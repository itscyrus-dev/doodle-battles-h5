// 自动对局时的道具用法，测试和关卡体检工具共用，保证两边口径一致。
import { TYPES, ITEMS, itemUnlocked } from '../src/data.mjs';
import { center } from '../src/combat.mjs';

// 落雷符的落点：选周围敌人最多的那个敌人。
export function bestStrikePoint(g) {
  const enemies = g.units.filter(u => u.team === 1 && u.hp > 0).map(u => center(u));
  if (!enemies.length) return null;
  const r = ITEMS.thunder.radius;
  let best = enemies[0], most = -1;
  for (const p of enemies) {
    const n = enemies.filter(q => Math.hypot(p.x - q.x, p.y - q.y) < r).length;
    if (n > most) { most = n; best = p; }
  }
  return { x: best.x, y: best.y };
}

// 每个模拟步调用一次：急救在有人低于 65% 生命时用；其他道具开战 2 秒后用。
export function autoItem(g) {
  if (g.phase !== 'battle' || g.itemUsed) return false;
  const id = g.selectedItem;
  if (id === 'heal') return g.units.some(u => !u.team && u.hp > 0 && u.hp < u.max * .65) ? g.useItem() : false;
  if (g.elapsed <= 2) return false;
  return ITEMS[id].targeted ? g.useItem(bestStrikePoint(g)) : g.useItem();
}

// 本关可用的道具：推荐道具已解锁就用它，否则退回急救旗。
export function itemFor(levelIndex, wanted) {
  return itemUnlocked(wanted, levelIndex) ? wanted : 'heal';
}

export function simulate(g, { item = 'heal', useItem = true, maxSteps = 4805 } = {}) {
  g.selectItem(item); g.start();
  for (let i = 0; i < maxSteps && g.phase === 'battle'; i++) { if (useItem) autoItem(g); g.update(1 / 60); g.events.length = 0; }
  return g;
}
