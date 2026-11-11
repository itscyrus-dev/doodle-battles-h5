// 图片加载与角色换色。角色原图的队伍色是宝蓝色，其他队伍色在加载后按色相替换生成。
const BASE = new URL('../assets/', import.meta.url).href;
export const assetUrl = path => BASE + path;

const pending = new Map(), ready = new Map(), failed = new Set();
export function loadImage(path) {
  if (!pending.has(path)) pending.set(path, new Promise((resolve, reject) => {
    const img = new Image(); img.decoding = 'async';
    img.onload = () => { ready.set(path, img); resolve(img); };
    img.onerror = () => { pending.delete(path); failed.add(path); reject(new Error(`image failed: ${path}`)); };
    img.src = assetUrl(path);
  }));
  return pending.get(path);
}
export async function preload(paths, onProgress) {
  let done = 0;
  await Promise.all(paths.map(p => loadImage(p).then(() => onProgress?.(++done / paths.length))));
}
// 同步取图：还没加载完就返回 null，并在后台开始加载（下一帧再画）。
export function image(path) {
  if (!ready.has(path)) { if (!failed.has(path)) loadImage(path).catch(() => {}); return null; }
  return ready.get(path);
}

export const UNIT_TYPES = ['knight', 'guard', 'archer', 'bomber', 'giant', 'lancer', 'healer', 'mage'];
// 每个兵种两张图：front 是面向镜头的正面（朝右下），back 是背对镜头的背面（朝右上）。
export const unitPath = (type, view = 'front') => `units/${type}${view === 'back' ? '-back' : ''}.webp`;
export const THEMES = ['meadow', 'canyon', 'snow', 'citadel'];
export const CORE_IMAGES = [
  ...UNIT_TYPES.map(type => unitPath(type)), ...UNIT_TYPES.map(type => unitPath(type, 'back')), 'ui/logo.webp', 'bg/home-wide.webp', 'bg/field-meadow-wide.webp',
  'icons/coin.webp', 'icons/star.webp', 'icons/ink.webp', 'icons/item-heal.webp', 'icons/item-smoke.webp', 'icons/item-rally.webp', 'icons/item-thunder.webp', 'icons/item-frost.webp',
  'icons/heart.webp', ...['battle', 'elite', 'boss', 'camp', 'shop', 'event'].map(k => `icons/node-${k}.webp`)
];

// 队伍配色：hue 为目标色相；sat、light 微调饱和度和亮度。blue 是原图，不处理。
export const PALETTES = {
  blue: { hue: null, swatch: '#3f63c7' },
  red: { hue: 4, sat: 1.05, light: 1.06, swatch: '#d2543f' },
  teal: { hue: 176, sat: .95, light: 1.02, swatch: '#2f9c94' },
  green: { hue: 122, sat: .9, light: 1.0, swatch: '#4a9c4c' },
  purple: { hue: 276, sat: .95, light: 1.04, swatch: '#8556c7' },
  gold: { hue: 40, sat: 1.15, light: 1.22, swatch: '#dba32c' },
  pink: { hue: 328, sat: .95, light: 1.1, swatch: '#d4589f' }
};

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return [h, s, l];
}
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
const smooth = (a, b, v) => Math.max(0, Math.min(1, (v - a) / (b - a)));

// 只替换“宝蓝色布料”：色相 208–252、够鲜艳、不太暗（描边）也不太亮（冰晶高光）的像素。
function recolor(img, palette) {
  const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
  const c = canvas.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0);
  if (palette.hue === null) return canvas;
  const data = c.getImageData(0, 0, canvas.width, canvas.height), d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
    if (h < 204 || h > 256) continue;
    const weight = smooth(204, 212, h) * (1 - smooth(248, 256, h)) * smooth(.2, .34, s) * smooth(.2, .3, l) * (1 - smooth(.74, .84, l));
    if (weight <= 0) continue;
    const [r, g, b] = hslToRgb((palette.hue + (h - 226) * .4 + 360) % 360, Math.min(1, s * (palette.sat ?? 1)), Math.min(.96, l * (palette.light ?? 1)));
    d[i] += (r - d[i]) * weight; d[i + 1] += (g - d[i + 1]) * weight; d[i + 2] += (b - d[i + 2]) * weight;
  }
  c.putImageData(data, 0, 0);
  return canvas;
}

const sprites = new Map();
// 取某兵种某配色的贴图（canvas）；原图未加载完时返回 null。
export function unitSprite(type, paletteId = 'blue', view = 'front') {
  const key = `${type}:${paletteId}:${view}`;
  if (sprites.has(key)) return sprites.get(key);
  const img = image(unitPath(type, view));
  // 背面图缺失时退回正面图，保证游戏照常运行。
  if (!img) return view === 'back' && failed.has(unitPath(type, 'back')) ? unitSprite(type, paletteId) : null;
  const canvas = recolor(img, PALETTES[paletteId] || PALETTES.blue);
  sprites.set(key, canvas);
  return canvas;
}
// 纯色剪影：受击闪白、冰冻、锁定剪影共用。
export function unitSilhouette(type, color, view = 'front') {
  const key = `${type}:sil:${color}:${view}`;
  if (sprites.has(key)) return sprites.get(key);
  const img = image(unitPath(type, view));
  if (!img) return view === 'back' && failed.has(unitPath(type, 'back')) ? unitSilhouette(type, color) : null;
  const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
  const c = canvas.getContext('2d'); c.drawImage(img, 0, 0);
  c.globalCompositeOperation = 'source-atop'; c.fillStyle = color; c.fillRect(0, 0, canvas.width, canvas.height);
  sprites.set(key, canvas);
  return canvas;
}

// 角色在战场上的身高（逻辑像素）。贴图画布 320，高度约 300，脚底贴着画布下沿。
export const UNIT_HEIGHT = { knight: 66, guard: 63, archer: 62, bomber: 70, giant: 96, lancer: 61, healer: 62, mage: 70 };
// 把角色画到任意 2D 画布上：(x, y) 是脚底位置，height 是角色身高。
export function drawUnitImage(c, type, paletteId, x, y, height, { flip = false, alpha = 1, silhouette = null, back = false } = {}) {
  const view = back ? 'back' : 'front';
  const sprite = silhouette ? unitSilhouette(type, silhouette, view) : unitSprite(type, paletteId, view);
  if (!sprite) return false;
  const box = height * 320 / 300;
  c.save(); c.translate(x, y); if (flip) c.scale(-1, 1); c.globalAlpha *= alpha;
  c.drawImage(sprite, -box / 2, -box, box, box);
  c.restore();
  return true;
}
