// 远征里的遗物（墨水）。只有数据和组合规则，不碰界面。
import { TYPES, TEAM_LIMIT, UNIT_ORDER } from './data.mjs';

// tier：common 常见、rare 稀有（精英战和首领战才掉）。
// flags 交给战斗模拟；all / units 是属性倍率；costScale 改墨水消耗；teamLimit 加出战人数；bounty 是每名幸存者的赏金。
export const RELICS = {
  swift: { tier: 'common', flags: { swift: true } },
  charge: { tier: 'rare', flags: { charge: true } },
  flank: { tier: 'rare', flags: { flank: true } },
  anchor: { tier: 'common', flags: { anchor: true } },
  thick: { tier: 'common', all: { hp: 1.15 } },
  sharp: { tier: 'common', all: { damage: 1.12 } },
  thrift: { tier: 'rare', costScale: .9 },
  squad: { tier: 'rare', teamLimit: 2 },
  drum: { tier: 'common', flags: { drum: true } },
  bleed: { tier: 'common', flags: { bleed: true } },
  spring: { tier: 'common', flags: { spring: true } },
  echo: { tier: 'rare', flags: { echo: true } },
  bounty: { tier: 'common', bounty: 3 },
  longbow: { tier: 'common', units: { archer: { range: 1.15 }, bomber: { range: 1.15 }, mage: { range: 1.15 } } },
  // 卡牌联动的遗物（远征卡牌模式）
  fervor: { tier: 'rare', flags: { fervor: true } },
  pact: { tier: 'common', flags: { pact: true } },
  horde: { tier: 'common', horde: true },
  warcry: { tier: 'common', momentum: 2 },
  tactician: { tier: 'rare', tactician: true },
  scholar: { tier: 'rare', hand: 1 }
};
export const RELIC_ORDER = Object.keys(RELICS);

function multiply(into, from) { for (const [k, v] of Object.entries(from || {})) into[k] = (into[k] ?? 1) * v; return into; }

// 把一局远征的遗物和敌军强化合成战斗模拟需要的修正。
// teamLimit 是出战人数的基数（卡牌战比战役多）。
export function runMods({ relics = [] } = {}, enemy = null, teamLimit = TEAM_LIMIT) {
  const mods = { all: {}, units: {}, enemy: enemy ? { ...enemy } : null, cost: {}, teamLimit, flags: {} };
  let costScale = 1;
  for (const id of relics) {
    const r = RELICS[id]; if (!r) continue;
    if (r.flags) Object.assign(mods.flags, r.flags);
    if (r.all) multiply(mods.all, r.all);
    for (const [type, m] of Object.entries(r.units || {})) mods.units[type] = multiply(mods.units[type] || {}, m);
    if (r.costScale) costScale *= r.costScale;
    if (r.teamLimit) mods.teamLimit += r.teamLimit;
  }
  if (costScale !== 1) for (const type of UNIT_ORDER) mods.cost[type] = Math.max(1, Math.round(TYPES[type].cost * costScale));
  return mods;
}
export const bountyOf = relics => relics.reduce((s, id) => s + (RELICS[id]?.bounty || 0), 0);

// 只影响卡牌规则（而不是战斗属性）的遗物效果：人海、军师、省墨、战吼、博览、赏金。
export function relicPerks(relics = []) {
  const has = id => relics.includes(id);
  return { horde: has('horde'), tactician: has('tactician'), thrift: has('thrift'), momentum: relics.reduce((s, id) => s + (RELICS[id]?.momentum || 0), 0), hand: relics.reduce((s, id) => s + (RELICS[id]?.hand || 0), 0), bounty: bountyOf(relics) };
}
