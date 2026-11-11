// 阵容草稿：保存时留兵种、位置、行军路线和驻守；读取时整份重新校验，坏数据不会部分恢复（坏路线单独丢掉）。
import { Battle } from './engine.mjs';
import { TYPES, TEAM_LIMIT } from './data.mjs';

const orders = u => ({ ...(u.route?.length ? { route: u.route.map(p => ({ x: p.x, y: p.y })) } : {}), ...(u.hold ? { hold: true } : {}) });
export function draftOf(g) { return g.plan.filter(u => !u.team).map(u => ({ type: u.type, x: u.x, y: u.y, team: 0, ...orders(u) })); }
export function validateDraft(level, raw) {
  if (!Array.isArray(raw) || raw.length > TEAM_LIMIT) return null;
  const g = new Battle(level);
  for (const u of raw) {
    if (!u || u.team !== 0 || !TYPES[u.type] || TYPES[u.type].unlock > level || !g.place(u.type, u.x, u.y, 0)) return null;
    g.applyOrders(g.plan.at(-1).pid, u);
  }
  return g.plan.map(u => ({ type: u.type, x: u.x, y: u.y, team: u.team, pid: u.pid, ...orders(u) }));
}
// 把一份草稿摆进任意一场战斗（远征用）：放不下的士兵直接跳过，返回摆进去的人数。
export function applyDraft(g, raw) {
  let n = 0;
  for (const u of Array.isArray(raw) ? raw : []) if (u && TYPES[u.type] && g.place(u.type, u.x, u.y, 0)) { g.applyOrders(g.plan.at(-1).pid, u); n++; }
  return n;
}
