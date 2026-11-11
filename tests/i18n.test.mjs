// 文案完整性：代码里用到的条目都要存在，没有空文案。界面只有中文。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { STRINGS, t, pick } from '../src/i18n.mjs';
import { UNIT_ORDER, ITEM_ORDER } from '../src/data.mjs';
import { ACHIEVEMENTS, SKINS } from '../src/meta.mjs';
import { CARD_ORDER, KEYWORD_ORDER, TACTIC_ORDER, CARDS, cardStats } from '../src/cards.mjs';
import { RELIC_ORDER } from '../src/relics.mjs';
import { WARBAND_ORDER, EVENTS, campOptions } from '../src/run.mjs';
import { TEMPLATE_ORDER, BOSSES } from '../src/encounters.mjs';
import { LESSONS } from '../src/tutorial.mjs';
import { cardText } from '../src/card-view.mjs';

test('没有空文案', () => {
  for (const [key, text] of Object.entries(STRINGS)) assert.ok(typeof text === 'string' && text.trim(), key);
});

test('代码里写死的文案条目都存在', () => {
  const dir = new URL('../src/', import.meta.url), missing = [];
  for (const file of readdirSync(dir).filter(f => f.endsWith('.mjs') && !f.startsWith('i18n'))) {
    const source = readFileSync(new URL(file, dir), 'utf8');
    for (const m of source.matchAll(/\bt\(\s*'([a-zA-Z0-9_.-]+)'/g)) if (!(m[1] in STRINGS)) missing.push(`${file}: ${m[1]}`);
  }
  assert.deepEqual(missing, []);
});

test('按规则拼出来的条目（兵种、道具、成就、卡牌、遗物、奇遇……）都存在', () => {
  const need = [
    ...UNIT_ORDER.flatMap(u => ['name', 'role', 'good', 'watch'].map(p => `unit.${u}.${p}`)),
    ...ITEM_ORDER.flatMap(i => ['name', 'short', 'desc'].map(p => `item.${i}.${p}`)),
    ...ACHIEVEMENTS.flatMap(a => [`ach.${a.id}.name`, `ach.${a.id}.desc`]), ...SKINS.map(k => `skin.${k.id}`),
    ...['phase', 'invalid', 'bounds', 'zone-blue', 'zone-red', 'rock', 'pond', 'team-full', 'type-full', 'ink', 'overlap', 'played', 'crowded'].map(c => `err.${c}`),
    ...['no-enemy', 'support', 'unreachable', 'blocked', 'in-range', 'lob', 'hunt', 'route'].map(s => `preview.${s}`),
    ...['itemHeal', 'itemSmoke', 'itemRally', 'itemThunder', 'itemFrost', 'mended', 'blocked', 'charges', 'backlineDeaths', 'explosion', 'chilled', 'summary', 'stoneArrows', 'firstLoss'].map(o => `obs.${o}`),
    ...['default', 'spread', 'frontline', 'chill', 'guardsWorked', 'stone'].map(k => `tip.${k}`),
    ...CARD_ORDER.map(id => `card.${id}`), ...['common', 'uncommon', 'rare'].map(r => `rarity.${r}`),
    ...KEYWORD_ORDER.flatMap(k => [`kw.${k}`, `kw.${k}.desc`]),
    ...TACTIC_ORDER.map(e => `tactic.${e}.desc`), ...CARD_ORDER.filter(id => CARDS[id].targeted).map(id => `tactic.${CARDS[id].effect}.target`),
    ...RELIC_ORDER.flatMap(id => [`relic.${id}`, `relic.${id}.desc`]),
    ...WARBAND_ORDER.flatMap(id => [`warband.${id}`, `warband.${id}.desc`]),
    ...Object.entries(EVENTS).flatMap(([id, e]) => [`event.${id}`, `event.${id}.text`, ...e.choices.map(c => `event.${id}.${c}`)]),
    ...campOptions({ hearts: 1, maxHearts: 3, deck: [] }).flatMap(o => [`camp.${o.id}`, `camp.${o.id}.desc`, `camp.${o.id}.no`]),
    ...['remove', 'upgrade'].flatMap(id => [`shop.${id}`, `shop.${id}.desc`]),
    ...['damage', 'kills', 'strikes', 'tactics'].map(k => `feats.${k}`),
    ...[...TEMPLATE_ORDER, ...BOSSES.map(b => b.id)].map(id => `intent.${id}`),
    ...LESSONS.flatMap(l => ['name', 'won', 'learned'].map(k => `tutorial.${l.id}.${k}`)), ...LESSONS.filter(l => !l.hand.length).map(l => `tutorial.${l.id}.side`)
  ];
  assert.deepEqual(need.filter(k => !STRINGS[k]), []);
});

test('每张牌的说明都填好了数字，没有漏掉的占位符', () => {
  for (const id of CARD_ORDER) for (const up of [false, true]) {
    const text = cardText(cardStats({ id, up }));
    assert.ok(text && !/[{}]/.test(text) && !text.includes('.desc'), `${id}${up ? '+' : ''}: ${text}`);
  }
});

test('取词：替换占位符；找不到时返回 key', () => {
  assert.equal(t('common.level', { n: 7 }), '第 7 关');
  assert.equal(pick('初次交锋'), '初次交锋'); assert.equal(pick(undefined), '');
  assert.equal(t('no.such.key'), 'no.such.key');
  assert.equal(t('err.type-full', { name: '弓手' }), '弓手最多 {n} 名', '没给的参数保留占位符，便于发现遗漏');
});
