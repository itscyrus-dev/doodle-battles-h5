// 战后复盘：只引用战斗里真实记录的数据。返回文案代码和参数，由界面按语言生成句子。
import { TYPES, UNIT_ORDER } from './data.mjs';

export function rosterKey(g) { return `${g.sandbox ? 'sandbox' : g.level}:` + g.plan.map(u => `${u.team}:${u.type}`).sort().join(','); }

export function report(g) {
  const s = g.stats?.[0] || { blocked: 0, explosionTaken: 0, backlineDeaths: 0, byType: {} };
  const round = Math.round, observations = [];
  const say = (key, params = {}) => observations.push({ key, params });
  if (g.itemUsed) {
    if (g.selectedItem === 'heal') say('obs.itemHeal', { n: round(g.itemStats.healed) });
    if (g.selectedItem === 'smoke') say('obs.itemSmoke', { n: round(g.itemStats.prevented) });
    if (g.selectedItem === 'rally') say('obs.itemRally', { n: g.itemStats.boostedAttacks });
    if (g.selectedItem === 'thunder') say('obs.itemThunder', { n: g.itemStats.struck, damage: round(g.itemStats.strikeDamage) });
    if (g.selectedItem === 'frost') say('obs.itemFrost', { n: g.itemStats.frozen });
  }
  const mended = s.byType?.healer?.healed || 0;
  if (mended > 0) say('obs.mended', { n: round(mended) });
  if (s.blocked > 0) say('obs.blocked', { n: round(s.blocked) });
  if (s.charges > 0) say('obs.charges', { n: s.charges });
  if (s.backlineDeaths > 0) say('obs.backlineDeaths', { n: s.backlineDeaths });
  if (s.explosionTaken > 0) say('obs.explosion', { n: round(s.explosionTaken) });
  if (s.chilled > 0) say('obs.chilled', { n: s.chilled });
  if (!observations.length) say('obs.summary', { alive: g.units.filter(u => u.team === 0 && u.hp > 0).length, total: g.plan.filter(u => u.team === 0).length, time: g.elapsed.toFixed(1) });
  if (s.stoneArrows > 0) say('obs.stoneArrows', { n: s.stoneArrows });
  if (s.firstLoss) say('obs.firstLoss', { type: s.firstLoss.type, time: s.firstLoss.time.toFixed(1) });

  const rows = UNIT_ORDER.flatMap(type => {
    const units = g.units.filter(u => u.team === 0 && u.type === type); if (!units.length) return [];
    const stats = s.byType?.[type] || { dealt: 0, taken: 0, healed: 0 };
    return [{ type, dealt: stats.dealt, taken: stats.taken, healed: stats.healed || 0, total: units.length, alive: units.filter(u => u.hp > 0).length }];
  });

  const hasBackline = g.plan.some(u => u.team === 0 && TYPES[u.type].backline);
  let tip = { key: 'tip.default', params: {} };
  if (s.explosionTaken > (g.stats?.[0].damageTaken || 0) * .3) tip = { key: 'tip.spread', params: {} };
  else if (s.backlineDeaths > 0 && hasBackline) tip = { key: 'tip.frontline', params: {} };
  else if (s.chilled >= 3 && g.phase !== 'won') tip = { key: 'tip.chill', params: {} };
  else if (g.phase === 'won' && s.blocked > 0) tip = { key: 'tip.guardsWorked', params: {} };
  if (s.stoneArrows > 0) tip = { key: 'tip.stone', params: { n: s.stoneArrows } };
  return { observations, tip, rows };
}
