// 卡牌远征体检：用一个“会出牌、会用战术，但不画路线”的机器人从头打整局远征，
// 统计每章普通战、精英战、首领战的首战胜率，以及整局能走到哪里。只读工具，结果只反映相对难度：
// 真人会画路线、挑站位，实际会更容易一些。
//
// 用法：node tools/card-report.mjs [--runs 40]
import { Battle, TACTICS } from '../src/engine.mjs';
import { TYPES, H, MARGIN, TIME_LIMIT, starsFor } from '../src/data.mjs';
import { newRun, available, enter, battleOf, finishBattle, choose, leave, buy, canBuy, camp, campOptions, eventChoices, resolveEvent, nodeOf, canExtraDraw, extraDraw, WARBAND_ORDER, MIN_DECK } from '../src/run.mjs';
import { CARDS, HAND, RARITY_WEIGHT, cardStats } from '../src/cards.mjs';
import { ACTS, rng } from '../src/encounters.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? +process.argv[i + 1] : d; };
const RUNS = arg('runs', 40);
const alive = (g, team) => g.units.filter(u => u.team === team && u.hp > 0);

// 布阵：兵牌从贵到便宜依次放，近战一排在前（x≈300），远程一排在后（x≈190），沿纵向均匀分开。
// 手里兵牌的墨水比预算少得多时先加抽。重打时（attempt>0）换一种纵向站位。
function deploy(run, attempt, rand) {
  let ctx = battleOf(run);
  for (;;) {
    const need = ctx.hand.filter(c => c.kind === 'unit').reduce((s, c) => s + c.cost, 0);
    if (!canExtraDraw(run) || ctx.def.budget - need < HAND.extraCost + 20) break;
    extraDraw(run); ctx = battleOf(run);
  }
  const g = new Battle(ctx.def, { mods: ctx.mods, item: null, cards: true, momentum: ctx.momentum });
  const units = ctx.hand.filter(c => c.kind === 'unit').sort((a, b) => b.cost - a.cost);
  const placed = [];
  for (const c of units) if (g.remaining >= c.cost) placed.push(c);
  const lines = [placed.filter(c => !TYPES[c.type].backline), placed.filter(c => TYPES[c.type].backline)];
  lines.forEach((line, back) => line.forEach((c, i) => {
    const top = MARGIN.top + 50, span = H - MARGIN.bottom - 50 - top, shift = attempt ? (rand() - .5) * 120 : 0;
    const y = Math.round(Math.max(top, Math.min(top + span, top + (i + .5) * span / line.length + shift)));
    const x = back ? 185 : 300;
    for (const dx of [0, -30, 30, -60]) if (!g.placeSquad({ card: c.index, type: c.type, n: c.n, kw: c.kw, ink: c.cost }, x + dx, y)) break;
  }));
  // 简单的路线：带冲锋、疾行的小队（或有冲锋墨、疾行墨时的近战）画一条直线冲到最近的敌人面前，走完后第一击有加成。
  // 长枪手本来就会自己去找后排，不另外画。
  const relics = new Set(run.relics), foes = ctx.def.enemies;
  for (const c of placed) {
    const squad = g.plan.filter(u => u.team === 0 && u.card === c.index); if (!squad.length || TYPES[c.type].backline) continue;
    const pids = squad.map(u => u.pid), a = squad[0];
    if (c.kw.includes('charge') || c.kw.includes('swift') || relics.has('charge') || relics.has('swift')) {
      const foe = foes.reduce((best, e) => (Math.hypot(e.x - a.x, e.y - a.y) < Math.hypot(best.x - a.x, best.y - a.y) ? e : best)), end = { x: foe.x - 55, y: foe.y };
      g.setRoute(pids, Array.from({ length: 9 }, (_, i) => ({ x: a.x + (end.x - a.x) * i / 8, y: a.y + (end.y - a.y) * i / 8 })), a.pid);
    }
  }
  return { g, tactics: ctx.hand.filter(c => c.kind === 'tactic') };
}

// 战术牌：治疗等到有两人以上受了重伤；落雷砸最密的一堆敌人；增援放在我方前排；其他的在两军快接触时打出。
function useTactics(g, tactics, used) {
  const mine = alive(g, 0), foes = alive(g, 1);
  if (!mine.length || !foes.length) return;
  const gap = Math.min(...mine.map(u => Math.min(...foes.map(v => Math.hypot(u.x - v.x, u.y - v.y)))));
  for (const c of tactics) {
    if (used.has(c.index) || g.momentum < c.cost) continue;
    let point = null, go = false;
    if (c.effect === 'heal') go = mine.filter(u => u.hp < u.max * .6).length >= 2;
    else if (c.effect === 'thunder') {
      const best = foes.map(u => ({ u, n: foes.filter(v => Math.hypot(u.x - v.x, u.y - v.y) <= TACTICS.thunder.radius).length })).sort((a, b) => b.n - a.n)[0];
      go = best.n >= 2 || foes.length === 1; point = { x: best.u.x, y: best.u.y };
    } else if (c.effect === 'reinforce') { go = g.elapsed > 2; point = { x: 250, y: mine.reduce((s, u) => s + u.y, 0) / mine.length }; }
    else go = gap < 150;
    if (go && g.cast(c.effect, { up: c.up, cost: c.cost, point })) used.add(c.index);
  }
}

function fight(run, attempt, rand) {
  const { g, tactics } = deploy(run, attempt, rand), used = new Set();
  if (!g.start()) return finishBattle(run, { won: false, plan: g.plan });
  for (let i = 0; i < TIME_LIMIT * 60 + 5 && g.phase === 'battle'; i++) { if (i % 15 === 0) useTactics(g, tactics, used); g.update(1 / 60); }
  const won = g.phase === 'won';
  return finishBattle(run, { won, survivors: alive(g, 0).length, deployed: g.plan.filter(u => u.team === 0).length, stars: won ? starsFor(g) : 0, kills: g.units.filter(u => u.team === 1 && u.hp <= 0).length, tactics: used.size, plan: g.plan });
}

// 牌的粗略价值：稀有度为主，兵牌太少时偏向兵牌。
const cardValue = (run, id) => RARITY_WEIGHT.common / RARITY_WEIGHT[CARDS[id].rarity] + (CARDS[id].kind === 'unit' && run.deck.filter(e => CARDS[e.id].kind === 'unit').length < run.deck.length * .7 ? 1 : 0);
// 升级目标：最贵的还没升级的兵牌（升级后多 1 人或便宜 30%）。
const upgradeTarget = run => run.deck.map((e, i) => ({ e, i })).filter(x => !x.e.up).sort((a, b) => (CARDS[b.e.id].kind === 'unit') - (CARDS[a.e.id].kind === 'unit') || cardStats(b.e).cost - cardStats(a.e).cost)[0]?.i ?? -1;
// 删牌目标：最便宜的普通兵牌。
const removeTarget = run => run.deck.map((e, i) => ({ e, i })).filter(x => CARDS[x.e.id].kind === 'unit' && CARDS[x.e.id].rarity === 'common').sort((a, b) => cardStats(a.e).cost - cardStats(b.e).cost)[0]?.i ?? -1;

function visit(run, rand) {
  if (run.screen === 'reward') {
    const o = run.pending.options; let best = 0;
    o.forEach((x, i) => { if (x.kind === 'card' && cardValue(run, x.id) > cardValue(run, o[best].id ?? 'knights')) best = i; });
    choose(run, best);
  } else if (run.screen === 'shop') {
    const stock = run.pending.stock, at = s => stock.findIndex(x => x.kind === 'service' && x.service === s);
    if (canBuy(run, at('upgrade')) && upgradeTarget(run) >= 0) buy(run, at('upgrade'), upgradeTarget(run));
    if (run.hearts < run.maxHearts) { const h = stock.findIndex(x => x.kind === 'heart'); if (canBuy(run, h)) buy(run, h); }
    const cards = stock.map((s, i) => ({ s, i })).filter(x => x.s.kind === 'card' && canBuy(run, x.i)).sort((a, b) => cardValue(run, b.s.id) - cardValue(run, a.s.id));
    if (cards.length) buy(run, cards[0].i);
    if (run.deck.length > 12 && canBuy(run, at('remove')) && removeTarget(run) >= 0) buy(run, at('remove'), removeTarget(run));
    leave(run);
  } else if (run.screen === 'camp') {
    const ok = Object.fromEntries(campOptions(run).map(o => [o.id, o.ok]));
    if (ok.rest && run.hearts < run.maxHearts - 0) camp(run, 'rest'); else if (ok.upgrade) camp(run, 'upgrade', upgradeTarget(run));
    leave(run);
  } else if (run.screen === 'event') {
    const choices = eventChoices(run).filter(c => c.ok), pray = choices.find(c => c.id === 'pray');
    resolveEvent(run, (pray && run.hearts < 3 ? choices.find(c => c.id !== 'pray') : choices[0])?.id ?? choices[0].id);
  }
}

// 选路：心少就找营火，钱多就找商店，否则按权重随机挑。
function pickNode(run, rand) {
  const next = available(run), kinds = next.map(id => nodeOf(run, id).kind);
  const weight = k => ({ battle: 3, elite: run.hearts >= 2 ? 1.2 : .2, event: 2, treasure: 3, shop: run.coins >= 80 ? 3 : .4, camp: run.hearts < run.maxHearts ? 4 : .8, boss: 1 }[k]);
  let roll = rand() * kinds.reduce((s, k) => s + weight(k), 0);
  for (let i = 0; i < next.length; i++) { roll -= weight(kinds[i]); if (roll <= 0) return next[i]; }
  return next.at(-1);
}

function playRun(seed, warband) {
  const run = newRun({ seed, warband }), rand = rng(seed * 13 + 5), log = [];
  for (let guard = 0; guard < 200 && run.screen !== 'over'; guard++) {
    if (run.screen === 'map') { enter(run, pickNode(run, rand)); continue; }
    if (run.screen === 'battle') {
      const node = nodeOf(run, run.pending.node), act = run.act;
      for (let attempt = 0; run.screen === 'battle'; attempt++) { const r = fight(run, attempt, rand); if (attempt === 0) log.push({ act, row: node.row, kind: node.kind, won: !!r?.won }); }
      continue;
    }
    visit(run, rand);
  }
  return { run, log };
}

const pct = (a, b) => (b ? `${Math.round(a / b * 100)}%` : '—').padStart(5);
console.log(`卡牌远征体检 · 每个编制 ${RUNS} 局 · 机器人会给冲锋型小队画直线路线`);
const started = Date.now(), all = [];
console.log('编制       通关   到第2章  到第3章  平均胜仗  结束时牌库');
for (const warband of WARBAND_ORDER) {
  const results = Array.from({ length: RUNS }, (_, i) => playRun(1000 + i * 7919, warband)); all.push(...results);
  const reach = n => results.filter(x => x.run.act >= n).length;
  console.log(`${warband.padEnd(10)} ${pct(results.filter(x => x.run.result === 'victory').length, RUNS)}   ${pct(reach(1), RUNS)}    ${pct(reach(2), RUNS)}    ${(results.reduce((s, x) => s + x.run.stats.wins, 0) / RUNS).toFixed(1).padStart(5)}     ${(results.reduce((s, x) => s + x.run.deck.length, 0) / RUNS).toFixed(1).padStart(5)} 张`);
}
console.log('\n章  类型     首战胜率  场次   普通战按层（1–6 层）');
for (let act = 0; act < ACTS; act++) for (const kind of ['battle', 'elite', 'boss']) {
  const rows = all.flatMap(x => x.log).filter(l => l.act === act && l.kind === kind);
  const byRow = kind === 'battle' ? Array.from({ length: 6 }, (_, r) => { const x = rows.filter(l => l.row === r); return pct(x.filter(l => l.won).length, x.length); }).join(' ') : '';
  console.log(`${act + 1}   ${kind.padEnd(7)}  ${pct(rows.filter(l => l.won).length, rows.length)}    ${String(rows.length).padStart(4)}   ${byRow}`);
}
console.log('\n心用光时停在哪里：', Object.entries(all.filter(x => x.run.result === 'defeat').reduce((m, x) => { const k = `${x.run.act + 1}章·${x.log.at(-1)?.kind}`; m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join('，'));
console.log(`\n用时 ${((Date.now() - started) / 1000).toFixed(1)} 秒。`);
