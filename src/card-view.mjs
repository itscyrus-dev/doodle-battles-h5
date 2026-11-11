// 卡牌的显示：名字、说明文字和图。战斗界面和远征界面共用。
import { TACTICS } from './engine.mjs';
import { CARDS, cardStats } from './cards.mjs';
import { t } from './i18n.mjs';
import { esc, img } from './ui.mjs';

export const TACTIC_ICON = { heal: 'item-heal', smoke: 'item-smoke', rally: 'item-rally', thunder: 'item-thunder', frost: 'item-frost', reinforce: 'tactic-reinforce', assault: 'tactic-assault', shield: 'tactic-shield' };
export const cardName = (id, up = false) => `${t(`card.${id}`)}${up ? '+' : ''}`;
export const kwName = k => t(`kw.${k}`);
// 一张牌的说明：兵牌写兵种、人数和关键词；战术牌写效果（按是否升级给出数值）。c 是 cardStats 的结果。
export function cardText(c) {
  if (c.kind === 'tactic') {
    const T = TACTICS[c.effect], base = T.ratio ?? T.duration ?? T.damage ?? T.n ?? T.amount, value = c.up ? T.up : base;
    return t(`tactic.${c.effect}.desc`, { a: c.effect === 'heal' ? Math.round(value * 100) : value });
  }
  return [t('card.squad', { name: t(`unit.${c.type}.name`), n: c.n }), ...(c.kw || []).map(k => `${kwName(k)}：${t(`kw.${k}.desc`)}`)].join('\n');
}
export const cardArt = (c, size = 96) => (c.kind === 'unit' ? `<canvas width="${size}" height="${size}" data-unit="${c.type}"></canvas>` : img(`icons/${TACTIC_ICON[c.effect]}.webp`));
export const costBadge = c => `<span class="pcost ${c.kind}">${c.kind === 'unit' ? img('icons/ink.webp') : img('icons/momentum.webp')}${c.cost}</span>`;
export const kindLabel = c => `${t(c.kind === 'unit' ? 'card.unit' : 'card.tactic')} · ${t(`rarity.${CARDS[c.id].rarity}`)}`;
// 牌面（用在战利品、商店、牌库里）：类别、费用、图、名字、说明。
export function cardFace(entry, perks = {}) {
  const c = cardStats(entry, perks);
  return { c, html: `<span class="kind">${esc(kindLabel(c))}</span>${costBadge(c)}${cardArt(c, 168)}<b>${esc(cardName(c.id, c.up))}</b><small>${esc(cardText(c)).replace(/\n/g, '<br>')}</small>` };
}
