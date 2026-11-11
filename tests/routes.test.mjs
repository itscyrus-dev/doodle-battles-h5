// 行军路线、驻守和遗物效果的规则测试。
import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle, unitDef } from '../src/engine.mjs';
import { TYPES, W, H, MARGIN } from '../src/data.mjs';
import { shapeRoute, fitRoute, ROUTE } from '../src/routes.mjs';
import { runMods } from '../src/stickers.mjs';
import { center } from '../src/combat.mjs';

const sandbox = (blue, red, mods) => { const g = new Battle({ index: -1, budget: 999, enemies: [], rocks: [] }, { sandbox: true, mods }); for (const [t, x, y] of blue) assert.equal(g.place(t, x, y, 0), true); for (const [t, x, y] of red) assert.equal(g.place(t, x, y, 1), true); return g; };
const run = (g, steps = 4805) => { for (let i = 0; i < steps && g.phase === 'battle'; i++) g.update(1 / 60); return g; };
const line = (a, b, n = 30) => Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n }));

test('画出的轨迹按间距取点、去掉抖动，并限制点数和总长', () => {
  const wobbly = Array.from({ length: 200 }, (_, i) => ({ x: 100 + i * 2, y: 300 + (i % 2 ? 1.5 : -1.5) }));
  const r = shapeRoute(wobbly);
  assert.ok(r.length >= 2 && r.length <= ROUTE.maxPoints);
  assert.ok(r.every(p => Math.abs(p.y - 300) <= 2), '直线上的抖动被去掉');
  assert.equal(r.at(-1).x, wobbly.at(-1).x, '终点保留');
  const long = shapeRoute(line({ x: 0, y: 100 }, { x: 4000, y: 100 }, 400));
  assert.ok(long.at(-1).x <= ROUTE.maxLength + 16, '太长的路线被截断');
  assert.deepEqual(shapeRoute([{ x: 1, y: 1 }]), []);
  assert.deepEqual(shapeRoute(null), []);
});

test('套用路线时限制在战场内、推出障碍，太短的路线不算数', () => {
  const rocks = [{ x: 400, y: 300, r: 40 }];
  const r = fitRoute({ x: 200, y: 300 }, [{ x: 300, y: 300 }, { x: 400, y: 300 }, { x: 900, y: -50 }], 0, 0, rocks, 11);
  assert.ok(r.every(p => p.x >= MARGIN.side && p.x <= W - MARGIN.side && p.y >= MARGIN.top - 5 && p.y <= H - MARGIN.bottom));
  assert.ok(r.every(p => Math.hypot(p.x - 400, p.y - 300) >= 40 + 11), '路点不会落在石头里');
  assert.deepEqual(fitRoute({ x: 200, y: 300 }, [{ x: 205, y: 302 }, { x: 210, y: 300 }], 0, 0, [], 11), []);
});

test('一笔路线可以同时给一组士兵，各自平移保持队形；撤销会恢复', () => {
  const g = sandbox([['knight', 200, 200], ['knight', 200, 260], ['archer', 120, 230]], [['guard', 600, 300]]);
  const [a, b, c] = g.plan;
  assert.equal(g.setRoute([a.pid, b.pid], line({ x: 200, y: 200 }, { x: 420, y: 120 }), a.pid), 2);
  assert.ok(a.route && b.route && !c.route);
  assert.equal(b.route.at(-1).y - a.route.at(-1).y, 60, '第二人的终点保持相对位置');
  g.move(a.pid, 220, 200); assert.equal(a.route.at(-1).x, 440, '移动士兵时路线跟着平移');
  g.undo(); assert.equal(g.plan[0].x, 200); g.undo(); assert.equal(g.plan[0].route, undefined);
  assert.equal(g.setHold([c.pid], true), true); assert.equal(g.plan[2].hold, true);
  assert.equal(g.clearOrders([c.pid]), true); assert.equal(g.plan[2].hold, undefined);
});

test('沿路线行军：照着画的路线走，路上不追远处的敌人，走完后照常寻敌', () => {
  const g = sandbox([['knight', 150, 300]], [['archer', 600, 300]]);
  const pid = g.plan[0].pid, route = line({ x: 150, y: 300 }, { x: 150, y: 110 }).concat(line({ x: 150, y: 110 }, { x: 520, y: 110 }));
  assert.equal(g.setRoute([pid], route, pid), 1);
  g.start(); const k = g.units[0], foe = g.units[1]; foe.cool = 999;
  let minY = 999, maxXbeforeTop = 0;
  for (let i = 0; i < 1200 && k.leg < k.route.length; i++) { g.update(1 / 60); minY = Math.min(minY, k.y); if (k.y > 140) maxXbeforeTop = Math.max(maxXbeforeTop, k.x); }
  assert.ok(minY < 130, '先往上走到路线顶部');
  assert.ok(maxXbeforeTop < 200, '没有直接冲向敌人');
  assert.equal(k.leg, k.route.length, '路线走完');
  run(g, 900); assert.ok(foe.hp < foe.max, '走完路线后去打敌人');
});

test('行军途中射程内出现敌人会停下攻击；驻守的士兵原地只打射程内的敌人', () => {
  const g = sandbox([['archer', 150, 300]], [['guard', 400, 300]]);
  const pid = g.plan[0].pid; g.setRoute([pid], line({ x: 150, y: 300 }, { x: 650, y: 300 }), pid);
  g.start(); const a = g.units[0], foe = g.units[1]; foe.cool = 999; foe.def.speed = 0;
  run(g, 240); assert.ok(foe.hp < foe.max, '路上射击射程内的敌人');
  assert.ok(a.x < foe.x - 60, '停在射程边上，没有一路走到敌人身边');
  const h = sandbox([['archer', 150, 300]], [['guard', 600, 300]]); h.setHold([h.plan[0].pid], true); h.start();
  h.units[1].cool = 999; h.units[1].def.speed = 0;
  run(h, 300); assert.equal(h.units[0].x, 150, '驻守的弓手不前进'); assert.equal(h.units[1].hp, h.units[1].max, '够不着就不打');
});

test('驻守的医师只治疗够得着的人；没有命令的兵种行为不变', () => {
  const g = sandbox([['healer', 120, 300], ['knight', 160, 300], ['knight', 330, 300]], [['knight', 650, 120]]);
  g.setHold([g.plan[0].pid], true); g.start();
  const [healer, near, far, foe] = g.units; foe.cool = 999; foe.def.speed = 0;
  near.hp = 40; far.hp = 40; near.def.speed = 0; far.def.speed = 0;
  run(g, 120);
  assert.ok(near.hp > 40, '射程内的队友得到治疗'); assert.equal(far.hp, 40, '射程外的不治疗'); assert.equal(healer.x, 120, '医师没有离开驻守点');
});

test('空的战斗修正不改变任何结果', () => {
  const play = mods => { const g = new Battle(3, { mods }); for (const [t, x, y] of [['guard', 300, 200], ['guard', 300, 340], ['bomber', 180, 270], ['knight', 290, 130], ['archer', 170, 420]]) g.place(t, x, y); g.start(); run(g); return [g.phase, g.elapsed.toFixed(4), g.units.map(u => Math.round(u.hp * 100))]; };
  assert.deepEqual(play(runMods({})), play(null));
  assert.ok(center({ x: 0, y: 0, type: 'knight' }).y < 0);
});
