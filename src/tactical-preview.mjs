// 布阵时的战术预览：与战斗相同的选敌、射程和障碍判定；只预估静态接敌，不预测胜负。
import { TYPES } from './data.mjs';
import { unitDef } from './engine.mjs';
import { center } from './combat.mjs';
import { clearPath, nextWaypoint } from './terrain.mjs';

function firstIntersection(a, b, rocks) {
  const dx = b.x - a.x, dy = b.y - a.y, A = dx * dx + dy * dy; if (!A) return null; let earliest = Infinity;
  for (const o of rocks) {
    const ox = a.x - o.x, oy = a.y - o.y, B = 2 * (ox * dx + oy * dy), C = ox * ox + oy * oy - o.r * o.r, D = B * B - 4 * A * C; if (D < 0) continue;
    const t = C <= 0 ? 0 : (-B - Math.sqrt(D)) / (2 * A); if (t >= 0 && t <= 1) earliest = Math.min(earliest, t);
  }
  return Number.isFinite(earliest) ? { x: a.x + dx * earliest, y: a.y + dy * earliest } : null;
}
const nearest = (u, list) => list.reduce((a, b) => (Math.hypot(a.x - u.x, a.y - u.y) < Math.hypot(b.x - u.x, b.y - u.y) ? a : b));

// status 是状态代码，由界面翻译：no-enemy / support / unreachable / blocked / in-range / lob / hunt / route / hold
// 有行军路线时从路线终点开始估算；range 用的是带上远征加成后的射程。
export function formationPreview(g, unit) {
  const def = g.mods ? unitDef(unit.type, unit.team, g.mods) : TYPES[unit.type];
  const end = unit.route?.length ? unit.route.at(-1) : null, u = end ? { ...unit, x: end.x, y: end.y } : unit, a = center(u);
  const base = { unit, range: def.range, origin: a, target: null, route: [u], blocked: false, marching: !!end, hold: !!unit.hold };
  if (def.heals) return { ...base, status: unit.hold ? 'hold' : 'support' };
  const enemies = (g.sandbox ? g.plan : g.enemy).filter(v => v.team !== u.team);
  if (!enemies.length) return { ...base, status: 'no-enemy' };
  const prey = def.hunter ? enemies.filter(v => TYPES[v.type].backline) : [];
  const target = nearest(u, prey.length ? prey : enemies);
  const b = center(target), arrowRocks = g.rocks.filter(o => o.kind !== 'pond').map(o => ({ ...o, y: o.y - 24 }));
  const needsSight = def.projectile === 'arrow';
  const blocked = needsSight && !clearPath(a, b, arrowRocks);
  const inRange = Math.hypot(a.x - b.x, a.y - b.y) <= def.range + TYPES[target.type].r && !blocked;
  if (unit.hold) return { ...base, target: inRange ? target : null, aim: b, inRange, reachable: true, status: 'hold', blocked: inRange ? false : blocked };
  const route = [{ x: u.x, y: u.y }]; let p = { x: u.x, y: u.y }, reachable = true;
  if (!inRange) for (let k = 0; k < 16; k++) {
    const wp = nextWaypoint(p, target, g.rocks, def.r + 1), d = Math.hypot(wp.x - p.x, wp.y - p.y);
    if (d < .1) { reachable = false; break; }
    let stop = false;
    for (let i = 1; i <= Math.ceil(d / 6); i++) {
      const t = Math.min(1, i * 6 / d), q = { ...u, x: p.x + (wp.x - p.x) * t, y: p.y + (wp.y - p.y) * t }, c = center(q);
      if (Math.hypot(c.x - b.x, c.y - b.y) <= def.range + TYPES[target.type].r && (!needsSight || clearPath(c, b, arrowRocks))) { route.push({ x: q.x, y: q.y }); stop = true; break; }
    }
    if (stop) break; route.push({ x: wp.x, y: wp.y }); p = wp;
    if (Math.hypot(p.x - target.x, p.y - target.y) < 1) break;
    if (k === 15) reachable = false;
  }
  const status = !reachable ? 'unreachable' : blocked ? 'blocked' : inRange ? 'in-range' : def.projectile && !needsSight ? 'lob' : def.hunter && prey.length ? 'hunt' : 'route';
  return { ...base, target, aim: b, route, blocked, obstruction: blocked ? firstIntersection(a, b, arrowRocks) : null, inRange, reachable, status };
}
