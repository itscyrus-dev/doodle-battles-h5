// 卡牌规则测试：卡牌数据、整队放置与收回、关键词、战术牌、战墨和卡牌遗物。
import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle, KEYWORDS, TACTICS, RELIC_FX } from '../src/engine.mjs';
import { TYPES, UNIT_ORDER, ZONE } from '../src/data.mjs';
import { CARDS, CARD_ORDER, STARTER_DECKS, KEYWORD_ORDER, TACTIC_ORDER, REFUND, cardStats } from '../src/cards.mjs';
import { runMods, relicPerks } from '../src/relics.mjs';

const field = (enemies = [], opts = {}) => new Battle({ index: -1, budget: 300, enemies, rocks: [], par: 40 }, { cards: true, refund: REFUND, item: null, ...opts });
const squad = (card, type, n, kw = [], ink = 0) => ({ card, type, n, kw, ink });
const run = (g, steps = 4805) => { for (let i = 0; i < steps && g.phase === 'battle'; i++) g.update(1 / 60); return g; };
const foe = (type, x, y, extra = {}) => ({ type, x, y, team: 1, ...extra });

test('卡牌数据完整：兵种、人数、关键词和战术都存在；起始牌库都是合法的牌', () => {
  for (const id of CARD_ORDER) {
    const c = CARDS[id];
    assert.ok(['unit', 'tactic'].includes(c.kind)); assert.ok(['common', 'uncommon', 'rare'].includes(c.rarity));
    if (c.kind === 'unit') { assert.ok(UNIT_ORDER.includes(c.type)); assert.ok(c.n >= 1 && c.n <= 4); assert.ok(c.cost >= TYPES[c.type].cost * c.n * .8); for (const k of c.kw || []) assert.ok(KEYWORD_ORDER.includes(k), k); }
    else { assert.ok(TACTIC_ORDER.includes(c.effect)); assert.ok(c.cost >= 5 && c.cost <= 40); }
  }
  for (const deck of Object.values(STARTER_DECKS)) assert.ok(deck.every(id => CARDS[id]));
  const up = cardStats({ id: 'knights', up: true }), base = cardStats({ id: 'knights', up: false });
  assert.equal(up.n, base.n + 1); assert.equal(up.cost, base.cost, '小队升级：多 1 人，墨水不变');
  const giant = cardStats({ id: 'giant', up: true }); assert.equal(giant.n, 1); assert.equal(giant.cost, Math.round(CARDS.giant.cost * .7), '单人牌升级：墨水 −30%');
  assert.equal(cardStats({ id: 'knights', up: false }, { horde: true }).n, base.n + 1, '人海：3 人以上的小队多 1 人');
  assert.equal(cardStats({ id: 'archers', up: false }, { horde: true }).n, 2);
  assert.equal(cardStats({ id: 't_frost', up: false }, { tactician: true }).cost, Math.round(CARDS.t_frost.cost * .7), '军师：战术牌便宜 30%');
  assert.equal(cardStats({ id: 'guards', up: false }, { thrift: true }).cost, Math.round(CARDS.guards.cost * .9));
  assert.deepEqual(relicPerks(['warcry', 'scholar', 'bounty']), { horde: false, tactician: false, thrift: false, inkStart: 15, hand: 1, bounty: 3 });
});

test('打出兵牌：整队按队形放下，墨水按整张牌扣；同一张牌不能打两次；收回退还墨水；撤销也能恢复', () => {
  const g = field([foe('knight', 600, 300)]);
  assert.equal(g.placeSquad(squad(0, 'knight', 3, [], 28), 200, 300), '');
  const mine = g.plan.filter(u => u.card === 0);
  assert.equal(mine.length, 3); assert.equal(g.spent, 28); assert.ok(mine.every(u => u.x <= ZONE.blue));
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(Math.hypot(mine[i].x - mine[j].x, mine[i].y - mine[j].y) >= 27, '队员不重叠');
  assert.equal(g.placeSquad(squad(0, 'knight', 3, [], 28), 100, 200), 'played');
  assert.equal(g.placeSquad(squad(1, 'giant', 1, [], 999), 100, 200), 'ink');
  assert.equal(g.placeSquad(squad(2, 'archer', 2, [], 30), 600, 300), 'zone-blue');
  assert.equal(g.placeSquad(squad(3, 'guard', 4, [], 60), 120, 200), '', '4 人排成两列');
  assert.equal(g.recallCard(0), true); assert.equal(g.plan.filter(u => u.card === 0).length, 0); assert.equal(g.spent, 60);
  g.undo(); assert.equal(g.spent, 88, '撤销收回');
  const pos = g.plan.filter(u => u.card === 0).map(u => ({ x: u.x, y: u.y }));
  const h = field([foe('knight', 600, 300)]);
  assert.equal(h.placeSquad(squad(0, 'knight', 3, [], 28), 0, 0, 0, pos), '', '按存好的位置原样恢复');
  assert.deepEqual(h.plan.map(u => ({ x: u.x, y: u.y })), pos);
});

test('卡牌模式不限兵种人数，只限总人数；移动整队里的一人不扣墨水', () => {
  const g = field([foe('knight', 600, 300)]);
  for (let i = 0; i < 3; i++) assert.equal(g.placeSquad(squad(i, 'knight', 3, [], 10), 80 + i * 90, 300), '', `第 ${i + 1} 队先锋`);
  assert.equal(g.count('knight'), 9, '超过普通模式的 5 人上限');
  assert.equal(g.placeSquad(squad(9, 'knight', 2, [], 10), 300, 120), 'team-full');
  const u = g.plan[0]; assert.equal(g.move(u.pid, u.x, u.y + 200), true); assert.equal(g.spent, 30);
});

test('关键词：冲锋、迅捷、坚盾、狂暴、吸血、寒霜、老兵', () => {
  // 冲锋：走完路线后的第一击翻倍
  const c = field([foe('giant', 420, 300)]); c.placeSquad(squad(0, 'knight', 1, ['charge']), 300, 300);
  const pid = c.plan[0].pid; c.setRoute([pid], [{ x: 300, y: 300 }, { x: 360, y: 300 }], pid); c.start();
  const giant = c.units[1]; giant.cool = 999; giant.def.speed = 0; let hp = giant.hp; const hits = [];
  for (let i = 0; i < 600 && hits.length < 2; i++) { c.update(1 / 60); if (giant.hp < hp) { hits.push(hp - giant.hp); hp = giant.hp; } }
  assert.ok(Math.abs(hits[0] - TYPES.knight.damage * KEYWORDS.charge.mult) < 1e-9); assert.equal(hits[1], TYPES.knight.damage);
  // 迅捷：行军时更快
  const fast = kw => { const g = field([foe('guard', 680, 520)]); g.placeSquad(squad(0, 'knight', 1, kw), 100, 300); const p = g.plan[0].pid; g.setRoute([p], [{ x: 100, y: 300 }, { x: 330, y: 300 }], p); g.start(); g.units[1].cool = 999; for (let i = 0; i < 60; i++) g.update(1 / 60); return g.units[0].x - 100; };
  assert.ok(Math.abs(fast(['swift']) / fast([]) - KEYWORDS.swift.speed) < .02);
  // 坚盾：驻守时受到的伤害减少；老兵：生命更高
  const b = field([foe('knight', 600, 300)]); b.placeSquad(squad(0, 'guard', 1, ['bulwark', 'veteran']), 200, 300); b.setHold([b.plan[0].pid], true); b.start();
  const guard = b.units[0]; assert.ok(Math.abs(guard.max - TYPES.guard.hp * KEYWORDS.veteran.hp) < 1e-9);
  const before = guard.hp; b.hit(guard, 10, b.units[1]); assert.ok(Math.abs(before - guard.hp - 10 * KEYWORDS.bulwark.taken) < 1e-9);
  // 狂暴：残血时伤害更高；吸血：打中回血；寒霜：打中减速
  const r = field([foe('giant', 360, 300)]); r.placeSquad(squad(0, 'knight', 1, ['berserk', 'lifesteal', 'frostbite']), 330, 300); r.start();
  const k = r.units[0], target = r.units[1]; target.cool = 999; target.def.speed = 0; k.hp = k.max * .4; const kHp = k.hp; hp = target.hp;
  for (let i = 0; i < 120 && target.hp === hp; i++) r.update(1 / 60);
  const dealt = hp - target.hp;
  assert.ok(Math.abs(dealt - TYPES.knight.damage * KEYWORDS.berserk.mult) < 1e-9, `狂暴伤害 ${dealt}`);
  assert.ok(Math.abs(k.hp - kHp - dealt * KEYWORDS.lifesteal.ratio) < 1e-9, '吸血');
  assert.ok(target.chill > 0, '寒霜减速');
});

test('关键词：鼓舞让附近队友加伤，齐射每第三箭多射一支', () => {
  const g = field([foe('giant', 380, 300)]); g.placeSquad(squad(0, 'giant', 1, ['inspire']), 290, 240); g.placeSquad(squad(1, 'knight', 1), 330, 300); g.start();
  const [boss, k, target] = g.units; boss.def.speed = 0; boss.cool = 999; target.cool = 999; target.def.speed = 0; let hp = target.hp;
  assert.ok(Math.hypot(boss.x - k.x, boss.y - k.y) <= KEYWORDS.inspire.radius);
  for (let i = 0; i < 120 && target.hp === hp; i++) g.update(1 / 60);
  assert.ok(Math.abs(hp - target.hp - TYPES.knight.damage * KEYWORDS.inspire.mult) < 1e-9, '鼓舞加伤');
  const v = field([foe('giant', 450, 300)]); v.placeSquad(squad(0, 'archer', 1, ['volley']), 300, 300); v.start();
  const a = v.units[0]; v.units[1].cool = 999; v.units[1].def.speed = 0; a.def.speed = 0;
  let fired = 0; for (let i = 0; i < 1200 && a.volleyCount < 3; i++) { const n = v.shots.length; v.update(1 / 60); fired += Math.max(0, v.shots.length - n); }
  assert.equal(v.relicStats.volleys, 1); assert.ok(fired >= 4, `射出 ${fired} 支箭`);
});

test('一种资源：没用完的墨水开战后打战术牌，击倒敌人返还墨水，不够就打不出', () => {
  const g = field([foe('knight', 400, 300), foe('knight', 400, 360)]); g.budget = 40;
  g.placeSquad(squad(0, 'knight', 1), 300, 300); const left = g.remaining; g.start();
  assert.equal(g.remaining, left, '开战时剩下的墨水原样带进战斗');
  assert.equal(g.cast('frost', { cost: left + 1 }), false, '墨水不够');
  g.hit(g.units[1], 999, g.units[0]); assert.equal(g.remaining, left + REFUND.perKill, '击倒敌人返还墨水'); assert.equal(g.relicStats.refunded, REFUND.perKill);
  assert.equal(g.cast('frost', { cost: left + 1 }), true); assert.equal(g.remaining, left + REFUND.perKill - left - 1); assert.ok(g.effects.frost >= TACTICS.frost.duration - .001);
  const h = field([foe('knight', 400, 300)], { refund: { perKill: 4, start: 15 } }); h.placeSquad(squad(0, 'knight', 1), 300, 300); const before = h.remaining; h.start();
  assert.equal(h.remaining, before + 15, '战吼：开战时多 15 墨水');
});

test('战术牌：急救、落雷、增援、突击、墨盾、烟幕和集结；升级后更强', () => {
  const g = field([foe('knight', 600, 300), foe('archer', 640, 200)]); g.placeSquad(squad(0, 'knight', 2), 260, 300); g.start(); g.inkBonus = 999;
  const [a] = g.units; a.hp = 20;
  assert.equal(g.cast('heal', { up: true }), true); assert.ok(Math.abs(a.hp - (20 + a.max * TACTICS.heal.up)) < 1e-9);
  for (const u of g.units) u.hp = u.max; assert.equal(g.cast('heal'), false, '没人受伤时不浪费');
  assert.equal(g.cast('thunder'), false, '落雷要落点'); assert.equal(g.cast('thunder', { point: { x: 600, y: 280 } }), true); assert.equal(g.pending.length, 1);
  const before = g.units.length; assert.equal(g.cast('reinforce', { point: { x: 600, y: 300 } }), false, '增援只能落在己方一侧');
  assert.equal(g.cast('reinforce', { point: { x: 150, y: 300 }, up: true }), true); assert.equal(g.units.length, before + TACTICS.reinforce.up);
  assert.ok(g.units.slice(before).every(u => u.team === 0 && u.type === TACTICS.reinforce.type && u.hp > 0));
  g.units[0].route = [{ x: 400, y: 100 }]; g.units[0].hold = true;
  assert.equal(g.cast('assault'), true); assert.equal(g.units[0].route, null); assert.equal(g.units[0].hold, false); assert.ok(g.effects.assault > 0);
  assert.equal(g.cast('shield'), true); assert.ok(g.units.filter(u => u.team === 0).every(u => u.shield === TACTICS.shield.amount));
  const u = g.units[1], hp = u.hp; g.hit(u, 15, g.units[2]); assert.equal(u.hp, hp, '墨盾先挡伤害'); assert.equal(u.shield, TACTICS.shield.amount - 15);
  assert.equal(g.cast('smoke'), true); assert.equal(g.cast('rally'), true); assert.ok(g.effects.smoke > 0 && g.effects.rally > 0);
  assert.equal(g.relicStats.tactics, 7, '失败的施放不算');
});

test('卡牌遗物：连斩越杀越强，墨契按打出的牌数加伤，战吼多给起始战墨', () => {
  const mods = runMods({ relics: ['fervor', 'pact'] });
  const g = field([foe('knight', 400, 300), foe('knight', 420, 380), foe('knight', 640, 520)], { mods });
  g.placeSquad(squad(0, 'knight', 1), 300, 300); g.placeSquad(squad(1, 'archer', 1), 120, 120); g.start();
  assert.ok(Math.abs(g.pactBonus - (1 + RELIC_FX.pact * 2)) < 1e-9);
  assert.ok(Math.abs(g.units[0].def.damage - TYPES.knight.damage * g.pactBonus) < 1e-9);
  g.hit(g.units[2], 999, g.units[0]); g.hit(g.units[3], 999, g.units[0]);
  assert.ok(Math.abs(g.units[0].fervor - RELIC_FX.fervor.step * 2) < 1e-9); assert.ok(g.boost(g.units[0]) > 1);
});
