import{TYPES}from'./data.mjs';
export const UNIT_GUIDE={
 knight:{good:'快速接近敌人，补足前排和近战输出。',watch:'生命低于护卫，单独冲进敌阵容易被集火。'},
 guard:{good:'站在远程单位前面，抵挡路径上的箭矢；受到远程伤害降低45%。',watch:'移动较慢，单次伤害不高。减伤无需额外操作。'},
 archer:{good:'留在后排持续射箭；点选角色可以看射程。',watch:'箭会被巨石和路径上的敌人挡住，被近战接触时很脆弱。'},
 bomber:{good:'对付聚集的敌人，炸弹可以越过巨石。',watch:'炸弹投向出手时的位置；分散或移动中的敌人不容易同时命中。'},
 giant:{good:'高生命的重型前排，适合承伤并推进阵线。',watch:'成本高、移动慢，每队最多1名，需要后排配合。'}
};
export const SPOTLIGHTS={
 0:{goal:'保护后排',description:'获胜且至少一名弓手参战，全部弓手存活。',check:g=>g.phase==='won'&&g.units.some(u=>u.team===0&&u.type==='archer')&&g.units.filter(u=>u.team===0&&u.type==='archer').every(u=>u.hp>0)},
 1:{goal:'混合编队',description:'用至少两种兵种获胜。',check:g=>g.phase==='won'&&new Set(g.plan.filter(u=>!u.team).map(u=>u.type)).size>=2},
 2:{goal:'范围输出',description:'获胜且爆破手实际造成过伤害。',check:g=>g.phase==='won'&&(g.stats?.[0].byType.bomber.dealt||0)>0},
 5:{goal:'绕石射击',description:'获胜、弓手实际射过箭，且没有箭矢撞石。',check:g=>g.phase==='won'&&(g.stats?.[0].arrowsFired||0)>0&&g.stats[0].stoneArrows===0},
 9:{goal:'协同终局',description:'至少三种兵种参战，获胜且至少三人存活。',check:g=>g.phase==='won'&&new Set(g.plan.filter(u=>!u.team).map(u=>u.type)).size>=3&&g.units.filter(u=>!u.team&&u.hp>0).length>=3}
};
export function guideStep(g,flags={}){
 const front=g.plan.filter(u=>u.team===0&&['knight','guard','giant'].includes(u.type)),archers=g.count('archer');
 if(g.phase!=='build')return null;
 if(g.level===0){
  if(front.length<2)return{id:'front',title:'1 / 4 · 放两名前排',text:'先拖入两名护卫，放在蓝色区域靠前的位置。',target:'roster',ghosts:[{type:'guard',x:130,y:365,team:0},{type:'guard',x:260,y:365,team:0}]};
  if(archers<2)return{id:'rear',title:'2 / 4 · 加两名弓手',text:'把两名弓手放在前排后面，形成前后排配合。',target:'roster',ghosts:[{type:'archer',x:110,y:490,team:0},{type:'archer',x:250,y:490,team:0}]};
  if(!flags.moved)return{id:'move',title:'3 / 4 · 调整一下位置',text:'拖动场上任意士兵换个位置；移位不重复扣墨水。',target:'arena'};
  return{id:'start',title:'4 / 4 · 看看你的安排',text:'可以用剩余墨水补兵，再点“开始战斗”，观察前排保护后排。',target:'start'};
 }
 if(g.level===1){
  if(!flags.inspected)return{id:'inspect',title:'盾墙阵地 · 先观察',text:'放兵后点选场上士兵，查看射程与接敌路线。',target:'arena'};
  if(new Set(g.plan.filter(u=>!u.team).map(u=>u.type)).size<2)return{id:'mix',title:'试试混合编队',text:'敌方护卫会减免箭伤。尝试搭配近战或爆破，比较不同结果。',target:'roster'};
  return{id:'start',title:'观察盾墙怎么被突破',text:'开始战斗；失败后保留阵容，每次只调整一部分。',target:'start'};
 }
 if(g.level===2){
  if(!g.count('bomber'))return{id:'blast',title:'密集冲锋 · 认识爆破手',text:'敌人聚在中路。试着加入爆破手，前排负责拖住敌人。',target:'roster',ghosts:[{type:'bomber',x:250,y:500,team:0}]};
  if(!flags.itemChosen)return{id:'item',title:'战前选一件道具',text:'点底部道具选择。每场只能用一次，带哪件由你决定。',target:'heal'};
  return{id:'start',title:'留意范围伤害',text:'开战后观察炸弹落点与复盘中的爆破手输出。',target:'start'};
 }
 if(g.level===5&&!flags.inspected)return{id:'cover',title:'巨石守卫 · 观察路线',text:'点选士兵看绕行；弓手被挡住时，试着拖到侧翼。',target:'arena'};
 if(g.level===9&&!flags.itemChosen)return{id:'final',title:'最后一笔 · 自己做决定',text:'先看敌军两翼和巨石，再选道具。可以返回兵种手册复习。',target:'heal'};
 return null;
}
