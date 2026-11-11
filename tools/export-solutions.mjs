// 把测试用的通关样本导出成游戏内“军师锦囊”用的紧凑数据。
// 用法：node tools/export-solutions.mjs（先用 tools/level-report.mjs --solutions 生成样本）
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('..', import.meta.url);
const fixtures = JSON.parse(readFileSync(new URL('tests/fixtures/level-solutions.json', root), 'utf8'));
const rows = fixtures.map(f => `  { stars: ${f.stars}, plan: [${f.plan.map(u => `['${u.type}', ${Math.round(u.x)}, ${Math.round(u.y)}]`).join(', ')}] }`);
writeFileSync(new URL('src/solutions.mjs', root), `// 由 tools/export-solutions.mjs 从 tests/fixtures/level-solutions.json 生成，请勿手改。\n// 每关一个不靠道具也能获胜的阵型，用于“军师锦囊”。stars 是测试中的成绩。\nexport const SOLUTIONS = [\n${rows.join(',\n')}\n];\n`);
console.log(`exported ${rows.length} solutions`);
