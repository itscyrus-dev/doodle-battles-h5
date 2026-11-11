// 新手引导与可选挑战。文案用代码表示（guide.* / spot.*），由界面按语言显示。
import { TYPES } from './data.mjs';

const kinds = g => new Set(g.plan.filter(u => !u.team).map(u => u.type)).size;
const survivors = g => g.units.filter(u => !u.team && u.hp > 0).length;
// 每个挑战只依据真实战斗结果判定。
export const SPOTLIGHTS = {
  0: { id: 'rear', check: g => g.phase === 'won' && g.units.some(u => u.team === 0 && u.type === 'archer') && g.units.filter(u => u.team === 0 && u.type === 'archer').every(u => u.hp > 0) },
  1: { id: 'mixed', check: g => g.phase === 'won' && kinds(g) >= 2 },
  2: { id: 'blast', check: g => g.phase === 'won' && (g.stats?.[0].byType.bomber.dealt || 0) > 0 },
  5: { id: 'sight', check: g => g.phase === 'won' && (g.stats?.[0].arrowsFired || 0) > 0 && g.stats[0].stoneArrows === 0 },
  9: { id: 'teamwork', check: g => g.phase === 'won' && kinds(g) >= 3 && survivors(g) >= 3 },
  19: { id: 'intact', check: g => g.phase === 'won' && survivors(g) >= 5 },
  29: { id: 'swift', check: g => g.phase === 'won' && g.elapsed <= 25 },
  39: { id: 'bare', check: g => g.phase === 'won' && !g.itemUsed }
};

const step = (id, target, ghosts) => ({ id, title: `guide.${id}.title`, text: `guide.${id}.text`, target, ...(ghosts ? { ghosts } : {}) });
const ghost = (type, x, y) => ({ type, x, y, team: 0 });
// 根据当前布阵进度给出下一步引导；返回 null 表示没有引导。
export function guideStep(g, flags = {}) {
  if (g.phase !== 'build' || g.sandbox) return null;
  const front = g.plan.filter(u => u.team === 0 && !TYPES[u.type].backline), archers = g.count('archer');
  if (g.level === 0) {
    if (front.length < 2) return step('front', 'roster', [ghost('guard', 305, 170), ghost('guard', 305, 300)]);
    if (archers < 2) return step('rear', 'roster', [ghost('archer', 180, 150), ghost('archer', 180, 290)]);
    if (!flags.moved) return step('move', 'arena');
    return step('start', 'start');
  }
  if (g.level === 1) {
    if (!flags.inspected) return step('inspect', 'arena');
    if (kinds(g) < 2) return step('mix', 'roster');
    return step('wall', 'start');
  }
  if (g.level === 2) {
    if (!g.count('bomber')) return step('blast', 'roster', [ghost('bomber', 170, 290)]);
    if (!flags.itemChosen) return step('item', 'item');
    return step('area', 'start');
  }
  if (g.level === 5 && !flags.inspected) return step('cover', 'arena');
  if (g.level === 10 && !g.count('lancer')) return step('lancer', 'roster', [ghost('lancer', 298, 130)]);
  if (g.level === 12 && !flags.itemChosen) return step('thunder', 'item');
  if (g.level === 15 && !g.count('healer')) return step('healer', 'roster', [ghost('healer', 200, 300)]);
  if (g.level === 20 && !g.count('mage')) return step('mage', 'roster', [ghost('mage', 190, 300)]);
  if (g.level === 22 && !flags.itemChosen) return step('frost', 'item');
  return null;
}
