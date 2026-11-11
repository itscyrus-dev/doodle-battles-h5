// 存档、金币、皮肤、锦囊、每日悬赏和成就的规则测试。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Battle } from '../src/engine.mjs';
import { LEVELS, TYPES } from '../src/data.mjs';
import { normalizeSave, loadSave, writeSave, campaignSummary, chapterSummary, SAVE_KEY, LEGACY_KEY } from '../src/save.mjs';
import { recordBattle, claimAchievements, ensureDaily, buySkin, equipSkin, buyHint, todayString, REWARDS, HINT_COST, SKINS, ACHIEVEMENTS, DAILY_MIN_CLEARED } from '../src/meta.mjs';
import { SOLUTIONS } from '../src/solutions.mjs';

const solutions = JSON.parse(readFileSync(new URL('./fixtures/level-solutions.json', import.meta.url), 'utf8'));
const memory = (initial = {}) => { const data = { ...initial }; return { getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: k => { delete data[k]; }, data }; };
function win(level, plan = solutions[level].plan) { const g = new Battle(level); for (const u of plan) g.place(u.type, u.x, u.y); g.start(); for (let i = 0; i < 5000 && g.phase === 'battle'; i++) g.update(1 / 60); return g; }
function lose(level) { const g = new Battle(level); g.place('knight', 110, 300); g.start(); for (let i = 0; i < 5000 && g.phase === 'battle'; i++) g.update(1 / 60); return g; }

test('旧版存档可以迁移：关卡、星级和偏好保留，新字段取默认值', () => {
  const store = memory({ [LEGACY_KEY]: JSON.stringify({ unlocked: 3, stars: { 0: 3, 1: 2, 2: 1 }, sound: true, haptics: false, speed: 2, campaignSeen: true, item: 'smoke' }) });
  const { save, migrated } = loadSave(store);
  assert.equal(migrated, true); assert.equal(save.unlocked, 3); assert.equal(save.currentLevel, 3); assert.deepEqual(save.stars, { 0: 3, 1: 2, 2: 1 });
  assert.equal(save.settings.haptics, false); assert.equal(save.settings.speed, 2); assert.equal(save.settings.music, true); assert.equal(save.seenIntro, true); assert.equal(save.item, 'smoke');
  assert.equal(save.coins, 0); assert.deepEqual(save.skins, ['blue']); assert.equal(save.v, 3);
  assert.deepEqual(campaignSummary(save), { completed: 3, stars: 6, maxStars: 120, total: 40 });
  assert.equal(writeSave(store, save), true); assert.equal(loadSave(store).migrated, false); assert.ok(store.data[SAVE_KEY]);
});

test('损坏或被改过的存档不会绕过锁关、凭空得到金币或没买过的东西', () => {
  assert.deepEqual(normalizeSave(null).stars, {}); assert.equal(normalizeSave('junk').unlocked, 0);
  const s = normalizeSave({ unlocked: 99, currentLevel: -1, stars: { 0: 3, 1: 9, 2: '3', 77: 3 }, coins: -50, skins: ['gold', 'rainbow', 'gold'], skin: 'gold', item: 'frost', achievements: { first_win: true, cheat: true }, hints: { 3: true, 4: 'yes' }, daily: { date: 'tomorrow', level: 500, streak: -3 }, settings: { lang: 'fr' } });
  assert.equal(s.unlocked, 1); assert.equal(s.currentLevel, 1); assert.deepEqual(s.stars, { 0: 3 }); assert.equal(s.coins, 0);
  assert.deepEqual(s.skins, ['blue', 'gold']); assert.equal(s.skin, 'gold'); assert.equal(s.item, 'heal', '没解锁的道具回退为急救旗');
  assert.deepEqual(s.achievements, { first_win: true }); assert.deepEqual(s.hints, { 3: true }); assert.equal(s.daily.date, null); assert.equal(s.daily.level, null); assert.equal(s.daily.streak, 0); assert.equal(s.settings.lang, null);
  assert.equal(normalizeSave({ skin: 'gold' }).skin, 'blue', '没拥有的配色不能使用');
  assert.equal(normalizeSave({ unlocked: 2, currentLevel: 8 }).currentLevel, 2);
  const broken = { getItem: () => '{bad', setItem: () => { throw new Error('full'); } }; assert.equal(loadSave(broken).save.unlocked, 0); assert.equal(writeSave(broken, normalizeSave(null)), false);
});

test('首次通关和新增星星给金币；重玩不重复发放，最高星不下降', () => {
  const s = normalizeSave(null), first = recordBattle(s, win(0));
  assert.equal(first.won, true); assert.equal(first.firstClear, true); assert.equal(first.newStars, 3);
  assert.equal(first.coins, REWARDS.firstClear + 3 * REWARDS.star); assert.equal(s.stars[0], 3); assert.equal(s.unlocked, 1);
  assert.ok(first.achievements.some(a => a.id === 'first_win')); assert.equal(s.coins, first.coins + first.achievements.reduce((n, a) => n + a.reward, 0));
  const coins = s.coins, again = recordBattle(s, win(0));
  assert.equal(again.coins, 0); assert.equal(again.firstClear, false); assert.equal(again.newStars, 0);
  assert.equal(s.coins, coins + again.achievements.reduce((n, a) => n + a.reward, 0)); assert.equal(s.stars[0], 3); assert.equal(campaignSummary(s).completed, 1);
  const lost = recordBattle(s, lose(1)); assert.equal(lost.won, false); assert.equal(lost.coins, 0); assert.equal(s.unlocked, 1); assert.equal(s.stars[1], undefined);
  assert.equal(s.counters.battles, 3); assert.equal(s.counters.wins, 2);
});

test('通关会解锁兵种和道具；可选挑战只奖励一次；通关整章有提示', () => {
  const s = normalizeSave({ unlocked: 1, stars: { 0: 3 } });
  const r = recordBattle(s, win(1), { medal: true });
  assert.deepEqual(r.unlockedUnits, ['bomber']); assert.deepEqual(r.unlockedItems, ['smoke']); assert.equal(r.medal, true); assert.equal(s.medals[1], true);
  assert.equal(recordBattle(s, win(1), { medal: true }).medal, false, '挑战奖励不重复');
  const nine = {}; for (let i = 0; i < 9; i++) nine[i] = 1; const t = normalizeSave({ unlocked: 9, stars: nine });
  const boss = recordBattle(t, win(9)); assert.equal(boss.chapterCleared, 0); assert.deepEqual(boss.unlockedUnits, ['lancer']); assert.ok(boss.achievements.some(a => a.id === 'chapter_1'));
  assert.equal(chapterSummary(t, 0).completed, 10); assert.equal(chapterSummary(t, 1).unlocked, true); assert.equal(chapterSummary(t, 2).unlocked, false);
  const all = {}; for (let i = 0; i < LEVELS.length; i++) all[i] = 3; const done = normalizeSave({ unlocked: 39, stars: all });
  assert.equal(recordBattle(done, win(39)).unlockedUnits.length, 0); assert.equal(done.unlocked, 39, '最后一关之后没有新关卡');
});

test('沙盒战斗不给金币、不改进度，只计入成就', () => {
  const s = normalizeSave(null), g = new Battle(0, true); g.place('giant', 270, 300, 0); g.place('knight', 470, 300, 1); g.start(); for (let i = 0; i < 3000 && g.phase === 'battle'; i++) g.update(1 / 60);
  const r = recordBattle(s, g); assert.equal(g.phase, 'won'); assert.equal(r.coins, 0); assert.deepEqual(s.stars, {}); assert.equal(s.unlocked, 0);
  assert.equal(s.counters.sandbox, 1); assert.ok(r.achievements.some(a => a.id === 'sandbox')); assert.equal(s.counters.wins, 0);
});

test('配色要先买再用，金币不够买不了；锦囊每关只扣一次钱', () => {
  const s = normalizeSave({ coins: 200 });
  assert.equal(equipSkin(s, 'teal'), false); assert.equal(buySkin(s, 'gold'), false, '400 金币的配色买不起'); assert.equal(s.coins, 200);
  assert.equal(buySkin(s, 'teal'), true); assert.equal(s.coins, 50); assert.equal(s.skin, 'teal'); assert.equal(buySkin(s, 'teal'), false, '不能重复购买');
  assert.equal(equipSkin(s, 'blue'), true); assert.equal(s.skin, 'blue'); assert.equal(buySkin(s, 'rainbow'), false);
  assert.equal(buyHint(s, 4), true); assert.equal(s.coins, 50 - HINT_COST); assert.equal(buyHint(s, 4), true); assert.equal(s.coins, 50 - HINT_COST, '已买过的锦囊不再扣钱');
  assert.equal(buyHint(s, 5), false); assert.equal(s.hints[5], undefined);
  assert.equal(SKINS[0].price, 0); assert.ok(SKINS.every(k => k.price >= 0 && k.price % 50 === 0));
});

test('每日悬赏：通关 3 关后开启，同一天不变，三星才算完成，连续天数隔天清零', () => {
  const s = normalizeSave({ unlocked: 2, stars: { 0: 3, 1: 1 } });
  assert.equal(ensureDaily(s, '2026-11-11'), null, `通关不足 ${DAILY_MIN_CLEARED} 关`);
  s.stars[2] = 2; s.unlocked = 3;
  const d = ensureDaily(s, '2026-11-11'); assert.ok([0, 1, 2].includes(d.level)); assert.equal(d.done, false);
  const level = d.level; assert.equal(ensureDaily(s, '2026-11-11').level, level, '同一天不换关卡');
  const coins = s.coins, r = recordBattle(s, win(level), { today: '2026-11-11' });
  assert.equal(r.stars, 3); assert.equal(r.daily, true); assert.equal(s.daily.done, true); assert.equal(s.daily.streak, 1); assert.ok(s.coins >= coins + REWARDS.daily);
  assert.equal(recordBattle(s, win(level), { today: '2026-11-11' }).daily, false, '一天只奖励一次');
  const next = ensureDaily(s, '2026-11-12'); assert.equal(next.done, false); assert.equal(next.streak, 1);
  recordBattle(s, win(next.level), { today: '2026-11-12' }); assert.equal(s.daily.streak, 2);
  ensureDaily(s, '2026-11-20'); assert.equal(s.daily.streak, 0, '断签后清零');
  assert.match(todayString(new Date(2026, 0, 5)), /^2026-01-05$/);
});

test('成就按真实进度达成，奖励只发一次；每个成就都能读出进度', () => {
  const s = normalizeSave(null); assert.deepEqual(claimAchievements(s), []);
  s.counters.wins = 10; const earned = claimAchievements(s).map(a => a.id); assert.deepEqual(earned, ['first_win', 'wins_10']); assert.equal(s.coins, 60);
  assert.deepEqual(claimAchievements(s), []); assert.equal(s.coins, 60);
  for (const a of ACHIEVEMENTS) { const v = a.progress(normalizeSave(null)); assert.ok(Number.isFinite(v) && v >= 0, a.id); assert.ok(a.goal > 0 && a.reward > 0); }
  assert.equal(new Set(ACHIEVEMENTS.map(a => a.id)).size, ACHIEVEMENTS.length);
});

test('游戏内锦囊的阵型与测试样本一致，每关都是已验证的胜解', () => {
  assert.equal(SOLUTIONS.length, LEVELS.length);
  SOLUTIONS.forEach((s, i) => {
    assert.deepEqual(s.plan, solutions[i].plan.map(u => [u.type, Math.round(u.x), Math.round(u.y)]), `第${i + 1}关的锦囊和样本不一致，请运行 node tools/export-solutions.mjs`);
    assert.equal(s.stars, solutions[i].stars); assert.ok(s.plan.every(([type]) => TYPES[type].unlock <= i));
  });
});
