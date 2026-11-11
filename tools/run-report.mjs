// 远征难度体检：对每章每层的遭遇战，用“按常识但随手”的阵容（该阶段常见的兵种和预计墨水，不画路线）模拟多次，
// 输出随手布阵的胜率。只读工具。随机胜率只反映相对难度：真人会画路线、挑遗物和升级，实际会更容易。
//
// 用法：node tools/run-report.mjs [--seeds 30] [--plans 12]
import { Battle } from '../src/engine.mjs';
import { TYPES, TEAM_LIMIT, TIME_LIMIT } from '../src/data.mjs';
import { makeEncounter, expectedInk, stepOf, ACTS, ROWS } from '../src/encounters.mjs';
import { runMods } from '../src/relics.mjs';
import { rng } from '../src/encounters.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? +process.argv[i + 1] : d; };
const SEEDS = arg('seeds', 30), PLANS = arg('plans', 12);
// 各章常见的牌组和升级（大致按一局里拿到的东西估计）。
const DECKS = [['knight', 'guard', 'archer', 'bomber'], ['knight', 'guard', 'archer', 'bomber', 'lancer', 'healer'], ['knight', 'guard', 'archer', 'bomber', 'lancer', 'healer', 'mage', 'giant']];
const UPGRADES = [[], ['guard'], ['guard', 'archer']];
const RELICS = [['thick'], ['thick', 'sharp'], ['thick', 'sharp', 'drum']];

function plan(g, deck, rand) {
  for (let tries = 0; tries < 300 && g.count(null) < g.teamLimit; tries++) {
    const pool = deck.filter(t => g.cost(t) <= g.remaining && g.count(t) < g.limit(t)); if (!pool.length) break;
    const type = pool[Math.floor(rand() * pool.length)], back = !!TYPES[type].backline, sensible = rand() < .7;
    const depth = sensible ? (back ? 440 + rand() * 140 : 340 + rand() * 90) : 340 + rand() * 240;
    g.place(type, Math.round(670 - depth), Math.round(70 + rand() * 460));
  }
}
function play(enc, act, ink, rand) {
  const mods = runMods({ relics: RELICS[act], upgrades: UPGRADES[act] }, enc.enemyMods);
  const g = new Battle({ index: -1, budget: ink, enemies: enc.enemies, rocks: enc.rocks, par: enc.par }, { mods, item: null });
  plan(g, DECKS[act], rand); if (!g.start()) return null;
  for (let i = 0; i < TIME_LIMIT * 60 + 5 && g.phase === 'battle'; i++) g.update(1 / 60);
  return g.phase === 'won';
}
const pct = v => `${Math.round(v * 100)}%`.padStart(5);
console.log(`远征难度体检 · 每格 ${SEEDS} 张地图 × ${PLANS} 个随手阵容 · 不画路线、不用道具`);
console.log('章 层  类型    预计墨水  敌军价值(均)  随手胜率');
const started = Date.now();
for (let act = 0; act < ACTS; act++) for (let row = 0; row <= ROWS; row++) {
  for (const kind of row === ROWS ? ['boss'] : row === 4 ? ['battle', 'elite'] : ['battle']) {
    const ink = expectedInk(stepOf(act, row)); let wins = 0, n = 0, value = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const enc = makeEncounter({ seed: seed * 7919, act, row, kind, node: `${act}-${row}-${seed % 4}` }); value += enc.value;
      const rand = rng(seed * 31 + row * 7 + act);
      for (let k = 0; k < PLANS; k++) { const r = play(enc, act, ink, rand); if (r !== null) { n++; if (r) wins++; } }
    }
    console.log(`${act + 1}  ${row + 1}   ${kind.padEnd(7)} ${String(ink).padStart(6)}    ${String(Math.round(value / SEEDS)).padStart(8)}     ${pct(wins / n)}`);
  }
}
console.log(`用时 ${((Date.now() - started) / 1000).toFixed(1)} 秒。`);
