// 行军路线、驻守和遗物效果的规则测试。
import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle, unitDef, RELIC_FX } from '../src/engine.mjs';
import { TYPES, W, H, MARGIN } from '../src/data.mjs';
import { shapeRoute, fitRoute, ROUTE } from '../src/routes.mjs';
import { runMods, RELICS, UPGRADES } from '../src/relics.mjs';
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

test('遗物与精锐升级合成战斗修正：倍率叠乘、墨水打折、扩编', () => {
  const mods = runMods({ relics: ['thick', 'thrift', 'squad', 'longbow', 'swift'], upgrades: ['knight', 'archer'] }, { hp: 1.1 });
  const knight = unitDef('knight', 0, mods);
  assert.ok(Math.abs(knight.hp - TYPES.knight.hp * 1.15 * UPGRADES.knight.hp) < 1e-9);
  assert.ok(Math.abs(unitDef('archer', 0, mods).range - TYPES.archer.range * 1.15 * UPGRADES.archer.range) < 1e-9);
  assert.equal(unitDef('knight', 1, mods).hp, TYPES.knight.hp * 1.1, '敌军只吃敌军强化');
  assert.equal(mods.cost.giant, Math.round(TYPES.giant.cost * .9)); assert.equal(mods.teamLimit, 12); assert.equal(mods.flags.swift, true);
  assert.equal(new Battle(0, { mods }).cost('guard'), Math.round(TYPES.guard.cost * .9));
  const g = new Battle({ index: -1, budget: 999, enemies: [], rocks: [] }, { sandbox: true, mods });
  for (let i = 0; i < 11; i++) g.place(i < 5 ? 'knight' : i < 8 ? 'guard' : 'archer', 100 + (i % 4) * 60, 90 + Math.floor(i / 4) * 60);
  assert.ok(g.count(null) > 10, '扩编后可以上场超过 10 人');
  for (const id of Object.keys(RELICS)) assert.ok(['common', 'rare'].includes(RELICS[id].tier));
});

test('疾行墨让行军更快；冲锋墨让走完路线后的第一击翻倍', () => {
  const march = mods => { const g = sandbox([['knight', 100, 300]], [['guard', 680, 520]], mods); const pid = g.plan[0].pid; g.setRoute([pid], line({ x: 100, y: 300 }, { x: 330, y: 300 }), pid); g.start(); g.units[1].cool = 999; for (let i = 0; i < 60; i++) g.update(1 / 60); return g.units[0].x; };
  const base = march(null), fast = march(runMods({ relics: ['swift'] }));
  assert.ok(Math.abs((fast - 100) / (base - 100) - RELIC_FX.swift) < .02, `疾行倍率 ${(fast - 100) / (base - 100)}`);
  const g = sandbox([['knight', 300, 300]], [['giant', 420, 300]], runMods({ relics: ['charge'] }));
  const pid = g.plan[0].pid; g.setRoute([pid], line({ x: 300, y: 300 }, { x: 360, y: 300 }), pid); g.start();
  const giant = g.units[1]; giant.cool = 999; giant.def.speed = 0; let hp = giant.hp; const hits = [];
  for (let i = 0; i < 600 && hits.length < 2; i++) { g.update(1 / 60); if (giant.hp < hp) { hits.push(hp - giant.hp); hp = giant.hp; } }
  assert.ok(Math.abs(hits[0] - TYPES.knight.damage * RELIC_FX.charge) < 1e-9, `首击 ${hits[0]}`); assert.equal(hits[1], TYPES.knight.damage);
  assert.equal(g.relicStats.primed, 1);
});

test('侧击墨：从背后砍中加伤；坚守墨：驻守时受到的伤害减少', () => {
  const g = sandbox([['knight', 300, 300]], [['guard', 400, 300]], runMods({ relics: ['flank'] })); g.start();
  const [k, foe] = g.units; foe.angle = Math.PI; // 敌人面朝左
  k.x = 430; k.y = 300; k.angle = Math.PI; k.cool = 0; foe.cool = 999; foe.def.speed = 0; k.def.speed = 0;
  let hp = foe.hp; for (let i = 0; i < 120 && foe.hp === hp; i++) { g.update(1 / 60); foe.angle = Math.PI; }
  assert.ok(Math.abs(hp - foe.hp - TYPES.knight.damage * RELIC_FX.flank) < 1e-9, '从背后砍中'); assert.equal(g.relicStats.flanks, 1);
  const h = sandbox([['guard', 300, 300]], [['knight', 600, 300]], runMods({ relics: ['anchor'] })); h.setHold([h.plan[0].pid], true); h.start();
  const before = h.units[0].hp; h.hit(h.units[0], 10, h.units[1]); assert.ok(Math.abs(before - h.units[0].hp - 10 * RELIC_FX.anchor) < 1e-9);
});

test('墨晕留下减速墨潭；回春墨持续回血；余墨按剩余墨水加伤', () => {
  const slowed = relics => {
    const g = sandbox([['knight', 300, 300], ['knight', 100, 520]], [['knight', 620, 300]], runMods({ relics })); g.start();
    const [mine, , foe] = g.units; foe.cool = 999;
    g.hit(mine, 999, foe); foe.x = mine.x; foe.y = mine.y; const x0 = foe.x, y0 = foe.y;
    for (let i = 0; i < 10; i++) g.update(1 / 60);
    return { g, moved: Math.hypot(foe.x - x0, foe.y - y0) };
  };
  const wet = slowed(['bleed']), dry = slowed([]);
  assert.equal(wet.g.puddles.length, 1); assert.equal(dry.g.puddles.length, 0);
  assert.ok(Math.abs(wet.moved / dry.moved - RELIC_FX.bleed.slow) < .02, `墨潭减速 ${wet.moved / dry.moved}`);
  const h = sandbox([['knight', 300, 300]], [['knight', 620, 300]], runMods({ relics: ['spring'] })); h.start(); h.units[1].cool = 999;
  h.units[0].hp = 30; h.update(1 / 60); assert.ok(h.units[0].hp > 30, '回春墨回血'); assert.ok(h.relicStats.spring > 0);
  const echo = new Battle(0, { mods: runMods({ relics: ['echo'] }) }); echo.place('knight', 300, 300); echo.start();
  assert.ok(Math.abs(echo.echoBonus - (1 + Math.min(RELIC_FX.echo.max, Math.floor(80 / RELIC_FX.echo.per) * .01))) < 1e-9);
  assert.ok(Math.abs(echo.units[0].def.damage - TYPES.knight.damage * echo.echoBonus) < 1e-9);
});

test('空的战斗修正不改变任何结果', () => {
  const play = mods => { const g = new Battle(3, { mods }); for (const [t, x, y] of [['guard', 300, 200], ['guard', 300, 340], ['bomber', 180, 270], ['knight', 290, 130], ['archer', 170, 420]]) g.place(t, x, y); g.start(); run(g); return [g.phase, g.elapsed.toFixed(4), g.units.map(u => Math.round(u.hp * 100))]; };
  assert.deepEqual(play(runMods({})), play(null));
  assert.ok(center({ x: 0, y: 0, type: 'knight' }).y < 0);
});
