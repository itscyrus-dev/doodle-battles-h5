// 本机存档（第 2 版）：只接受已知字段并逐项校验，坏数据不会破坏进度；兼容旧版 doodle-battles-v1。
import { LEVELS, ITEMS, UNIT_ORDER, LEVELS_PER_CHAPTER, CHAPTERS, itemUnlocked } from './data.mjs';
import { validateDraft } from './drafts.mjs';
import { SKINS, ACHIEVEMENTS } from './meta.mjs';

export const SAVE_KEY = 'draw-clash-save-v2', LEGACY_KEY = 'doodle-battles-v1';
const validLevel = n => Number.isInteger(n) && n >= 0 && n < LEVELS.length;
const count = (v, max = 9999999) => (Number.isInteger(v) && v >= 0 ? Math.min(v, max) : 0);
const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const flags = (raw, allowed) => Object.fromEntries(allowed.filter(k => raw?.[k] === true).map(k => [k, true]));

export function normalizeSave(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const stars = {};
  for (let i = 0; i < LEVELS.length; i++) { const n = s.stars?.[i]; if (Number.isInteger(n) && n >= 1 && n <= 3) stars[i] = n; }
  const earned = Math.max(0, ...Object.keys(stars).map(i => Math.min(LEVELS.length - 1, +i + 1)));
  const unlocked = Math.max(validLevel(s.unlocked) ? s.unlocked : 0, earned);
  const formations = {}, guides = {}, medals = {}, lessonActions = {}, hints = {};
  for (let i = 0; i < LEVELS.length; i++) {
    if (i <= unlocked && s.formations?.[i]) { const draft = validateDraft(i, s.formations[i]); if (draft) formations[i] = draft; }
    if (s.lessonActions?.[i]) lessonActions[i] = flags(s.lessonActions[i], ['moved', 'inspected', 'itemChosen']);
    if (s.guides?.[i] === true) guides[i] = true;
    if (s.medals?.[i] === true) medals[i] = true;
    if (s.hints?.[i] === true) hints[i] = true;
  }
  const skinIds = SKINS.map(k => k.id), skins = ['blue', ...(Array.isArray(s.skins) ? s.skins.filter(id => id !== 'blue' && skinIds.includes(id)) : [])].filter((id, i, a) => a.indexOf(id) === i);
  const settings = s.settings && typeof s.settings === 'object' ? s.settings : {};
  const daily = s.daily && typeof s.daily === 'object' ? s.daily : {};
  const counters = s.counters && typeof s.counters === 'object' ? s.counters : {};
  return {
    v: 2, unlocked, stars, formations, guides, medals, lessonActions, hints,
    item: typeof s.item === 'string' && Object.hasOwn(ITEMS, s.item) && itemUnlocked(s.item, unlocked) ? s.item : 'heal',
    currentLevel: validLevel(s.currentLevel) && s.currentLevel <= unlocked ? s.currentLevel : unlocked,
    seenIntro: s.seenIntro === true || s.campaignSeen === true,
    coins: count(s.coins), skins, skin: skins.includes(s.skin) ? s.skin : 'blue',
    achievements: flags(s.achievements, ACHIEVEMENTS.map(a => a.id)),
    daily: { date: isDate(daily.date) ? daily.date : null, level: validLevel(daily.level) ? daily.level : null, done: daily.done === true, streak: count(daily.streak, 9999), last: isDate(daily.last) ? daily.last : null },
    counters: { battles: count(counters.battles), wins: count(counters.wins), kills: count(counters.kills), flawless: count(counters.flawless), small: count(counters.small), fast: count(counters.fast), sandbox: count(counters.sandbox), hints: count(counters.hints) },
    usedUnits: flags(s.usedUnits, UNIT_ORDER),
    usedItems: flags(s.usedItems, Object.keys(ITEMS)),
    settings: {
      lang: ['zh', 'en'].includes(settings.lang) ? settings.lang : null,
      music: settings.music !== false, sfx: settings.sfx !== false,
      haptics: (settings.haptics ?? s.haptics) !== false,
      speed: (settings.speed ?? s.speed) === 2 ? 2 : 1,
      reduced: settings.reduced === true
    }
  };
}

// 读取存档；没有新版存档时尝试迁移旧版。storage 不可用时返回空白存档。
export function loadSave(storage) {
  let raw = null, migrated = false;
  try { raw = JSON.parse(storage.getItem(SAVE_KEY)); } catch { /* 坏数据按空白处理 */ }
  if (!raw) { try { raw = JSON.parse(storage.getItem(LEGACY_KEY)); migrated = !!raw; } catch { /* 同上 */ } }
  return { save: normalizeSave(raw), migrated };
}
export function writeSave(storage, save) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(save)); return true; } catch { return false; }
}

export function campaignSummary(save) {
  const values = Object.values(save.stars);
  return { completed: values.length, stars: values.reduce((a, b) => a + b, 0), maxStars: LEVELS.length * 3, total: LEVELS.length };
}
export function chapterSummary(save, chapter) {
  let completed = 0, stars = 0;
  for (let i = chapter * LEVELS_PER_CHAPTER; i < (chapter + 1) * LEVELS_PER_CHAPTER; i++) if (save.stars[i]) { completed++; stars += save.stars[i]; }
  return { completed, stars, maxStars: LEVELS_PER_CHAPTER * 3, total: LEVELS_PER_CHAPTER, unlocked: save.unlocked >= chapter * LEVELS_PER_CHAPTER, name: CHAPTERS[chapter].name };
}
