// 远征的卡牌：兵牌（一整支小队，可带关键词）和战术牌（开战后用战墨打出）。只有数据和规则，不碰界面。
import { KEYWORDS, TACTICS } from './engine.mjs';
import { STICKER_FX } from './stickers.mjs';

export const KEYWORD_ORDER = Object.keys(KEYWORDS);
export const TACTIC_ORDER = Object.keys(TACTICS);
// rarity：common 常见、uncommon 少见、rare 稀有。cost 都是墨水：兵牌在布阵时花，战术牌在开战后用剩下的墨水打出。
export const CARDS = {
  knights: { kind: 'unit', type: 'knight', n: 3, cost: 28, rarity: 'common' },
  chargers: { kind: 'unit', type: 'knight', n: 2, kw: ['charge'], cost: 24, rarity: 'common' },
  frostblades: { kind: 'unit', type: 'knight', n: 3, kw: ['frostbite'], cost: 34, rarity: 'uncommon' },
  berserkers: { kind: 'unit', type: 'knight', n: 2, kw: ['berserk', 'lifesteal'], cost: 30, rarity: 'rare' },
  guards: { kind: 'unit', type: 'guard', n: 2, cost: 34, rarity: 'common' },
  ironwall: { kind: 'unit', type: 'guard', n: 2, kw: ['bulwark', 'veteran'], cost: 42, rarity: 'uncommon' },
  archers: { kind: 'unit', type: 'archer', n: 2, cost: 30, rarity: 'common' },
  volley: { kind: 'unit', type: 'archer', n: 2, kw: ['volley'], cost: 36, rarity: 'uncommon' },
  arrowrain: { kind: 'unit', type: 'archer', n: 3, cost: 44, rarity: 'uncommon' },
  bomber: { kind: 'unit', type: 'bomber', n: 1, cost: 24, rarity: 'common' },
  sappers: { kind: 'unit', type: 'bomber', n: 2, cost: 46, rarity: 'uncommon' },
  giant: { kind: 'unit', type: 'giant', n: 1, cost: 46, rarity: 'uncommon' },
  warchief: { kind: 'unit', type: 'giant', n: 1, kw: ['inspire', 'veteran'], cost: 56, rarity: 'rare' },
  lancers: { kind: 'unit', type: 'lancer', n: 2, cost: 38, rarity: 'common' },
  outriders: { kind: 'unit', type: 'lancer', n: 2, kw: ['swift', 'charge'], cost: 46, rarity: 'rare' },
  medic: { kind: 'unit', type: 'healer', n: 1, cost: 22, rarity: 'common' },
  medics: { kind: 'unit', type: 'healer', n: 2, cost: 42, rarity: 'uncommon' },
  mage: { kind: 'unit', type: 'mage', n: 1, cost: 26, rarity: 'uncommon' },
  t_heal: { kind: 'tactic', effect: 'heal', cost: 10, rarity: 'common' },
  t_smoke: { kind: 'tactic', effect: 'smoke', cost: 10, rarity: 'common' },
  t_rally: { kind: 'tactic', effect: 'rally', cost: 15, rarity: 'common' },
  t_thunder: { kind: 'tactic', effect: 'thunder', cost: 20, targeted: true, rarity: 'uncommon' },
  t_reinforce: { kind: 'tactic', effect: 'reinforce', cost: 20, targeted: true, rarity: 'uncommon' },
  t_assault: { kind: 'tactic', effect: 'assault', cost: 15, rarity: 'uncommon' },
  t_shield: { kind: 'tactic', effect: 'shield', cost: 15, rarity: 'uncommon' },
  t_frost: { kind: 'tactic', effect: 'frost', cost: 25, rarity: 'rare' }
};
export const CARD_ORDER = Object.keys(CARDS);
export const RARITY_WEIGHT = { common: 6, uncommon: 3, rare: 1 };
// 每局开头的牌库（8 张），按编制不同。
export const STARTER_DECKS = {
  iron: ['knights', 'knights', 'guards', 'guards', 'archers', 'archers', 't_heal', 't_rally'],
  raiders: ['knights', 'chargers', 'lancers', 'lancers', 'archers', 'archers', 't_assault', 't_heal'],
  sappers: ['guards', 'guards', 'archers', 'archers', 'bomber', 'bomber', 't_smoke', 't_thunder']
};
// 手牌：每场随机抽几张。
export const HAND = { size: 6 };
// 卡牌战的出战人数上限（战役是 10 人），人海贴纸在此基础上再加。
export const CARD_TEAM_LIMIT = 14;
// 开战后每击倒一名敌人返还的墨水（只能用来打战术牌，因为这时已经不能出兵）。
export const REFUND = { perKill: 4 };

// 升级：小队（2 人以上）多 1 人、墨水不变；单人牌墨水 −30%；战术牌换成 TACTICS 里的 up 数值。
export const UPGRADE = { extra: 1, single: .7 };
// 一张牌（牌库里的一项 { id, up }）实际放出的人数和墨水。horde 是“人海”贴纸：2 人以上的小队多来 2 人。
export function cardStats(entry, { horde = false } = {}) {
  const c = CARDS[entry.id];
  if (c.kind === 'tactic') return { ...c, id: entry.id, up: !!entry.up };
  const up = !!entry.up, single = c.n === 1;
  const crowd = horde && !single, n = c.n + (up && !single ? UPGRADE.extra : 0) + (crowd ? STICKER_FX.horde.extra : 0);
  const cost = Math.round(c.cost * (up && single ? UPGRADE.single : 1));
  return { ...c, id: entry.id, up, n, cost, kw: [...(c.kw || []), ...(crowd ? ['crowd'] : [])] };
}
// 牌的强度粗估（墨水值），给遭遇战难度和测试用。
export const deckInk = deck => deck.reduce((s, e) => s + (CARDS[e.id].kind === 'unit' ? cardStats(e).cost : 0), 0);
