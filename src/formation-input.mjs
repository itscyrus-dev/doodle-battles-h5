// 布阵手势（电脑版，鼠标为主）：
//   布阵笔：左键拖动画兵；按住士兵拖动换位置，拖回左栏回收；单击士兵选中（Shift 多选）。
//   路线笔：从士兵身上拖出行军路线（选中的一组一起走）；在空地上画圈选人。
//   橡皮：按住左键划过士兵擦掉。
//   任何笔下：右键从士兵身上拖出路线，右键单击士兵取消它的命令。
// 卡牌模式（远征、教学）没有笔：把手牌拖到战场上出兵（或点牌再点战场）；从士兵身上拖线，整支小队沿线行军；
//   把线拖回左栏就收回这支小队；开战后把战术牌拖到战场上打出。
import { TYPES } from './data.mjs';
import { paintUnit } from './render.mjs';

const STEP = 40; // 拖动画兵时，每隔这么远尝试放一名士兵
const CLICK = 6; // 移动不超过这么多像素算单击

function inside(poly, p) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

export class FormationInput {
  // say(code, params) 负责把提示翻译成当前语言；onChange(event, team, detail) 通知界面刷新。
  // 卡牌模式：armed 是点选的兵牌，点战场调用 onStamp 整队放下；onDeal(事件, 牌, 落点) 处理拖牌（start 返回能不能拖）；
  // canRecall(牌) 决定这支小队能不能拖回手牌。
  constructor({ canvas, roster, recycle, renderer, getGame, getSelection, select, onChange, say, onStamp = null, onDeal = null, canRecall = () => true }) {
    Object.assign(this, { canvas, roster, recycle, renderer, getGame, getSelection, select, onChange, say, onStamp, onDeal, canRecall });
    this.gesture = null; this.lastMessage = ''; this.lastMessageAt = 0; this.tool = 'deploy'; this.armed = null;
    this.selection = new Set(); renderer.selection = this.selection;
    this.ghost = document.createElement('canvas'); this.ghost.width = 192; this.ghost.height = 192;
    this.ghost.className = 'drag-ghost'; this.ghost.hidden = true; this.ghost.setAttribute('aria-hidden', 'true'); document.body.append(this.ghost);
    canvas.addEventListener('pointerdown', e => this.down(e, null, canvas));
    canvas.addEventListener('pointermove', e => { if (!this.gesture) this.hover(e); });
    canvas.addEventListener('pointerleave', () => { if (!this.gesture) { this.renderer.hoverPid = null; this.renderer.stamp = null; this.canvas.classList.remove('over-unit'); this.onChange('hover'); } });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    const lost = e => { if (this.gesture?.pointer === e.pointerId) this.cancel(); };
    canvas.addEventListener('lostpointercapture', lost);
    // 兵种卡会随关卡重建，所以在容器上统一监听。
    roster.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const hand = e.target.closest('[data-hand]'); if (hand) { this.deal(e, +hand.dataset.hand, hand); return; }
      const card = e.target.closest('[data-type]'); if (card && !card.disabled) this.down(e, card.dataset.type, card);
    });
    roster.addEventListener('lostpointercapture', lost);
    document.addEventListener('pointermove', e => this.move(e), { passive: false });
    document.addEventListener('pointerup', e => this.up(e));
    document.addEventListener('pointercancel', e => { if (this.gesture?.pointer === e.pointerId) this.cancel(); });
    window.addEventListener('blur', () => this.cancel());
  }
  get active() { return !!this.gesture; }
  // 拖牌结束后浏览器还会补发一次 click，界面用它来区分“拖”和“点”。
  justDealt() { return performance.now() - (this.dealtAt || 0) < 350; }
  // 卡牌模式下，一名士兵所在的整支小队（同一张牌放下的人）。
  squad(u) { const g = this.getGame(); return g.cardMode && u.card !== undefined ? g.plan.filter(v => v.card === u.card && this.mine(v)).map(v => v.pid) : null; }
  setTool(tool) { if (['deploy', 'route', 'erase'].includes(tool)) { this.cancel(); this.tool = tool; this.canvas.classList.toggle('tool-route', tool === 'route'); this.canvas.classList.toggle('tool-erase', tool === 'erase'); } }
  insideEl(e, element) { const r = element.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }
  mine(u) { const g = this.getGame(); return g.sandbox || u.team === 0; }
  pick(p) {
    return this.getGame().plan.slice().sort((a, b) => b.y - a.y).find(u => this.mine(u) && Math.abs(p.x - u.x) < (u.type === 'giant' ? 28 : 21) && p.y > u.y - (u.type === 'giant' ? 92 : 64) && p.y < u.y + 10);
  }
  tell(code, params) {
    const key = code + JSON.stringify(params || {});
    if (key !== this.lastMessage || performance.now() - this.lastMessageAt > 1100) { this.say(code, params); this.lastMessage = key; this.lastMessageAt = performance.now(); }
  }
  errorParams(code, type) { return code === 'type-full' ? { type, n: this.getGame().limit(type) } : {}; }
  prune() { const g = this.getGame(); for (const pid of [...this.selection]) if (!g.plan.some(u => u.pid === pid)) this.selection.delete(pid); }
  setSelection(pids) { this.selection.clear(); for (const pid of pids) this.selection.add(pid); this.onChange('select'); }
  // 选中兵牌时，鼠标处预览整队会站在哪里。
  arm(card) { this.armed = card; this.renderer.stamp = null; this.canvas.classList.toggle('stamping', !!card); }
  preview(p) {
    const g = this.getGame(), c = this.armed;
    if (!c || g.phase !== 'build') { this.renderer.stamp = null; return; }
    const spots = g.squadSpots(c.type, c.n, Math.round(p.x), Math.round(p.y));
    this.renderer.stamp = { type: c.type, x: p.x, y: p.y, spots: spots || [{ x: p.x, y: p.y }], valid: !!spots && g.remaining >= c.ink };
  }
  hover(e) {
    const g = this.getGame(); if (g.phase !== 'build') { this.renderer.hoverPid = null; this.renderer.stamp = null; return; }
    if (this.armed) { this.preview(this.renderer.point(e)); this.canvas.classList.remove('over-unit'); return; }
    const unit = this.pick(this.renderer.point(e)), pid = unit?.pid ?? null;
    this.canvas.classList.toggle('over-unit', !!unit && this.tool === 'deploy');
    if (pid !== this.renderer.hoverPid) { this.renderer.hoverPid = pid; this.onChange('hover'); }
  }

  deal(e, index, element) {
    if (this.active || e.isPrimary === false || !this.onDeal?.('start', index)) return;
    e.preventDefault();
    this.gesture = { pointer: e.pointerId, element, startX: e.clientX, startY: e.clientY, kind: 'deal', index, moved: false };
    try { element.setPointerCapture(e.pointerId); } catch { /* 手牌刚被重建时可能失败 */ }
  }
  down(e, type = null, element = this.canvas) {
    const g = this.getGame(); if (this.active || g.phase !== 'build' || e.isPrimary === false || e.button > 2 || e.button === 1) return;
    e.preventDefault();
    const point = this.renderer.point(e), right = e.button === 2;
    // 卡牌模式：选着兵牌时左键直接放下整队，右键取消选牌。
    if (this.armed && !type) {
      if (right) { this.arm(null); this.onChange('disarm'); return; }
      this.onStamp?.(point); this.preview(point); return;
    }
    const unit = type ? null : this.pick(point);
    let kind;
    if (type) kind = g.cardMode ? 'none' : 'card';
    else if (right) kind = unit ? 'route' : 'none';
    else if (this.tool === 'erase') kind = 'erase';
    else if (this.tool === 'route') kind = unit ? 'route' : 'lasso';
    else if (unit) kind = g.cardMode ? 'route' : 'unit';
    else if (g.cardMode) kind = 'none';
    else {
      const suggestion = (this.renderer.guideGhosts || []).find(v => Math.abs(point.x - v.x) < 24 && point.y > v.y - 66 && point.y < v.y + 14 && !g.placementError(v.type, v.x, v.y, v.team));
      if (suggestion) { point.x = suggestion.x; point.y = suggestion.y; this.select(suggestion.type); }
      kind = 'paint';
    }
    if (kind === 'none') { if (this.selection.size) this.setSelection([]); return; }
    const pids = kind === 'route' ? (this.squad(unit) || (this.selection.has(unit.pid) ? [...this.selection] : [unit.pid])) : [];
    this.gesture = {
      pointer: e.pointerId, element, startX: e.clientX, startY: e.clientY, kind, right, shift: e.shiftKey, type: type || unit?.type || this.getSelection().type,
      unit, pids, team: unit?.team || 0, offset: unit ? { x: unit.x - point.x, y: unit.y - point.y } : { x: 0, y: 0 }, point, moved: false, last: point, points: [{ x: point.x, y: point.y }], placed: []
    };
    try { element.setPointerCapture(e.pointerId); } catch { /* 元素刚被重建时可能失败，手势照常进行 */ }
    if (type || (unit && kind === 'unit')) this.select(type || unit.type);
    if (kind === 'paint') { g.beginStroke(); this.renderer.inkTrail.push({ ...point, at: performance.now(), start: true }); this.paint(point); }
    if (kind === 'erase') { g.beginStroke(); this.erase(point); }
    if (kind === 'route' || kind === 'lasso') this.renderer.sketch = { kind, points: this.gesture.points, card: unit?.card };
    this.onChange(unit ? 'inspect' : null, unit?.team, { type: unit?.type });
  }
  paint(p) {
    const g = this.getGame(), type = this.gesture?.type || this.getSelection().type;
    const team = g.sandbox && p.x > (g.def?.zoneSplit ?? 360) ? 1 : 0;
    const error = g.placementError(type, p.x, p.y, team);
    if (!error) { g.place(type, p.x, p.y, team); this.gesture?.placed.push(g.plan.at(-1).pid); this.onChange('place', team, { type }); return; }
    if (error === 'overlap') return;
    this.tell(error, this.errorParams(error, type));
    if (error !== this.lastRejected || performance.now() - (this.rejectedAt || 0) > 700) { this.lastRejected = error; this.rejectedAt = performance.now(); this.onChange('rejected', team, { reason: error, type }); }
  }
  erase(p) {
    const g = this.getGame(), before = g.plan.length;
    g.plan = g.plan.filter(u => !this.mine(u) || Math.hypot(u.x - p.x, u.y - p.y + 20) > 26);
    if (g.plan.length !== before) { this.prune(); this.onChange('erase'); }
  }
  move(e) {
    const s = this.gesture; if (!s || s.pointer !== e.pointerId) return;
    e.preventDefault();
    if (s.kind === 'deal') {
      if (!s.moved && Math.hypot(e.clientX - s.startX, e.clientY - s.startY) > CLICK) { s.moved = true; s.element.classList.add('lifting'); }
      if (s.moved) this.onDeal('move', s.index, this.insideEl(e, this.canvas) ? this.renderer.point(e) : null);
      return;
    }
    if (this.getGame().phase !== 'build') { this.cancel(); return; }
    if (Math.hypot(e.clientX - s.startX, e.clientY - s.startY) > CLICK) s.moved = true;
    const p = this.renderer.point(e);
    if (s.kind === 'paint' || s.kind === 'erase') {
      if (s.kind === 'paint') this.renderer.inkTrail.push({ ...p, at: performance.now() });
      const d = Math.hypot(p.x - s.last.x, p.y - s.last.y), step = s.kind === 'paint' ? STEP : 8;
      if (d >= step) {
        const dx = (p.x - s.last.x) / d, dy = (p.y - s.last.y) / d, n = Math.floor(d / step);
        for (let i = 1; i <= n; i++) { const q = { x: s.last.x + dx * i * step, y: s.last.y + dy * i * step }; if (s.kind === 'paint') this.paint(q); else this.erase(q); }
        s.last = { x: s.last.x + dx * n * step, y: s.last.y + dy * n * step };
      }
      return;
    }
    if (s.kind === 'route' || s.kind === 'lasso') {
      const last = s.points.at(-1);
      if (Math.hypot(p.x - last.x, p.y - last.y) >= 4) s.points.push({ x: p.x, y: p.y });
      // 卡牌模式：把线拖回左栏就是收回这支小队。
      if (s.kind === 'route' && s.moved && this.getGame().cardMode && this.canRecall(s.unit.card)) {
        s.recycle = this.insideEl(e, this.recycle.parentElement);
        document.getElementById('app').classList.add('dragging-unit'); this.recycle.classList.toggle('over', s.recycle);
      }
      return;
    }
    if (!s.moved) return;
    s.point = { x: p.x + s.offset.x, y: p.y + s.offset.y };
    const g = this.getGame(); s.team = s.unit?.team ?? (g.sandbox && s.point.x > 360 ? 1 : 0);
    s.recycle = s.kind === 'unit' && this.insideEl(e, this.recycle.parentElement);
    s.error = s.recycle ? '' : g.placementError(s.type, s.point.x, s.point.y, s.team, s.unit?.pid ?? null);
    const at = this.renderer.toClient(s.point);
    this.ghost.hidden = false; this.ghost.style.left = `${at.x}px`; this.ghost.style.top = `${at.y}px`;
    this.ghost.classList.toggle('invalid', !!s.error); this.ghost.classList.toggle('recycling', !!s.recycle);
    paintUnit(this.ghost, s.type, s.team === 0 ? this.renderer.skin : 'red', { flip: s.team === 1 });
    document.getElementById('app').classList.toggle('dragging-unit', s.kind === 'unit');
    this.recycle.classList.toggle('over', !!s.recycle);
    this.renderer.drag = { ...s.point, type: s.type, team: s.team, unit: s.unit, valid: !s.error, recycle: s.recycle };
    this.onChange('drag', s.team, { type: s.type, error: s.error, recycle: s.recycle });
  }
  up(e) {
    const s = this.gesture; if (!s || s.pointer !== e.pointerId) return;
    const g = this.getGame();
    if (s.kind === 'deal') {
      if (s.moved) { this.dealtAt = performance.now(); this.onDeal('drop', s.index, this.insideEl(e, this.canvas) ? this.renderer.point(e) : null); }
      this.finish(); return;
    }
    if (s.kind === 'paint' && s.placed.length) this.setSelection(s.placed);
    else if (s.kind === 'route') {
      if (s.recycle) { g.recallCard(s.unit.card); this.prune(); this.onChange('recall', 0, { type: s.type, card: s.unit.card }); }
      else if (s.moved && s.points.length > 1) {
        const n = g.setRoute(s.pids, s.points, s.unit.pid);
        if (n) { this.setSelection(s.pids); this.tell('route.given', { n }); this.onChange('route', 0, { n }); } else this.tell('route.short');
      } else if (s.right) { if (g.clearOrders(s.pids)) { this.tell('route.cleared'); this.onChange('orders'); } }
      else this.toggle(s.unit.pid, s.shift);
    } else if (s.kind === 'lasso') {
      const poly = s.points;
      if (s.moved && poly.length > 2) {
        const pids = g.plan.filter(u => this.mine(u) && inside(poly, { x: u.x, y: u.y - 18 })).map(u => u.pid);
        this.setSelection(s.shift ? [...new Set([...this.selection, ...pids])] : pids);
        if (pids.length) this.tell('route.lasso', { n: pids.length });
      } else this.setSelection([]);
    } else if (s.kind === 'unit' && !s.moved) this.toggle(s.unit.pid, s.shift);
    else if ((s.kind === 'unit' || s.kind === 'card') && s.moved) {
      this.move(e);
      if (s.recycle && g.cardMode) { g.recallCard(s.unit.card); this.prune(); this.onChange('recall', s.team, { type: s.type, card: s.unit.card }); }
      else if (s.recycle) { g.remove(s.unit.pid); this.prune(); this.onChange('remove', s.team, { type: s.type }); this.say(g.sandbox ? 'drag.recycledFree' : 'drag.recycled', { n: g.cost(s.type) }); }
      else if (s.error) { this.say(s.kind === 'unit' ? 'drag.back' : s.error, { ...this.errorParams(s.error, s.type), reasonCode: s.error }); this.onChange('rejected', s.team, { reason: s.error, type: s.type }); }
      else if (s.kind === 'unit') { if (g.move(s.unit.pid, s.point.x, s.point.y)) this.onChange('move', s.team, { type: s.type }); }
      else { g.beginStroke(); g.place(s.type, s.point.x, s.point.y, s.team); this.setSelection([g.plan.at(-1).pid]); this.onChange('place', s.team, { type: s.type }); }
    }
    this.finish();
  }
  toggle(pid, additive) {
    if (additive) { if (this.selection.has(pid)) this.selection.delete(pid); else this.selection.add(pid); this.onChange('select'); }
    else this.setSelection(this.selection.size === 1 && this.selection.has(pid) ? [] : [pid]);
  }
  finish() {
    const s = this.gesture; this.gesture = null;
    try { if (s?.element.hasPointerCapture(s.pointer)) s.element.releasePointerCapture(s.pointer); } catch { /* 元素已不在页面上 */ }
    if (s?.kind === 'deal') { s.element.classList.remove('lifting'); this.onDeal?.('end', s.index); return; }
    this.ghost.hidden = true; this.renderer.drag = null; this.renderer.sketch = null;
    document.getElementById('app').classList.remove('dragging-unit'); this.recycle.classList.remove('over');
    this.onChange('idle');
  }
  cancel() { if (!this.gesture) return; if (this.gesture.kind === 'paint' || this.gesture.kind === 'erase') this.getGame().undo(); this.finish(); }
}
