// 远征（肉鸽模式，卡牌版）的规则测试：地图、遭遇战、抽牌、奖励、商店、营火、奇遇、存档校验和整局流程。
import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/engine.mjs';
import { TYPES, W, H, ZONE, MARGIN, TIME_LIMIT } from '../src/data.mjs';
import { makeEncounter, expectedInk, stepOf, ACTS, ROWS, TEMPLATES, BOSSES } from '../src/encounters.mjs';
import { makeMap, newRun, available, enter, battleOf, finishBattle, choose, leave, buy, canBuy, camp, campOptions, eventChoices, resolveEvent, normalizeRun, abandon, runPayout, nodeOf, isFight, WARBANDS, EVENTS, drawHand, handSize, MIN_DECK, WIN_INK } from '../src/run.mjs';
import { CARDS, HAND } from '../src/cards.mjs';
import { RELICS } from '../src/relics.mjs';
import { validRoute } from '../src/routes.mjs';

const seeds = [1, 7, 42, 1234, 99991];
const won = (extra = {}) => ({ won: true, survivors: 4, deployed: 6, stars: 3, kills: 6, tactics: 1, plan: [{ type: 'knight', x: 200, y: 300, team: 0, card: 0 }], ...extra });
const lost = (extra = {}) => ({ won: false, survivors: 0, deployed: 6, stars: 0, kills: 2, tactics: 0, plan: [], ...extra });
// 沿着地图一路往前：每次选第一个可去的节点，按类型处理。
function step(run, pickFight = true) {
  const next = available(run); assert.ok(next.length > 0, '地图上总有路可走');
  const choice = (pickFight && next.find(id => isFight(nodeOf(run, id).kind))) || next[0];
  assert.equal(enter(run, choice), true);
  if (run.screen === 'battle') { assert.ok(battleOf(run)); finishBattle(run, won()); assert.equal(run.screen, 'reward'); assert.equal(choose(run, 0), true); }
  else if (run.screen === 'reward') choose(run, 0);
  else if (run.screen === 'shop') leave(run);
  else if (run.screen === 'camp') { camp(run, 'upgrade', run.deck.findIndex(e => !e.up)); leave(run); }
  else if (run.screen === 'event') resolveEvent(run, eventChoices(run).find(c => c.ok).id);
  return choice;
}

test('每章地图：每层 2–4 个节点，所有节点都能从第一层走到，并且都通向首领', () => {
  for (const seed of seeds) for (let act = 0; act < ACTS; act++) {
    const map = makeMap(seed, act);
    assert.equal(map.rows.length, ROWS + 1); assert.equal(map.rows[ROWS][0].kind, 'boss');
    for (const row of map.rows.slice(1, ROWS)) assert.ok(row.length >= 2 && row.length <= 4);
    assert.ok(map.rows[0].every(n => n.kind === 'battle'), '第一层都是普通战斗');
    assert.ok(map.rows[ROWS - 1].some(n => n.kind === 'camp'), '首领前有营火');
    const reach = new Set(map.rows[0].map(n => n.id));
    for (const row of map.rows) for (const n of row) if (reach.has(n.id)) n.next.forEach(id => reach.add(id));
    assert.equal(reach.size, map.nodes.size, '没有走不到的节点');
    for (const row of map.rows.slice(0, ROWS)) for (const n of row) { assert.ok(n.next.length >= 1); for (const id of n.next) assert.equal(map.nodes.get(id).row, n.row + 1); }
    assert.deepEqual(makeMap(seed, act).rows.flat().map(n => n.id + n.kind), map.rows.flat().map(n => n.id + n.kind), '同一种子生成同一张图');
  }
});

test('遭遇战：同一输入结果相同；敌人都在红方区域内、不重叠、不压石头；规模接近目标', () => {
  for (const seed of seeds) for (let act = 0; act < ACTS; act++) for (let row = 0; row <= ROWS; row++) {
    const kind = row === ROWS ? 'boss' : row === 4 ? 'elite' : 'battle';
    const e = makeEncounter({ seed, act, row, kind, node: `${act}-${row}-1` });
    assert.deepEqual(makeEncounter({ seed, act, row, kind, node: `${act}-${row}-1` }), e);
    assert.ok(e.enemies.length >= 4 && e.enemies.length <= 12, `${e.enemies.length} 名敌人`);
    for (const u of e.enemies) {
      assert.ok(TYPES[u.type]); assert.equal(u.team, 1);
      assert.ok(u.x >= ZONE.red && u.x <= W - MARGIN.side && u.y >= MARGIN.top && u.y <= H - MARGIN.bottom, `${u.type} 位置 ${u.x},${u.y}`);
      assert.ok(e.rocks.every(o => Math.hypot(o.x - u.x, o.y - u.y) > o.r + TYPES[u.type].r));
      if (u.route) assert.ok(validRoute(u.route));
    }
    for (let i = 0; i < e.enemies.length; i++) for (let j = i + 1; j < e.enemies.length; j++) assert.ok(Math.hypot(e.enemies[i].x - e.enemies[j].x, e.enemies[i].y - e.enemies[j].y) >= 24);
    if (kind === 'boss') assert.equal(e.enemies.filter(u => u.boss).length, 1, '首领战有且只有一名首领');
    // 后期目标规模超过阵型能容纳的人数时，至少要摆满大部分位置（难度再由属性强化补上）。
    else assert.ok((e.value >= e.target * .7 || e.enemies.length >= 8) && e.value <= e.target * 1.12, `规模 ${e.value} / 目标 ${e.target}，${e.enemies.length} 人`);
    if (act === 0 && kind === 'battle') assert.ok(e.enemies.every(u => !['lancer', 'mage', 'healer', 'giant'].includes(u.type)), '第一章普通战不出现高级兵种');
  }
  assert.ok(expectedInk(stepOf(2, ROWS)) > expectedInk(0));
  assert.equal(Object.keys(TEMPLATES).length >= 6, true); assert.equal(BOSSES.length, ACTS);
});

test('新开远征：三个编制各有 8 张起始牌和一件遗物；第一步只能选第一层', () => {
  for (const [id, wb] of Object.entries(WARBANDS)) {
    const run = newRun({ seed: 3, warband: id });
    assert.equal(run.deck.length, 8); assert.ok(run.deck.every(e => CARDS[e.id] && e.up === false));
    assert.ok(run.deck.some(e => CARDS[e.id].kind === 'tactic') && run.deck.some(e => CARDS[e.id].kind === 'unit'));
    assert.deepEqual(run.relics, wb.relics); assert.ok(wb.relics.every(r => RELICS[r])); assert.equal(run.hearts, 3); assert.equal(run.ink, 100);
    assert.deepEqual(available(run), makeMap(3, 0).rows[0].map(n => n.id));
  }
  const run = newRun({ seed: 3 }); assert.equal(enter(run, '0-5-0'), false, '不能跳到后面的节点');
});

test('进入战斗时抽手牌：同一种子同一节点抽到同样的牌；兵牌在前；击倒敌人返还墨水', () => {
  const a = newRun({ seed: 11 }), b = newRun({ seed: 11 });
  enter(a, available(a)[0]); enter(b, available(b)[0]);
  assert.deepEqual(a.hand, b.hand); assert.equal(a.hand.length, handSize(a)); assert.equal(new Set(a.hand).size, a.hand.length);
  const kinds = a.hand.map(i => CARDS[a.deck[i].id].kind); assert.deepEqual(kinds, [...kinds].sort((x, y) => (x === 'tactic') - (y === 'tactic')));
  const ctx = battleOf(a); assert.equal(ctx.def.budget, a.ink); assert.equal(ctx.hand.length, a.hand.length); assert.ok(ctx.refund.perKill > 0); assert.equal(ctx.refund.start, 0);
  const loud = newRun({ seed: 11 }); loud.relics.push('warcry'); enter(loud, available(loud)[0]); assert.equal(battleOf(loud).refund.start, 15, '战吼：开战时多 15 墨水');
  const big = newRun({ seed: 12 }); big.relics.push('scholar'); assert.equal(handSize(big), HAND.size + 1, '兵书：手牌 +1');
});

test('打赢普通战：拿金币、墨水上限 +5、从三张牌里挑一张；输了扣心、保留手牌和阵容重打', () => {
  const run = newRun({ seed: 11 }); enter(run, available(run)[0]);
  const coins = run.coins, ink = run.ink, deck = run.deck.length;
  const r = finishBattle(run, won());
  assert.ok(r.won && run.coins > coins); assert.equal(run.ink, ink + WIN_INK); assert.equal(run.hand, null);
  assert.equal(run.screen, 'reward'); assert.equal(run.pending.options.length, 3); assert.ok(run.pending.options.every(o => o.kind === 'card' && CARDS[o.id]));
  assert.equal(new Set(run.pending.options.map(o => o.id)).size, 3, '三张牌不重复');
  choose(run, 0); assert.equal(run.deck.length, deck + 1); assert.equal(run.screen, 'map');

  const again = newRun({ seed: 12 }); enter(again, available(again)[0]); const hand = again.hand.slice();
  finishBattle(again, lost({ plan: [{ type: 'knight', x: 200, y: 300, team: 0, card: 0, route: [{ x: 300, y: 200 }], hold: true }] }));
  assert.equal(again.hearts, 2); assert.equal(again.screen, 'battle'); assert.equal(again.attempts, 1); assert.deepEqual(again.hand, hand, '重打时手牌不变');
  assert.deepEqual(again.draft[0], { card: 0, type: 'knight', x: 200, y: 300, route: [{ x: 300, y: 200 }], hold: true });
  finishBattle(again, lost()); finishBattle(again, lost());
  assert.equal(again.hearts, 0); assert.equal(again.screen, 'over'); assert.equal(again.result, 'defeat'); assert.ok(runPayout(again) > 0);
});

test('精英给遗物三选一，首领回满心、加墨水并进入下一章；三章打完胜利', () => {
  const run = newRun({ seed: 21 });
  let guard = 0;
  while (run.screen !== 'over' && guard++ < 60) {
    const before = run.act, next = available(run), elite = next.find(id => nodeOf(run, id).kind === 'elite');
    if (elite) {
      enter(run, elite); finishBattle(run, won());
      assert.equal(run.pending.kind, 'elite'); assert.ok(run.pending.options.every(o => o.kind === 'relic' && !run.relics.includes(o.id)));
      choose(run, 0); continue;
    }
    const id = step(run);
    if (nodeOf({ seed: run.seed, act: before }, id).kind === 'boss') {
      assert.equal(run.hearts, run.maxHearts);
      if (run.screen !== 'over') { assert.equal(run.act, before + 1); assert.equal(run.at, null); assert.equal(run.path.length, 0); }
    }
  }
  assert.equal(run.screen, 'over'); assert.equal(run.result, 'victory'); assert.equal(run.stats.bosses, ACTS);
  assert.ok(run.ink >= 100 + 20 * ACTS); assert.ok(runPayout(run) >= 100 + 40 * ACTS); assert.ok(run.deck.length > 8, '一路上拿到了新牌');
});

test('军需官：卖兵牌、战术牌和遗物；删牌和升级要指定一张牌；钱不够、心满时买不了', () => {
  const map = makeMap(31, 0), shop = map.rows.flat().find(n => n.kind === 'shop');
  const run = newRun({ seed: 31 }); run.coins = 1000;
  if (!shop) return;
  run.at = map.rows[shop.row - 1].find(n => n.next.includes(shop.id)).id;
  assert.equal(enter(run, shop.id), true); assert.equal(run.screen, 'shop');
  const stock = run.pending.stock, at = kind => stock.findIndex(s => s.kind === kind || s.service === kind);
  assert.equal(stock.filter(s => s.kind === 'card' && CARDS[s.id].kind === 'unit').length, 3); assert.equal(stock.filter(s => s.kind === 'card' && CARDS[s.id].kind === 'tactic').length, 2);
  assert.equal(canBuy(run, at('heart')), false, '满心时不卖心');
  const card = stock.findIndex(s => s.kind === 'card'), deck = run.deck.length;
  assert.equal(buy(run, card), true); assert.equal(run.deck.length, deck + 1); assert.equal(buy(run, card), false, '买过的不能再买');
  assert.equal(buy(run, at('upgrade')), false, '升级要指定一张牌'); assert.equal(buy(run, at('upgrade'), 0), true); assert.equal(run.deck[0].up, true);
  assert.equal(buy(run, at('remove'), 0), true); assert.equal(run.deck.length, deck, '删掉一张');
  run.coins = 0; assert.equal(stock.every((_, i) => !canBuy(run, i)), true, '没钱买不了');
  leave(run); assert.equal(run.screen, 'map');
});

test('营火三选一只能选一次；删牌不会让牌库少于下限；奇遇的选项按条件开放', () => {
  const run = newRun({ seed: 41 }); run.screen = 'camp'; run.pending = { done: false };
  assert.equal(campOptions(run).find(o => o.id === 'rest').ok, false, '满心时不能休息');
  assert.equal(camp(run, 'upgrade', 99), false, '不能升级不存在的牌');
  assert.equal(camp(run, 'upgrade', 2), true); assert.equal(run.deck[2].up, true);
  assert.equal(camp(run, 'remove', 0), false, '只能选一次');
  const thin = newRun({ seed: 42 }); thin.deck = thin.deck.slice(0, MIN_DECK); thin.screen = 'camp'; thin.pending = { done: false };
  assert.equal(campOptions(thin).find(o => o.id === 'remove').ok, false, `牌库不少于 ${MIN_DECK} 张`);
  for (const id of Object.keys(EVENTS)) {
    const r = newRun({ seed: 41 }); r.screen = 'event'; r.pending = { event: id, card: id === 'cache' ? 't_frost' : 'outriders', relic: 'flank', index: 1 };
    const choices = eventChoices(r); assert.ok(choices.length >= 1);
    if (id === 'mercenary') { assert.equal(choices[0].ok, false, '金币不够不能雇佣'); r.coins = 100; assert.equal(resolveEvent(r, 'hire'), true); assert.equal(r.deck.at(-1).id, 'outriders'); assert.equal(r.coins, 60); }
    else if (id === 'shrine') { assert.equal(resolveEvent(r, 'pray'), true); assert.equal(r.hearts, 2); assert.ok(r.relics.includes('flank')); }
    else if (id === 'scribe') { assert.equal(resolveEvent(r, 'train'), true); assert.equal(r.deck[1].up, true); }
    else assert.equal(resolveEvent(r, choices.find(c => c.ok).id), true);
    assert.equal(r.screen, 'map');
  }
});

test('存档校验：正常的远征原样恢复，坏数据整局作废，旧版（无卡牌）的远征也作废', () => {
  const run = newRun({ seed: 51 }); step(run); enter(run, available(run).find(id => isFight(nodeOf(run, id).kind)) ?? available(run)[0]);
  const back = normalizeRun(JSON.parse(JSON.stringify(run)));
  assert.deepEqual(back, normalizeRun(back)); assert.equal(back.seed, 51); assert.equal(back.screen, run.screen); assert.deepEqual(back.hand, run.hand);
  assert.equal(normalizeRun(null), null); assert.equal(normalizeRun({ ...run, gen: 1 }), null);
  assert.equal(normalizeRun({ ...run, deck: [{ id: 'dragon', up: false }] }), null); assert.equal(normalizeRun({ ...run, hearts: 9 }), null);
  assert.equal(normalizeRun({ ...run, at: 'nowhere' }), null); assert.equal(normalizeRun({ ...run, relics: ['thick', 'thick'] }), null);
  assert.equal(normalizeRun({ ...run, hand: [0, 0] }), null); assert.equal(normalizeRun({ ...run, extra: 9, mulligan: true }).extra, undefined, '0.11.0 存档里加抽、重抽的旧字段直接丢掉');
  if (run.hand) {
    const unit = run.hand.find(i => CARDS[run.deck[i].id].kind === 'unit');
    const draft = normalizeRun({ ...run, draft: [{ card: unit, type: CARDS[run.deck[unit].id].type, x: 200, y: 300, route: [{ x: 'a' }] }, { card: 99, type: 'knight', x: 1, y: 1 }] }).draft;
    assert.deepEqual(draft, [{ card: unit, type: CARDS[run.deck[unit].id].type, x: 200, y: 300 }], '坏路线和不存在的牌被丢掉');
  }
  const over = newRun({ seed: 52 }); abandon(over); assert.equal(normalizeRun(over).result, 'abandoned');
});

test('遭遇战能直接交给卡牌模式的战斗：整队放下、打出战术牌、击倒敌人返还墨水', () => {
  const run = newRun({ seed: 5, warband: 'raiders' }); enter(run, available(run)[0]);
  const { def, mods, hand, refund } = battleOf(run), g = new Battle(def, { mods, cards: true, refund, item: null });
  const unit = hand.find(c => c.kind === 'unit');
  assert.equal(g.placeSquad({ card: unit.index, type: unit.type, n: unit.n, kw: unit.kw, ink: unit.cost }, 220, 300), '');
  assert.equal(g.plan.length, unit.n); assert.equal(g.spent, unit.cost); assert.equal(g.start(), true);
  const left = g.remaining;
  for (let i = 0; i < TIME_LIMIT * 60 + 5 && g.phase === 'battle'; i++) g.update(1 / 60);
  assert.ok(['won', 'lost'].includes(g.phase));
  const kills = g.units.filter(u => u.team === 1 && u.hp <= 0).length;
  assert.equal(g.relicStats.refunded, kills * refund.perKill, '每击倒一名敌人返还墨水'); assert.ok(g.remaining >= left);
});
