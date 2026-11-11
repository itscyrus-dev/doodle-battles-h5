// 生成 GitHub Release 的说明：试玩链接 + CHANGELOG.md 里当前版本的小节 + 下载说明。
// 用法：node release/notes.mjs > notes.md
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

export function releaseNotes() {
  let section = '';
  try { section = changelogSection(readFileSync(new URL('CHANGELOG.md', root), 'utf8'), version); } catch { /* 没有更新记录文件时只输出链接和下载说明 */ }
  return [
    '**Play in your browser · 在线试玩：** https://doodle-battles-h5.pages.dev',
    '',
    section || `_No changelog entry for ${version}._`,
    '',
    '### Downloads · 下载',
    '',
    `- \`draw-clash-web-${version}.zip\` — the static site. Unzip it and host it anywhere. 网页版文件，解压后放到任何静态托管即可。`,
    `- \`draw-clash-playtest-${version}.zip\` — the same build with a local launcher (\`python3 serve.py\`) and playtest notes. 本地试玩包，含启动器和试玩说明。`
  ].join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.stdout.write(releaseNotes());
