// 文案完整性：两种语言的条目和占位符必须一致，代码里用到的条目都要存在。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { STRINGS, t, setLang, pick, detectLang } from '../src/i18n.mjs';
import { UNIT_ORDER, ITEM_ORDER } from '../src/data.mjs';
import { ACHIEVEMENTS, SKINS } from '../src/meta.mjs';

const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

test('中英文条目一一对应，占位符相同，没有空文案', () => {
  const zh = Object.keys(STRINGS.zh).sort(), en = Object.keys(STRINGS.en).sort();
  assert.deepEqual(zh.filter(k => !(k in STRINGS.en)), [], '英文缺少的条目'); assert.deepEqual(en.filter(k => !(k in STRINGS.zh)), [], '中文缺少的条目');
  for (const key of zh) { assert.ok(STRINGS.zh[key].trim() && STRINGS.en[key].trim(), key); assert.equal(placeholders(STRINGS.zh[key]), placeholders(STRINGS.en[key]), `${key} 的占位符不一致`); }
});

test('代码里写死的文案条目都存在', () => {
  const dir = new URL('../src/', import.meta.url), missing = [];
  for (const file of readdirSync(dir).filter(f => f.endsWith('.mjs') && f !== 'i18n.mjs')) {
    const source = readFileSync(new URL(file, dir), 'utf8');
    for (const m of source.matchAll(/\bt\(\s*'([a-zA-Z0-9_.-]+)'/g)) if (!(m[1] in STRINGS.zh)) missing.push(`${file}: ${m[1]}`);
  }
  assert.deepEqual(missing, []);
});

test('按规则拼出来的条目（兵种、道具、成就、配色、错误、预览）都存在', () => {
  const need = [
    ...UNIT_ORDER.flatMap(u => ['name', 'role', 'good', 'watch'].map(p => `unit.${u}.${p}`)),
    ...ITEM_ORDER.flatMap(i => ['name', 'short', 'desc'].map(p => `item.${i}.${p}`)),
    ...ACHIEVEMENTS.flatMap(a => [`ach.${a.id}.name`, `ach.${a.id}.desc`]), ...SKINS.map(k => `skin.${k.id}`),
    ...['phase', 'invalid', 'bounds', 'zone-blue', 'zone-red', 'rock', 'pond', 'team-full', 'type-full', 'ink', 'overlap'].map(c => `err.${c}`),
    ...['no-enemy', 'support', 'unreachable', 'blocked', 'in-range', 'lob', 'hunt', 'route'].map(s => `preview.${s}`),
    ...['itemHeal', 'itemSmoke', 'itemRally', 'itemThunder', 'itemFrost', 'mended', 'blocked', 'charges', 'backlineDeaths', 'explosion', 'chilled', 'summary', 'stoneArrows', 'firstLoss'].map(o => `obs.${o}`),
    ...['default', 'spread', 'frontline', 'chill', 'guardsWorked', 'stone'].map(k => `tip.${k}`)
  ];
  for (const lang of ['zh', 'en']) assert.deepEqual(need.filter(k => !STRINGS[lang][k]), [], `${lang} 缺少条目`);
});

test('取词：替换占位符、按语言取关卡文字、缺失时回退', () => {
  setLang('en'); assert.equal(t('common.level', { n: 7 }), 'Level 7'); assert.equal(pick({ zh: '初次交锋', en: 'First Clash' }), 'First Clash');
  setLang('zh'); assert.equal(t('common.level', { n: 7 }), '第 7 关'); assert.equal(pick({ zh: '初次交锋', en: 'First Clash' }), '初次交锋');
  assert.equal(t('no.such.key'), 'no.such.key'); assert.equal(t('err.type-full', { name: '弓手' }), '弓手最多 {n} 名', '没给的参数保留占位符，便于发现遗漏');
  assert.equal(setLang('fr'), 'zh', '不支持的语言保持不变');
  assert.equal(detectLang(['zh-TW', 'en']), 'zh'); assert.equal(detectLang(['en-US']), 'en'); assert.equal(detectLang(['ja-JP']), 'en'); assert.equal(detectLang([]), 'en');
});
