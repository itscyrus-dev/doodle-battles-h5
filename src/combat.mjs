// 渲染与模拟共享的握持位置，确保弹道从可见武器前端出发。
export const UNIT_SCALE = 1.22;
export const ANGLE_TOLERANCE = 0.10;
export const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
export function turnTowards(current, target, maxStep) {
  return current + Math.max(-maxStep, Math.min(maxStep, wrapAngle(target-current)));
}
export const unitScale = u => UNIT_SCALE * (u.type === 'giant' ? 1.38 : 1);
export const center = u => ({x:u.x, y:u.y-20*unitScale(u)});
const MUZZLE = { bomber: [5, -14], mage: [10, -18], default: [22, 0] };
export function muzzle(u) {
  const p=center(u), s=unitScale(u);
  // 投掷和施法从手边或杖尖出手，射箭从弓的前端出手。
  const [x, y] = MUZZLE[u.type] || MUZZLE.default;
  return {x:p.x+(Math.cos(u.angle)*x-Math.sin(u.angle)*y)*s,
    y:p.y+(Math.sin(u.angle)*x+Math.cos(u.angle)*y)*s};
}
export function segmentDistance(px,py,ax,ay,bx,by) {
  const dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy;
  const t=len ? Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len)) : 0;
  return Math.hypot(px-ax-t*dx,py-ay-t*dy);
}
