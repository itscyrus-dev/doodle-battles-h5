// 界面小工具：取元素、图标、图片、底部弹层和提示条。
import { assetUrl } from './assets.mjs';
import { t } from './i18n.mjs';
import { sfx } from './audio.mjs';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
export const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const PATHS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  gear: '<circle cx="12" cy="12" r="5.6"/><circle cx="12" cy="12" r="1.4"/><path stroke-width="4.2" stroke-linecap="butt" d="M12 2v3.2M12 18.8V22M2 12h3.2M18.8 12H22M4.9 4.9l2.3 2.3M16.8 16.8l2.3 2.3M19.1 4.9l-2.3 2.3M7.2 16.8l-2.3 2.3"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
  undo: '<path d="M8 5L4 9l4 4"/><path d="M4 9h9a6 6 0 010 12h-3"/>',
  eraser: '<path d="M4 15l8-9 7 6-7 8H7z"/><path d="M4 20h16"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  retry: '<path d="M4 12a8 8 0 1014.5-4.6"/><path d="M19 3v5h-5"/>',
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  swords: '<path d="M5 4l10 10M4 4h3v3M15 14l-3 3M19 4L9 14M20 4h-3v3M9 14l3 3M5 18l2 2M19 18l-2 2"/>',
  flag: '<path d="M6 21V4M6 5h11l-2.5 4L17 13H6"/>'
};
export const icon = name => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || ''}</svg>`;
export const img = (path, className = '', alt = '') => `<img class="${className}" src="${assetUrl(path)}" alt="${esc(alt)}" draggable="false">`;
export const starsMarkup = (earned, total = 3) => `<span class="stars" aria-label="${earned}/${total}">${Array.from({ length: total }, (_, i) => `<i class="${i < earned ? 'on' : ''}"></i>`).join('')}</span>`;

let toastTimer = null;
export function toast(text, ms = 1900) {
  const el = $('#toast'); if (!el) return;
  el.textContent = text; el.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), ms);
}

// 底部弹层。同一时间只显示一个；onClose 在任何方式关闭时都会调用一次。
let active = null, lastFocus = null;
export function openSheet({ title = '', kicker = '', body = '', className = '', onClose = null, dismissable = true }) {
  closeSheet(true);
  const overlay = $('#overlay'), sheet = $('#sheet');
  lastFocus = document.activeElement;
  sheet.className = `sheet ${className}`;
  sheet.innerHTML = `${dismissable ? `<button class="ibtn sheet-close" id="sheet-close" aria-label="${esc(t('common.close'))}">${icon('close')}</button>` : ''}
    <div class="sheet-body">${kicker ? `<div class="kicker">${kicker}</div>` : ''}${title ? `<h2 id="sheet-title">${title}</h2>` : ''}${body}</div>`;
  overlay.hidden = false; overlay.dataset.dismissable = dismissable ? '1' : '';
  requestAnimationFrame(() => overlay.classList.add('open'));
  active = { onClose };
  if (dismissable) { $('#sheet-close').onclick = () => closeSheet(); $('#sheet-close').focus({ preventScroll: true }); }
  sfx('open');
  return sheet;
}
export function closeSheet(silent = false) {
  if (!active) return;
  const { onClose } = active; active = null;
  const overlay = $('#overlay'); overlay.classList.remove('open'); overlay.hidden = true;
  if (!silent) sfx('close');
  onClose?.();
  lastFocus?.focus?.({ preventScroll: true });
}
export const sheetOpen = () => !!active;

export function initOverlay() {
  $('#overlay').addEventListener('pointerdown', e => { if (e.target.id === 'overlay' && e.currentTarget.dataset.dismissable) closeSheet(); });
  document.addEventListener('keydown', e => {
    if (!active) return;
    if (e.key === 'Escape' && $('#overlay').dataset.dismissable) { e.preventDefault(); closeSheet(); }
    if (e.key === 'Tab') {
      const els = $$('#sheet button:not(:disabled), #sheet select, #sheet textarea, #sheet input'); if (!els.length) return;
      if (e.shiftKey && document.activeElement === els[0]) { e.preventDefault(); els.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === els.at(-1)) { e.preventDefault(); els[0].focus(); }
    }
  });
}

// 震动只在支持的浏览器生效（多数安卓可以，iPhone 浏览器不支持）。
export const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
let lastBuzz = 0, hapticsOn = true;
export const setHaptics = on => { hapticsOn = !!on; };
export function buzz(pattern, force = false) {
  if (!hapticsOn || !canVibrate) return;
  const now = performance.now(); if (!force && now - lastBuzz < 70) return; lastBuzz = now;
  try { navigator.vibrate(pattern); } catch { /* 个别浏览器在后台会抛错 */ }
}
