// 局外成长：金币、皮肤、锦囊、每日悬赏和成就。纯逻辑，不碰界面和存储。
import { LEVELS, TYPES, ITEMS, UNIT_ORDER, ITEM_ORDER, LEVELS_PER_CHAPTER, CHAPTERS, starsFor } from './data.mjs';

export const REWARDS = { firstClear: 20, star: 10, medal: 30, daily: 60 };
export const HINT_COST = 40;
// 队伍配色只改变外观，不影响数值。
export const SKINS = [
  { id: 'blue', price: 0 }, { id: 'teal', price: 150 }, { id: 'green', price: 150 },
  { id: 'purple', price: 250 }, { id: 'pink', price: 250 }, { id: 'gold', price: 400 }
];

const totalStars = s => Object.values(s.stars).reduce((a, b) => a + b, 0);
const chapterStars = (s, c) => { let n = 0; for (let i = c * LEVELS_PER_CHAPTER; i < (c + 1) * LEVELS_PER_CHAPTER; i++) n += s.stars[i] || 0; return n; };
const chapterCleared = (s, c) => { for (let i = c * LEVELS_PER_CHAPTER; i < (c + 1) * LEVELS_PER_CHAPTER; i++) if (!s.stars[i]) return false; return true; };

export const ACHIEVEMENTS = [
  { id: 'first_win', reward: 20, goal: 1, progress: s => s.counters.wins },
  { id: 'wins_10', reward: 40, goal: 10, progress: s => s.counters.wins },
  { id: 'wins_50', reward: 100, goal: 50, progress: s => s.counters.wins },
  ...CHAPTERS.map((_, c) => ({ id: `chapter_${c + 1}`, reward: 60, goal: LEVELS_PER_CHAPTER, chapter: c, progress: s => { let n = 0; for (let i = c * LEVELS_PER_CHAPTER; i < (c + 1) * LEVELS_PER_CHAPTER; i++) if (s.stars[i]) n++; return n; } })),
  { id: 'stars_30', reward: 50, goal: 30, progress: totalStars },
  { id: 'stars_60', reward: 80, goal: 60, progress: totalStars },
  { id: 'stars_90', reward: 120, goal: 90, progress: totalStars },
  { id: 'stars_all', reward: 300, goal: LEVELS.length * 3, progress: totalStars },
  { id: 'perfect_chapter', reward: 100, goal: LEVELS_PER_CHAPTER * 3, progress: s => Math.max(...CHAPTERS.map((_, c) => chapterStars(s, c))) },
  { id: 'medals_5', reward: 60, goal: 5, progress: s => Object.keys(s.medals).length },
  { id: 'all_units', reward: 60, goal: UNIT_ORDER.length, progress: s => Object.keys(s.usedUnits).length },
  { id: 'all_items', reward: 60, goal: ITEM_ORDER.length, progress: s => Object.keys(s.usedItems).length },
  { id: 'flawless', reward: 40, goal: 1, progress: s => s.counters.flawless },
  { id: 'small_squad', reward: 40, goal: 1, progress: s => s.counters.small },
  { id: 'fast_win', reward: 40, goal: 1, progress: s => s.counters.fast },
  { id: 'daily_3', reward: 80, goal: 3, progress: s => s.daily.streak },
  { id: 'daily_7', reward: 150, goal: 7, progress: s => s.daily.streak },
  { id: 'skins_3', reward: 50, goal: 3, progress: s => s.skins.length },
  { id: 'sandbox', reward: 20, goal: 1, progress: s => s.counters.sandbox },
  { id: 'run_boss', reward: 60, goal: 1, progress: s => s.runStats.bosses },
  { id: 'run_win', reward: 200, goal: 1, progress: s => s.runStats.wins }
];
// 发放新达成的成就奖励，返回这次新达成的成就。
export function claimAchievements(save) {
  const earned = [];
  for (const a of ACHIEVEMENTS) if (!save.achievements[a.id] && a.progress(save) >= a.goal) { save.achievements[a.id] = true; save.coins += a.reward; earned.push(a); }
  return earned;
}

// ---------- 每日悬赏：今天在指定的已通关关卡拿到三星 ----------
export const todayString = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
function hash(text) { let h = 2166136261; for (const ch of text) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export const DAILY_MIN_CLEARED = 3;
// 把存档里的每日悬赏更新到今天；通关不足 3 关时还没有悬赏。
export function ensureDaily(save, today = todayString()) {
  const cleared = Object.keys(save.stars).map(Number).sort((a, b) => a - b);
  if (cleared.length < DAILY_MIN_CLEARED) { save.daily.date = null; save.daily.level = null; save.daily.done = false; return null; }
  if (save.daily.date !== today || save.daily.level === null || !save.stars[save.daily.level]) {
    const yesterday = todayString(new Date(new Date(`${today}T12:00:00`).getTime() - 86400000));
    if (save.daily.last !== today && save.daily.last !== yesterday) save.daily.streak = 0;
    save.daily.date = today; save.daily.level = cleared[hash(today) % cleared.length]; save.daily.done = save.daily.last === today;
  }
  return save.daily;
}

// ---------- 战斗结算 ----------
// 把一场战斗的结果记进存档，返回这场获得的东西，供结算界面展示。
export function recordBattle(save, g, { medal = false, today = todayString() } = {}) {
  const won = g.phase === 'won', stars = starsFor(g), level = g.level;
  const summary = { won, stars, coins: 0, firstClear: false, newStars: 0, medal: false, daily: false, unlockedUnits: [], unlockedItems: [], chapterCleared: null, achievements: [] };
  const blue = g.units.filter(u => u.team === 0), alive = blue.filter(u => u.hp > 0).length;
  save.counters.battles++;
  for (const u of blue) save.usedUnits[u.type] = true;
  if (g.itemUsed) save.usedItems[g.selectedItem] = true;
  save.counters.kills += g.units.filter(u => u.team === 1 && u.hp <= 0).length;
  if (g.sandbox) { save.counters.sandbox++; summary.achievements = claimAchievements(save); return summary; }
  if (won) {
    save.counters.wins++;
    if (alive === blue.length) save.counters.flawless++;
    if (blue.length <= 3) save.counters.small++;
    if (g.elapsed <= 10) save.counters.fast++;
    const before = save.stars[level] || 0, wasUnlocked = save.unlocked, hadChapter = chapterCleared(save, LEVELS[level].chapter);
    summary.firstClear = !before; summary.newStars = Math.max(0, stars - before);
    summary.coins += (summary.firstClear ? REWARDS.firstClear : 0) + summary.newStars * REWARDS.star;
    save.stars[level] = Math.max(before, stars);
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length - 1, level + 1));
    if (save.unlocked > wasUnlocked) {
      summary.unlockedUnits = UNIT_ORDER.filter(t => TYPES[t].unlock > wasUnlocked && TYPES[t].unlock <= save.unlocked);
      summary.unlockedItems = ITEM_ORDER.filter(id => ITEMS[id].unlock > wasUnlocked && ITEMS[id].unlock <= save.unlocked);
    }
    if (!hadChapter && chapterCleared(save, LEVELS[level].chapter)) summary.chapterCleared = LEVELS[level].chapter;
    if (medal && !save.medals[level]) { save.medals[level] = true; summary.medal = true; summary.coins += REWARDS.medal; }
    const daily = ensureDaily(save, today);
    if (daily && !daily.done && daily.level === level && stars === 3) {
      const yesterday = todayString(new Date(new Date(`${today}T12:00:00`).getTime() - 86400000));
      daily.streak = daily.last === yesterday ? daily.streak + 1 : 1; daily.last = today; daily.done = true;
      summary.daily = true; summary.coins += REWARDS.daily;
    }
  }
  save.coins += summary.coins;
  summary.achievements = claimAchievements(save);
  return summary;
}

// 远征里的一场战斗：只计入通用计数和成就，不涉及关卡星级和金币（远征有自己的金币）。
export function recordRunBattle(save, g, kind = 'battle') {
  const blue = g.units.filter(u => u.team === 0), won = g.phase === 'won';
  save.counters.battles++;
  for (const u of blue) save.usedUnits[u.type] = true;
  if (g.itemUsed) save.usedItems[g.selectedItem] = true;
  save.counters.kills += g.units.filter(u => u.team === 1 && u.hp <= 0).length;
  if (won) {
    save.counters.wins++;
    if (blue.every(u => u.hp > 0)) save.counters.flawless++;
    if (blue.length <= 3) save.counters.small++;
    if (g.elapsed <= 10) save.counters.fast++;
    if (kind === 'boss') save.runStats.bosses++;
  }
  return claimAchievements(save);
}
// 远征结束：带回的金币记进主线，更新远征纪录。
export function recordRunEnd(save, run, payout) {
  save.coins += payout;
  save.runStats.runs++;
  if (run.result === 'victory') save.runStats.wins++;
  save.runStats.bestAct = Math.max(save.runStats.bestAct, run.act + 1);
  save.runStats.bestWins = Math.max(save.runStats.bestWins, run.stats.wins);
  return claimAchievements(save);
}

export function buySkin(save, id) {
  const skin = SKINS.find(k => k.id === id);
  if (!skin || save.skins.includes(id) || save.coins < skin.price) return false;
  save.coins -= skin.price; save.skins.push(id); save.skin = id; return true;
}
export function equipSkin(save, id) { if (!save.skins.includes(id)) return false; save.skin = id; return true; }
export function buyHint(save, level) {
  if (save.hints[level]) return true;
  if (save.coins < HINT_COST) return false;
  save.coins -= HINT_COST; save.hints[level] = true; save.counters.hints++; return true;
}
