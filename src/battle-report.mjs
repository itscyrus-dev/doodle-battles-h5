import {TYPES} from './data.mjs';
export function rosterKey(g){return `${g.sandbox?'sandbox':g.level}:`+g.plan.map(u=>`${u.team}:${u.type}`).sort().join(',');}
export function report(g){
  const s=g.stats?.[0]||{blocked:0,explosionTaken:0,backlineDeaths:0};
  const observations=[];
  if(g.itemUsed){
    if(g.selectedItem==='heal')observations.push(`急救旗实际恢复 ${Math.round(g.itemStats.healed)} 点生命。`);
    if(g.selectedItem==='smoke')observations.push(`烟雾实际减免 ${Math.round(g.itemStats.prevented)} 点箭矢伤害。`);
    if(g.selectedItem==='rally')observations.push(`集结期间我方完成 ${g.itemStats.boostedAttacks} 次攻击。`);
  }
  if(s.blocked>0)observations.push(`护卫累计抵挡 ${Math.round(s.blocked)} 点远程伤害。`);
  if(s.backlineDeaths>0)observations.push(`${s.backlineDeaths} 名弓手或爆破手倒下。`);
  if(s.explosionTaken>0)observations.push(`我方承受了 ${Math.round(s.explosionTaken)} 点爆炸伤害。`);
  if(!observations.length)observations.push(`存活 ${g.units.filter(u=>u.team===0&&u.hp>0).length} / ${g.plan.filter(u=>u.team===0).length} 人，战斗持续 ${g.elapsed.toFixed(1)} 秒。`);
  if(s.stoneArrows>0)observations.push(`本场 ${s.stoneArrows} 支我方箭矢撞上巨石。`);
  if(s.firstLoss)observations.push(`最早阵亡：${TYPES[s.firstLoss.type].name}，发生在 ${s.firstLoss.time.toFixed(1)} 秒。`);
  const rows=Object.entries(TYPES).flatMap(([type,d])=>{
    const units=g.units.filter(u=>u.team===0&&u.type===type);if(!units.length)return [];
    const stats=s.byType?.[type]||{dealt:0,taken:0};return [{type,name:d.name,...stats,total:units.length,alive:units.filter(u=>u.hp>0).length}];
  });
  const ranged=g.plan.some(u=>u.team===0&&['archer','bomber'].includes(u.type));
  let tip='试着集中一侧兵力，观察哪一组先接敌；每次只移动几名士兵，更容易看出效果。';
  if(s.explosionTaken>g.stats?.[0].damageTaken*.3)tip='下次尝试：拉开士兵间距，降低一次爆炸同时伤到多人的风险。';
  else if(s.backlineDeaths>0&&ranged)tip='下次尝试：把护卫和先锋往前放，弓手与爆破手往后挪，让近战先接敌。';
  else if(g.phase==='won'&&s.blocked>0)tip='这次护卫确实减少了远程伤害。可以保留前排，再微调后排距离，挑战更多存活人数。';
  if(s.stoneArrows>0)tip=`下次尝试：本场 ${s.stoneArrows} 支箭被巨石挡住。把弓手移到侧翼，或换用能越石投弹的爆破手，再比较结果。`;
  return {observations,tip,rows};
}
