// 布阵手势：画兵、从兵种卡拖入、拖动移位、拖回回收。落下之前不改变已有士兵。
import { TYPES } from './data.mjs';
import { paintUnit } from './render.mjs';

const STEP = 40; // 滑动画兵时，每隔这么远尝试放一名士兵

export class FormationInput {
  // say(code, params) 负责把提示翻译成当前语言；onChange(event, team, detail) 通知界面刷新。
  constructor({ canvas, roster, renderer, getGame, getSelection, select, onChange, say }) {
    Object.assign(this, { canvas, roster, renderer, getGame, getSelection, select, onChange, say });
    this.gesture = null; this.lastMessage = ''; this.lastMessageAt = 0;
    this.ghost = document.createElement('canvas'); this.ghost.width = 192; this.ghost.height = 192;
    this.ghost.className = 'drag-ghost'; this.ghost.hidden = true; this.ghost.setAttribute('aria-hidden', 'true'); document.body.append(this.ghost);
    canvas.addEventListener('pointerdown', e => this.down(e, null, canvas));
    const lost = e => { if (this.gesture?.pointer === e.pointerId) this.cancel(); };
    canvas.addEventListener('lostpointercapture', lost);
    // 兵种卡会随关卡重建，所以在容器上统一监听。
    roster.addEventListener('pointerdown', e => { const card = e.target.closest('[data-type]'); if (card && !card.disabled) this.down(e, card.dataset.type, card); });
    roster.addEventListener('lostpointercapture', lost);
    document.addEventListener('pointermove', e => this.move(e), { passive: false });
    document.addEventListener('pointerup', e => this.up(e));
    document.addEventListener('pointercancel', e => { if (this.gesture?.pointer === e.pointerId) this.cancel(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.cancel(); });
    window.addEventListener('blur', () => this.cancel());
  }
  get active() { return !!this.gesture; }
  inside(e, element) { const r = element.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }
  pick(p) {
    return this.getGame().plan.slice().sort((a, b) => b.y - a.y).find(u => Math.abs(p.x - u.x) < (u.type === 'giant' ? 28 : 21) && p.y > u.y - (u.type === 'giant' ? 92 : 64) && p.y < u.y + 10);
  }
  tell(code, params) {
    const key = code + JSON.stringify(params || {});
    if (key !== this.lastMessage || performance.now() - this.lastMessageAt > 1100) { this.say(code, params); this.lastMessage = key; this.lastMessageAt = performance.now(); }
  }
  errorParams(code, type) { return code === 'type-full' ? { type, n: TYPES[type].limit } : {}; }

  down(e, type = null, element = this.canvas) {
    const g = this.getGame(); if (this.active || g.phase !== 'build' || e.button > 0 || e.isPrimary === false) return;
    e.preventDefault();
    const point = this.renderer.point(e), selection = this.getSelection();
    const unit = !type && !selection.eraser ? this.pick(point) : null;
    const suggestion = !type && !unit && !selection.eraser ? (this.renderer.guideGhosts || []).find(v => Math.abs(point.x - v.x) < 24 && point.y > v.y - 66 && point.y < v.y + 14 && !g.placementError(v.type, v.x, v.y, v.team)) : null;
    if (suggestion) { point.x = suggestion.x; point.y = suggestion.y; this.select(suggestion.type); }
    const kind = type ? 'card' : unit ? 'unit' : 'paint';
    this.renderer.selectedPid = unit?.pid ?? null;
    this.gesture = {
      pointer: e.pointerId, element, startX: e.clientX, startY: e.clientY, kind, type: type || unit?.type || suggestion?.type || selection.type,
      unit, team: unit?.team || 0, offset: unit ? { x: unit.x - point.x, y: unit.y - point.y } : { x: 0, y: 0 }, point, moved: false, last: point
    };
    try { element.setPointerCapture(e.pointerId); } catch { /* 元素刚被重建时可能失败，手势照常进行 */ }
    if (type || unit) this.select(type || unit.type);
    if (kind === 'paint') { g.beginStroke(); this.renderer.inkTrail.push({ ...point, at: performance.now(), start: true }); this.paint(point); }
    this.onChange(unit ? 'inspect' : null, unit?.team, { type: unit?.type });
  }
  paint(p) {
    const g = this.getGame(), selection = this.getSelection();
    if (selection.eraser) { const before = g.plan.length; g.erase(p.x, p.y); this.onChange(before !== g.plan.length ? 'erase' : null); return; }
    const type = this.gesture?.type || selection.type;
    const team = g.sandbox && p.y < 300 ? 1 : 0;
    const error = g.placementError(type, p.x, p.y, team);
    if (!error) { g.place(type, p.x, p.y, team); this.onChange('place', team, { type }); return; }
    if (error === 'overlap') return;
    this.tell(error, this.errorParams(error, type));
    if (error !== this.lastRejected || performance.now() - (this.rejectedAt || 0) > 700) { this.lastRejected = error; this.rejectedAt = performance.now(); this.onChange('rejected', team, { reason: error, type }); }
  }
  move(e) {
    const s = this.gesture; if (!s || s.pointer !== e.pointerId) return;
    e.preventDefault(); if (this.getGame().phase !== 'build') { this.cancel(); return; }
    if (Math.hypot(e.clientX - s.startX, e.clientY - s.startY) > 7) s.moved = true;
    const p = this.renderer.point(e);
    if (s.kind === 'paint') {
      this.renderer.inkTrail.push({ ...p, at: performance.now() });
      const d = Math.hypot(p.x - s.last.x, p.y - s.last.y);
      if (d >= STEP) {
        const dx = (p.x - s.last.x) / d, dy = (p.y - s.last.y) / d, n = Math.floor(d / STEP);
        for (let i = 1; i <= n; i++) this.paint({ x: s.last.x + dx * i * STEP, y: s.last.y + dy * i * STEP });
        s.last = { x: s.last.x + dx * n * STEP, y: s.last.y + dy * n * STEP };
      }
      return;
    }
    if (!s.moved) return;
    s.point = { x: p.x + s.offset.x, y: p.y + s.offset.y };
    const g = this.getGame(); s.team = s.unit?.team ?? (g.sandbox && s.point.y < 300 ? 1 : 0);
    s.recycle = s.kind === 'unit' && (this.inside(e, document.getElementById('recycle')) || this.inside(e, this.roster));
    s.error = s.recycle ? '' : g.placementError(s.type, s.point.x, s.point.y, s.team, s.unit?.pid ?? null);
    const at = this.renderer.toClient(s.point);
    this.ghost.hidden = false; this.ghost.style.left = `${at.x}px`; this.ghost.style.top = `${at.y}px`;
    this.ghost.classList.toggle('invalid', !!s.error); this.ghost.classList.toggle('recycling', !!s.recycle);
    paintUnit(this.ghost, s.type, s.team === 0 ? this.renderer.skin : 'red', { flip: s.team === 1 });
    document.getElementById('app').classList.toggle('dragging-unit', s.kind === 'unit');
    document.getElementById('recycle').classList.toggle('over', !!s.recycle);
    this.renderer.drag = { ...s.point, type: s.type, team: s.team, unit: s.unit, valid: !s.error, recycle: s.recycle };
    this.onChange('drag', s.team, { type: s.type, error: s.error, recycle: s.recycle });
  }
  up(e) {
    const s = this.gesture; if (!s || s.pointer !== e.pointerId) return;
    if (s.kind !== 'paint' && s.moved) {
      const g = this.getGame(); this.move(e);
      if (s.recycle) { g.remove(s.unit.pid); this.onChange('remove', s.team, { type: s.type }); this.say(g.sandbox ? 'drag.recycledFree' : 'drag.recycled', { n: TYPES[s.type].cost }); }
      else if (s.error) { this.say(s.kind === 'unit' ? 'drag.back' : s.error, { ...this.errorParams(s.error, s.type), reasonCode: s.error }); this.onChange('rejected', s.team, { reason: s.error, type: s.type }); }
      else if (s.kind === 'unit') { if (g.move(s.unit.pid, s.point.x, s.point.y)) this.onChange('move', s.team, { type: s.type }); }
      else { g.beginStroke(); g.place(s.type, s.point.x, s.point.y, s.team); this.onChange('place', s.team, { type: s.type }); }
    }
    this.finish();
  }
  finish() {
    const s = this.gesture; this.gesture = null; if (s?.moved) this.renderer.selectedPid = null;
    try { if (s?.element.hasPointerCapture(s.pointer)) s.element.releasePointerCapture(s.pointer); } catch { /* 元素已不在页面上 */ }
    this.ghost.hidden = true; this.renderer.drag = null;
    document.getElementById('app').classList.remove('dragging-unit'); document.getElementById('recycle').classList.remove('over');
    this.onChange('idle');
  }
  cancel() { if (!this.gesture) return; if (this.gesture.kind === 'paint') this.getGame().undo(); this.finish(); }
}
