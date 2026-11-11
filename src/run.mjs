// 远征（肉鸽模式）：一局三章，每章一张分岔地图。这里只有规则和状态，不碰界面和存储。
// 地图和遭遇战都由种子生成，存档只需要记玩家的状态和选择。
import { TYPES, UNIT_ORDER, ITEMS, ITEM_ORDER } from './data.mjs';
import { RELICS, RELIC_ORDER, UPGRADES, runMods, bountyOf } from './relics.mjs';
import { rng, hash, pickOne, makeEncounter, ACTS, ROWS } from './encounters.mjs';
import { validRoute } from './routes.mjs';

export const GEN_VERSION = 1;
export const START = { hearts: 3, ink: 100 };
// 开局编制：起始兵种、一件遗物和道具。
export const WARBANDS = {
  iron: { deck: ['knight', 'guard', 'archer'], relics: ['thick'], items: { heal: 2 } },
  raiders: { deck: ['knight', 'archer', 'lancer'], relics: ['swift'], items: { rally: 1, heal: 1 } },
  sappers: { deck: ['guard', 'archer', 'bomber'], relics: ['anchor'], items: { smoke: 1, heal: 1 } }
};
export const WARBAND_ORDER = Object.keys(WARBANDS);
export const PRICES = { unit: 55, upgrade: 45, relic: { common: 80, rare: 120 }, item: 25, heart: 40, ink: 30 };
export const COINS = { battle: 14, elite: 30, boss: 60, star: 4 };
export const NODE_KINDS = ['battle', 'elite', 'event', 'shop', 'camp', 'treasure', 'boss'];
export const isFight = kind => kind === 'battle' || kind === 'elite' || kind === 'boss';

const shuffle = (rand, list) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function weighted(rand, entries) { const total = entries.reduce((s, [, w]) => s + w, 0); let r = rand() * total; for (const [v, w] of entries) { r -= w; if (r <= 0) return v; } return entries.at(-1)[0]; }

// ---------- 地图 ----------
const ROW_KINDS = [
  [['battle', 1]],
  [['battle', .65], ['event', .35]],
  [['battle', .5], ['shop', .25], ['event', .25]],
  [['treasure', .4], ['battle', .4], ['event', .2]],
  [['elite', .5], ['battle', .3], ['event', .2]],
  [['camp', .6], ['shop', .4]]
];
const maps = new Map();
// 每章 6 层普通节点（每层 2–4 个，分布在 4 条纵线上），相邻层就近连线，最后汇到首领。
export function makeMap(seed, act) {
  const key = `${seed}:${act}`; if (maps.has(key)) return maps.get(key);
  const rand = rng(hash(seed, 'map', act)), rows = [];
  for (let r = 0; r < ROWS; r++) {
    const count = r === 0 ? 3 : 2 + Math.floor(rand() * 3);
    const lanes = shuffle(rand, [0, 1, 2, 3]).slice(0, count).sort((a, b) => a - b);
    rows.push(lanes.map(lane => ({ id: `${act}-${r}-${lane}`, row: r, lane, kind: weighted(rand, ROW_KINDS[r]), next: [] })));
  }
  if (!rows[ROWS - 1].some(n => n.kind === 'camp')) rows[ROWS - 1][0].kind = 'camp';
  rows.push([{ id: `${act}-boss`, row: ROWS, lane: 1.5, kind: 'boss', next: [] }]);
  const near = (list, lane) => list.slice().sort((p, q) => Math.abs(p.lane - lane) - Math.abs(q.lane - lane) || p.lane - q.lane);
  for (let r = 0; r < ROWS - 1; r++) {
    const a = rows[r], b = rows[r + 1];
    for (const n of a) {
      const [first, second] = near(b, n.lane);
      n.next.push(first.id);
      if (second && Math.abs(second.lane - n.lane) <= 1 && rand() < .45) n.next.push(second.id);
    }
    for (const m of b) if (!a.some(n => n.next.includes(m.id))) near(a, m.lane)[0].next.push(m.id);
  }
  for (const n of rows[ROWS - 1]) n.next.push(rows[ROWS][0].id);
  const nodes = new Map(rows.flat().map(n => [n.id, n]));
  const map = { act, rows, nodes };
  maps.set(key, map);
  return map;
}
export const mapOf = run => makeMap(run.seed, run.act);
export const nodeOf = (run, id) => mapOf(run).nodes.get(id) || null;
// 现在可以前往的节点。
export function available(run) {
  if (run.screen !== 'map') return [];
  const map = mapOf(run);
  return run.at === null ? map.rows[0].map(n => n.id) : nodeOf(run, run.at)?.next.slice() || [];
}

// ---------- 开局与存档校验 ----------
export function newRun({ seed = Math.floor(Math.random() * 2147483646) + 1, warband = 'iron' } = {}) {
  const wb = WARBANDS[warband] || WARBANDS.iron;
  return {
    v: 1, gen: GEN_VERSION, seed, warband: WARBANDS[warband] ? warband : 'iron', act: 0, at: null, path: [],
    hearts: START.hearts, maxHearts: START.hearts, ink: START.ink, coins: 0,
    deck: [...wb.deck], upgrades: [], relics: [...wb.relics], items: { ...wb.items },
    screen: 'map', pending: null, draft: [], attempts: 0, result: null,
    stats: { wins: 0, losses: 0, kills: 0, elites: 0, bosses: 0, coins: 0, nodes: 0 }
  };
}

const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const uniqueIn = (list, allowed) => Array.isArray(list) && list.every(v => allowed.includes(v)) && new Set(list).size === list.length;
function validOption(o) {
  if (!o || typeof o !== 'object') return false;
  if (o.kind === 'unit' || o.kind === 'upgrade') return UNIT_ORDER.includes(o.type);
  if (o.kind === 'relic') return RELIC_ORDER.includes(o.id);
  if (o.kind === 'item') return ITEM_ORDER.includes(o.id) && int(o.n, 1, 3);
  if (o.kind === 'ink' || o.kind === 'coins') return int(o.n, 1, 200);
  if (o.kind === 'heart') return int(o.n, 1, 3);
  return false;
}
// 存档里的远征：逐项校验，任何一处不对就整局作废，避免坏数据让游戏卡住。
export function normalizeRun(raw) {
  const r = raw && typeof raw === 'object' ? raw : null;
  if (!r || r.v !== 1 || r.gen !== GEN_VERSION || !int(r.seed, 1, 2147483647) || !WARBANDS[r.warband] || !int(r.act, 0, ACTS - 1)) return null;
  if (!int(r.maxHearts, 1, 9) || !int(r.hearts, 0, r.maxHearts) || !int(r.ink, 40, 999) || !int(r.coins, 0, 99999)) return null;
  if (!uniqueIn(r.deck, UNIT_ORDER) || !r.deck.length || !uniqueIn(r.upgrades, r.deck) || !uniqueIn(r.relics, RELIC_ORDER)) return null;
  if (!r.items || typeof r.items !== 'object' || Object.entries(r.items).some(([id, n]) => !ITEM_ORDER.includes(id) || !int(n, 0, 9))) return null;
  if (!['map', 'battle', 'reward', 'shop', 'camp', 'event', 'over'].includes(r.screen)) return null;
  const map = makeMap(r.seed, r.act);
  if (r.at !== null && !map.nodes.has(r.at)) return null;
  if (!Array.isArray(r.path) || r.path.some(id => !map.nodes.has(id))) return null;
  if (!int(r.attempts, 0, 99) || !Array.isArray(r.draft) || r.draft.length > 12) return null;
  const draft = r.draft.filter(u => u && r.deck.includes(u.type) && Number.isFinite(u.x) && Number.isFinite(u.y)).map(u => ({ type: u.type, x: u.x, y: u.y, ...(u.route && validRoute(u.route) ? { route: u.route.map(p => ({ x: p.x, y: p.y })) } : {}), ...(u.hold === true ? { hold: true } : {}) }));
  const p = r.pending;
  if (r.screen === 'battle' && !(p && p.node === r.at && isFight(nodeOf({ seed: r.seed, act: r.act }, r.at)?.kind))) return null;
  if (r.screen === 'reward' && !(p && Array.isArray(p.options) && p.options.every(validOption) && int(p.coins ?? 0, 0, 999))) return null;
  if (r.screen === 'shop' && !(p && Array.isArray(p.stock) && p.stock.every(s => validOption(s) && int(s.price, 1, 999) && typeof s.sold === 'boolean'))) return null;
  if (r.screen === 'event' && !(p && EVENTS[p.event] && (p.unit === undefined || UNIT_ORDER.includes(p.unit)) && (p.relic === undefined || RELIC_ORDER.includes(p.relic)) && (p.upgrade === undefined || UNIT_ORDER.includes(p.upgrade)) && (p.item === undefined || ITEM_ORDER.includes(p.item)))) return null;
  if (r.screen === 'over' && !['victory', 'defeat', 'abandoned'].includes(r.result)) return null;
  const stats = {}; for (const k of ['wins', 'losses', 'kills', 'elites', 'bosses', 'coins', 'nodes']) stats[k] = int(r.stats?.[k], 0, 999999) ? r.stats[k] : 0;
  return {
    v: 1, gen: GEN_VERSION, seed: r.seed, warband: r.warband, act: r.act, at: r.at, path: r.path.slice(),
    hearts: r.hearts, maxHearts: r.maxHearts, ink: r.ink, coins: r.coins,
    deck: r.deck.slice(), upgrades: r.upgrades.slice(), relics: r.relics.slice(), items: { ...r.items },
    screen: r.screen, pending: p ? structuredClone(p) : null, draft, attempts: r.attempts, result: r.screen === 'over' ? r.result : null, stats
  };
}

// ---------- 进入节点 ----------
export function enter(run, id) {
  if (!available(run).includes(id)) return false;
  const node = nodeOf(run, id);
  run.at = id; run.path.push(id); run.stats.nodes++; run.attempts = 0;
  if (isFight(node.kind)) { run.screen = 'battle'; run.pending = { node: id }; }
  else if (node.kind === 'shop') { run.screen = 'shop'; run.pending = { stock: makeStock(run, id) }; }
  else if (node.kind === 'camp') { run.screen = 'camp'; run.pending = { done: false }; }
  else if (node.kind === 'event') { run.screen = 'event'; run.pending = makeEvent(run, id); }
  else if (node.kind === 'treasure') { run.screen = 'reward'; run.pending = { kind: 'treasure', coins: 0, options: relicChoices(run, 2, rng(hash(run.seed, 'treasure', id)), .3) }; }
  return true;
}

// 当前战斗的完整设置：遭遇战、墨水预算和战斗修正。
export function battleOf(run) {
  if (run.screen !== 'battle') return null;
  const node = nodeOf(run, run.pending.node);
  const encounter = makeEncounter({ seed: run.seed, act: run.act, row: node.row, kind: node.kind, node: node.id });
  const def = { index: -1, budget: run.ink, enemies: encounter.enemies, rocks: encounter.rocks, par: encounter.par, title: encounter.name };
  return { node, encounter, def, mods: runMods(run, encounter.enemyMods) };
}
export const itemsOf = run => ITEM_ORDER.filter(id => (run.items[id] || 0) > 0);

// ---------- 战斗结果 ----------
// result = { won, survivors, deployed, stars, kills, itemUsed, plan }
export function finishBattle(run, result) {
  if (run.screen !== 'battle') return null;
  const node = nodeOf(run, run.pending.node);
  if (result.itemUsed && run.items[result.itemUsed] > 0) run.items[result.itemUsed]--;
  run.stats.kills += result.kills || 0;
  // 输了重打同一场，路线和驻守都保留；赢了以后敌阵会变，只留站位。
  if (Array.isArray(result.plan)) run.draft = result.plan.filter(u => u.team === 0).map(u => ({ type: u.type, x: u.x, y: u.y, ...(!result.won && u.route ? { route: u.route.map(p => ({ x: p.x, y: p.y })) } : {}), ...(!result.won && u.hold ? { hold: true } : {}) }));
  if (!result.won) {
    run.stats.losses++; run.hearts = Math.max(0, run.hearts - 1); run.attempts++;
    if (run.hearts === 0) { run.screen = 'over'; run.result = 'defeat'; run.pending = null; }
    return { won: false, hearts: run.hearts, over: run.hearts === 0 };
  }
  const bounty = bountyOf(run.relics) * (result.survivors || 0);
  const coins = COINS[node.kind] + COINS.star * Math.max(0, (result.stars || 1) - 1) + bounty;
  run.coins += coins; run.stats.coins += coins; run.stats.wins++;
  const rand = rng(hash(run.seed, 'spoils', node.id));
  if (node.kind === 'battle') run.pending = { kind: 'spoils', coins, bounty, options: spoils(run, rand) };
  else if (node.kind === 'elite') { run.stats.elites++; run.pending = { kind: 'elite', coins, bounty, options: relicChoices(run, 3, rand, .4) }; }
  else {
    run.stats.bosses++; run.hearts = run.maxHearts; run.ink += 20;
    run.pending = { kind: 'boss', coins, bounty, options: relicChoices(run, 3, rand, 1) };
  }
  run.screen = 'reward';
  return { won: true, coins, bounty };
}

// 普通战后三选一：新兵种、精锐升级、墨水上限、道具，偶尔有常见遗物。
function spoils(run, rand) {
  const missing = UNIT_ORDER.filter(t => !run.deck.includes(t)), upgradable = run.deck.filter(t => !run.upgrades.includes(t));
  const commons = RELIC_ORDER.filter(id => RELICS[id].tier === 'common' && !run.relics.includes(id));
  const makers = [];
  if (missing.length) makers.push([() => ({ kind: 'unit', type: pickOne(rand, missing) }), 3]);
  if (upgradable.length) makers.push([() => ({ kind: 'upgrade', type: pickOne(rand, upgradable) }), 2.5]);
  makers.push([() => ({ kind: 'ink', n: run.act >= 1 ? 20 : 15 }), 2.5]);
  makers.push([() => ({ kind: 'item', id: pickOne(rand, ITEM_ORDER), n: 1 }), 1.2]);
  if (commons.length) makers.push([() => ({ kind: 'relic', id: pickOne(rand, commons) }), 1]);
  const out = [];
  for (let tries = 0; tries < 30 && out.length < 3; tries++) {
    const o = weighted(rand, makers)();
    if (!out.some(v => v.kind === o.kind && (v.type ?? v.id ?? v.n) === (o.type ?? o.id ?? o.n))) out.push(o);
  }
  return out;
}
// 遗物候选：rareChance 是每个候选为稀有遗物的概率；已拥有的不会再出现。
function relicChoices(run, n, rand, rareChance) {
  const out = [];
  for (let tries = 0; tries < 40 && out.length < n; tries++) {
    const tier = rand() < rareChance ? 'rare' : 'common';
    let pool = RELIC_ORDER.filter(id => RELICS[id].tier === tier && !run.relics.includes(id) && !out.some(o => o.id === id));
    if (!pool.length) pool = RELIC_ORDER.filter(id => !run.relics.includes(id) && !out.some(o => o.id === id));
    if (!pool.length) break;
    out.push({ kind: 'relic', id: pickOne(rand, pool) });
  }
  if (!out.length) out.push({ kind: 'coins', n: 40 });
  return out;
}

// 套用一个奖励或购买的商品。
export function grant(run, o) {
  if (o.kind === 'unit' && !run.deck.includes(o.type)) run.deck.push(o.type);
  else if (o.kind === 'upgrade' && run.deck.includes(o.type) && !run.upgrades.includes(o.type)) run.upgrades.push(o.type);
  else if (o.kind === 'relic' && !run.relics.includes(o.id)) run.relics.push(o.id);
  else if (o.kind === 'ink') run.ink += o.n;
  else if (o.kind === 'coins') { run.coins += o.n; run.stats.coins += o.n; }
  else if (o.kind === 'item') run.items[o.id] = Math.min(9, (run.items[o.id] || 0) + o.n);
  else if (o.kind === 'heart') run.hearts = Math.min(run.maxHearts, run.hearts + o.n);
  else return false;
  return true;
}
// 领奖：index 为 -1 表示跳过。
export function choose(run, index) {
  if (run.screen !== 'reward') return false;
  const o = run.pending.options[index];
  if (index !== -1 && !o) return false;
  if (o) grant(run, o);
  leave(run);
  return true;
}
// 离开当前节点回到地图；打完首领进入下一章，三章打完远征胜利。
export function leave(run) {
  if (run.screen === 'over' || run.screen === 'battle') return false;
  const node = run.at ? nodeOf(run, run.at) : null;
  run.pending = null;
  if (node?.kind === 'boss') {
    if (run.act + 1 >= ACTS) { run.screen = 'over'; run.result = 'victory'; return true; }
    run.act++; run.at = null; run.path = []; run.draft = run.draft.map(({ type, x, y }) => ({ type, x, y }));
  }
  run.screen = 'map';
  return true;
}

// ---------- 军需官 ----------
function makeStock(run, id) {
  const rand = rng(hash(run.seed, 'shop', id)), stock = [];
  const missing = shuffle(rand, UNIT_ORDER.filter(t => !run.deck.includes(t))), upgradable = shuffle(rand, run.deck.filter(t => !run.upgrades.includes(t)));
  for (const type of missing.slice(0, 2)) stock.push({ kind: 'unit', type, price: PRICES.unit, sold: false });
  for (const type of upgradable.slice(0, 2)) stock.push({ kind: 'upgrade', type, price: PRICES.upgrade, sold: false });
  const relic = relicChoices(run, 1, rand, .35)[0];
  if (relic.kind === 'relic') stock.push({ ...relic, price: PRICES.relic[RELICS[relic.id].tier], sold: false });
  for (const item of shuffle(rand, ITEM_ORDER).slice(0, 2)) stock.push({ kind: 'item', id: item, n: 1, price: PRICES.item, sold: false });
  stock.push({ kind: 'heart', n: 1, price: PRICES.heart, sold: false });
  stock.push({ kind: 'ink', n: 10, price: PRICES.ink, sold: false });
  return stock;
}
export function canBuy(run, index) {
  const s = run.screen === 'shop' ? run.pending.stock[index] : null;
  if (!s || s.sold || run.coins < s.price) return false;
  if (s.kind === 'heart') return run.hearts < run.maxHearts;
  if (s.kind === 'unit') return !run.deck.includes(s.type);
  if (s.kind === 'upgrade') return run.deck.includes(s.type) && !run.upgrades.includes(s.type);
  if (s.kind === 'relic') return !run.relics.includes(s.id);
  return true;
}
export function buy(run, index) {
  if (!canBuy(run, index)) return false;
  const s = run.pending.stock[index];
  run.coins -= s.price; s.sold = true; grant(run, s);
  return true;
}

// ---------- 营火 ----------
export const CAMP = { rest: 1, study: 10 };
export function campOptions(run) {
  return [
    { id: 'rest', ok: run.hearts < run.maxHearts },
    { id: 'train', ok: run.deck.some(t => !run.upgrades.includes(t)) },
    { id: 'study', ok: true }
  ];
}
export function camp(run, id, type = null) {
  if (run.screen !== 'camp' || run.pending?.done) return false;
  const option = campOptions(run).find(o => o.id === id); if (!option?.ok) return false;
  if (id === 'rest') grant(run, { kind: 'heart', n: CAMP.rest });
  if (id === 'study') grant(run, { kind: 'ink', n: CAMP.study });
  if (id === 'train') { if (!run.deck.includes(type) || run.upgrades.includes(type)) return false; grant(run, { kind: 'upgrade', type }); }
  run.pending.done = true;
  return true;
}

// ---------- 奇遇 ----------
// 每个奇遇两个选项；需要的条件不满足时选项不可选。具体会得到什么在进入时就定好，界面可以提前写清楚。
export const EVENTS = {
  spring: { choices: ['ink', 'coins'] },
  mercenary: { choices: ['hire', 'leave'], price: 40 },
  shrine: { choices: ['pray', 'leave'] },
  scribe: { choices: ['train', 'coins'] },
  cache: { choices: ['take'] }
};
export const EVENT_ORDER = Object.keys(EVENTS);
export const EVENT_GAIN = { springInk: 20, springCoins: 40, scribeCoins: 25, cacheCoins: 15 };
function makeEvent(run, id) {
  const rand = rng(hash(run.seed, 'event', id));
  const missing = UNIT_ORDER.filter(t => !run.deck.includes(t)), upgradable = run.deck.filter(t => !run.upgrades.includes(t));
  const rares = RELIC_ORDER.filter(r => RELICS[r].tier === 'rare' && !run.relics.includes(r));
  const pool = ['spring', 'cache', ...(missing.length ? ['mercenary'] : []), ...(rares.length ? ['shrine'] : []), ...(upgradable.length ? ['scribe'] : [])];
  const event = pickOne(rand, pool), p = { event };
  if (event === 'mercenary') p.unit = pickOne(rand, missing);
  if (event === 'shrine') p.relic = pickOne(rand, rares);
  if (event === 'scribe') p.upgrade = pickOne(rand, upgradable);
  if (event === 'cache') p.item = pickOne(rand, ITEM_ORDER);
  return p;
}
export function eventChoices(run) {
  const p = run.pending, e = EVENTS[p.event];
  return e.choices.map(id => {
    let ok = true;
    if (p.event === 'mercenary' && id === 'hire') ok = run.coins >= e.price && !run.deck.includes(p.unit);
    if (p.event === 'shrine' && id === 'pray') ok = run.hearts > 1 && !run.relics.includes(p.relic);
    if (p.event === 'scribe' && id === 'train') ok = !run.upgrades.includes(p.upgrade);
    return { id, ok };
  });
}
export function resolveEvent(run, id) {
  if (run.screen !== 'event') return false;
  const p = run.pending, choice = eventChoices(run).find(c => c.id === id);
  if (!choice?.ok) return false;
  if (p.event === 'spring') grant(run, id === 'ink' ? { kind: 'ink', n: EVENT_GAIN.springInk } : { kind: 'coins', n: EVENT_GAIN.springCoins });
  if (p.event === 'mercenary' && id === 'hire') { run.coins -= EVENTS.mercenary.price; grant(run, { kind: 'unit', type: p.unit }); }
  if (p.event === 'shrine' && id === 'pray') { run.hearts--; grant(run, { kind: 'relic', id: p.relic }); }
  if (p.event === 'scribe') grant(run, id === 'train' ? { kind: 'upgrade', type: p.upgrade } : { kind: 'coins', n: EVENT_GAIN.scribeCoins });
  if (p.event === 'cache') { grant(run, { kind: 'item', id: p.item, n: 1 }); grant(run, { kind: 'coins', n: EVENT_GAIN.cacheCoins }); }
  leave(run);
  return true;
}

// ---------- 结束 ----------
export function abandon(run) { if (run.screen === 'over') return false; run.screen = 'over'; run.result = 'abandoned'; run.pending = null; return true; }
// 远征结束时给主线的金币：按走过的节点和打倒的首领算，胜利另有奖励。
export function runPayout(run) {
  return run.stats.nodes * 4 + run.stats.bosses * 40 + (run.result === 'victory' ? 100 : 0);
}
export { UPGRADES, RELICS, ITEMS, TYPES };
