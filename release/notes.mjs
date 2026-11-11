// 生成 GitHub Release 的说明：试玩链接 + CHANGELOG.md 里当前版本的小节 + 下载说明 + 合并的 PR。
// 用法：node release/notes.mjs [GitHub 自动生成的说明文件] > notes.md
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url);
const { version } = JSON.parse(readFileSync(new URL('release.json', root), 'utf8'));

// 取出 CHANGELOG.md 里 “## <版本号>” 到下一个 “## ” 之间的内容；没有这一节时返回空字符串。
export function changelogSection(text, wanted) {
  const lines = text.split('\n');
  const start = lines.findIndex(line => line.startsWith('## ') && line.slice(3).trim().split(/\s+/)[0] === wanted);
  if (start < 0) return '';
  const next = lines.findIndex((line, i) => i > start && line.startsWith('## '));
  return lines.slice(start + 1, next < 0 ? lines.length : next).join('\n').trim();
}

// GitHub 自动生成的说明（PR 列表和完整改动链接）是英文的：翻成中文，去掉 @ 提及和“新贡献者”一节。
export function localizeGenerated(text) {
  return text
    .replace(/^## What's Changed$/m, '## 合并的 PR')
    .replace(/^\* (.+) by @\S+ in (https:\/\/\S+)$/gm, '* $1：$2')
    .replace(/^## New Contributors\n(?:\* .*\n?)*\n?/m, '')
    .replace(/^\*\*Full Changelog\*\*: (\S+)$/m, '**完整改动：** $1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function releaseNotes(generated = '') {
  const extra = localizeGenerated(generated);
  let section = '';
  try { section = changelogSection(readFileSync(new URL('CHANGELOG.md', root), 'utf8'), version); } catch { /* 没有更新记录文件时只输出链接和下载说明 */ }
  return [
    '**在线试玩：** https://doodle-battles-h5.pages.dev',
    '',
    section || `_CHANGELOG 里没有 ${version} 的更新记录。_`,
    '',
    '### 下载',
    '',
    `- \`draw-clash-web-${version}.zip\`：网页版文件，解压后放到任何静态托管即可。`,
    `- \`draw-clash-playtest-${version}.zip\`：本地试玩包，含启动器（\`python3 serve.py\`）和试玩说明。`,
    ...(extra ? ['', extra] : [])
  ].join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.stdout.write(releaseNotes(process.argv[2] ? readFileSync(process.argv[2], 'utf8') : ''));
