// 远征里的贴纸：贴在作战本上，每张改一条规则。最多同时贴 5 张，满了要换下一张才能贴新的。
// 一半和“怎么画线”有关（route），一半改出兵、成长和运气。这里只有数据、数值和几何判断，不碰界面。
import { TEAM_LIMIT } from './data.mjs';
import { routeLength } from './routes.mjs';

// tier：common 普通、rare 稀有、legend 传说。贴纸包按稀有度抽，传说最少见。
export const STICKERS = {
  longhaul: { tier: 'rare', route: true },
  lasso: { tier: 'rare', route: true },
  cross: { tier: 'legend', route: true },
  trail: { tier: 'common', route: true },
  swift: { tier: 'common', route: true },
  ambush: { tier: 'common', route: true },
  lone: { tier: 'legend' },
  horde: { tier: 'rare' },
  snowball: { tier: 'legend' },
  dice: { tier: 'legend' },
  echo: { tier: 'rare' },
  savings: { tier: 'common' }
};
export const STICKER_ORDER = Object.keys(STICKERS);
export const TIERS = ['common', 'rare', 'legend'];
export const STICKER_SLOTS = 5;
// 卖掉或换下一张贴纸得到的金币。
export const SELL = { common: 25, rare: 40, legend: 60 };

// 数值。界面说明里的数字与这里一致。
export const STICKER_FX = {
  longhaul: { per: 100, step: .5, max: 2 }, // 走完路线后的第一击：路线每长 100，伤害 +50%，最多 +200%
  lasso: { mult: 1.5, close: 70, minLength: 160 }, // 终点离起点 70 以内、线长 160 以上算圈；圈住的敌人受到的伤害 ×1.5
  cross: { delay: 1.5, damage: 45, radius: 58, max: 3, merge: 40 }, // 两支小队的路线交叉处：1.5 秒后炸开，最多 3 处
  trail: { slow: .5, width: 22 }, // 路线留下的墨迹：敌人踩上去移速 ×0.5
  swift: { speed: 1.4 }, // 行军时移速 ×1.4，不停下交战
  ambush: { mult: 2.5, reveal: 110, wait: 5 }, // 没画线的小队原地埋伏：敌人走到 110 以内才看得见，第一击 ×2.5；5 秒没人来就出击
  lone: { hp: 3, damage: 2 }, // 只打出 1 张兵牌：生命 ×3、伤害 ×2
  horde: { extra: 2, hp: .6, damage: .75, team: 6 }, // 2 人以上的兵牌多 2 人，出战上限 +6，全体生命 ×0.6、伤害 ×0.75
  snowball: { step: .005, max: .6 }, // 贴上后每击倒一名敌人，全体伤害永久 +0.5%，最多 +60%
  savings: { per: 2, max: .3 } // 开战时每剩 2 墨水，全体伤害 +1%，最多 +30%
};

// 旧存档里的遗物换成贴纸：有对应的换成对应的，没有的每件折成 30 金币。
export const RELIC_TO_STICKER = { swift: 'swift', charge: 'longhaul', bleed: 'trail', anchor: 'ambush', horde: 'horde', fervor: 'snowball', echo: 'savings', tactician: 'echo' };
export const RELIC_REFUND = 30;

export const snowballBonus = n => Math.min(STICKER_FX.snowball.max, Math.max(0, n) * STICKER_FX.snowball.step);
export const haulBonus = length => Math.min(STICKER_FX.longhaul.max, Math.max(0, length) / STICKER_FX.longhaul.per * STICKER_FX.longhaul.step);
export const stickerPerks = (stickers = []) => ({ horde: stickers.includes('horde') });

// 把一局的贴纸和敌军强化合成战斗修正。贴纸都以 flags 交给模拟；人海和滚雪球直接改属性倍率。
export function runMods({ stickers = [], snowball = 0 } = {}, enemy = null, teamLimit = TEAM_LIMIT) {
  const mods = { all: {}, units: {}, enemy: enemy ? { ...enemy } : null, cost: {}, teamLimit, flags: {} };
  for (const id of stickers) if (STICKERS[id]) mods.flags[id] = true;
  if (mods.flags.horde) mods.teamLimit += STICKER_FX.horde.team; // 人数和每人的打折在牌上（cardStats 给小队加上“人海”关键词）
  if (mods.flags.snowball && snowball > 0) { mods.snowball = snowballBonus(snowball); mods.all.damage = 1 + mods.snowball; }
  return mods;
}

// ---------- 几何：模拟和布阵预览共用，保证画出来看到的加成就是开战后的加成 ----------
// 每支小队取一条代表路线：这队里第一个有路线的士兵，从它站的位置出发。key 是牌的编号（没有牌时用士兵编号）。
export function squadLines(units) {
  const lines = new Map();
  for (const u of units) {
    if (u.team !== 0 || !u.route?.length) continue;
    const key = u.card ?? `p${u.pid}`;
    if (!lines.has(key)) lines.set(key, { key, pts: [{ x: u.x, y: u.y }, ...u.route.map(p => ({ x: p.x, y: p.y }))] });
  }
  return [...lines.values()];
}
export const lineLength = pts => (pts.length > 1 ? routeLength(pts[0], pts.slice(1)) : 0);

// 首尾相接（终点离起点够近、线够长）的路线围成一个圈；不是圈时返回 null。
export function loopOf(pts) {
  if (pts.length < 4) return null;
  const a = pts[0], b = pts.at(-1);
  return Math.hypot(a.x - b.x, a.y - b.y) <= STICKER_FX.lasso.close && lineLength(pts) >= STICKER_FX.lasso.minLength ? pts : null;
}
export function insidePoly(poly, p) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
// 被圈住的敌人：任意一条首尾相接的路线围住了它的脚下。
export function lassoed(lines, enemies) {
  const loops = lines.map(l => loopOf(l.pts)).filter(Boolean);
  return loops.length ? enemies.filter(e => loops.some(poly => insidePoly(poly, e))) : [];
}

function segCross(a, b, c, d) {
  const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y, den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den, u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: Math.round(a.x + t * rx), y: Math.round(a.y + t * ry) } : null;
}
// 两支不同小队的路线相交的地方。离得很近的算一处，按找到的先后最多取 max 处。
export function crossings(lines, max = STICKER_FX.cross.max) {
  const out = [];
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const p = lines[i].pts, q = lines[j].pts;
    for (let a = 1; a < p.length; a++) for (let b = 1; b < q.length; b++) {
      const hit = segCross(p[a - 1], p[a], q[b - 1], q[b]);
      if (hit && !out.some(o => Math.hypot(o.x - hit.x, o.y - hit.y) < STICKER_FX.cross.merge)) out.push(hit);
      if (out.length >= max) return out;
    }
  }
  return out;
}

// 墨迹：所有小队代表路线的每一段。
export const trailOf = lines => lines.flatMap(l => l.pts.slice(1).map((p, i) => [l.pts[i], p]));
export function onTrail(p, segments, width = STICKER_FX.trail.width) {
  const r = width / 2;
  return segments.some(([a, b]) => {
    const dx = b.x - a.x, dy = b.y - a.y, len = dx * dx + dy * dy, k = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
    return Math.hypot(p.x - (a.x + dx * k), p.y - (a.y + dy * k)) <= r;
  });
}

// 掷骰子：用阵容本身算种子，同一套布阵每次掷出一样的结果；挪一挪士兵就会重新掷。
// 返回翻倍的那张牌和撤下的那张牌（只有一张牌时只翻倍，不撤下）。
export function diceRoll(units) {
  const mine = units.filter(u => u.team === 0 && u.card !== undefined);
  const cards = [...new Set(mine.map(u => u.card))].sort((a, b) => a - b);
  if (!cards.length) return null;
  let h = 2166136261;
  for (const u of mine) { h ^= Math.round(u.x) * 73 + Math.round(u.y) * 151 + u.card; h = Math.imul(h, 16777619); }
  const roll = k => { h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return (h >>> 0) % k; };
  const double = cards[roll(cards.length)], rest = cards.filter(c => c !== double);
  return { double, drop: rest.length ? rest[roll(rest.length)] : null };
}
