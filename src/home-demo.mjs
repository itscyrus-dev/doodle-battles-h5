// 主页上循环播放的演示：一支“笔”画出路线，先锋沿线绕过石头打掉弓手。三秒内看懂这个游戏在玩什么。
// 用真的战斗模拟和渲染器，内容和新手教学第一课一样。
import { Battle } from './engine.mjs';
import { Renderer } from './render.mjs';
import { LESSONS } from './tutorial.mjs';
import { t } from './i18n.mjs';

const lesson = LESSONS[0];
// 把引导线加密成每 18 像素一个点，画线动画和真正的路线都用它。
function dense(points) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1], q = points[i], n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 18));
    for (let k = 1; k <= n; k++) out.push({ x: p.x + (q.x - p.x) * k / n, y: p.y + (q.y - p.y) * k / n });
  }
  return out;
}
const ROUTE = dense(lesson.guide);

export function createDemo(canvas, { skin = 'blue', reduced = false } = {}) {
  const r = new Renderer(canvas);
  r.skin = skin; r.reduced = reduced; r.setTheme('meadow');
  r.words = { victory: t('battle.victory'), defeat: t('battle.defeat'), raid: t('battle.raid'), outflank: t('battle.outflank'), yourZone: '', enemyZone: '' };
  let g = null, start = 0, ended = 0, last = 0, acc = 0, raf = 0, stopped = false;
  function restart(now) {
    g = new Battle({ index: -1, budget: 0, enemies: lesson.enemies.map(u => ({ ...u })), rocks: lesson.rocks.map(o => ({ ...o })), par: 30 }, { cards: true, item: null });
    for (const sq of lesson.squads) g.placeSquad({ card: sq.card, type: sq.type, n: sq.n, kw: [], ink: 0 }, sq.x, sq.y);
    start = now; ended = 0; acc = 0; r.clearEffects(); r.sketch = null;
  }
  function frame(now) {
    if (stopped) return;
    if (!g) restart(now);
    const dt = Math.min(.05, (now - (last || now)) / 1000), age = (now - start) / 1000; last = now;
    if (g.phase === 'build') {
      // 0.5 秒后开始画线，1.7 秒画完，停一下再开战。
      const k = Math.max(0, Math.min(1, (age - .5) / 1.2));
      r.sketch = k > 0 ? { kind: 'route', points: ROUTE.slice(0, Math.max(2, Math.ceil(ROUTE.length * k))) } : null;
      if (age > 2.1) { r.sketch = null; const pids = g.plan.map(u => u.pid); g.setRoute(pids, ROUTE, pids[0]); g.start(); }
    } else if (g.phase === 'battle') {
      acc += dt; while (acc >= 1 / 60) { g.update(1 / 60); acc -= 1 / 60; }
      g.events.length = 0;
      if (g.phase !== 'battle') ended = now;
    } else {
      g.settle(dt * .5);
      if ((now - ended) / 1000 > 2.2) restart(now);
    }
    r.timeScale = 1;
    r.draw(g, now / 1000);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return { stop() { stopped = true; cancelAnimationFrame(raf); } };
}
