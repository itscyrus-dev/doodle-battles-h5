// 新手教学：每一课照着教的做都能赢；第一课照着引导线画活下来的人最多；画了路线打到后排会弹出“突袭后排”。
import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle, TACTICS } from '../src/engine.mjs';
import { TIME_LIMIT } from '../src/data.mjs';
import { LESSONS, lessonCtx } from '../src/tutorial.mjs';

function setup(index) {
  const ctx = lessonCtx(index), g = new Battle(ctx.def, { mods: ctx.mods, item: null, cards: true, refund: ctx.refund });
  for (const sq of ctx.lesson.squads) assert.equal(g.placeSquad({ card: sq.card, type: sq.type, n: sq.n, kw: [], ink: 0 }, sq.x, sq.y), '');
  return { ctx, g };
}
function fight(g, onTick = null) {
  assert.equal(g.start(), true);
  for (let i = 0; i < TIME_LIMIT * 60 + 5 && g.phase === 'battle'; i++) { onTick?.(g, i); g.update(1 / 60); }
  return { won: g.phase === 'won', alive: g.units.filter(u => u.team === 0 && u.hp > 0).length, time: g.elapsed };
}
const dense = pts => { const out = [pts[0]]; for (let i = 1; i < pts.length; i++) { const p = pts[i - 1], q = pts[i], n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 20)); for (let k = 1; k <= n; k++) out.push({ x: p.x + (q.x - p.x) * k / n, y: p.y + (q.y - p.y) * k / n }); } return out; };
const play = (g, hand, id, x, y) => { const c = hand.find(h => h.id === id); return g.placeSquad({ card: c.index, type: c.type, n: c.n, kw: c.kw, ink: c.cost }, x, y); };

test('教学有三课，依次教画路线、出牌、打战术牌；越界的课号会被拉回范围内', () => {
  assert.deepEqual(LESSONS.map(l => l.id), ['route', 'cards', 'tactics']);
  assert.equal(lessonCtx(99).lesson.id, 'tactics'); assert.equal(lessonCtx(-3).lesson.id, 'route');
  assert.equal(lessonCtx(0).refund, null, '第一课没有墨水');
  assert.ok(lessonCtx(2).hand.some(c => c.kind === 'tactic') && lessonCtx(2).def.budget - lessonCtx(2).hand.filter(c => c.kind === 'unit').reduce((s, c) => s + c.cost, 0) >= lessonCtx(2).hand.find(c => c.kind === 'tactic').cost, '第三课放完兵牌还够打一张战术牌');
});

test('第一课：照着引导线画，四个人全活，并且弹出“突袭后排”；直线冲也能赢，但活得少', () => {
  const guided = setup(0), pids = guided.g.plan.map(u => u.pid);
  assert.equal(guided.g.setRoute(pids, dense(guided.ctx.lesson.guide), pids[0]), 4);
  let shouts = 0; const result = fight(guided.g, g => { shouts += g.events.filter(e => e === 'shout').length; g.events.length = 0; });
  assert.ok(result.won && result.alive === 4 && result.time < 20, JSON.stringify(result)); assert.ok(shouts >= 1, '打到后排时有大字');
  const straight = setup(0), ids = straight.g.plan.map(u => u.pid);
  straight.g.setRoute(ids, dense([{ x: 280, y: 300 }, { x: 600, y: 300 }]), ids[0]);
  const plain = fight(straight.g); assert.ok(plain.won && plain.alive < result.alive, JSON.stringify(plain));
});

test('第二课：两张兵牌都放下就能赢，只放一张会输', () => {
  const both = setup(1);
  assert.equal(play(both.g, both.ctx.hand, 'knights', 300, 300), ''); assert.equal(play(both.g, both.ctx.hand, 'archers', 200, 300), '');
  assert.ok(fight(both.g).won);
  const one = setup(1); play(one.g, one.ctx.hand, 'knights', 300, 300);
  assert.equal(fight(one.g).won, false);
});

test('第三课：留下的墨水开战后打落雷，砸中一群敌人；击倒敌人返还墨水', () => {
  const { ctx, g } = setup(2), thunder = ctx.hand.find(c => c.kind === 'tactic');
  play(g, ctx.hand, 'guards', 300, 300); play(g, ctx.hand, 'archers', 200, 300);
  assert.equal(g.remaining, thunder.cost);
  let cast = false;
  const result = fight(g, (g, i) => {
    if (cast || i % 6) return;
    const foes = g.units.filter(u => u.team === 1 && u.hp > 0), best = foes.map(u => ({ u, n: foes.filter(v => Math.hypot(u.x - v.x, u.y - v.y) <= TACTICS.thunder.radius).length })).sort((a, b) => b.n - a.n)[0];
    if (best && best.n >= 3) cast = g.cast(thunder.effect, { cost: thunder.cost, point: { x: best.u.x, y: best.u.y } });
  });
  assert.ok(cast && result.won && result.alive >= 3, JSON.stringify(result)); assert.ok(g.relicStats.refunded > 0);
});
