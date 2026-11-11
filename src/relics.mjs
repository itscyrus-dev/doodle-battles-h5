// 远征里的遗物（墨水）和兵种精锐升级。只有数据和组合规则，不碰界面。
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
  longbow: { tier: 'common', units: { archer: { range: 1.15 }, bomber: { range: 1.15 }, mage: { range: 1.15 } } }
};
export const RELIC_ORDER = Object.keys(RELICS);

// 精锐升级：每个兵种一次。数字是倍率；meleeTaken 是受到近战伤害的比例，chargeMult 乘在冲锋倍率上。
export const UPGRADES = {
  knight: { hp: 1.35, damage: 1.2 },
  guard: { hp: 1.3, meleeTaken: .8 },
  archer: { damage: 1.25, range: 1.12 },
  bomber: { damage: 1.15, aoe: 1.3 },
  giant: { hp: 1.3, damage: 1.25 },
  lancer: { chargeMult: 1.33, speed: 1.1 },
  healer: { heal: 1.5, range: 1.15 },
  mage: { damage: 1.25, chill: 1.5 }
};

function multiply(into, from) { for (const [k, v] of Object.entries(from || {})) into[k] = (into[k] ?? 1) * v; return into; }

// 把一局远征的遗物、升级和敌军强化合成战斗模拟需要的修正。
export function runMods({ relics = [], upgrades = [] } = {}, enemy = null) {
  const mods = { all: {}, units: {}, enemy: enemy ? { ...enemy } : null, cost: {}, teamLimit: TEAM_LIMIT, flags: {} };
  let costScale = 1;
  for (const id of relics) {
    const r = RELICS[id]; if (!r) continue;
    if (r.flags) Object.assign(mods.flags, r.flags);
    if (r.all) multiply(mods.all, r.all);
    for (const [type, m] of Object.entries(r.units || {})) mods.units[type] = multiply(mods.units[type] || {}, m);
    if (r.costScale) costScale *= r.costScale;
    if (r.teamLimit) mods.teamLimit += r.teamLimit;
  }
  for (const type of upgrades) if (UPGRADES[type]) mods.units[type] = multiply(mods.units[type] || {}, UPGRADES[type]);
  if (costScale !== 1) for (const type of UNIT_ORDER) mods.cost[type] = Math.max(1, Math.round(TYPES[type].cost * costScale));
  return mods;
}
export const bountyOf = relics => relics.reduce((s, id) => s + (RELICS[id]?.bounty || 0), 0);
