// 远征（肉鸽模式，卡牌版）：一局三章，每章一张分岔地图。玩家带一副牌：每场抽手牌，兵牌整队放下，战术牌开战后用战墨打出。
// 这里只有规则和状态，不碰界面和存储。地图、遭遇战和抽牌都由种子决定，存档只需要记玩家的状态和选择。
import { TYPES, UNIT_ORDER } from './data.mjs';
import { STICKERS, STICKER_ORDER, STICKER_SLOTS, SELL, RELIC_TO_STICKER, RELIC_REFUND, runMods, stickerPerks } from './stickers.mjs';
import { CARDS, CARD_ORDER, RARITY_WEIGHT, STARTER_DECKS, HAND, REFUND, cardStats, CARD_TEAM_LIMIT } from './cards.mjs';
import { rng, hash, pickOne, makeEncounter, ACTS, ROWS } from './encounters.mjs';
import { validRoute } from './routes.mjs';

export const GEN_VERSION = 2;
export const START = { hearts: 3, ink: 100 };
export const MIN_DECK = 5;
// 开局编制：起始牌库和第一张贴纸。
export const WARBANDS = {
  iron: { deck: STARTER_DECKS.iron, stickers: ['longhaul'] },
  sappers: { deck: STARTER_DECKS.sappers, stickers: ['cross'] },
  raiders: { deck: STARTER_DECKS.raiders, stickers: ['swift'] }
};
export const WARBAND_ORDER = Object.keys(WARBANDS);
export const PRICES = { card: { common: 40, uncommon: 60, rare: 85 }, pack: 70, heart: 40, ink: 30, remove: 50, upgrade: 60 };
// 贴纸包里各稀有度的概率（剩下的是普通）：宝箱和商店的包、精英战、首领战依次更好。
export const PACK_ODDS = { treasure: { rare: .3, legend: .1 }, shop: { rare: .35, legend: .12 }, elite: { rare: .45, legend: .15 }, boss: { rare: .5, legend: .5 } };
export const PACK_SIZE = 3;
export const COINS = { battle: 14, elite: 30, boss: 60, star: 4 };
export const WIN_INK = 8; // 每打赢一场普通战或精英战，墨水上限 +8
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
  const id = WARBANDS[warband] ? warband : 'iron', wb = WARBANDS[id];
  return {
    v: 1, gen: GEN_VERSION, seed, warband: id, act: 0, at: null, path: [],
    hearts: START.hearts, maxHearts: START.hearts, ink: START.ink, coins: 0,
    deck: wb.deck.map(card => ({ id: card, up: false })), stickers: [...wb.stickers], snowball: 0,
    hand: null,
    screen: 'map', pending: null, draft: [], attempts: 0, result: null,
    stats: { wins: 0, losses: 0, kills: 0, elites: 0, bosses: 0, coins: 0, nodes: 0, cards: 0, tactics: 0 }
  };
}

const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const uniqueIn = (list, allowed) => Array.isArray(list) && list.every(v => allowed.includes(v)) && new Set(list).size === list.length;
const validEntry = e => e && typeof e === 'object' && CARDS[e.id] && typeof e.up === 'boolean';
function validOption(o, deckSize) {
  if (!o || typeof o !== 'object') return false;
  if (o.kind === 'card') return !!CARDS[o.id] && (o.up === undefined || typeof o.up === 'boolean');
  if (o.kind === 'sticker') return STICKER_ORDER.includes(o.id);
  if (o.kind === 'pack') return Array.isArray(o.contents) && o.contents.length <= 6 && o.contents.every(id => STICKER_ORDER.includes(id)) && typeof o.taken === 'boolean';
  if (o.kind === 'ink' || o.kind === 'coins') return int(o.n, 1, 200);
  if (o.kind === 'heart') return int(o.n, 1, 3);
  if (o.kind === 'service') return ['remove', 'upgrade'].includes(o.service);
  if (o.kind === 'upgrade' || o.kind === 'remove') return int(o.index, 0, deckSize - 1);
  return false;
}
// 0.13 以前的存档带的是遗物：有对应贴纸的换成贴纸（最多 5 张），其余每件折成金币；待领的遗物奖励、商店里的遗物和神龛也一并换掉。
function migrateRelics(raw) {
  if (!raw || typeof raw !== 'object' || raw.stickers !== undefined || !Array.isArray(raw.relics)) return raw;
  const r = structuredClone(raw), stickers = [];
  let refund = 0;
  for (const id of r.relics) { const s = RELIC_TO_STICKER[id]; if (s && !stickers.includes(s) && stickers.length < STICKER_SLOTS) stickers.push(s); else refund += RELIC_REFUND; }
  r.stickers = stickers; r.snowball = 0; delete r.relics;
  if (Number.isInteger(r.coins)) r.coins += refund;
  const p = r.pending, swap = o => (o?.kind === 'relic' ? (RELIC_TO_STICKER[o.id] ? { kind: 'sticker', id: RELIC_TO_STICKER[o.id] } : { kind: 'coins', n: 40 }) : o);
  if (p && Array.isArray(p.options)) p.options = p.options.map(swap);
  if (p && Array.isArray(p.stock)) p.stock = p.stock.map(s => {
    if (s?.kind !== 'relic') return s;
    const id = RELIC_TO_STICKER[s.id], gone = !!s.sold || !id;
    return { kind: 'pack', contents: id ? [id] : [], taken: gone, price: PRICES.pack, sold: gone };
  });
  if (p && p.relic !== undefined) { p.sticker = RELIC_TO_STICKER[p.relic] || 'longhaul'; delete p.relic; }
  return r;
}
// 存档里的远征：逐项校验，任何一处不对就整局作废，避免坏数据让游戏卡住（只有阵容草稿里的坏士兵会被单独丢掉）。
export function normalizeRun(raw) {
  const r = migrateRelics(raw && typeof raw === 'object' ? raw : null);
  if (!r || r.v !== 1 || r.gen !== GEN_VERSION || !int(r.seed, 1, 2147483647) || !WARBANDS[r.warband] || !int(r.act, 0, ACTS - 1)) return null;
  if (!int(r.maxHearts, 1, 9) || !int(r.hearts, 0, r.maxHearts) || !int(r.ink, 40, 999) || !int(r.coins, 0, 99999)) return null;
  if (!Array.isArray(r.deck) || r.deck.length < 1 || r.deck.length > 60 || !r.deck.every(validEntry)) return null;
  if (!uniqueIn(r.stickers, STICKER_ORDER) || r.stickers.length > STICKER_SLOTS || !int(r.snowball ?? 0, 0, 99999)) return null;
  const size = r.deck.length;
  if (r.hand !== null && !(Array.isArray(r.hand) && r.hand.length <= 16 && r.hand.every(i => int(i, 0, size - 1)) && new Set(r.hand).size === r.hand.length)) return null;
  if (!['map', 'battle', 'reward', 'shop', 'camp', 'event', 'over'].includes(r.screen)) return null;
  const map = makeMap(r.seed, r.act);
  if (r.at !== null && !map.nodes.has(r.at)) return null;
  if (!Array.isArray(r.path) || r.path.some(id => !map.nodes.has(id))) return null;
  if (!int(r.attempts, 0, 99) || !Array.isArray(r.draft) || r.draft.length > 40) return null;
  const draft = r.draft.filter(u => u && int(u.card, 0, size - 1) && CARDS[r.deck[u.card].id].type === u.type && Number.isFinite(u.x) && Number.isFinite(u.y))
    .map(u => ({ card: u.card, type: u.type, x: u.x, y: u.y, ...(u.route && validRoute(u.route) ? { route: u.route.map(p => ({ x: p.x, y: p.y })) } : {}), ...(u.hold === true ? { hold: true } : {}) }));
  const p = r.pending;
  if (r.screen === 'battle' && !(p && p.node === r.at && isFight(nodeOf({ seed: r.seed, act: r.act }, r.at)?.kind) && Array.isArray(r.hand))) return null;
  if (r.screen === 'reward' && !(p && Array.isArray(p.options) && p.options.every(o => validOption(o, size)) && int(p.coins ?? 0, 0, 999))) return null;
  if (r.screen === 'shop' && !(p && Array.isArray(p.stock) && p.stock.every(s => validOption(s, size) && int(s.price, 1, 999) && typeof s.sold === 'boolean'))) return null;
  if (r.screen === 'camp' && !(p && typeof p.done === 'boolean')) return null;
  if (r.screen === 'event' && !(p && EVENTS[p.event] && (p.card === undefined || CARDS[p.card]) && (p.sticker === undefined || STICKER_ORDER.includes(p.sticker)) && (p.index === undefined || int(p.index, 0, size - 1)))) return null;
  if (r.screen === 'over' && !['victory', 'defeat', 'abandoned'].includes(r.result)) return null;
  const stats = {}; for (const k of ['wins', 'losses', 'kills', 'elites', 'bosses', 'coins', 'nodes', 'cards', 'tactics']) stats[k] = int(r.stats?.[k], 0, 999999) ? r.stats[k] : 0;
  return {
    v: 1, gen: GEN_VERSION, seed: r.seed, warband: r.warband, act: r.act, at: r.at, path: r.path.slice(),
    hearts: r.hearts, maxHearts: r.maxHearts, ink: r.ink, coins: r.coins,
    deck: r.deck.map(e => ({ id: e.id, up: e.up })), stickers: r.stickers.slice(), snowball: r.snowball ?? 0, hand: r.hand ? r.hand.slice() : null,
    screen: r.screen, pending: p ? structuredClone(p) : null, draft, attempts: r.attempts, result: r.screen === 'over' ? r.result : null, stats
  };
}

// ---------- 抽牌 ----------
export const perksOf = run => stickerPerks(run.stickers);
// 牌库里出现过的兵种（主页小队、图鉴用）。
export const deckTypes = run => [...new Set((run?.deck || []).filter(e => CARDS[e.id]?.kind === 'unit').map(e => CARDS[e.id].type))];
export const handSize = () => HAND.size;
// 手牌按“兵牌在前、战术牌在后”，同类按牌库顺序排。
const sortHand = (run, hand) => hand.slice().sort((a, b) => (CARDS[run.deck[a].id].kind === 'tactic') - (CARDS[run.deck[b].id].kind === 'tactic') || a - b);
export function drawHand(run, salt = 0) {
  const rand = rng(hash(run.seed, 'hand', run.at, salt));
  return sortHand(run, shuffle(rand, run.deck.map((_, i) => i)).slice(0, Math.min(handSize(run), run.deck.length)));
}
// 花墨水多抽一张（每场最多 3 次）。
export function enter(run, id) {
  if (!available(run).includes(id)) return false;
  const node = nodeOf(run, id);
  run.at = id; run.path.push(id); run.stats.nodes++; run.attempts = 0;
  if (isFight(node.kind)) { run.screen = 'battle'; run.pending = { node: id }; run.hand = drawHand(run); run.draft = []; }
  else if (node.kind === 'shop') { run.screen = 'shop'; run.pending = { stock: makeStock(run, id) }; }
  else if (node.kind === 'camp') { run.screen = 'camp'; run.pending = { done: false }; }
  else if (node.kind === 'event') { run.screen = 'event'; run.pending = makeEvent(run, id); }
  else if (node.kind === 'treasure') { run.screen = 'reward'; run.pending = { kind: 'treasure', coins: 0, options: stickerChoices(run, PACK_SIZE, rng(hash(run.seed, 'treasure', id)), PACK_ODDS.treasure) }; }
  return true;
}

// 当前战斗的完整设置：遭遇战、墨水预算、战斗修正、手牌和战墨规则。
export function battleOf(run) {
  if (run.screen !== 'battle') return null;
  const node = nodeOf(run, run.pending.node), perks = perksOf(run);
  const encounter = makeEncounter({ seed: run.seed, act: run.act, row: node.row, kind: node.kind, node: node.id });
  const def = { index: -1, budget: run.ink, enemies: encounter.enemies, rocks: encounter.rocks, par: encounter.par, title: encounter.name };
  const hand = run.hand.map(index => ({ index, ...cardStats(run.deck[index], perks) }));
  return { node, encounter, def, mods: runMods(run, encounter.enemyMods, CARD_TEAM_LIMIT), hand, refund: { perKill: REFUND.perKill, start: 0 } };
}

// ---------- 战斗结果 ----------
// result = { won, survivors, deployed, stars, kills, tactics, plan }
export function finishBattle(run, result) {
  if (run.screen !== 'battle') return null;
  const node = nodeOf(run, run.pending.node);
  run.stats.kills += result.kills || 0; run.stats.tactics += result.tactics || 0;
  if (run.stickers.includes('snowball')) run.snowball += result.kills || 0;
  run.stats.cards += new Set((result.plan || []).filter(u => u.team === 0 && u.card !== undefined).map(u => u.card)).size;
  if (!result.won) {
    // 输了重打同一场：手牌、站位、路线和驻守都保留。
    run.draft = (result.plan || []).filter(u => u.team === 0 && u.card !== undefined).map(u => ({ card: u.card, type: u.type, x: u.x, y: u.y, ...(u.route ? { route: u.route.map(p => ({ x: p.x, y: p.y })) } : {}), ...(u.hold ? { hold: true } : {}) }));
    run.stats.losses++; run.hearts = Math.max(0, run.hearts - 1); run.attempts++;
    if (run.hearts === 0) { run.screen = 'over'; run.result = 'defeat'; run.pending = null; }
    return { won: false, hearts: run.hearts, over: run.hearts === 0 };
  }
  const coins = COINS[node.kind] + COINS.star * Math.max(0, (result.stars || 1) - 1);
  run.coins += coins; run.stats.coins += coins; run.stats.wins++;
  run.hand = null; run.draft = [];
  const rand = rng(hash(run.seed, 'spoils', node.id));
  let ink = 0;
  if (node.kind === 'battle') { ink = WIN_INK; run.ink += ink; run.pending = { kind: 'spoils', coins, ink, options: cardChoices(run, 3, rand) }; }
  else if (node.kind === 'elite') { ink = WIN_INK; run.ink += ink; run.stats.elites++; run.pending = { kind: 'elite', coins, ink, options: stickerChoices(run, PACK_SIZE, rand, PACK_ODDS.elite) }; }
  else {
    ink = 20; run.stats.bosses++; run.hearts = run.maxHearts; run.ink += ink;
    run.pending = { kind: 'boss', coins, ink, options: stickerChoices(run, PACK_SIZE, rand, PACK_ODDS.boss) };
  }
  run.screen = 'reward';
  return { won: true, coins, ink };
}

// 选牌：按稀有度加权抽，后面的章节稀有牌更多；kind 可以限定兵牌或战术牌。三张不重复。
export function cardChoices(run, n, rand, kind = null) {
  const weight = id => RARITY_WEIGHT[CARDS[id].rarity] + (CARDS[id].rarity === 'rare' ? run.act : CARDS[id].rarity === 'uncommon' ? run.act * .5 : 0);
  const out = [];
  for (let tries = 0; tries < 40 && out.length < n; tries++) {
    const pool = CARD_ORDER.filter(id => (!kind || CARDS[id].kind === kind) && !out.some(o => o.id === id)).map(id => [id, weight(id)]);
    if (!pool.length) break;
    out.push({ kind: 'card', id: weighted(rand, pool) });
  }
  return out;
}
// 一包贴纸：每张先按 odds 掷稀有度（legend、rare，其余是普通），再从这一档里挑一张还没有的；这一档挑完了就从所有没有的里挑。
export function stickerChoices(run, n, rand, odds) {
  const out = [];
  for (let tries = 0; tries < 40 && out.length < n; tries++) {
    const roll = rand(), tier = roll < odds.legend ? 'legend' : roll < odds.legend + odds.rare ? 'rare' : 'common';
    const free = id => !run.stickers.includes(id) && !out.some(o => o.id === id);
    let pool = STICKER_ORDER.filter(id => STICKERS[id].tier === tier && free(id));
    if (!pool.length) pool = STICKER_ORDER.filter(free);
    if (!pool.length) break;
    out.push({ kind: 'sticker', id: pickOne(rand, pool) });
  }
  if (!out.length) out.push({ kind: 'coins', n: 40 });
  return out;
}
export const stickersFull = run => run.stickers.length >= STICKER_SLOTS;
export const sellValue = id => SELL[STICKERS[id]?.tier] ?? 0;
// 贴上一张贴纸。满了要指定换下哪一张（replace 是贴纸栏里的位置），换下的那张按卖价折成金币。
function stick(run, id, replace = null) {
  if (!STICKERS[id] || run.stickers.includes(id)) return false;
  if (!stickersFull(run)) { run.stickers.push(id); return true; }
  if (!Number.isInteger(replace) || !run.stickers[replace]) return false;
  const gain = sellValue(run.stickers[replace]); run.coins += gain; run.stats.coins += gain;
  run.stickers[replace] = id;
  return true;
}
// 在地图上卖掉一张贴纸，腾出位置。
export function sellSticker(run, index) {
  if (run.screen !== 'map' || !run.stickers[index]) return false;
  const gain = sellValue(run.stickers[index]); run.coins += gain; run.stats.coins += gain;
  run.stickers.splice(index, 1);
  return true;
}

// 套用一个奖励或购买的商品。贴纸满了时要带上 replace。
export function grant(run, o) {
  if (o.kind === 'card' && CARDS[o.id]) run.deck.push({ id: o.id, up: !!o.up });
  else if (o.kind === 'sticker') return stick(run, o.id, o.replace ?? null);
  else if (o.kind === 'ink') run.ink += o.n;
  else if (o.kind === 'coins') { run.coins += o.n; run.stats.coins += o.n; }
  else if (o.kind === 'heart') run.hearts = Math.min(run.maxHearts, run.hearts + o.n);
  else if (o.kind === 'upgrade' && run.deck[o.index] && !run.deck[o.index].up) run.deck[o.index].up = true;
  else if (o.kind === 'remove' && run.deck[o.index] && run.deck.length > MIN_DECK) run.deck.splice(o.index, 1);
  else return false;
  return true;
}
// 领奖：index 为 -1 表示跳过。选贴纸而贴纸栏满了时，replace 是要换下的那一张；不给就领不了。
export function choose(run, index, replace = null) {
  if (run.screen !== 'reward') return false;
  const o = run.pending.options[index];
  if (index !== -1 && !o) return false;
  if (o && !grant(run, { ...o, replace })) return false;
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
    run.act++; run.at = null; run.path = [];
  }
  run.screen = 'map';
  return true;
}

// ---------- 军需官 ----------
function makeStock(run, id) {
  const rand = rng(hash(run.seed, 'shop', id)), stock = [];
  for (const o of [...cardChoices(run, 3, rand, 'unit'), ...cardChoices(run, 2, rand, 'tactic')]) stock.push({ ...o, price: PRICES.card[CARDS[o.id].rarity], sold: false });
  // 贴纸包：进店时就定好里面是什么，买下以后翻开挑一张。
  const contents = stickerChoices(run, PACK_SIZE, rand, PACK_ODDS.shop).filter(o => o.kind === 'sticker').map(o => o.id);
  if (contents.length) stock.push({ kind: 'pack', contents, taken: false, price: PRICES.pack, sold: false });
  stock.push({ kind: 'service', service: 'remove', price: PRICES.remove, sold: false });
  stock.push({ kind: 'service', service: 'upgrade', price: PRICES.upgrade, sold: false });
  stock.push({ kind: 'heart', n: 1, price: PRICES.heart, sold: false });
  stock.push({ kind: 'ink', n: 10, price: PRICES.ink, sold: false });
  return stock;
}
const upgradable = run => run.deck.some(e => !e.up);
export function canBuy(run, index) {
  const s = run.screen === 'shop' ? run.pending.stock[index] : null;
  if (!s || s.sold || run.coins < s.price) return false;
  if (s.kind === 'heart') return run.hearts < run.maxHearts;
  if (s.kind === 'service') return s.service === 'remove' ? run.deck.length > MIN_DECK : upgradable(run);
  return true;
}
// 从买下的贴纸包里挑一张（pick 为 -1 表示都不要）。贴纸栏满了时要给 replace。
export function takeFromPack(run, index, pick, replace = null) {
  const s = run.screen === 'shop' ? run.pending.stock[index] : null;
  if (!s || s.kind !== 'pack' || !s.sold || s.taken) return false;
  if (pick !== -1 && (!s.contents[pick] || !stick(run, s.contents[pick], replace))) return false;
  s.taken = true;
  return true;
}
// 买东西；删牌和升级要指定牌库里的哪一张（deckIndex）。
export function buy(run, index, deckIndex = null) {
  if (!canBuy(run, index)) return false;
  const s = run.pending.stock[index];
  if (s.kind === 'service') {
    const target = run.deck[deckIndex];
    if (!target || (s.service === 'upgrade' && target.up)) return false;
    run.coins -= s.price; s.sold = true; grant(run, { kind: s.service, index: deckIndex });
    return true;
  }
  run.coins -= s.price; s.sold = true; grant(run, s);
  return true;
}

// ---------- 营火 ----------
export const CAMP = { rest: 1 };
export function campOptions(run) {
  return [
    { id: 'rest', ok: run.hearts < run.maxHearts },
    { id: 'upgrade', ok: upgradable(run) },
    { id: 'remove', ok: run.deck.length > MIN_DECK }
  ];
}
export function camp(run, id, deckIndex = null) {
  if (run.screen !== 'camp' || run.pending?.done) return false;
  const option = campOptions(run).find(o => o.id === id); if (!option?.ok) return false;
  if (id === 'rest') grant(run, { kind: 'heart', n: CAMP.rest });
  else if (!run.deck[deckIndex] || !grant(run, { kind: id, index: deckIndex })) return false;
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
  const rares = STICKER_ORDER.filter(s => STICKERS[s].tier !== 'common' && !run.stickers.includes(s));
  const pool = ['spring', 'cache', 'mercenary', ...(rares.length ? ['shrine'] : []), ...(upgradable(run) ? ['scribe'] : [])];
  const event = pickOne(rand, pool), p = { event };
  if (event === 'mercenary') p.card = pickOne(rand, CARD_ORDER.filter(c => CARDS[c].kind === 'unit' && CARDS[c].rarity !== 'common'));
  if (event === 'shrine') p.sticker = pickOne(rand, rares);
  if (event === 'scribe') p.index = pickOne(rand, run.deck.map((e, i) => (e.up ? -1 : i)).filter(i => i >= 0));
  if (event === 'cache') p.card = pickOne(rand, CARD_ORDER.filter(c => CARDS[c].kind === 'tactic'));
  return p;
}
export function eventChoices(run) {
  const p = run.pending, e = EVENTS[p.event];
  return e.choices.map(id => {
    let ok = true;
    if (p.event === 'mercenary' && id === 'hire') ok = run.coins >= e.price;
    if (p.event === 'shrine' && id === 'pray') ok = run.hearts > 1 && !run.stickers.includes(p.sticker);
    if (p.event === 'scribe' && id === 'train') ok = !!run.deck[p.index] && !run.deck[p.index].up;
    return { id, ok };
  });
}
// replace：神龛给的贴纸要贴上而贴纸栏满了时，换下的那一张。
export function resolveEvent(run, id, replace = null) {
  if (run.screen !== 'event') return false;
  const p = run.pending, choice = eventChoices(run).find(c => c.id === id);
  if (!choice?.ok) return false;
  if (p.event === 'shrine' && id === 'pray' && stickersFull(run) && !(Number.isInteger(replace) && run.stickers[replace])) return false;
  if (p.event === 'spring') grant(run, id === 'ink' ? { kind: 'ink', n: EVENT_GAIN.springInk } : { kind: 'coins', n: EVENT_GAIN.springCoins });
  if (p.event === 'mercenary' && id === 'hire') { run.coins -= EVENTS.mercenary.price; grant(run, { kind: 'card', id: p.card }); }
  if (p.event === 'shrine' && id === 'pray') { run.hearts--; grant(run, { kind: 'sticker', id: p.sticker, replace }); }
  if (p.event === 'scribe') grant(run, id === 'train' ? { kind: 'upgrade', index: p.index } : { kind: 'coins', n: EVENT_GAIN.scribeCoins });
  if (p.event === 'cache') { grant(run, { kind: 'card', id: p.card }); grant(run, { kind: 'coins', n: EVENT_GAIN.cacheCoins }); }
  leave(run);
  return true;
}

// ---------- 结束 ----------
export function abandon(run) { if (run.screen === 'over') return false; run.screen = 'over'; run.result = 'abandoned'; run.pending = null; return true; }
// 远征结束时给主线的金币：按走过的节点和打倒的首领算，胜利另有奖励。
export function runPayout(run) {
  return run.stats.nodes * 4 + run.stats.bosses * 40 + (run.result === 'victory' ? 100 : 0);
}
export { STICKERS, STICKER_SLOTS, TYPES, UNIT_ORDER, CARDS };
