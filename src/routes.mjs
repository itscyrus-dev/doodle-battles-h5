// 行军路线：把鼠标画出的轨迹整理成一串路点。模拟和界面共用，保证画出来的就是会走的。
import { W, H, MARGIN } from './data.mjs';
import { resolveRocks } from './terrain.mjs';

export const ROUTE = { step: 16, maxLength: 1400, maxPoints: 24, minLength: 30, skip: 18 };

// 按固定间距重新取点，限制总长度；再用折线简化去掉手抖。
export function shapeRoute(raw) {
  const pts = (Array.isArray(raw) ? raw : []).filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y)).map(p => ({ x: p.x, y: p.y }));
  if (pts.length < 2) return [];
  const out = [pts[0]]; let used = 0, carry = 0;
  for (let i = 1; i < pts.length && used < ROUTE.maxLength; i++) {
    let a = pts[i - 1]; const b = pts[i];
    let seg = Math.hypot(b.x - a.x, b.y - a.y);
    while (carry + seg >= ROUTE.step && used < ROUTE.maxLength) {
      const k = (ROUTE.step - carry) / seg, p = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      out.push(p); used += ROUTE.step; a = p; seg = Math.hypot(b.x - a.x, b.y - a.y); carry = 0;
    }
    carry += seg;
  }
  const last = pts.at(-1);
  if (used < ROUTE.maxLength && Math.hypot(last.x - out.at(-1).x, last.y - out.at(-1).y) > 4) out.push(last);
  let simple = simplify(out, 5);
  while (simple.length > ROUTE.maxPoints) simple = simple.filter((_, i) => i % 2 === 0 || i === simple.length - 1);
  return simple;
}
function simplify(points, eps) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop(), a = points[i], b = points[j], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    let far = -1, best = eps;
    for (let k = i + 1; k < j; k++) { const d = Math.abs((points[k].x - a.x) * dy - (points[k].y - a.y) * dx) / len; if (d > best) { best = d; far = k; } }
    if (far >= 0) { keep[far] = 1; stack.push([i, far], [far, j]); }
  }
  return points.filter((_, i) => keep[i]);
}
export const routeLength = (start, route) => route.reduce((s, p, i) => s + Math.hypot(p.x - (i ? route[i - 1] : start).x, p.y - (i ? route[i - 1] : start).y), 0);

// 给一名士兵套用路线：平移到它自己的位置、限制在战场内、推出障碍，去掉贴着起点的点。
export function fitRoute(start, route, dx, dy, rocks, radius) {
  const out = [];
  for (const p of route) {
    const q = { x: Math.max(MARGIN.side, Math.min(W - MARGIN.side, p.x + dx)), y: Math.max(MARGIN.top - 5, Math.min(H - MARGIN.bottom, p.y + dy)) };
    resolveRocks(q, rocks, radius + 4);
    q.x = Math.round(Math.max(MARGIN.side, Math.min(W - MARGIN.side, q.x))); q.y = Math.round(Math.max(MARGIN.top - 5, Math.min(H - MARGIN.bottom, q.y)));
    if (!out.length && Math.hypot(q.x - start.x, q.y - start.y) < ROUTE.skip) continue;
    if (out.length && Math.hypot(q.x - out.at(-1).x, q.y - out.at(-1).y) < 3) continue;
    out.push(q);
  }
  return routeLength(start, out) >= ROUTE.minLength ? out : [];
}
// 存档或关卡里读到的路线：逐点校验，坏数据整条丢弃。
export function validRoute(route) {
  return Array.isArray(route) && route.length > 0 && route.length <= ROUTE.maxPoints * 2 && route.every(p => Number.isFinite(p?.x) && Number.isFinite(p?.y) && p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H);
}
