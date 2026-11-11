// 战场绘制：背景、障碍、角色贴图动画、弹道和特效。只读取模拟状态，不修改它。
import { W, H, TYPES, ZONE, starsFor } from './data.mjs';
import { formationPreview } from './tactical-preview.mjs';
import { image, drawUnitImage, UNIT_HEIGHT, PALETTES } from './assets.mjs';
import { STICKER_FX, squadLines, lineLength, haulBonus, lassoed, crossings, trailOf } from './stickers.mjs';

const INK = '#22304a';
const FONT = 'ui-rounded,"SF Pro Rounded","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif';
const TAU = Math.PI * 2;
const BLUE_INK = '#3f63c7', RED_INK = '#d2543f';
const STRIDE = 15; // 走一步的距离（逻辑像素）：走得快步子就密，巨人步子慢

function ellipse(c, x, y, rx, ry, color) { c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); }
function line(c, x, y, a, b, color = INK, width = 2) { c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(a, b); c.stroke(); }
function ring(c, x, y, rx, ry, color, width = 2) { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.stroke(); }
function pill(c, x, y, w, h, fill, stroke = null, width = 1.5) { c.beginPath(); c.roundRect(x, y, w, h, Math.min(w, h) / 2); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); } }
function label(c, text, x, y, size, fill, { stroke = INK, width = 3.5, weight = 800, align = 'center' } = {}) {
  c.font = `${weight} ${size}px ${FONT}`; c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round';
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.strokeText(text, x, y); }
  c.fillStyle = fill; c.fillText(text, x, y);
}
function star(c, x, y, r, fill, stroke = INK) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .46 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.lineJoin = 'round'; c.stroke(); }
}
const teamColor = (team, skin) => team === 0 ? (PALETTES[skin] || PALETTES.blue).swatch : PALETTES.red.swatch;
const rand = (a, b) => a + Math.random() * (b - a);
// 按比例混合两个 #rrggbb 颜色。
function mix(a, b, k) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), ch = s => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

const SHORE = { meadow: ['#e9dcae', '#7aa84f'], canyon: ['#f6e3b5', '#d9a868'], snow: ['#ffffff', '#b9d6ea'], citadel: ['#d9d2bd', '#8f8a78'] };
function drawPond(c, o, t, reduced, theme) {
  const ry = o.r * .86, [sand, rim] = SHORE[theme] || SHORE.meadow;
  ellipse(c, o.x, o.y + 2, o.r + 6, ry + 6, rim);
  ellipse(c, o.x, o.y, o.r + 2, ry + 2, sand);
  const water = c.createLinearGradient(o.x, o.y - ry, o.x, o.y + ry);
  water.addColorStop(0, theme === 'snow' ? '#a9dcf2' : '#6fc0e8'); water.addColorStop(1, theme === 'snow' ? '#6fb4e0' : '#3f95d2');
  ellipse(c, o.x, o.y, o.r - 4, ry - 4, water);
  ring(c, o.x, o.y, o.r + 6, ry + 6, INK, 2); ring(c, o.x, o.y, o.r - 4, ry - 4, 'rgba(34,48,74,.55)', 1.5);
  c.save(); c.beginPath(); c.ellipse(o.x, o.y, o.r - 4, ry - 4, 0, 0, TAU); c.clip();
  for (let i = 0; i < 4; i++) {
    const phase = reduced ? 0 : Math.sin(t * 1.1 + i * 1.9) * 5, y = o.y - ry * .5 + i * ry * .33, x = o.x - o.r * .45 + (i % 2) * o.r * .5 + phase;
    line(c, x, y, x + o.r * .32, y, 'rgba(255,255,255,.6)', 2);
  }
  c.restore();
}
function drawRock(c, o, theme) {
  const img = image(`obstacles/rock-${theme}.webp`);
  ellipse(c, o.x, o.y + o.r * .5, o.r * 1.05, o.r * .34, 'rgba(30,45,60,.25)');
  if (!img) { ellipse(c, o.x, o.y - o.r * .2, o.r, o.r * .8, '#9aa39a'); ring(c, o.x, o.y - o.r * .2, o.r, o.r * .8, INK, 2); return; }
  const w = o.r * 2.5, h = w * img.naturalHeight / img.naturalWidth;
  c.drawImage(img, o.x - w / 2, o.y + o.r * .72 - h, w, h);
}

const height = f => (f.unit ? UNIT_HEIGHT[f.unit.type] : 62);
function drawEffect(c, f, renderer) {
  const reduced = renderer.reduced, p = f.t / f.life, alpha = 1 - p;
  c.save(); c.translate(f.x, f.y); c.globalAlpha = Math.max(0, alpha);
  if (f.kind === 'death') {
    const u = f.unit, pose = renderer.faces.get(u.id) || renderer.defaultPose(u), palette = u.team === 0 ? renderer.skin : 'red';
    if (!reduced) {
      const options = { flip: pose.flip < 0, back: pose.back };
      c.save(); c.globalAlpha = Math.max(0, 1 - p * 1.25); c.rotate(p * -pose.flip * 1.1); c.translate(0, p * 6); c.scale(1 + p * .12, 1 - p * .25);
      drawUnitImage(c, u.type, palette, 0, 3, UNIT_HEIGHT[u.type], options);
      if (p < .3) drawUnitImage(c, u.type, palette, 0, 3, UNIT_HEIGHT[u.type], { ...options, alpha: 1 - p / .3, silhouette: '#ffffff' });
      c.restore();
    } else for (let i = 0; i < 6; i++) ellipse(c, Math.cos(i * 1.7) * p * 24, -10 + Math.sin(i * 1.7) * p * 12, 5 + p * 5, 4 + p * 4, '#fff8e6');
  } else if (f.kind === 'heal') {
    ring(c, 0, 0, 12 + p * 26, 5 + p * 9, '#5fbf6b', 2.5);
    for (let i = 0; i < 3; i++) { const x = (i - 1) * 11, y = -22 - p * 26 - i * 5; line(c, x - 4, y, x + 4, y, '#5fbf6b', 3.2); line(c, x, y - 4, x, y + 4, '#5fbf6b', 3.2); }
  } else if (f.kind === 'healbeam') {
    c.setTransform(c.getTransform()); const dx = f.tx - f.x, dy = f.ty - f.y;
    for (let i = 0; i <= 6; i++) { const k = i / 6, wob = reduced ? 0 : Math.sin(k * Math.PI * 2 + p * 10) * 4; ellipse(c, dx * k + wob, dy * k, 3.2 - Math.abs(k - p) * 2, 3.2 - Math.abs(k - p) * 2, '#8be28f'); }
  } else if (f.kind === 'slash' || f.kind === 'charge') {
    if (!reduced || f.kind === 'charge') {
      c.rotate(f.angle); const big = f.heavy || f.kind === 'charge';
      c.strokeStyle = f.kind === 'charge' ? '#ffe08a' : f.heavy ? '#ffd27a' : '#fff6d6'; c.lineWidth = big ? 8 : 4.5; c.lineCap = 'round';
      c.beginPath(); c.arc(0, 0, (big ? 38 : 30) + p * 8, -.85 + p, .75 + p); c.stroke();
      c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, (big ? 43 : 34) + p * 8, -.6 + p, .7 + p); c.stroke();
      if (f.kind === 'charge') for (let i = -1; i <= 1; i++) line(c, -46 - p * 20, i * 9, -18 - p * 10, i * 9, 'rgba(255,255,255,.85)', 3);
    }
  } else if (f.kind === 'boom') {
    const r = f.radius || 48;
    ellipse(c, 0, 0, r, r * .8, 'rgba(255,190,90,.22)');
    if (!reduced) {
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ellipse(c, Math.cos(a) * p * r * .7, Math.sin(a) * p * r * .52 - p * 8, 10 + p * 9, 9 + p * 8, p < .22 ? '#ffe28a' : p < .5 ? '#ffb45e' : '#e8e0d0'); }
      ellipse(c, 0, -4, 16 * (1 - p), 13 * (1 - p), '#fffbe0');
    }
    ring(c, 0, 0, 6 + p * r, (6 + p * r) * .8, '#ff9d4d', 4 * (1 - p) + .5);
  } else if (f.kind === 'frostburst') {
    const r = f.radius || 44;
    ellipse(c, 0, 0, r, r * .8, 'rgba(160,220,255,.3)');
    ring(c, 0, 0, 8 + p * r, (8 + p * r) * .8, '#e8f8ff', 4 * (1 - p) + .5);
    if (!reduced) for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + .3, d = 10 + p * r * .7; c.save(); c.translate(Math.cos(a) * d, Math.sin(a) * d * .8); c.rotate(a);
      c.fillStyle = '#d6f2ff'; c.strokeStyle = '#5aa6dc'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(9, 0); c.lineTo(0, 4); c.lineTo(-7, 0); c.lineTo(0, -4); c.closePath(); c.fill(); c.stroke(); c.restore();
    }
  } else if (f.kind === 'mark') {
    c.globalAlpha = 1; const r = f.radius || 60, shrink = 1.25 - p * .25;
    c.setLineDash([7, 6]); ring(c, 0, 0, r * shrink, r * .8 * shrink, '#ffd84a', 3); c.setLineDash([]);
    ellipse(c, 0, 0, r * p, r * .8 * p, 'rgba(255,220,90,.2)');
  } else if (f.kind === 'thunder') {
    const r = f.radius || 60;
    ellipse(c, 0, 0, r, r * .8, `rgba(255,240,150,${.45 * (1 - p)})`);
    ring(c, 0, 0, 10 + p * r, (10 + p * r) * .8, '#fff3a0', 5 * (1 - p) + .5);
    if (p < .6) {
      c.globalAlpha = 1 - p / .6; c.strokeStyle = INK; c.lineWidth = 9; c.lineJoin = 'round'; c.lineCap = 'round';
      const bolt = () => { c.beginPath(); c.moveTo(10, -H); let x = 10, y = -H; for (let i = 0; i < 9; i++) { y += H / 9; x = i === 8 ? 0 : (i % 2 ? -1 : 1) * (10 + (i * 37 % 13)); c.lineTo(x, y); } c.stroke(); };
      bolt(); c.strokeStyle = '#ffe14a'; c.lineWidth = 5.5; bolt(); c.strokeStyle = '#fffbe0'; c.lineWidth = 2; bolt();
    }
  } else if (f.kind === 'hit' || f.kind === 'block' || f.kind === 'release') {
    const block = f.kind === 'block', release = f.kind === 'release';
    if (block && f.actor) label(c, renderer.words.block || 'BLOCK', 0, -22 - p * 10, 12, '#dff6ff', { width: 3 });
    if (f.big && !block) label(c, `-${f.amount}`, 0, -30 - p * 22, 17, f.team === 0 ? '#ff9c8a' : '#fff4c2');
    if (!reduced) {
      c.rotate(f.angle || 0);
      if (!release) { c.fillStyle = block ? '#d9f1ff' : '#fff2a8'; c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); for (const [x, y] of [[-8, -3], [-4, -13], [0, -5], [9, -9], [5, 0], [13, 5], [3, 5], [0, 13], [-3, 5], [-12, 5]]) c.lineTo(x * (1 + p * .4), y * (1 + p * .4)); c.closePath(); c.fill(); c.stroke(); }
      for (let i = 0; i < (release ? 3 : 6); i++) { const a = i * 2.4, r = 6 + p * (release ? 11 : 26), x = Math.cos(a) * r, y = Math.sin(a) * r; line(c, x, y, x + Math.cos(a) * 5, y + Math.sin(a) * 5, block ? '#bfe3f5' : '#ffc95e', 2.4 * (1 - p) + .5); }
    }
  } else if (f.kind === 'flank') {
    label(c, renderer.words.flank || 'FLANK!', 0, -34 - p * 18, 15, '#ffe08a', { width: 4 });
    if (!reduced) { c.rotate(f.angle || 0); for (let i = -1; i <= 1; i++) line(c, -24 - p * 12, i * 8, 6 - p * 6, i * 8, '#fff6d6', 3 * (1 - p) + .5); }
  } else if (f.kind === 'primed') {
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = 8 + p * 26; line(c, Math.cos(a) * r * .5, Math.sin(a) * r * .5, Math.cos(a) * r, Math.sin(a) * r, '#ffd84a', 3.5 * (1 - p) + .5); }
  } else if (f.kind === 'shout') {
    const pop = Math.min(1, p * 5), size = 24 * (.75 + .25 * pop);
    label(c, renderer.words[f.text] || '', 0, -height(f) - 22 - p * 24, size, '#ffe08a', { stroke: '#22304a', width: 6, weight: 900 });
  } else if (f.kind === 'refund') {
    label(c, `+${f.n || 1}`, 0, -height(f) - p * 22, 15, '#cfe6ff', { stroke: '#22304a', width: 4 });
    if (!reduced) ellipse(c, 0, -height(f) * .5, 6 + p * 10, 6 + p * 10, `rgba(80,140,255,${.35 * (1 - p)})`);
  } else if (f.kind === 'shield') {
    ring(c, 0, -22, 14 + p * 16, 18 + p * 18, '#8fd0ff', 3 * (1 - p) + .5);
  } else if (f.kind === 'arrive') {
    ring(c, 0, 2, 10 + p * 18, (10 + p * 18) * .4, f.primed ? '#ffd84a' : '#ffffff', 3 * (1 - p) + .5);
  } else if (f.kind === 'sticker') {
    // 贴纸生效：头顶弹出一张小贴纸（图标、贴纸名、数值），先弹大再落定，最后才淡出。
    const pop = Math.min(1, p * 6), s = (.6 + .4 * pop) * (1 + (1 - pop) * .3), icon = image(`icons/sticker-${f.id}.webp`);
    const name = renderer.stickerName?.(f.id) || '', value = f.word ? renderer.words?.[f.word] || '' : f.text || '';
    c.globalAlpha = Math.min(1, (1 - p) * 3);
    c.translate(0, -height(f) - 34 - p * 20); c.rotate(-.05); c.scale(s, s);
    c.font = `900 11px ${FONT}`; const wn = c.measureText(name).width; c.font = `900 19px ${FONT}`; const wv = value ? c.measureText(value).width : 0;
    const w = Math.max(wn, wv) + 40, h = value ? 44 : 28;
    c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 12); c.fillStyle = '#fffdf2'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
    if (icon) c.drawImage(icon, -w / 2 - 16, -h / 2 - 12, 36, 36);
    label(c, name, 9, value ? -9 : 0, 11, INK, { stroke: null, weight: 900 });
    if (value) label(c, value, 9, 10, 19, '#d97a00', { stroke: null, weight: 900 });
  } else if (!reduced && f.kind === 'dust') ellipse(c, 0, 0, 3 + p * 7, 2 + p * 3, 'rgba(240,230,200,.6)');
  c.restore();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas; this.c = canvas.getContext('2d');
    this.theme = 'meadow'; this.skin = 'blue'; this.words = {}; this.unitName = type => type;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.faces = new Map(); this.inkTrail = []; this.reticle = null;
    this.particles = []; this.decals = []; this.seenFx = new WeakSet(); this.timeScale = 1; this.bodies = new Map(); this.frameDt = 0;
    this.resize(); new ResizeObserver(() => this.resize()).observe(canvas);
  }
  setTheme(theme) { if (theme !== this.theme) { this.theme = theme; this.fieldCache = null; } }
  resize() {
    const r = this.canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    if (!r.width || !r.height) return;
    this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr);
    this.scale = Math.min(this.canvas.width / W, this.canvas.height / H);
    this.ox = (this.canvas.width - W * this.scale) / 2; this.oy = (this.canvas.height - H * this.scale) / 2;
    this.fieldCache = null;
  }
  point(e) { const r = this.canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) * this.canvas.width / r.width - this.ox) / this.scale, y: ((e.clientY - r.top) * this.canvas.height / r.height - this.oy) / this.scale }; }
  // 把战场坐标换成页面坐标，供拖动时的浮动预览使用。
  toClient(p) { const r = this.canvas.getBoundingClientRect(); return { x: r.x + (p.x * this.scale + this.ox) * r.width / this.canvas.width, y: r.y + (p.y * this.scale + this.oy) * r.height / this.canvas.height }; }
  // 震屏只在表现层偏移画面；减少动效模式下不震。
  kick(amount) { if (!this.reduced) this.shake = Math.min(10, (this.shake || 0) + amount); }

  // 静态背景只在尺寸、主题变化或图片到位时画一次，之后每帧直接贴图。
  // 横版背景：两侧营帐分别在战场左右边缘外。横版图还没到位时，把竖版图转 90° 顶上。
  field() {
    const wide = image(`bg/field-${this.theme}-wide.webp`), tall = wide ? null : image(`bg/field-${this.theme}.webp`), art = wide || tall;
    if (this.fieldCache && this.fieldCache.art === art) return this.fieldCache.canvas;
    if (!this.canvas.width || !this.canvas.height) return null;
    const k = document.createElement('canvas'); k.width = this.canvas.width; k.height = this.canvas.height;
    const c = k.getContext('2d');
    c.fillStyle = { meadow: '#a9d36a', canyon: '#f0c98a', snow: '#e4f0f8', citadel: '#d8c9a2' }[this.theme] || '#a9d36a'; c.fillRect(0, 0, k.width, k.height);
    if (art) {
      // 图的长边对着战场的长边；按“盖满画布，且战场两侧再多留 8% 给营帐”的比例铺。
      const aw = wide ? art.naturalWidth : art.naturalHeight, ah = wide ? art.naturalHeight : art.naturalWidth;
      const zoom = Math.max(k.width / aw, k.height / ah, W * this.scale * 1.16 / aw);
      const w = aw * zoom, h = ah * zoom;
      c.imageSmoothingQuality = 'high';
      c.save(); c.translate(this.ox + W * this.scale / 2, this.oy + H * this.scale / 2);
      if (!wide) c.rotate(Math.PI / 2);
      c.drawImage(art, -(wide ? w : h) / 2, -(wide ? h : w) / 2, wide ? w : h, wide ? h : w);
      c.restore();
    }
    const shade = c.createRadialGradient(k.width / 2, k.height / 2, Math.min(k.width, k.height) * .45, k.width / 2, k.height / 2, Math.max(k.width, k.height) * .8);
    shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(20,40,30,.22)'); c.fillStyle = shade; c.fillRect(0, 0, k.width, k.height);
    this.fieldCache = { canvas: k, art };
    return k;
  }

  inspect(g) {
    if (g.phase !== 'build' || this.drag?.recycle || this.drag?.valid === false) return null;
    const u = this.drag ? { ...this.drag.unit, type: this.drag.type, team: this.drag.team, x: this.drag.x, y: this.drag.y, route: this.drag.unit?.route?.map(p => ({ x: p.x + this.drag.x - this.drag.unit.x, y: p.y + this.drag.y - this.drag.unit.y })) } : g.plan.find(u => u.pid === (this.hoverPid ?? this.selectedPid));
    if (!u) return null;
    const key = JSON.stringify([u.type, u.team, u.x, u.y, u.route, u.hold, g.plan.map(v => [v.type, v.team, v.x, v.y]), g.level, g.sandbox]);
    if (key !== this.previewKey) { this.previewKey = key; this.preview = formationPreview(g, u); }
    return this.preview;
  }
  drawInspection(c, p) {
    if (!p) return;
    c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip();
    c.fillStyle = 'rgba(255,255,255,.16)'; c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2; c.setLineDash([7, 6]);
    c.beginPath(); c.ellipse(p.origin.x, p.origin.y, p.range, p.range, 0, 0, TAU); c.fill(); c.stroke();
    if (p.route.length > 1) {
      c.setLineDash([5, 6]); c.strokeStyle = INK; c.lineWidth = 4.5; c.lineCap = 'round'; c.beginPath(); p.route.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.stroke();
      c.strokeStyle = '#8be28f'; c.lineWidth = 2.5; c.stroke(); c.setLineDash([]);
      const end = p.route.at(-1); ellipse(c, end.x, end.y, 6, 4, '#8be28f'); ring(c, end.x, end.y, 6, 4, INK, 1.5);
    }
    c.setLineDash([]);
    if (p.target) {
      c.setLineDash([3, 6]); line(c, p.origin.x, p.origin.y, p.aim.x, p.aim.y, p.blocked ? '#ff6b57' : '#ffe08a', 2); c.setLineDash([]);
      ring(c, p.target.x, p.target.y + 2, 19, 7, INK, 4); ring(c, p.target.x, p.target.y + 2, 19, 7, '#ff8f6b', 2);
      if (p.blocked) { const mx = p.obstruction?.x ?? (p.origin.x + p.aim.x) / 2, my = p.obstruction?.y ?? (p.origin.y + p.aim.y) / 2; line(c, mx - 6, my - 6, mx + 6, my + 6, INK, 6); line(c, mx + 6, my - 6, mx - 6, my + 6, INK, 6); line(c, mx - 6, my - 6, mx + 6, my + 6, '#ff6b57', 3); line(c, mx + 6, my - 6, mx - 6, my + 6, '#ff6b57', 3); }
    }
    ring(c, p.unit.x, p.unit.y + 2, 21, 8, INK, 4.5); ring(c, p.unit.x, p.unit.y + 2, 21, 8, '#ffffff', 2.2);
    c.restore();
  }

  // 朝向：每个角色有正面和背面两张图。瞄准方向朝上用背面、朝下用正面；左右决定是否水平翻转。
  // 接近水平或垂直时保持原样，避免来回抖动。还没有瞄准目标时：我方朝右、敌方朝左，都用正面。
  defaultPose(u) { return { flip: u.team === 0 ? 1 : -1, back: false }; }
  pose(u, build) {
    if (build || u.id === undefined || u.angle === undefined) return this.defaultPose(u);
    let pose = this.faces.get(u.id);
    if (!pose) { pose = this.defaultPose(u); this.faces.set(u.id, pose); }
    const ax = Math.cos(u.angle), ay = Math.sin(u.angle);
    if (Math.abs(ax) > .3) pose.flip = ax > 0 ? 1 : -1;
    if (Math.abs(ay) > .3) pose.back = ay < 0;
    return pose;
  }

  // ---------- 击杀粒子 ----------
  clearEffects() { this.particles = []; this.decals = []; this.faces.clear(); this.bodies.clear(); }
  // 每名士兵在画面上的“身体”：位置轻微平滑（挨打被推开、互相挤开时不会瞬间一跳），
  // 步伐按实际走过的距离推进，起步和停下渐变。只影响画面，不影响模拟。
  body(u) {
    let b = this.bodies.get(u.id);
    if (!b) { b = { x: u.x, y: u.y, amt: 0, phase: (u.id * 1.7) % TAU }; this.bodies.set(u.id, b); }
    const dt = this.frameDt, px = b.x, py = b.y, follow = 1 - Math.exp(-dt * 28);
    b.x += (u.x - b.x) * follow; b.y += (u.y - b.y) * follow;
    if (Math.hypot(u.x - b.x, u.y - b.y) > 40) { b.x = u.x; b.y = u.y; }
    b.amt += ((u.moving ? 1 : 0) - b.amt) * (1 - Math.exp(-dt * 9));
    if (u.moving) b.phase += Math.min(8, Math.hypot(b.x - px, b.y - py)) / STRIDE * Math.PI;
    return b;
  }
  // 一名士兵倒下：碎片和星星四散、烟团、冲击环，地上留一摊队伍颜色的墨迹。
  spawnKill(f) {
    if (this.reduced) return;
    const u = f.unit, big = u.type === 'giant', base = teamColor(u.team, this.skin), cy = f.y - UNIT_HEIGHT[u.type] * .45;
    const tint = mix(base, '#ffffff', .4), colors = ['#ffd84a', '#ffffff', tint, '#ffd84a', base, tint];
    for (let i = 0, n = big ? 24 : 15; i < n; i++) {
      const a = rand(0, TAU), speed = rand(big ? 120 : 95, big ? 270 : 230);
      this.particles.push({ kind: ['star', 'shard', 'dot'][i % 3], x: f.x + Math.cos(a) * 6, y: cy + Math.sin(a) * 6, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 80, gravity: 340, drag: 1.5, t: 0, life: rand(.55, 1), size: rand(big ? 8 : 6, big ? 13 : 10.5), color: colors[i % colors.length], rot: rand(0, TAU), spin: rand(-9, 9) });
    }
    for (let i = 0, n = big ? 9 : 6; i < n; i++) {
      const a = rand(0, TAU), speed = rand(20, 60);
      this.particles.push({ kind: 'puff', x: f.x, y: cy + 8, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * .6 - 24, gravity: -34, drag: 2.2, t: 0, life: rand(.55, .9), size: rand(big ? 15 : 11, big ? 23 : 17), color: '#fff8e6', rot: 0, spin: 0 });
    }
    this.particles.push({ kind: 'ring', x: f.x, y: cy, vx: 0, vy: 0, gravity: 0, drag: 0, t: 0, life: .42, size: big ? 74 : 54, color: '#ffffff', rot: 0, spin: 0 });
    this.particles.push({ kind: 'flash', x: f.x, y: cy, vx: 0, vy: 0, gravity: 0, drag: 0, t: 0, life: .22, size: big ? 50 : 36, color: '#fffbe0', rot: rand(0, TAU), spin: 2 });
    const spread = big ? 46 : 30;
    this.decals.push({
      x: f.x, y: f.y + 3, color: mix(base, INK, .35), t: 0, life: 3.6,
      blobs: Array.from({ length: big ? 7 : 5 }, (_, i) => ({ dx: i ? rand(-spread, spread) * .5 : 0, dy: i ? rand(-spread, spread) * .2 : 0, r: i ? rand(big ? 7 : 5, big ? 13 : 9) : (big ? 22 : 15) })),
      drops: Array.from({ length: big ? 7 : 5 }, () => { const a = rand(0, TAU), d = rand(spread * .55, spread); return { dx: Math.cos(a) * d, dy: Math.sin(a) * d * .45, r: rand(1.5, 3.2) }; })
    });
    if (this.decals.length > 26) this.decals.shift();
    if (this.particles.length > 420) this.particles.splice(0, this.particles.length - 420);
    this.kick(big ? 4 : 1.3);
  }
  stepParticles(dt) {
    if (!dt) return;
    for (const p of this.particles) { p.t += dt; const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy = p.vy * k + p.gravity * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt; }
    this.particles = this.particles.filter(p => p.t < p.life);
    for (const d of this.decals) d.t += dt;
    this.decals = this.decals.filter(d => d.t < d.life);
  }
  drawDecals(c) {
    for (const d of this.decals) {
      const grow = Math.min(1, d.t / .16), fade = Math.min(1, (d.life - d.t) / 1.1);
      c.save(); c.globalAlpha = .58 * fade; c.fillStyle = d.color; c.translate(d.x, d.y);
      for (const b of d.blobs) { c.beginPath(); c.ellipse(b.dx * grow, b.dy * grow, b.r * grow * 1.25, b.r * grow * .5, 0, 0, TAU); c.fill(); }
      for (const b of d.drops) { c.beginPath(); c.ellipse(b.dx * grow, b.dy * grow, b.r, b.r * .5, 0, 0, TAU); c.fill(); }
      c.restore();
    }
  }
  drawParticles(c) {
    for (const p of this.particles) {
      const k = p.t / p.life;
      c.save(); c.translate(p.x, p.y);
      if (p.kind === 'ring') { c.globalAlpha = 1 - k; ring(c, 0, 0, p.size * k, p.size * k * .8, INK, 5 * (1 - k) + 1.5); ring(c, 0, 0, p.size * k, p.size * k * .8, p.color, 3 * (1 - k) + .8); }
      else if (p.kind === 'puff') { c.globalAlpha = (1 - k) * .85; ellipse(c, 0, 0, p.size * (.55 + k * .9), p.size * (.5 + k * .8), p.color); }
      else if (p.kind === 'flash') {
        // 爆闪：两个错开 45° 的四角星，迅速放大并淡出。
        c.globalAlpha = 1 - k; c.rotate(p.rot); const r = p.size * (.45 + k * .9);
        for (let n = 0; n < 2; n++) { c.rotate(n * Math.PI / 4); c.fillStyle = n ? '#ffd84a' : p.color; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * .22 : r * (n ? .72 : 1); c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); }
      }
      else {
        c.globalAlpha = 1 - k * k; c.rotate(p.rot); const size = p.size * (1 - k * .45);
        if (p.kind === 'star') star(c, 0, 0, size, p.color, INK);
        else if (p.kind === 'shard') { c.fillStyle = p.color; c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.moveTo(size, 0); c.lineTo(-size * .6, size * .5); c.lineTo(-size * .3, -size * .55); c.closePath(); c.fill(); c.stroke(); }
        else { ellipse(c, 0, 0, size * .55, size * .55, INK); ellipse(c, 0, 0, size * .55 - 1.2, size * .55 - 1.2, p.color); }
      }
      c.restore();
    }
  }

  // ---------- 行军路线、驻守、圈选 ----------
  // 布阵时画出每名士兵的路线（敌人的路线用红色）；战斗中只淡淡地画出还没走完的部分。
  drawRoutes(c, g, build, t) {
    const list = build ? [...g.plan, ...(g.sandbox ? [] : g.enemy)] : g.units.filter(u => u.hp > 0 && u.route && u.leg < u.route.length);
    for (const u of list) {
      const route = build ? u.route : u.route?.slice(u.leg);
      const mine = u.team === 0, focus = build && (this.selection?.has(u.pid) || this.hoverPid === u.pid);
      // 开战后头两秒半，我方的路线先亮一下再淡下去：看得出小队正在照着你画的线走。
      const glow = !build && mine ? Math.max(0, 1 - g.elapsed / 2.5) : 0;
      if (route?.length) {
        const pts = [{ x: u.x, y: u.y }, ...route], color = mine ? BLUE_INK : RED_INK;
        c.save(); c.globalAlpha = build ? (focus ? 1 : mine ? .85 : .75) : .35 + .6 * glow; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
        c.strokeStyle = glow ? `rgba(255,230,140,${.9 * glow})` : 'rgba(255,255,255,.9)'; c.lineWidth = (focus ? 8 : 6.5) + 6 * glow; c.stroke();
        if (glow) { c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 6.5; c.stroke(); }
        c.setLineDash(mine ? [12, 7] : [7, 7]); c.lineDashOffset = this.reduced ? 0 : -t * 22;
        c.strokeStyle = color; c.lineWidth = focus ? 4 : 3; c.stroke(); c.setLineDash([]);
        const a = pts.at(-2), b = pts.at(-1), ang = Math.atan2(b.y - a.y, b.x - a.x);
        c.translate(b.x, b.y); c.rotate(ang); c.fillStyle = color; c.strokeStyle = '#fff'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(9, 0); c.lineTo(-7, -7); c.lineTo(-4, 0); c.lineTo(-7, 7); c.closePath(); c.stroke(); c.fill();
        c.restore();
      }
    }
  }
  // 驻守小旗：画在士兵之后，免得被身体挡住；有路线时插在路线终点。
  drawHoldFlags(c, g, build) {
    const list = build ? [...g.plan, ...(g.sandbox ? [] : g.enemy)] : g.units.filter(u => u.hp > 0);
    for (const u of list) if (u.hold) {
      const ahead = u.route?.length && (build || u.leg < u.route.length), end = ahead ? u.route.at(-1) : null;
      this.drawFlag(c, end ? end.x : u.x - 17, end ? end.y + 2 : u.y + 2, u.team === 0 ? '#ffd84a' : RED_INK);
    }
  }
  drawFlag(c, x, y, color) {
    c.save(); c.translate(x, y);
    line(c, 0, 0, 0, -26, INK, 4); line(c, 0, 0, 0, -26, '#fff8e7', 1.6);
    c.beginPath(); c.moveTo(1, -26); c.lineTo(18, -20); c.lineTo(1, -13); c.closePath(); c.fillStyle = color; c.strokeStyle = INK; c.lineWidth = 2.2; c.fill(); c.stroke();
    ellipse(c, 0, 1, 6, 2.4, 'rgba(25,40,55,.3)');
    c.restore();
  }
  // 教学用的引导线：一支“笔”沿着金色虚线反复画过去，告诉玩家从哪里拖到哪里。
  drawGuidePath(c, t) {
    const pts = this.guidePath; if (!pts || pts.length < 2) return;
    const lens = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y)), total = lens.reduce((a, b) => a + b, 0);
    const k = this.reduced ? 1 : Math.min(1, (t % 2.4) / 1.8), want = total * k;
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 9; c.stroke();
    c.setLineDash([10, 8]); c.lineDashOffset = this.reduced ? 0 : -t * 20; c.strokeStyle = 'rgba(227,165,28,.75)'; c.lineWidth = 4; c.stroke(); c.setLineDash([]);
    let left = want, head = pts[0]; c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < lens.length; i++) {
      const a = pts[i], b = pts[i + 1];
      if (left >= lens[i]) { c.lineTo(b.x, b.y); head = b; left -= lens[i]; continue; }
      const f = left / lens[i]; head = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }; c.lineTo(head.x, head.y); break;
    }
    c.strokeStyle = '#e3a51c'; c.lineWidth = 6; c.stroke();
    const pulse = this.reduced ? 0 : Math.sin(t * 8) * 2;
    ellipse(c, head.x, head.y, 11 + pulse, 11 + pulse, 'rgba(255,216,74,.35)');
    ellipse(c, head.x, head.y, 7, 7, '#fffdf2'); ring(c, head.x, head.y, 7, 7, INK, 2.5);
    c.restore();
  }
  // 正在画的路线或圈选。
  drawSketch(c, t) {
    const s = this.sketch; if (!s || s.points.length < 2) return;
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); s.points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    if (s.kind === 'lasso') {
      c.closePath(); c.fillStyle = 'rgba(255,216,74,.18)'; c.fill();
      c.setLineDash([8, 6]); c.lineDashOffset = this.reduced ? 0 : -t * 30; c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
    } else {
      c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 9; c.stroke();
      c.strokeStyle = s.valid === false ? '#c8402c' : BLUE_INK; c.lineWidth = 4.5; c.stroke();
    }
    c.restore();
  }
  // ---------- 贴纸 ----------
  // 墨迹陷阱：路线留下的墨迹（布阵时是预览，开战后一直留着）。
  drawTrail(c, segs, alpha = .6) {
    if (!segs?.length) return;
    c.save(); c.globalAlpha = alpha; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); for (const [a, b] of segs) { c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
    c.strokeStyle = mix(BLUE_INK, INK, .55); c.lineWidth = STICKER_FX.trail.width; c.stroke();
    c.strokeStyle = 'rgba(140,170,255,.35)'; c.lineWidth = 5; c.stroke();
    c.restore();
  }
  // 圈出目标：被圈住的敌人脚下一圈转动的红色虚线。
  drawMark(c, x, y, t) {
    c.save(); c.setLineDash([7, 5]); c.lineDashOffset = this.reduced ? 0 : -t * 22;
    ring(c, x, y + 2, 27, 11, '#fffdf2', 5.5); ring(c, x, y + 2, 27, 11, RED_INK, 2.8); c.restore();
  }
  // 交叉引爆：交叉点上一颗跳动的星，外面一圈是爆炸范围。
  drawBurst(c, x, y, t) {
    const k = this.reduced ? 1 : 1 + Math.sin(t * 6) * .1, r = STICKER_FX.cross.radius;
    c.save(); c.setLineDash([6, 6]); ring(c, x, y, r, r * .8, 'rgba(210,84,63,.7)', 2.2); c.restore();
    star(c, x, y, 15 * k, '#ffd84a', INK);
  }
  tag(c, x, y, text, color) { label(c, text, x, y, 15, color, { stroke: '#fffdf2', width: 5, weight: 900 }); }
  // 布阵时的贴纸预览：画线的时候就看得到这条线会带来什么。和开战时用的是同一套几何判断，所以看到的就是会发生的。
  // 墨迹、红圈和交叉点画在地上；文字记进 previewTags，等士兵画完再盖在最上面。
  drawStickerPreview(c, g, t) {
    const has = id => this.stickers.includes(id), sk = this.sketch?.kind === 'route' && this.sketch.points.length > 1 ? this.sketch : null, tags = [];
    let lines = squadLines(g.plan);
    if (sk) lines = [...lines.filter(l => l.key !== sk.card), { key: 'sketch', pts: sk.points }];
    const mine = g.plan.filter(u => u.team === 0), cards = [...new Set(mine.map(u => u.card))];
    if (has('trail')) this.drawTrail(c, trailOf(lines), .45);
    if (has('lasso')) for (const e of lassoed(lines, g.enemy)) { this.drawMark(c, e.x, e.y, t); tags.push([e.x, e.y + 24, `+${Math.round((STICKER_FX.lasso.mult - 1) * 100)}%`, RED_INK]); }
    if (has('cross')) for (const p of crossings(lines)) this.drawBurst(c, p.x, p.y, t);
    if (has('longhaul')) for (const l of lines) { const b = haulBonus(lineLength(l.pts)); if (b >= .05) { const e = l.pts.at(-1); tags.push([e.x, e.y - 22, `+${Math.round(b * 100)}%`, '#d97a00']); } }
    if (has('ambush')) for (const card of cards) {
      const squad = mine.filter(u => u.card === card), low = squad.reduce((a, b) => (b.y > a.y ? b : a));
      if (!squad.some(u => u.route?.length) && sk?.card !== card) tags.push([low.x, low.y + 26, this.words.ambushTag || '', '#2f8f46']);
    }
    if (has('lone') && cards.length === 1) tags.push([mine[0].x, Math.min(...mine.map(u => u.y)) - 74, this.words.loneTag || '', '#d97a00']);
    this.previewTags = tags;
  }

  drawUnit(c, sim, time, build, g) {
    const body = build || sim.id === undefined ? null : this.body(sim), u = body ? { ...sim, x: body.x, y: body.y } : sim;
    const def = TYPES[u.type], height = UNIT_HEIGHT[u.type] * (u.boss?.size || 1), palette = u.team === 0 ? this.skin : 'red', reduced = this.reduced;
    const pose = this.pose(u, build), face = pose.flip;
    const ax = Math.cos(u.angle ?? 0), ay = Math.sin(u.angle ?? 0);
    // 走路：脚踩在地上，身体随步伐左右轻摆、略微前倾，每一步只抬起一点点。
    const amt = reduced ? 0 : body?.amt || 0, phase = body?.phase || 0;
    const sway = Math.sin(phase) * .05 * amt, lean = .045 * amt * face, lift = Math.abs(Math.sin(phase)) * 1.2 * amt, step = (1 - Math.abs(Math.sin(phase))) * .02 * amt;
    const wind = u.windupTotal ? 1 - u.windup / u.windupTotal : 0;
    const swing = u.swing ? Math.sin((1 - u.swing / (def.projectile ? .22 : .28)) * Math.PI) : 0;
    const age = u.born ? Date.now() / 1000 - u.born : 1, pop = !reduced && build && age < .3 ? 1 + Math.sin(age / .3 * Math.PI) * .2 : 1;
    const breathe = build && !reduced ? 1 + Math.sin(time * 2.2 + u.x * .05) * .016 : 1;
    ellipse(c, u.x, u.y + 2, height * .27, height * .085, 'rgba(25,40,55,.25)');
    if (!build && u.team === 0 && g.effects.rally > 0) { ring(c, u.x, u.y + 2, height * .33, height * .11, '#ffd84a', 2.5); }
    if (u.frozen) ellipse(c, u.x, u.y + 2, height * .36, height * .12, 'rgba(190,232,255,.75)');
    if (!build && u.shield > 0) { c.save(); c.globalAlpha = .35 + Math.min(.35, u.shield / 60); ring(c, u.x, u.y - height * .45, height * .42, height * .55, '#6fb6ff', 3); c.restore(); }
    c.save(); c.translate(u.x, u.y);
    if (!reduced) {
      c.translate(Math.cos(u.hitAngle || 0) * (u.recoil || 0) * 12 + ax * (swing * 7 - wind * 3), ay * (swing * 5 - wind * 2) - lift);
      c.rotate(sway + lean + face * (swing * .2 - wind * .13));
      c.scale(pop * (1 + wind * .05 + step * .5), pop * breathe * (1 - wind * .06 - step));
    }
    const options = { flip: face < 0, back: pose.back };
    if (this.drag?.unit?.pid === u.pid && u.pid !== undefined && build) c.globalAlpha = .28;
    if (!drawUnitImage(c, u.type, palette, 0, 3, height, options)) { ellipse(c, 0, -height * .4, height * .25, height * .4, teamColor(u.team, this.skin)); }
    if (u.flash > 0) drawUnitImage(c, u.type, palette, 0, 3, height, { ...options, alpha: Math.min(1, u.flash / .13) * .8, silhouette: '#ffffff' });
    if (u.frozen) drawUnitImage(c, u.type, palette, 0, 3, height, { ...options, alpha: .55, silhouette: '#bfe6ff' });
    else if (u.chill > 0) drawUnitImage(c, u.type, palette, 0, 3, height, { ...options, alpha: .3, silhouette: '#8fd0ff' });
    c.restore();
    if (u.blockFlash > 0) { const k = 1 - u.blockFlash / .24; ring(c, u.x + face * 10, u.y - height * .4, 8 + k * 14, 8 + k * 14, `rgba(230,248,255,${1 - k})`, 3); }
    if (!build && u.team === 0 && g.effects.smoke > 0) { c.save(); c.globalAlpha = .4; for (let i = 0; i < 3; i++) ellipse(c, u.x + (reduced ? (i - 1) * 9 : Math.sin(time * 2 + i * 2 + u.id) * 13), u.y - height * .35 + i * 5, 17, 11, '#e9eef0'); c.restore(); }
    if (u.chill > 0 && !u.frozen && !reduced) for (let i = 0; i < 2; i++) { const a = time * 2 + i * 3 + (u.id || 0); label(c, '❄', u.x + Math.cos(a) * 14, u.y - height * .55 + Math.sin(a * 1.3) * 9, 10, '#e8f7ff', { stroke: '#4d93c9', width: 2 }); }
    if (u.threat > 0 && u.hp > 0) { const y = u.y - height - 16; pill(c, u.x - 9, y - 9, 18, 18, '#ff6b57', INK, 2); label(c, '!', u.x, y + .5, 13, '#fff', { stroke: null }); }
    if (u.boss) this.drawCrown(c, u.x, u.y - height - (build || u.hp >= u.max ? 4 : 16), time);
    if (!build && u.hp > 0 && u.hp < u.max) {
      const w = u.boss ? 70 : u.type === 'giant' ? 46 : 32, y = u.y - height - 5;
      pill(c, u.x - w / 2 - 1.5, y - 1.5, w + 3, 8, INK);
      pill(c, u.x - w / 2, y, w, 5, 'rgba(255,255,255,.25)');
      const fill = Math.max(0, u.hp / u.max); if (fill > .02) pill(c, u.x - w / 2, y, Math.max(5, w * fill), 5, fill < .3 ? '#ff7a5c' : teamColor(u.team, this.skin));
    }
  }

  drawCrown(c, x, y, time) {
    const bob = this.reduced ? 0 : Math.sin(time * 3) * 1.5;
    c.save(); c.translate(x, y - 6 + bob);
    c.beginPath(); c.moveTo(-13, 6); c.lineTo(-15, -7); c.lineTo(-7, -1); c.lineTo(0, -11); c.lineTo(7, -1); c.lineTo(15, -7); c.lineTo(13, 6); c.closePath();
    c.fillStyle = '#ffd84a'; c.strokeStyle = INK; c.lineWidth = 2.5; c.lineJoin = 'round'; c.fill(); c.stroke();
    ellipse(c, 0, 1, 2.6, 2.6, '#d2543f');
    c.restore();
  }

  drawShot(c, s) {
    c.save(); c.translate(s.x, s.y);
    const kind = TYPES[s.type]?.projectile;
    if (kind === 'bomb' || kind === 'orb') {
      const progress = Math.min(1, s.t * s.speed / (s.distance || 1)), lift = Math.sin(progress * Math.PI) * (kind === 'bomb' ? 36 : 22);
      ellipse(c, 0, 12, 5, 2, 'rgba(25,40,55,.22)'); c.translate(0, -lift);
      if (kind === 'bomb') { c.rotate(s.t * 8); ellipse(c, 0, 0, 7, 7, INK); ellipse(c, -1, -1, 5, 5, '#4a5568'); ellipse(c, -2.5, -2.5, 1.6, 1.6, '#aab4c0'); line(c, 2, -6, 5, -10, '#8a5a2b', 2); ellipse(c, 5.5, -10.5, 2, 2, '#ffd84a'); }
      else { ellipse(c, 0, 0, 10, 10, 'rgba(150,215,255,.35)'); ellipse(c, 0, 0, 6.5, 6.5, INK); ellipse(c, 0, 0, 5, 5, '#8fd6ff'); ellipse(c, -1.5, -1.5, 2, 2, '#f2fbff'); }
    } else {
      c.rotate(s.angle); const col = teamColor(s.team, this.skin);
      line(c, -20, 0, -6, 0, 'rgba(255,255,255,.55)', 2.5);
      line(c, -11, 0, 6, 0, INK, 4); line(c, -11, 0, 6, 0, '#b98950', 2);
      c.fillStyle = '#e9eef2'; c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.moveTo(11, 0); c.lineTo(4, -3.5); c.lineTo(4, 3.5); c.closePath(); c.fill(); c.stroke();
      line(c, -10, 0, -14, -3.5, col, 2.4); line(c, -10, 0, -14, 3.5, col, 2.4);
    }
    c.restore();
  }

  // 胜负揭晓的横幅：在战报弹出前停顿片刻，让最后一击和倒地动作播完。
  drawBanner(c, g, t) {
    this.endSeen ??= t; const age = t - this.endSeen, grow = this.reduced ? 1 : Math.min(1, age / .25), pop = this.reduced ? 1 : 1 + Math.sin(grow * Math.PI) * .1;
    const won = g.phase === 'won', timeout = !won && g.units.some(u => u.team === 0 && u.hp > 0);
    const title = won ? this.words.victory : timeout ? this.words.timeUp : this.words.defeat;
    c.save(); c.globalAlpha = grow * .38; c.fillStyle = won ? '#fff6d0' : '#27324a'; c.fillRect(-W, -H, W * 3, H * 3); c.globalAlpha = grow;
    c.translate(W / 2, H / 2 - 30); c.scale(pop, pop); c.rotate(-.03);
    c.fillStyle = won ? '#ffcf4a' : '#8fa0b8'; c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.roundRect(-170, -44, 340, 88, 22); c.fill(); c.stroke();
    c.fillStyle = won ? '#ffe9a3' : '#b9c5d6'; c.beginPath(); c.roundRect(-160, -36, 320, 34, 14); c.fill();
    label(c, title || '', 0, won && !g.sandbox ? -8 : 0, 40, '#fffdf2', { width: 7, weight: 900 });
    if (won && !g.sandbox) { const stars = starsFor(g); for (let i = 0; i < 3; i++) { if (!this.reduced && age < .3 + i * .16) continue; star(c, (i - 1) * 40, 44, 17, i < stars ? '#ffd84a' : '#c9c3ad'); } }
    c.restore();
  }

  draw(g, t) {
    const c = this.c, build = g.phase === 'build', reduced = this.reduced;
    if (!this.canvas.width) { this.resize(); if (!this.canvas.width) return; }
    const dt = Math.min(.05, Math.max(0, t - (this.lastT ?? t))); this.lastT = t; this.frameDt = dt; this.shake = this.shake > .15 ? this.shake * Math.exp(-dt * 11) : 0;
    for (const f of g.fx) if (f.kind === 'death' && !this.seenFx.has(f)) { this.seenFx.add(f); this.spawnKill(f); }
    this.stepParticles(dt * this.timeScale);
    const sx = this.shake ? (Math.random() - .5) * 2 * this.shake * this.scale : 0, sy = this.shake ? (Math.random() - .5) * 2 * this.shake * this.scale : 0;
    c.setTransform(1, 0, 0, 1, 0, 0);
    const field = this.field(); if (field) c.drawImage(field, sx, sy); else { c.fillStyle = '#a9d36a'; c.fillRect(0, 0, this.canvas.width, this.canvas.height); }
    c.setTransform(this.scale, 0, 0, this.scale, this.ox + sx, this.oy + sy);
    const time = g.phase === 'paused' ? g.elapsed : t;

    if (build) {
      // 布阵区：己方半场（左）提亮，敌方半场（右）略带红色，分界线用墨水虚线。
      const pulse = reduced ? .5 : .5 + Math.sin(t * 2.4) * .5, mid = (ZONE.blue + ZONE.red) / 2;
      c.fillStyle = `rgba(255,255,255,${.1 + pulse * .05})`; c.fillRect(-W, -H, W + ZONE.blue + 12, H * 3);
      c.fillStyle = 'rgba(210,84,63,.1)'; c.fillRect(ZONE.red - 12, -H, W * 2, H * 3);
      c.setLineDash([10, 9]); line(c, mid, -H, mid, H * 2, 'rgba(255,255,255,.9)', 3); c.setLineDash([]);
      if (!g.plan.length && this.words.yourZone) label(c, this.words.yourZone, ZONE.blue / 2, 38, 13, '#fff', { stroke: 'rgba(40,70,140,.9)', width: 3.5 });
      if (!g.plan.length && this.words.enemyZone) label(c, this.words.enemyZone, (ZONE.red + W) / 2, 38, 13, '#fff', { stroke: 'rgba(170,60,45,.9)', width: 3.5 });
    }
    for (const o of g.rocks) if (o.kind === 'pond') drawPond(c, o, time, reduced, this.theme);
    this.drawDecals(c);
    if (!build && g.trail?.length) this.drawTrail(c, g.trail);
    this.drawRoutes(c, g, build, t);
    if (build) this.drawInspection(c, this.inspect(g));
    this.drawSketch(c, t);
    this.previewTags = null;
    if (build && this.stickers?.length) this.drawStickerPreview(c, g, t);
    if (!build) for (const u of g.units) if (u.marked && u.hp > 0) this.drawMark(c, u.x, u.y, t);

    // 墨水笔迹：滑动画兵时留下的痕迹。
    if (this.inkTrail.length) {
      const now = performance.now(); this.inkTrail = this.inkTrail.filter(p => now - p.at < 700);
      c.lineCap = 'round';
      for (let i = 1; i < this.inkTrail.length; i++) { const a = this.inkTrail[i - 1], b = this.inkTrail[i]; if (b.start) continue; const life = 1 - (now - b.at) / 700; line(c, a.x, a.y, b.x, b.y, `rgba(34,48,74,${life * .55})`, 5 * life + 1); }
    }
    if (this.drag && !this.drag.recycle) { const d = this.drag; c.save(); c.setLineDash([5, 5]); ellipse(c, d.x, d.y + 2, 24, 10, d.valid ? 'rgba(120,220,130,.4)' : 'rgba(255,107,87,.4)'); ring(c, d.x, d.y + 2, 24, 10, d.valid ? '#2f8f46' : '#c8402c', 2.5); c.restore(); }

    if (build && this.selection?.size) for (const u of g.plan) if (this.selection.has(u.pid)) {
      const r = (u.type === 'giant' ? 30 : 22) + (reduced ? 0 : Math.sin(t * 5) * 1.5);
      ellipse(c, u.x, u.y + 2, r, r * .4, 'rgba(255,216,74,.35)'); c.setLineDash([6, 4]); ring(c, u.x, u.y + 2, r, r * .4, INK, 3.5); ring(c, u.x, u.y + 2, r, r * .4, '#ffd84a', 2); c.setLineDash([]);
    }
    const units = build ? [...g.plan, ...(g.sandbox ? [] : g.enemy)] : g.units.filter(u => u.hp > 0);
    const drawables = [...units.map(u => ({ y: u.y, u })), ...g.rocks.filter(o => o.kind !== 'pond').map(o => ({ y: o.y + o.r * .3, o }))].sort((a, b) => a.y - b.y);
    for (const d of drawables) {
      if (d.o) drawRock(c, d.o, this.theme);
      // 埋伏中的士兵画得半透明：敌人还没发现他们。
      else if (!build && d.u.hidden) { c.save(); c.globalAlpha = .45; this.drawUnit(c, d.u, time, build, g); c.restore(); }
      else this.drawUnit(c, d.u, time, build, g);
    }

    // 卡牌模式：选着兵牌时，在鼠标处画出整队的虚影（放不下时是红色）。
    if (build && this.stamp) {
      const st = this.stamp, bob = reduced ? 0 : Math.sin(t * 5) * 1.5;
      for (const p of st.spots) {
        c.save(); c.globalAlpha = .55; drawUnitImage(c, st.type, this.skin, p.x, p.y + 3 - bob, UNIT_HEIGHT[st.type], st.valid ? {} : { silhouette: '#d2543f' }); c.restore();
        c.setLineDash([5, 5]); ring(c, p.x, p.y + 2, 20, 8, INK, 4); ring(c, p.x, p.y + 2, 20, 8, st.valid ? '#ffe08a' : '#ff6b57', 2); c.setLineDash([]);
      }
    }
    if (build && !this.drag) for (const ghost of this.guideGhosts || []) {
      if (g.placementError(ghost.type, ghost.x, ghost.y, ghost.team)) continue;
      const bob = reduced ? 0 : Math.sin(t * 4) * 2;
      c.save(); c.globalAlpha = .5; drawUnitImage(c, ghost.type, this.skin, ghost.x, ghost.y + 3 - bob, UNIT_HEIGHT[ghost.type]); c.restore();
      c.setLineDash([5, 5]); ring(c, ghost.x, ghost.y + 2, 22, 8, INK, 4); ring(c, ghost.x, ghost.y + 2, 22, 8, '#ffe08a', 2); c.setLineDash([]);
      label(c, this.unitName(ghost.type), ghost.x, ghost.y + 20, 11, '#fff', { width: 3 });
    }
    if (build && this.guidePath && !this.drag && !this.sketch) this.drawGuidePath(c, t);
    for (const [x, y, text, color] of this.previewTags || []) this.tag(c, x, y, text, color);
    this.drawHoldFlags(c, g, build);
    for (const s of g.shots) this.drawShot(c, s);
    for (const f of g.fx) drawEffect(c, f, this);
    this.drawParticles(c);
    if (this.reticle && g.phase === 'battle') {
      const r = this.reticle, spin = reduced ? 0 : t * 1.5;
      ellipse(c, r.x, r.y, r.r, r.r * .8, 'rgba(255,220,90,.22)');
      c.save(); c.translate(r.x, r.y); c.rotate(spin); c.setLineDash([9, 7]); ring(c, 0, 0, r.r, r.r, INK, 5); ring(c, 0, 0, r.r, r.r, '#ffd84a', 2.5); c.restore(); c.setLineDash([]);
      line(c, r.x - 9, r.y, r.x + 9, r.y, '#fff', 3); line(c, r.x, r.y - 9, r.x, r.y + 9, '#fff', 3);
    }
    if (g.phase === 'won' || g.phase === 'lost') this.drawBanner(c, g, t); else this.endSeen = null;
    if (g.phase === 'paused') { c.fillStyle = 'rgba(34,48,74,.45)'; c.fillRect(-W, -H, W * 3, H * 3); label(c, this.words.paused || '', W / 2, H / 2, 34, '#fffdf2', { width: 6, weight: 900 }); }
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
}

// 把角色画进一张小画布（兵种卡、图鉴、首页小队用）。locked 时画成深色剪影。
export function paintUnit(canvas, type, paletteId = 'blue', { locked = false, flip = false, fill = .92 } = {}) {
  const c = canvas.getContext('2d'); c.clearRect(0, 0, canvas.width, canvas.height);
  const h = canvas.height * fill;
  return drawUnitImage(c, type, paletteId, canvas.width / 2, canvas.height * (.5 + fill / 2) - canvas.height * .02, h, locked ? { silhouette: '#5c6b85', flip } : { flip });
}
