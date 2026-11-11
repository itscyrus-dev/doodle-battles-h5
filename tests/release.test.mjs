// 发布流程的守卫：版本号处处一致、这一版写了更新记录、工作流引用的脚本都存在。
// 这些不满足时 CI 会失败，自动发布也就不会发出一个没写说明或版本号错位的 Release。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { PLAYTEST_VERSION } from '../src/playtest.mjs';
import { changelogSection, releaseNotes } from '../release/notes.mjs';

const root = new URL('..', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const { version } = JSON.parse(read('release.json'));

test('版本号格式正确，游戏里显示的版本与 release.json 一致', () => {
  assert.match(version, /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/);
  assert.equal(PLAYTEST_VERSION, version, '改版本号时 release.json 和 src/playtest.mjs 要一起改');
});

test('当前版本在 CHANGELOG.md 里有内容，Release 说明带试玩链接和两个下载包', () => {
  const section = changelogSection(read('CHANGELOG.md'), version);
  assert.ok(section.length > 40, `CHANGELOG.md 缺少 “## ${version}” 小节`);
  const notes = releaseNotes();
  assert.ok(notes.includes(section));
  assert.ok(notes.includes('https://doodle-battles-h5.pages.dev'));
  for (const name of [`draw-clash-web-${version}.zip`, `draw-clash-playtest-${version}.zip`]) assert.ok(notes.includes(name), name);
});

test('更新记录按小节取词：只取指定版本，不串到下一节；没有的版本返回空', () => {
  const text = '# Log\n\n## 2.0.0\n\nnew things\n- a\n\n## 1.9.0\n\nold things\n';
  assert.equal(changelogSection(text, '2.0.0'), 'new things\n- a');
  assert.equal(changelogSection(text, '1.9.0'), 'old things');
  assert.equal(changelogSection(text, '1.9'), '');
  assert.equal(changelogSection(text, '3.0.0'), '');
});

test('工作流里用到的脚本和打包文件名都对得上', () => {
  const ci = read('.github/workflows/ci.yml'), release = read('.github/workflows/release.yml');
  for (const script of ['release/build_release.py', 'release/build_playtest.py', 'release/build_web.py', 'release/notes.mjs']) assert.ok(existsSync(new URL(script, root)), script);
  for (const workflow of [ci, release]) { assert.ok(workflow.includes('node --test tests/*.test.mjs')); assert.ok(workflow.includes('python3 release/build_release.py')); }
  assert.ok(release.includes('node release/notes.mjs'));
  assert.ok(release.includes('contents: write'), '发布需要写权限：仓库默认只给工作流只读权限');
  const builder = read('release/build_release.py');
  for (const name of ['draw-clash-web-$VERSION.zip', 'draw-clash-playtest-$VERSION.zip']) {
    assert.ok(release.includes(`dist/${name}`), name);
    assert.ok(builder.includes(name.replace('$VERSION', '{version}')), `build_release.py 应生成 ${name}`);
  }
});
