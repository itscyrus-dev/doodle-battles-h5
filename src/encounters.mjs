// 远征的遭遇战生成：按种子、章节和节点生成敌军阵型与地形。结果只取决于输入，可以复现。
import { TYPES, W, H, ZONE, MARGIN } from './data.mjs';

// mulberry32 随机数和字符串种子。
export function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function hash(...parts) { let h = 2166136261; for (const ch of parts.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export const pickOne = (rand, list) => list[Math.floor(rand() * list.length)];

export const ACT_THEMES = ['meadow', 'canyon', 'snow'];
export const ACTS = 3, ROWS = 6; // 每章 6 层普通节点，第 7 层是首领
// 每一步（章节 × 层）玩家大致会有的墨水，用来决定敌军规模（卡牌远征：每打赢一场 +8，约六成的层是战斗）。
// 出战人数有上限，墨水再多也用不完，所以封顶。
export const expectedInk = step => Math.min(240, 100 + 6 * step);
export const stepOf = (act, row) => act * (ROWS + 1) + row;
// 敌军价值 = 预计墨水 × 比例。普通战随层数变难；精英更强；首领战的比例只算护卫，不含首领本人。
export const RATIO = { battle: [.8, .84, .88, .92, .96, 1], elite: [.9, 1.05, 1.05], boss: [.55, 1, .92] };
// 敌军属性强化：每章生命 +25%、伤害 +15%（出战人数有上限，后期主要靠这个变难）；精英战再加生命。
export const enemyScale = (act, kind) => ({ hp: (1 + act * .25) * (kind === 'elite' ? 1.15 : 1), damage: 1 + act * .15 });

// 各章允许出现的敌方兵种（精英和首领可以提前出现更重的兵种）。
function allowed(type, act, row, kind) {
  if (['knight', 'guard', 'archer'].includes(type)) return true;
  if (type === 'bomber') return act > 0 || row >= 2 || kind !== 'battle';
  if (type === 'giant') return act > 0 || kind !== 'battle';
  if (type === 'lancer' || type === 'healer') return act > 0 || (kind === 'elite' && type === 'healer');
  if (type === 'mage') return act > 1 || (act === 1 && kind !== 'battle');
  return false;
}
const FALLBACK = { knight: 'knight', guard: 'guard', archer: 'archer', bomber: 'archer', giant: 'guard', lancer: 'knight', healer: 'archer', mage: 'archer' };

// 阵型模板：按优先顺序排列的位置，每个位置列出可用兵种。route 是敌方的行军路线（布阵时会画出来）。
const s = (x, y, types, extra = {}) => ({ x, y, types, ...extra });
const TOP_SWEEP = [{ x: 390, y: 92 }, { x: 250, y: 100 }, { x: 150, y: 170 }];
const BOTTOM_SWEEP = [{ x: 390, y: 508 }, { x: 250, y: 500 }, { x: 150, y: 430 }];
export const TEMPLATES = {
  line: { name: '战线', slots: [
    s(430, 300, ['knight', 'guard']), s(550, 260, ['archer']), s(430, 220, ['guard', 'knight']), s(550, 340, ['archer', 'bomber']), s(430, 380, ['knight']),
    s(500, 300, ['giant', 'guard']), s(550, 180, ['mage', 'archer']), s(430, 140, ['knight', 'lancer']), s(550, 420, ['archer']), s(430, 460, ['knight', 'lancer']), s(610, 300, ['healer', 'bomber'])
  ] },
  wall: { name: '盾墙', slots: [
    s(420, 300, ['guard']), s(520, 300, ['archer']), s(420, 220, ['guard']), s(420, 380, ['guard']), s(520, 200, ['archer', 'mage']), s(520, 400, ['archer']),
    s(600, 300, ['mage', 'bomber']), s(450, 130, ['knight', 'lancer']), s(450, 470, ['knight', 'lancer']), s(600, 200, ['healer', 'archer']), s(600, 400, ['archer'])
  ] },
  pincer: { name: '钳形攻势', slots: [
    s(520, 110, ['lancer', 'knight'], { route: TOP_SWEEP }), s(520, 490, ['lancer', 'knight'], { route: BOTTOM_SWEEP }), s(560, 300, ['archer']), s(470, 300, ['guard']),
    s(570, 140, ['lancer', 'knight'], { route: TOP_SWEEP }), s(570, 460, ['lancer', 'knight'], { route: BOTTOM_SWEEP }), s(610, 250, ['archer', 'bomber']), s(610, 350, ['archer', 'mage']),
    s(470, 220, ['knight']), s(470, 380, ['knight']), s(650, 300, ['healer', 'bomber'])
  ] },
  battery: { name: '炮台', rocks: [{ x: 420, y: 225, r: 34 }, { x: 420, y: 385, r: 34 }], slots: [
    s(520, 225, ['bomber', 'archer'], { hold: true }), s(450, 305, ['guard']), s(520, 385, ['mage', 'bomber', 'archer'], { hold: true }), s(610, 305, ['archer'], { hold: true }),
    s(470, 130, ['knight', 'lancer']), s(470, 480, ['knight', 'lancer']), s(560, 305, ['guard', 'giant']), s(620, 200, ['archer', 'mage'], { hold: true }), s(620, 410, ['archer'], { hold: true }), s(650, 305, ['healer', 'bomber'])
  ] },
  horde: { name: '蜂拥', slots: [
    s(430, 260, ['knight']), s(430, 340, ['knight']), s(470, 300, ['knight', 'lancer']), s(590, 300, ['bomber', 'archer']), s(470, 220, ['knight']), s(470, 380, ['knight']),
    s(510, 260, ['lancer', 'knight']), s(510, 340, ['lancer', 'knight']), s(590, 200, ['archer']), s(590, 400, ['archer']), s(640, 300, ['healer', 'mage'])
  ] },
  escort: { name: '护驾', slots: [
    s(470, 300, ['giant', 'guard']), s(570, 250, ['healer', 'archer']), s(430, 220, ['guard']), s(430, 380, ['guard']), s(570, 350, ['healer', 'archer']),
    s(620, 200, ['archer', 'mage']), s(620, 400, ['archer']), s(520, 140, ['knight', 'lancer']), s(520, 460, ['knight', 'lancer']), s(650, 300, ['bomber', 'mage'])
  ] },
  skirmish: { name: '散兵', slots: [
    s(560, 110, ['archer']), s(560, 490, ['archer']), s(450, 300, ['guard']), s(450, 160, ['lancer', 'knight']), s(450, 440, ['lancer', 'knight']),
    s(620, 300, ['archer', 'mage']), s(520, 210, ['archer', 'bomber']), s(520, 390, ['archer', 'bomber']), s(640, 200, ['mage', 'archer']), s(640, 400, ['healer', 'archer'])
  ] }
};
export const TEMPLATE_ORDER = Object.keys(TEMPLATES);

// 首领战：固定的首领加按规模补齐的护卫。boss 里的数字是首领自身的属性倍率（size 只影响画面大小）。
export const BOSSES = [
  { id: 'warlord', name: '巨人督军', boss: s(520, 300, ['giant'], { boss: { hp: 2.2, damage: 1.25, size: 1.25 } }), rocks: [{ x: 400, y: 160, r: 30 }, { x: 400, y: 440, r: 30 }], slots: [
    s(440, 300, ['guard']), s(600, 230, ['archer']), s(600, 370, ['archer']), s(450, 210, ['knight']), s(450, 390, ['knight']), s(620, 300, ['bomber', 'archer']), s(470, 130, ['knight']), s(470, 470, ['knight']), s(660, 200, ['archer']), s(660, 400, ['archer'])
  ] },
  { id: 'gunner', name: '峡谷炮台长', boss: s(600, 300, ['bomber'], { hold: true, boss: { hp: 10, damage: 1.5, aoe: 1.35, size: 1.25 } }), rocks: [{ x: 430, y: 220, r: 36 }, { x: 430, y: 380, r: 36 }], slots: [
    s(470, 300, ['guard']), s(530, 160, ['lancer'], { route: TOP_SWEEP }), s(530, 440, ['lancer'], { route: BOTTOM_SWEEP }), s(540, 230, ['archer'], { hold: true }), s(540, 370, ['archer'], { hold: true }),
    s(650, 300, ['healer']), s(470, 120, ['knight']), s(470, 480, ['knight']), s(640, 200, ['bomber'], { hold: true }), s(640, 400, ['archer'], { hold: true })
  ] },
  { id: 'queen', name: '冰霜女王', boss: s(610, 300, ['mage'], { boss: { hp: 5, damage: 1.3, aoe: 1.35, chill: 1.4, size: 1.3 } }), rocks: [{ x: 410, y: 300, r: 40, kind: 'pond' }], slots: [
    s(480, 300, ['giant']), s(560, 230, ['healer']), s(560, 370, ['healer']), s(450, 190, ['guard']), s(450, 410, ['guard']), s(540, 130, ['lancer'], { route: TOP_SWEEP }), s(540, 470, ['lancer'], { route: BOTTOM_SWEEP }),
    s(640, 180, ['archer']), s(640, 420, ['archer']), s(660, 300, ['mage'])
  ] }
];

const inZone = p => p.x >= ZONE.red + 10 && p.x <= W - MARGIN.side && p.y >= MARGIN.top + 10 && p.y <= H - MARGIN.bottom - 5;
// 地形：中间地带随机放几块巨石或水塘，留出通道，不压到敌人。
function terrain(rand, act, kind, fixed) {
  if (fixed) return fixed.map(o => ({ ...o }));
  const count = kind === 'boss' ? 0 : Math.floor(rand() * (act === 0 ? 3 : 4));
  const rocks = [];
  for (let tries = 0; tries < 40 && rocks.length < count; tries++) {
    const o = { x: Math.round(350 + rand() * 100), y: Math.round(110 + rand() * 380), r: Math.round(26 + rand() * 18) };
    if (act > 0 && rand() < .35) o.kind = 'pond';
    if (rocks.every(v => Math.hypot(v.x - o.x, v.y - o.y) > v.r + o.r + 60)) rocks.push(o);
  }
  return rocks;
}

// 生成一场遭遇战。value 是敌军兵种墨水价值之和的目标；实际生成的规模会落在目标附近。
export function makeEncounter({ seed, act, row, kind = 'battle', node = '' }) {
  const rand = rng(hash(seed, act, row, kind, node));
  const step = stepOf(act, row), ratio = kind === 'battle' ? RATIO.battle[Math.min(row, RATIO.battle.length - 1)] : kind === 'boss' ? RATIO.boss[act] ?? RATIO.boss.at(-1) : RATIO.elite[act] ?? RATIO.elite.at(-1);
  const target = Math.round(expectedInk(step) * ratio);
  const bossDef = kind === 'boss' ? BOSSES[act % BOSSES.length] : null;
  const templateId = bossDef ? bossDef.id : pickOne(rand, TEMPLATE_ORDER);
  const template = bossDef || TEMPLATES[templateId];
  const rocks = terrain(rand, act, kind, template.rocks);
  const enemies = []; let value = 0;
  const clear = p => rocks.every(o => Math.hypot(o.x - p.x, o.y - p.y) > o.r + 14) && enemies.every(u => Math.hypot(u.x - p.x, u.y - p.y) >= 30) && inZone(p);
  const add = (slot, type, jitter) => {
    const p = { x: slot.x + Math.round((rand() - .5) * jitter), y: slot.y + Math.round((rand() - .5) * jitter) };
    if (!clear(p)) { p.x = slot.x; p.y = slot.y; if (!clear(p)) return false; }
    const u = { type, x: p.x, y: p.y, team: 1 };
    if (slot.route) u.route = slot.route.map(q => ({ x: q.x + (p.x - slot.x), y: q.y + (p.y - slot.y) }));
    if (slot.hold) u.hold = true;
    if (slot.boss) u.boss = { ...slot.boss };
    enemies.push(u); value += TYPES[type].cost;
    return true;
  };
  if (bossDef) { add(bossDef.boss, bossDef.boss.types[0], 0); value = 0; }
  // 每个位置挑“最接近平均所需墨水”的可用兵种，让规模稳定落在目标附近。
  template.slots.forEach((slot, i) => {
    if (value >= target * .94 || enemies.length >= 12) return;
    const options = slot.types.filter(t => allowed(t, act, row, kind));
    const left = Math.max(1, Math.min(template.slots.length - i, 12 - enemies.length)), need = (target - value) / left;
    const type = options.length ? options.map(t => [t, Math.abs(TYPES[t].cost - need) + rand() * 6]).sort((a, b) => a[1] - b[1])[0][0] : FALLBACK[slot.types[0]];
    if (value + TYPES[type].cost > target * 1.08 && enemies.filter(u => !u.boss).length >= 4) {
      const cheaper = ['knight', 'archer'].find(t => value + TYPES[t].cost <= target * 1.08);
      if (cheaper) add(slot, cheaper, 16);
      return;
    }
    add(slot, type, 16);
  });
  const name = template.name;
  return { kind, act, row, theme: ACT_THEMES[act] || 'citadel', template: templateId, name, enemies, rocks, value, target, par: kind === 'boss' ? 45 : kind === 'elite' ? 40 : 35, enemyMods: enemyScale(act, kind) };
}
