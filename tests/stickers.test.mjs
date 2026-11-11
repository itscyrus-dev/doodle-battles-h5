// 贴纸测试：每张贴纸在模拟里的效果、布阵预览用的几何判断，以及远征里的贴纸栏、贴纸包、卖掉、换下和旧存档迁移。
import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle, TACTICS } from '../src/engine.mjs';
import { TYPES } from '../src/data.mjs';
import { REFUND, cardStats } from '../src/cards.mjs';
import { STICKERS, STICKER_ORDER, STICKER_SLOTS, STICKER_FX, SELL, TIERS, runMods, squadLines, haulBonus, lassoed, crossings, loopOf, diceRoll, trailOf, onTrail, snowballBonus } from '../src/stickers.mjs';
import { newRun, available, enter, finishBattle, choose, buy, takeFromPack, sellSticker, stickerChoices, normalizeRun, resolveEvent, eventChoices, nodeOf, makeMap, WARBANDS, PRICES } from '../src/run.mjs';
import { rng } from '../src/encounters.mjs';

const field = (enemies, stickers = [], extra = {}) => new Battle({ index: -1, budget: 300, enemies, rocks: [], par: 40 }, { cards: true, refund: REFUND, item: null, mods: runMods({ stickers, ...extra }) });
const foe = (type, x, y) => ({ type, x, y, team: 1 });
const squad = (card, type, n, ink = 0) => ({ card, type, n, kw: [], ink });
const line = (a, b, n = 8) => Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n }));
const route = (g, card, points) => { const pids = g.plan.filter(u => u.card === card).map(u => u.pid); return g.setRoute(pids, points, pids[0]); };
const still = u => { u.cool = 999; u.def.speed = 0; };
// 记下某个单位每次掉的血。
function hitsOn(g, target, frames, want = 2) {
  let hp = target.hp; const hits = [];
  for (let i = 0; i < frames && hits.length < want && g.phase === 'battle'; i++) { g.update(1 / 60); if (target.hp < hp) { hits.push(hp - target.hp); hp = target.hp; } }
  return hits;
}

test('贴纸数据：12 张，一半和画线有关，三档稀有度都有卖价；三个编制各带一张起始贴纸', () => {
  assert.equal(STICKER_ORDER.length, 12);
  assert.equal(STICKER_ORDER.filter(id => STICKERS[id].route).length, 6);
  for (const tier of TIERS) { assert.ok(STICKER_ORDER.some(id => STICKERS[id].tier === tier), tier); assert.ok(SELL[tier] > 0); }
  for (const wb of Object.values(WARBANDS)) assert.ok(wb.stickers.length === 1 && STICKERS[wb.stickers[0]]);
  assert.equal(STICKER_SLOTS, 5);
});

test('长途奔袭：走完路线后的第一击按路线长度加成，只加一次；路线越长加得越多，有上限', () => {
  assert.equal(haulBonus(100), STICKER_FX.longhaul.step); assert.equal(haulBonus(5000), STICKER_FX.longhaul.max); assert.ok(haulBonus(300) > haulBonus(150));
  const strike = (stickers, length) => {
    const g = field([foe('giant', 300 + length + 90, 300)], stickers);
    g.placeSquad(squad(0, 'knight', 1), 300, 300); route(g, 0, line({ x: 300, y: 300 }, { x: 300 + length, y: 300 })); g.start();
    const giant = g.units.find(u => u.team === 1); still(giant);
    return { g, hits: hitsOn(g, giant, 1200), knight: g.units[0] };
  };
  const long = strike(['longhaul'], 260), short = strike(['longhaul'], 120), plain = strike([], 260);
  const dmg = TYPES.knight.damage;
  assert.ok(Math.abs(long.hits[0] - dmg * (1 + haulBonus(long.knight.routeLen))) < 1e-6, `长线首击 ${long.hits[0]}`);
  assert.equal(long.hits[1], dmg, '第二击不再加成');
  assert.ok(long.hits[0] > short.hits[0], '路线越长越疼'); assert.equal(plain.hits[0], dmg, '没贴纸不加成');
  assert.equal(long.g.tally.stickers.longhaul, 1);
});

test('圈出目标：首尾相接的路线圈住的敌人受到的伤害 ×1.5；没圈住的、没闭合的都不算', () => {
  const loop = [{ x: 300, y: 300 }, { x: 420, y: 190 }, { x: 610, y: 190 }, { x: 610, y: 410 }, { x: 420, y: 410 }, { x: 312, y: 310 }];
  assert.ok(loopOf(loop)); assert.equal(loopOf(loop.slice(0, -1)), null, '没回到起点不算圈');
  const g = field([foe('knight', 500, 300), foe('knight', 660, 520)], ['lasso']);
  g.placeSquad(squad(0, 'knight', 1), 300, 300); route(g, 0, loop); g.start();
  const [inside, outside] = g.units.filter(u => u.team === 1), me = g.units[0];
  assert.equal(inside.marked, true); assert.equal(outside.marked, false);
  const a = inside.hp; g.hit(inside, 10, me); assert.ok(Math.abs(a - inside.hp - 10 * STICKER_FX.lasso.mult) < 1e-9);
  const b = outside.hp; g.hit(outside, 10, me); assert.equal(b - outside.hp, 10);
  assert.equal(g.tally.stickers.lasso, 1);
  assert.deepEqual(lassoed(squadLines(g.plan), g.enemy).map(e => e.x), [500], '布阵预览和开战结果一致');
});

test('交叉引爆：两支小队的路线交叉处在开战后炸开，炸到附近的敌人；不交叉就没有', () => {
  const cross = stickers => {
    const g = field([foe('knight', 460, 300), foe('knight', 660, 540)], stickers);
    g.placeSquad(squad(0, 'knight', 1), 300, 200); g.placeSquad(squad(1, 'knight', 1), 300, 400);
    route(g, 0, line({ x: 300, y: 200 }, { x: 620, y: 400 })); route(g, 1, line({ x: 300, y: 400 }, { x: 620, y: 200 }));
    return g;
  };
  const points = crossings(squadLines(cross(['cross']).plan));
  assert.equal(points.length, 1); assert.ok(Math.abs(points[0].x - 460) < 3 && Math.abs(points[0].y - 300) < 3, JSON.stringify(points));
  const g = cross(['cross']); g.start();
  const [near, far] = g.units.filter(u => u.team === 1); still(near); still(far);
  const hp = near.hp, hpFar = far.hp;
  for (let i = 0; i < Math.ceil(STICKER_FX.cross.delay * 60) + 2; i++) g.update(1 / 60);
  assert.equal(hp - near.hp, STICKER_FX.cross.damage); assert.equal(far.hp, hpFar);
  assert.equal(g.tally.stickers.cross, 1);
  const none = cross([]); none.start(); assert.equal(none.pending.length, 0, '没贴纸就不炸');
  assert.equal(crossings([{ key: 0, pts: line({ x: 0, y: 0 }, { x: 100, y: 0 }) }, { key: 1, pts: line({ x: 0, y: 50 }, { x: 100, y: 50 }) }]).length, 0);
});

test('墨迹陷阱：敌人踩在我方路线留下的墨迹上移速减半', () => {
  const walk = stickers => {
    const g = field([foe('knight', 640, 300)], stickers);
    g.placeSquad(squad(0, 'knight', 1), 300, 300); route(g, 0, line({ x: 300, y: 300 }, { x: 660, y: 300 })); g.start();
    const enemy = g.units.find(u => u.team === 1), x0 = enemy.x;
    for (let i = 0; i < 20; i++) g.update(1 / 60);
    return { g, moved: x0 - enemy.x };
  };
  const wet = walk(['trail']), dry = walk([]);
  assert.ok(Math.abs(wet.moved / dry.moved - STICKER_FX.trail.slow) < .05, `墨迹减速 ${wet.moved / dry.moved}`);
  assert.equal(wet.g.tally.stickers.trail, 1);
  assert.ok(onTrail({ x: 400, y: 305 }, trailOf(squadLines(wet.g.plan)))); assert.ok(!onTrail({ x: 400, y: 360 }, trailOf(squadLines(wet.g.plan))));
});

test('疾行：行军时移速 ×1.4，路上不停下交战，走完路线才动手', () => {
  const march = stickers => {
    const g = field([foe('guard', 690, 540)], stickers);
    g.placeSquad(squad(0, 'knight', 1), 100, 300); route(g, 0, line({ x: 100, y: 300 }, { x: 330, y: 300 })); g.start();
    still(g.units.find(u => u.team === 1)); for (let i = 0; i < 60; i++) g.update(1 / 60);
    return g.units[0].x - 100;
  };
  assert.ok(Math.abs(march(['swift']) / march([]) - STICKER_FX.swift.speed) < .03);
  const pass = stickers => {
    const g = field([foe('guard', 430, 318)], stickers);
    g.placeSquad(squad(0, 'knight', 1), 300, 300); route(g, 0, line({ x: 300, y: 300 }, { x: 620, y: 300 })); g.start();
    const guard = g.units.find(u => u.team === 1); still(guard); const hp = guard.hp;
    for (let i = 0; i < 150; i++) g.update(1 / 60);
    return { hurt: hp - guard.hp, x: g.units[0].x };
  };
  const plain = pass([]), swift = pass(['swift']);
  assert.ok(plain.hurt > 0, '没贴纸时路过会停下来打'); assert.equal(swift.hurt, 0, '疾行一路不停'); assert.ok(swift.x > 445 && swift.x > plain.x + 25, `疾行走到了 ${swift.x}，停下来打的走到 ${plain.x}`);
});

test('埋伏：没画线的小队原地不动、敌人看不见，敌人走近才现身；第一击 ×2.5', () => {
  const g = field([foe('knight', 640, 300)], ['ambush']);
  g.placeSquad(squad(0, 'knight', 1), 300, 300); g.start();
  const me = g.units[0], enemy = g.units.find(u => u.team === 1);
  me.cool = 0; assert.equal(me.hidden, true); assert.equal(me.hold, true);
  enemy.cool = 999;
  let hp = enemy.hp, first = null, revealedAt = null, waitedAt = null;
  for (let i = 0; i < 900 && first === null; i++) {
    g.update(1 / 60);
    if (revealedAt === null && !me.hidden) { revealedAt = Math.hypot(enemy.x - me.x, enemy.y - me.y); waitedAt = me.x; }
    if (enemy.hp < hp) first = hp - enemy.hp;
  }
  assert.ok(Math.abs(waitedAt - 300) < 8, `现身之前原地埋伏，没有往前冲（${waitedAt}）`);
  assert.ok(revealedAt !== null && revealedAt <= STICKER_FX.ambush.reveal + 4, `现身距离 ${revealedAt}`);
  assert.ok(Math.abs(first - TYPES.knight.damage * STICKER_FX.ambush.mult) < 1e-6, `第一击 ${first}`);
  assert.equal(g.tally.stickers.ambush, 1);
  // 敌人一直不过来：等够时间就放弃埋伏出击，没有第一击加成。
  const idle = field([foe('archer', 660, 300)], ['ambush']); idle.placeSquad(squad(0, 'knight', 1), 300, 300); idle.start();
  const lurker = idle.units[0]; still(idle.units.find(u => u.team === 1));
  for (let i = 0; i < (STICKER_FX.ambush.wait + 1.5) * 60; i++) idle.update(1 / 60);
  assert.equal(lurker.hidden, false); assert.equal(lurker.ambush, false); assert.equal(lurker.hold, false); assert.ok(lurker.x > 330, `出击了 ${lurker.x}`);
  assert.equal(me.hold, false, '现身以后不再死守原地');
  const routed = field([foe('knight', 640, 300)], ['ambush']); routed.placeSquad(squad(0, 'knight', 1), 300, 300); route(routed, 0, line({ x: 300, y: 300 }, { x: 400, y: 300 })); routed.start();
  assert.equal(routed.units[0].hidden, false, '画了线的小队不埋伏');
});

test('孤军：只打出一张兵牌时生命 ×3、伤害 ×2；两张牌就没有', () => {
  const one = field([foe('knight', 640, 300)], ['lone']); one.placeSquad(squad(0, 'knight', 2), 300, 300); one.start();
  for (const u of one.units.filter(u => u.team === 0)) { assert.equal(u.max, TYPES.knight.hp * STICKER_FX.lone.hp); assert.equal(u.def.damage, TYPES.knight.damage * STICKER_FX.lone.damage); }
  assert.equal(one.tally.stickers.lone, 1);
  const two = field([foe('knight', 640, 300)], ['lone']); two.placeSquad(squad(0, 'knight', 1), 300, 200); two.placeSquad(squad(1, 'archer', 1), 200, 400); two.start();
  assert.equal(two.units[0].max, TYPES.knight.hp); assert.equal(two.tally.stickers.lone, undefined);
});

test('掷骰子：同一套布阵结果固定；一支小队人数翻倍，另一支撤下、墨水退回；只有一支时只翻倍', () => {
  const build = () => { const g = field([foe('knight', 640, 300)], ['dice']); g.placeSquad(squad(0, 'knight', 2, 30), 300, 160); g.placeSquad(squad(1, 'archer', 2, 40), 200, 420); return g; };
  const roll = diceRoll(build().plan);
  assert.deepEqual(diceRoll(build().plan), roll, '同样的站位掷出同样的结果');
  const g = build(), left = g.remaining; g.start();
  const count = card => g.units.filter(u => u.team === 0 && u.card === card).length;
  assert.equal(count(roll.double), 4); assert.equal(count(roll.drop), 0);
  assert.equal(g.remaining, left + (roll.drop === 0 ? 30 : 40), '撤下的那支墨水退回');
  assert.equal(g.tally.stickers.dice, 2, '翻倍和撤下各弹一次');
  const solo = field([foe('knight', 640, 300)], ['dice']); solo.placeSquad(squad(0, 'knight', 2), 300, 300); solo.start();
  assert.equal(solo.units.filter(u => u.team === 0).length, 4);
  assert.equal(new Set(solo.units.map(u => u.id)).size, solo.units.length, '新补上的士兵编号不重复');
});

test('回声：每场第一张战术牌生效两次，之后照常', () => {
  const g = field([foe('knight', 640, 300)], ['echo']); g.placeSquad(squad(0, 'knight', 2), 300, 300); g.start();
  assert.equal(g.cast('shield', { cost: 0 }), true);
  assert.ok(g.units.filter(u => u.team === 0).every(u => u.shield === TACTICS.shield.amount * 2), '护盾叠了两层');
  assert.equal(g.cast('thunder', { cost: 0, point: { x: 600, y: 300 } }), true); assert.equal(g.pending.length, 1, '第二张不再回声');
  assert.equal(g.tally.stickers.echo, 1);
  const h = field([foe('knight', 640, 300)], ['echo']); h.placeSquad(squad(0, 'knight', 1), 300, 300); h.start();
  h.cast('thunder', { cost: 0, point: { x: 600, y: 300 } }); assert.equal(h.pending.length, 2, '落雷劈两次');
  const r = field([foe('knight', 640, 300)], ['echo']); r.placeSquad(squad(0, 'knight', 1), 300, 300); r.start();
  r.cast('rally', { cost: 0 }); assert.equal(r.effects.rally, TACTICS.rally.duration * 2, '持续类加倍时长');
});

test('存墨：开战时剩下的墨水越多伤害越高，有上限；滚雪球按这局攒下的击倒数加伤', () => {
  const g = field([foe('knight', 640, 300)], ['savings']); g.placeSquad(squad(0, 'knight', 1, 40), 300, 300); g.start();
  const bonus = 1 + Math.min(STICKER_FX.savings.max, Math.floor(260 / STICKER_FX.savings.per) * .01);
  assert.ok(Math.abs(g.units[0].def.damage - TYPES.knight.damage * bonus) < 1e-9); assert.equal(g.tally.stickers.savings, 1);
  assert.equal(snowballBonus(30), 30 * STICKER_FX.snowball.step); assert.equal(snowballBonus(1000), STICKER_FX.snowball.max);
  const s = field([foe('knight', 640, 300)], ['snowball'], { snowball: 20 }); s.placeSquad(squad(0, 'knight', 1), 300, 300); s.start();
  assert.ok(Math.abs(s.units[0].def.damage - TYPES.knight.damage * (1 + snowballBonus(20))) < 1e-9); assert.equal(s.tally.stickers.snowball, 1);
  const run = newRun({ seed: 3 }); run.stickers.push('snowball');
  enter(run, available(run)[0]); finishBattle(run, { won: true, survivors: 2, deployed: 3, stars: 1, kills: 7, tactics: 0, plan: [] });
  assert.equal(run.snowball, 7, '贴着滚雪球时击倒数累计');
  const plain = newRun({ seed: 3 }); enter(plain, available(plain)[0]); finishBattle(plain, { won: true, survivors: 2, deployed: 3, stars: 1, kills: 7, tactics: 0, plan: [] });
  assert.equal(plain.snowball, 0);
});

test('人海：小队牌多 2 人并带上“人海”关键词，这些人生命和伤害打折；单人牌不受影响；出战上限 +6', () => {
  const mods = runMods({ stickers: ['horde'] }, null, 14);
  assert.equal(mods.teamLimit, 14 + STICKER_FX.horde.team); assert.equal(mods.all.hp, undefined, '不再整体打折');
  const crowd = cardStats({ id: 'knights', up: false }, { horde: true }); assert.ok(crowd.kw.includes('crowd'));
  assert.ok(!cardStats({ id: 'giant', up: false }, { horde: true }).kw.includes('crowd'), '单人牌没有人海');
  const g = field([foe('knight', 640, 300)], ['horde']); g.placeSquad({ card: 0, type: 'knight', n: crowd.n, kw: crowd.kw, ink: 0 }, 300, 300); g.placeSquad(squad(1, 'giant', 1), 200, 420); g.start();
  const knight = g.units.find(u => u.type === 'knight'), giant = g.units.find(u => u.type === 'giant');
  assert.equal(g.units.filter(u => u.team === 0 && u.type === 'knight').length, 5);
  assert.ok(Math.abs(knight.max - TYPES.knight.hp * STICKER_FX.horde.hp) < 1e-9 && Math.abs(knight.def.damage - TYPES.knight.damage * STICKER_FX.horde.damage) < 1e-9);
  assert.equal(giant.max, TYPES.giant.hp);
});

test('贴纸栏：最多 5 张，不能重复；满了要指定换下哪一张，换下的按卖价折成金币；地图上可以卖掉', () => {
  const run = newRun({ seed: 9 }); run.screen = 'reward';
  run.stickers = ['longhaul', 'lasso', 'trail', 'swift', 'ambush']; run.coins = 0;
  run.pending = { kind: 'elite', options: [{ kind: 'sticker', id: 'dice' }, { kind: 'sticker', id: 'lasso' }] };
  assert.equal(choose(run, 0), false, '满了不指定就领不了'); assert.equal(run.screen, 'reward');
  assert.equal(choose(run, 0, 1), true); assert.deepEqual(run.stickers, ['longhaul', 'dice', 'trail', 'swift', 'ambush']); assert.equal(run.coins, SELL.rare);
  const dup = newRun({ seed: 9 }); dup.screen = 'reward'; dup.pending = { kind: 'elite', options: [{ kind: 'sticker', id: dup.stickers[0] }] };
  assert.equal(choose(dup, 0), false, '已有的贴纸不能再贴');
  const map = newRun({ seed: 9 }); map.stickers.push('lone'); const coins = map.coins;
  assert.equal(sellSticker(map, 1), true); assert.deepEqual(map.stickers, ['longhaul']); assert.equal(map.coins, coins + SELL.legend);
  map.screen = 'shop'; assert.equal(sellSticker(map, 0), false, '只能在地图上卖');
});

test('贴纸包：三张不重复、不给已有的；稀有度按概率；精英、首领和宝箱给贴纸包', () => {
  const run = newRun({ seed: 2 });
  for (let s = 1; s < 40; s++) {
    const pack = stickerChoices(run, 3, rng(s), { rare: .3, legend: .1 });
    assert.equal(pack.length, 3); assert.equal(new Set(pack.map(o => o.id)).size, 3); assert.ok(pack.every(o => o.kind === 'sticker' && !run.stickers.includes(o.id)));
  }
  assert.ok(stickerChoices(run, 3, rng(5), { rare: 0, legend: 1 }).every(o => STICKERS[o.id].tier === 'legend'));
  assert.ok(stickerChoices(run, 3, rng(5), { rare: 0, legend: 0 }).every(o => STICKERS[o.id].tier === 'common'));
  const full = newRun({ seed: 2 }); full.stickers = [...STICKER_ORDER].slice(0, 5); assert.ok(stickerChoices(full, 3, rng(1), { rare: 0, legend: 1 }).every(o => !full.stickers.includes(o.id)));
  const map = makeMap(77, 0), treasure = map.rows.flat().find(n => n.kind === 'treasure');
  if (treasure) {
    const r = newRun({ seed: 77 }); r.at = map.rows[treasure.row - 1]?.find(n => n.next.includes(treasure.id))?.id ?? null;
    if (r.at === null || available(r).includes(treasure.id)) { enter(r, treasure.id); assert.equal(r.pending.kind, 'treasure'); assert.ok(r.pending.options.every(o => o.kind === 'sticker')); }
  }
});

test('军需官的贴纸包：进店就定好内容；买下后挑一张或都不要，只能开一次', () => {
  const map = makeMap(31, 0), shop = map.rows.flat().find(n => n.kind === 'shop');
  const run = newRun({ seed: 31 }); run.coins = 500;
  run.at = map.rows[shop.row - 1].find(n => n.next.includes(shop.id)).id;
  enter(run, shop.id);
  const i = run.pending.stock.findIndex(s => s.kind === 'pack'), pack = run.pending.stock[i];
  assert.ok(i >= 0 && pack.contents.length === 3 && pack.price === PRICES.pack);
  assert.equal(takeFromPack(run, i, 0), false, '没买不能开');
  assert.equal(buy(run, i), true); assert.equal(run.coins, 500 - PRICES.pack); assert.equal(pack.sold, true); assert.equal(pack.taken, false);
  assert.equal(takeFromPack(run, i, 1), true); assert.ok(run.stickers.includes(pack.contents[1])); assert.equal(pack.taken, true);
  assert.equal(takeFromPack(run, i, 0), false, '只能开一次');
  assert.equal(buy(run, i), false, '卖完了');
});

test('神龛：献一颗心换贴纸；贴纸栏满了要指定换下一张', () => {
  const r = newRun({ seed: 41 }); r.screen = 'event'; r.pending = { event: 'shrine', sticker: 'snowball' };
  r.stickers = ['longhaul', 'lasso', 'trail', 'swift', 'ambush'];
  assert.ok(eventChoices(r).find(c => c.id === 'pray').ok);
  assert.equal(resolveEvent(r, 'pray'), false, '满了不指定就换不了'); assert.equal(r.hearts, 3);
  assert.equal(resolveEvent(r, 'pray', 0), true); assert.equal(r.hearts, 2); assert.equal(r.stickers[0], 'snowball');
});

test('旧存档的遗物换成贴纸：有对应的换过来，其余折成金币；待领的遗物奖励和商店里的遗物也换掉', () => {
  const run = newRun({ seed: 8 }), old = structuredClone(run);
  delete old.stickers; delete old.snowball; old.relics = ['charge', 'thick', 'bleed', 'fervor']; old.coins = 10;
  old.screen = 'reward'; old.pending = { kind: 'elite', coins: 30, options: [{ kind: 'relic', id: 'swift' }, { kind: 'relic', id: 'sharp' }] };
  const r = normalizeRun(old);
  assert.ok(r, '能读出来'); assert.deepEqual(r.stickers, ['longhaul', 'trail', 'snowball']); assert.equal(r.coins, 10 + 30, '没有对应贴纸的遗物折成金币');
  assert.deepEqual(r.pending.options, [{ kind: 'sticker', id: 'swift' }, { kind: 'coins', n: 40 }]);
  const shop = structuredClone(run); delete shop.stickers; shop.relics = []; shop.screen = 'shop';
  shop.pending = { stock: [{ kind: 'relic', id: 'charge', price: 80, sold: false }, { kind: 'relic', id: 'thick', price: 80, sold: false }] };
  const s = normalizeRun(shop);
  assert.deepEqual(s.pending.stock.map(x => [x.kind, x.contents.join(), x.sold]), [['pack', 'longhaul', false], ['pack', '', true]]);
});
