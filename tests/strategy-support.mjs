import {Battle} from '../src/engine.mjs';
import{TYPES}from'../src/data.mjs';
export const recipes={balanced:['guard','guard','archer','archer','bomber','knight','knight'],melee:['guard','knight','knight','knight','knight','knight'],archers:['guard','archer','archer','archer','archer'],bombs:['guard','guard','bomber','bomber','knight'],heavy:['giant','guard','archer','archer','bomber','knight'],rush:['knight','knight','knight','knight','knight','bomber','bomber'],shield:['guard','guard','guard','archer','archer','archer'],blast:['giant','bomber','bomber','guard','archer'],full:['guard','guard','giant','bomber','archer','archer','knight','knight']};
export function setup(level,recipe,layout){const g=new Battle(level);const fronts=recipe.filter(t=>!['archer','bomber'].includes(t)),backs=recipe.filter(t=>['archer','bomber'].includes(t));for(const [list,y]of[[fronts,365],[backs,490]])list.forEach((type,i)=>{let x=60+(i%5)*95,py=y+Math.floor(i/5)*65;if(layout==='left')x=45+(i%4)*55;if(layout==='right')x=475-(i%4)*55;if(layout==='tight')x=185+(i%3)*55;if(layout==='tight')py=y+Math.floor(i/3)*50;g.place(type,x,py);});return g;}
export function run(g,item='heal'){g.selectItem(item);g.start();for(let i=0;i<4805&&g.phase==='battle';i++){if(item==='heal'){if(g.units.some(u=>!u.team&&u.hp>0&&u.hp<u.max*.65))g.useItem();}else if(g.elapsed>2)g.useItem();g.update(1/60);}return{phase:g.phase,time:+g.elapsed.toFixed(1),survive:g.units.filter(u=>!u.team&&u.hp>0).length};}
// 预算收紧后，部分关卡需要更精简的配方或具体站位；具体站位来自 tools/level-report.mjs 的搜索结果。
Object.assign(recipes,{bombsLean:['guard','bomber','bomber','knight','knight'],balancedLean:['guard','guard','archer','archer','knight','knight']});
export const plans={
 // 第8关：两名护卫堵住窄口，爆破手越过巨石投弹。
 narrowPass:[{type:'archer',x:177,y:441},{type:'guard',x:297,y:360},{type:'archer',x:451,y:507},{type:'guard',x:259,y:347},{type:'bomber',x:212,y:476}],
 // 第10关：四种兵种协同，满足“协同终局”挑战。
 finale:[{type:'archer',x:257,y:449},{type:'bomber',x:407,y:386},{type:'archer',x:411,y:539},{type:'knight',x:236,y:397},{type:'guard',x:133,y:418},{type:'archer',x:230,y:439},{type:'guard',x:382,y:414},{type:'archer',x:73,y:514},{type:'knight',x:288,y:358}]
};
// 用配方或具体站位布阵，并确认每名士兵都放得下；放不下说明超出了关卡预算或撞上巨石。
export function build(level,spec,layout='wide'){
 const g=typeof spec[0]==='string'?setup(level,spec,layout):new Battle(level);
 if(typeof spec[0]!=='string')for(const u of spec)g.place(u.type,u.x,u.y);
 if(g.plan.length!==spec.length)throw new Error(`第${level+1}关只放下 ${g.plan.length}/${spec.length} 名士兵`);
 return g;
}
