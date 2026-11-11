// 关卡难度体检：用大量“按常识但随手”的合法阵容模拟每一关，估算随手布阵的胜率；
// 再做局部搜索，找出能达到的最好成绩。只读工具，不修改关卡数据（--solutions 会写通关样本文件）。
// 随机胜率只是相对难度的代理指标，不能代替真人试玩。
//
// 用法：
//   node tools/level-report.mjs [--level 3 | 11-20] [--samples 150] [--search 160] [--seed 1] [--json 路径]
//   node tools/level-report.mjs --sweep 1,0.9,0.8          按原预算的倍数扫描
//   node tools/level-report.mjs --budgets 90,105,…         按关卡顺序试一组新预算（数量要等于关卡总数）
//   node tools/level-report.mjs --tune [--level 11-40]     按目标胜率曲线给出建议预算
//   node tools/level-report.mjs --solutions 路径           为每关搜索一个不靠道具的通关阵容并写入文件
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Battle } from '../src/engine.mjs';
import { TYPES, LEVELS, TEAM_LIMIT, UNIT_ORDER, starsFor } from '../src/data.mjs';
import { simulate as play, itemFor } from './policy.mjs';

// 目标曲线：每章开头宽松，逐关收紧；新兵种登场的关卡稍微放松。
export const TARGETS = [
  .99, .72, .76, .60, .40, .25, .28, .18, .20, .15,
  .55, .45, .45, .35, .35, .45, .30, .30, .25, .20,
  .50, .40, .35, .35, .30, .25, .25, .20, .20, .15,
  .40, .35, .30, .25, .30, .20, .20, .15, .12, .10
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// mulberry32：固定种子，报告可复现。
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const toPlan = g => g.plan.map(({ type, x, y }) => ({ type, x, y }));

function pickType(level, g, rand) {
  const pool = UNIT_ORDER.filter(t => TYPES[t].unlock <= level && TYPES[t].cost <= g.remaining && g.count(t) < TYPES[t].limit);
  return pool.length ? pool[Math.floor(rand() * pool.length)] : null;
}
// 七成按常识站位（近战在前、远程和辅助在后），三成完全随手。
function spot(type, rand) {
  // 横向战场：lateral 是上下位置，depth 是离分界线的远近（数值越大越靠后）。
  const sensible = rand() < .7, back = !!TYPES[type].backline;
  const lateral = 70 + rand() * 460, depth = sensible ? (back ? 440 + rand() * 140 : 340 + rand() * 90) : 340 + rand() * 240;
  return { x: Math.round(670 - depth), y: Math.round(lateral) };
}
function randomPlan(level, rand) {
  const g = new Battle(level);
  for (let tries = 0; tries < 300 && g.count(null) < TEAM_LIMIT; tries++) {
    const type = pickType(level, g, rand); if (!type) break;
    const p = spot(type, rand); g.place(type, p.x, p.y);
  }
  return toPlan(g);
}
function simulate(level, plan, item, useItem = true) {
  const g = new Battle(level);
  for (const u of plan) if (!g.place(u.type, u.x, u.y)) return null;
  if (!g.plan.length) return null;
  play(g, { item, useItem });
  const red = g.units.filter(u => u.team === 1), redLeft = red.reduce((s, u) => s + Math.max(0, u.hp), 0) / red.reduce((s, u) => s + u.max, 0);
  return { won: g.phase === 'won', stars: starsFor(g), time: +g.elapsed.toFixed(1), survivors: g.units.filter(u => u.team === 0 && u.hp > 0).length, deployed: plan.length, spent: g.spent, redLeft: +redLeft.toFixed(3) };
}
const score = r => !r ? -1 : r.won ? 100 + r.stars * 30 + r.survivors * 2 - r.time * .4 : (1 - r.redLeft) * 60 + r.survivors;
function mutate(level, plan, rand) {
  const g = new Battle(level); for (const u of plan) g.place(u.type, u.x, u.y);
  const units = g.plan, r = rand(), u = units[Math.floor(rand() * units.length)];
  if (u && r < .4) { const lateral = (rand() - .5) * 140, depth = (rand() - .5) * 120; g.move(u.pid, Math.round(clamp(u.x - depth, 25, 335)), Math.round(clamp(u.y + lateral, 65, 535))); }
  else if (u && r < .7) { const { x, y } = u; g.remove(u.pid); const t = pickType(level, g, rand); if (t) g.place(t, x, y); }
  else if (u && r < .85) g.remove(u.pid);
  else { const t = pickType(level, g, rand); if (t) { const p = spot(t, rand); g.place(t, p.x, p.y); } }
  return toPlan(g);
}
function search(level, start, item, rand, iterations, useItem) {
  let plan = start, result = simulate(level, start, item, useItem), best = score(result);
  for (let i = 0; i < iterations; i++) {
    const next = mutate(level, plan, rand); if (!next.length) continue;
    const r = simulate(level, next, item, useItem), s = score(r);
    if (s >= best) { plan = next; result = r; best = s; }
  }
  return { plan, result };
}
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

export function winRate(level, { samples = 150, seed = 1 } = {}) {
  const rand = rng(seed * 7919 + level * 104729), item = itemFor(level, LEVELS[level].recommendedItem), runs = [];
  for (let i = 0; i < samples; i++) { const plan = randomPlan(level, rand), r = simulate(level, plan, item); if (r) runs.push({ plan, r }); }
  return { rand, item, runs, wins: runs.filter(x => x.r.won) };
}
export function analyse(level, { samples = 150, search: iterations = 160, seed = 1, noItem = false } = {}) {
  const { rand, item, runs, wins } = winRate(level, { samples, seed });
  // 搜索从随机样本里最好的几个出发；noItem 时要求不靠道具也能赢，这样的阵容才适合做“锦囊”。
  const rescored = noItem ? runs.map(x => ({ plan: x.plan, r: simulate(level, x.plan, item, false) })) : runs;
  const starts = rescored.slice().sort((a, b) => score(b.r) - score(a.r)).slice(0, 3);
  let best = starts[0];
  for (const s of starts) {
    const found = search(level, s.plan, item, rand, Math.ceil(iterations / starts.length), !noItem);
    if (score(found.result) > score(best.r)) best = { plan: found.plan, r: found.result };
  }
  return {
    level: level + 1, title: LEVELS[level].title, budget: LEVELS[level].budget, par: LEVELS[level].par, item, samples: runs.length,
    winRate: wins.length / runs.length, threeStarRate: wins.filter(x => x.r.stars === 3).length / runs.length,
    medianWinTime: median(wins.map(x => x.r.time)), best: { ...best.r, plan: best.plan, noItem }
  };
}
// 调预算：从当前预算出发，按 5 墨水一步，找随机胜率最接近目标的预算。
export function tune(level, target, { samples = 150, seed = 1 } = {}) {
  const original = LEVELS[level].budget, tried = new Map();
  const rate = b => { if (!tried.has(b)) { LEVELS[level].budget = b; const w = winRate(level, { samples, seed }); tried.set(b, w.wins.length / w.runs.length); } return tried.get(b); };
  let b = original, step = 10;
  for (let i = 0; i < 24; i++) {
    const r = rate(b);
    if (Math.abs(r - target) <= .03) break;
    const next = clamp(b + (r > target ? -step : step), 60, 260);
    if (next === b) break;
    if (tried.has(next)) { if (step === 5) break; step = 5; continue; }
    b = next;
  }
  const best = [...tried.entries()].sort((a, c) => Math.abs(a[1] - target) - Math.abs(c[1] - target) || a[0] - c[0])[0];
  LEVELS[level].budget = original;
  return { level: level + 1, title: LEVELS[level].title, original, target, budget: best[0], rate: best[1], tried: [...tried.entries()].sort((a, c) => a[0] - c[0]) };
}

function args() {
  const a = process.argv.slice(2), get = (k, d) => { const i = a.indexOf(`--${k}`); return i >= 0 && a[i + 1] !== undefined && !a[i + 1].startsWith('--') ? a[i + 1] : d; }, has = k => a.includes(`--${k}`);
  const range = get('level', `1-${LEVELS.length}`).split('-').map(Number), from = range[0], to = range[1] ?? range[0];
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > LEVELS.length || from > to) throw new Error(`--level 应在 1-${LEVELS.length} 之间`);
  const sweep = get('sweep', null)?.split(',').map(Number).filter(v => v > 0 && v <= 2) || null;
  const budgets = get('budgets', null)?.split(',').map(Number) || null;
  if (budgets && (budgets.length !== LEVELS.length || budgets.some(b => !Number.isInteger(b) || b < 10))) throw new Error(`--budgets 需要 ${LEVELS.length} 个整数`);
  return {
    levels: Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i),
    opts: { samples: +get('samples', 150), search: +get('search', 160), seed: +get('seed', 1) },
    json: get('json', null), sweep, budgets, tune: has('tune'), solutions: get('solutions', null)
  };
}
const scaledBudget = (level, scale) => Math.max(10, Math.round(LEVELS[level].budget * scale / 5) * 5);
const label = r => r.best.won ? r.winRate >= .5 ? '轻松' : r.winRate >= .25 ? '适中' : r.winRate >= .1 ? '偏难' : '很难' : '未找到解';
const pct = v => `${Math.round(v * 100)}%`.padStart(4);
const pad = (s, n) => { s = String(s); const w = [...s].reduce((sum, ch) => sum + (ch.charCodeAt(0) > 255 ? 2 : 1), 0); return s + ' '.repeat(Math.max(0, n - w)); };

async function runAll(tasks, opts) {
  const workers = Math.max(1, Math.min(tasks.length, (os.availableParallelism?.() ?? os.cpus().length) - 1)), queue = [...tasks], results = [];
  await Promise.all(Array.from({ length: workers }, async () => {
    while (queue.length) {
      const task = queue.shift();
      results.push(await new Promise((resolve, reject) => { const w = new Worker(new URL(import.meta.url), { workerData: { ...task, opts } }); w.once('message', resolve); w.once('error', reject); }));
    }
  }));
  return { results, workers };
}

const isCli = isMainThread && !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const { levels, opts, json, sweep, budgets, tune: tuning, solutions } = args(), started = Date.now();
  const done = () => console.log(`用时 ${((Date.now() - started) / 1000).toFixed(1)} 秒。`);
  if (tuning) {
    console.log(`按目标胜率调预算 · ${levels.length} 关 · 每档随机阵容 ${opts.samples} 个 · 种子 ${opts.seed}`);
    const { results } = await runAll(levels.map(level => ({ mode: 'tune', level, target: TARGETS[level] })), opts);
    results.sort((a, b) => a.level - b.level);
    console.log(`\n${pad('关卡', 6)}${pad('名称', 14)}${pad('原预算', 8)}${pad('目标', 7)}${pad('建议预算', 10)}${pad('该预算胜率', 12)}试过的预算`);
    for (const r of results) console.log(`${pad(r.level, 6)}${pad(r.title, 14)}${pad(r.original, 8)}${pad(pct(r.target), 7)}${pad(r.budget, 10)}${pad(pct(r.rate), 12)}${r.tried.map(([b, v]) => `${b}:${Math.round(v * 100)}`).join(' ')}`);
    console.log(`\n建议预算（按关卡顺序）：${results.map(r => r.budget).join(',')}`);
    if (json) writeFileSync(json, JSON.stringify({ opts, results }, null, 2));
    done(); process.exit(0);
  }
  if (sweep) {
    const tasks = levels.flatMap(level => sweep.map(scale => ({ mode: 'analyse', level, budget: scaledBudget(level, scale), scale })));
    console.log(`预算扫描 · ${levels.length} 关 × ${sweep.length} 档 · 每档随机阵容 ${opts.samples} 个 + 搜索 ${opts.search} 次 · 种子 ${opts.seed}`);
    const { results } = await runAll(tasks, opts);
    console.log(`\n${pad('关卡', 6)}${pad('名称', 14)}${sweep.map(s => pad(`×${s}${s === 1 ? '(原)' : ''}`, 18)).join('')}`);
    for (const level of levels) {
      const row = sweep.map(scale => { const r = results.find(x => x.level === level + 1 && x.scale === scale); return pad(`${r.budget} ${pct(r.winRate).trim()} ${r.best.won ? '★' + r.best.stars : '✗'}`, 18); });
      console.log(`${pad(level + 1, 6)}${pad(LEVELS[level].title, 14)}${row.join('')}`);
    }
    console.log('\n每格：预算 随机胜率 搜到的最好星级（✗ 表示本次没搜到胜解）。');
    if (json) writeFileSync(json, JSON.stringify({ opts, sweep, results }, null, 2));
    done(); process.exit(0);
  }
  const noItem = !!solutions;
  const { results, workers } = await runAll(levels.map(level => ({ mode: 'analyse', level, budget: budgets?.[level], noItem })), opts);
  console.log(`关卡难度体检 · 每关随机阵容 ${opts.samples} 个 + 局部搜索 ${opts.search} 次 · 种子 ${opts.seed} · ${workers} 个线程${budgets ? ' · 试用预算' : ''}${noItem ? ' · 搜索不靠道具的通关阵容' : ''}`);
  results.sort((a, b) => a.level - b.level);
  console.log(`\n${pad('关卡', 6)}${pad('名称', 14)}${pad('预算', 6)}${pad('限时', 6)}${pad('随机胜率', 10)}${pad('随机三星', 10)}${pad('胜局中位用时', 14)}${pad('搜到的最好成绩', 24)}难度`);
  for (const r of results) {
    const b = r.best, bestText = b.won ? `${'★'.repeat(b.stars)}${'☆'.repeat(3 - b.stars)} ${b.time}s 存活${b.survivors}/${b.deployed}` : `未赢 · 敌剩${Math.round(b.redLeft * 100)}%血`;
    console.log(`${pad(r.level, 6)}${pad(r.title, 14)}${pad(r.budget, 6)}${pad(r.par, 6)}${pad(pct(r.winRate), 10)}${pad(pct(r.threeStarRate), 10)}${pad(r.medianWinTime === null ? '—' : r.medianWinTime + 's', 14)}${pad(bestText, 24)}${label(r)}`);
  }
  const notes = [];
  for (const r of results) {
    if (!r.best.won) notes.push(`第${r.level}关在本次搜索中没找到获胜阵容，需要人工确认是否可解`);
    else if (r.best.stars < 3) notes.push(`第${r.level}关搜到的最好成绩只有 ${r.best.stars} 星（用时 ${r.best.time}s，限时 ${r.par}s）`);
  }
  if (notes.length) console.log(`\n值得关注：\n- ${notes.join('\n- ')}`);
  console.log('\n说明：随机胜率=按常识但随手布阵的获胜比例，只反映相对难度，不能代替真人试玩。');
  if (solutions) {
    const out = results.map(r => ({ level: r.level, phase: r.best.won ? 'won' : 'lost', stars: r.best.stars, time: r.best.time, survive: r.best.survivors, noItem: true, plan: r.best.plan.map(u => ({ ...u, team: 0 })) }));
    writeFileSync(solutions, JSON.stringify(out, null, 1) + '\n');
    console.log(`通关样本已写入 ${solutions}（${out.filter(o => o.phase === 'won').length}/${out.length} 关找到不靠道具的胜解）`);
  }
  if (json) { writeFileSync(json, JSON.stringify({ generatedAt: new Date().toISOString(), opts, results }, null, 2)); console.log(`完整结果已写入 ${json}`); }
  done();
} else if (!isMainThread) {
  // 每个线程有独立的模块副本，改预算不会影响其他任务。
  const { mode, level, budget, scale, target, noItem, opts } = workerData;
  if (budget) LEVELS[level].budget = budget;
  parentPort.postMessage(mode === 'tune' ? tune(level, target, opts) : { ...analyse(level, { ...opts, noItem }), scale });
}
