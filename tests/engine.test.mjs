import {readFileSync} from 'node:fs';
const solutions=JSON.parse(readFileSync(new URL('./fixtures/level-solutions.json',import.meta.url),'utf8'));
import test from 'node:test';import assert from 'node:assert/strict';import{Battle}from'../src/engine.mjs';import{TYPES,LEVELS,starsFor}from'../src/data.mjs';
const run=g=>{for(let i=0;i<5000&&g.phase==='battle';i++)g.update(1/60);return g.phase;};
test('区域和预算校验；撤销退还整笔且不会凭空增加预算',()=>{const g=new Battle();assert.equal(g.place('knight',40,200),false);g.beginStroke();const types=['knight','knight','knight','guard','guard','bomber'];for(let i=0;i<types.length;i++)assert.equal(g.place(types[i],50+(i%5)*65,370+Math.floor(i/5)*65),true);assert.equal(g.remaining,0);assert.equal(g.place('knight',400,550),false);g.undo();assert.equal(g.remaining,g.budget);g.undo();assert.equal(g.remaining,g.budget);});
test('橡皮退款；撤销橡皮恢复阵容',()=>{const g=new Battle();g.place('guard',100,400);g.beginStroke();g.erase(100,400);assert.equal(g.remaining,g.budget);g.undo();assert.equal(g.remaining,g.budget-18);});
test('暂停冻结时间，急救每场一次、不复活死亡队员，战斗不改原阵容',()=>{const g=new Battle();g.place('guard',150,370);const plan=structuredClone(g.plan);g.start();g.phase='paused';g.update(2);assert.equal(g.elapsed,0);g.phase='battle';g.units[0].hp=50;assert.equal(g.heal(),true);assert.equal(g.units[0].hp,107);assert.equal(g.heal(),false);assert.deepEqual(g.plan,plan);assert.equal(g.place('knight',200,400),false);});
test('护卫减免远程伤害，爆破能伤害多个目标',()=>{const g=new Battle();g.place('guard',100,400);g.start();g.hit(g.units[0],100,null,true);assert.equal(g.units[0].hp,135);const a=g.units[1],b=g.units[2];a.x=200;a.y=200;b.x=210;b.y=200;g.shots.push({x:200,y:200,tx:200,ty:200,type:'bomber',team:0,speed:210,damage:33,t:0});g.update(1/60);assert.ok(a.hp<a.max);assert.ok(b.hp<b.max);});
test('沙盒需要两队；弱阵容确实失败；胜利结果和星级由模拟决定',()=>{const g=new Battle(0,true);g.place('archer',50,400);assert.equal(g.start(),false);g.place('giant',50,150,1);assert.equal(g.start(),true);assert.equal(run(g),'lost');assert.equal(starsFor(g),0);});
// 每关一个不靠道具也能获胜的阵容：只用本关已解锁的兵种，在预算和配额内。
for(let level=0;level<LEVELS.length;level++)test(`关卡 ${level+1} 存在不靠道具的获胜阵容，星级与记录一致`,()=>{
 const g=new Battle(level),solution=solutions[level];assert.equal(solution.level,level+1);
 for(const u of solution.plan){assert.ok(TYPES[u.type].unlock<=level,`${u.type} 在第${level+1}关还没解锁`);assert.equal(g.place(u.type,u.x,u.y,u.team),true);}
 g.start();run(g);assert.equal(g.phase,'won');assert.equal(g.itemUsed,false);assert.ok(g.remaining>=0);assert.equal(starsFor(g),solution.stars);
});

import {center,muzzle,wrapAngle,ANGLE_TOLERANCE} from '../src/combat.mjs';
function duel(type='archer'){
 const g=new Battle(0,true);g.place(type,100,370);g.place('archer',100,240,1);g.start();
 const enemy=g.units[1];enemy.hp=enemy.max=100000;enemy.cool=999;
 return g;
}
test('目标在背后时不能立即射击，必须完成转身和拉弓',()=>{
 const g=duel(),u=g.units[0];u.angle=Math.PI/2;u.cool=0;
 g.update(1/60);assert.equal(g.shots.filter(s=>s.team===0).length,0);assert.equal(u.windupTotal,0);
 let launch;
 for(let i=0;i<100&&!launch;i++){g.update(1/60);launch=g.shots.find(s=>s.team===0);}
 assert.ok(launch,'转身对准后应能发射');
 const a=center(u),b=center(g.units[1]);
 assert.ok(Math.abs(wrapAngle(Math.atan2(b.y-a.y,b.x-a.x)-launch.angle))<=ANGLE_TOLERANCE);
 assert.ok(g.elapsed>.3,'不能跳过转向与前摇');
 const m=muzzle(u);assert.ok(Math.hypot(launch.sx-m.x,launch.sy-m.y)<1,'箭从弓前端生成');
});
test('八个方向均可对准后射击；朝向和实际弹道一致',()=>{
 for(let i=0;i<8;i++){
  const g=duel(),u=g.units[0],v=g.units[1],angle=i*Math.PI/4;
  u.x=260;u.y=350;v.x=u.x+Math.cos(angle)*100;v.y=u.y+Math.sin(angle)*100;
  u.angle=angle+Math.PI;u.cool=0;
  let shot;
  for(let n=0;n<100&&!shot;n++){g.update(1/60);shot=g.shots.find(s=>s.team===0);}
  assert.ok(shot,`方向 ${i} 未射击`);
  assert.ok(Math.abs(wrapAngle(shot.angle-u.angle))<.001);
  assert.ok(Math.abs(shot.vx-Math.cos(u.angle))<.001);
 }
});
test('飞出的箭不追踪拐弯，拉弓期间目标死亡会取消原攻击',()=>{
 const g=duel(),u=g.units[0];u.cool=0;
 let shot;for(let i=0;i<100&&!shot;i++){g.update(1/60);shot=g.shots.find(s=>s.team===0);}
 const {vx,vy,angle}=shot;g.units[1].x+=100;g.update(1/60);
 assert.equal(shot.vx,vx);assert.equal(shot.vy,vy);assert.equal(shot.angle,angle);
 const h=duel();h.units[0].cool=0;h.update(1/60);assert.ok(h.units[0].windupTotal>0);
 h.units[1].hp=0;h.update(1/60);assert.equal(h.shots.length,0);
});

import {TEAM_LIMIT} from '../src/data.mjs';
import {report} from '../src/battle-report.mjs';
test('各兵种限额与全队10人上限；红蓝配额独立，非法位置不消耗名额',()=>{
 for(const [type,def]of Object.entries(TYPES)){
  const g=new Battle(0,true);
  for(let i=0;i<def.limit;i++)assert.equal(g.place(type,50+i*70,400),true);
  assert.equal(g.place(type,50,500),false);
  assert.equal(g.placementError(type,50,500),'type-full');
  assert.equal(g.place(type,50,150,1),true);
 }
 const g=new Battle(0,true);
 const types=['knight','knight','knight','knight','knight','archer','archer','archer','archer','guard'];
 types.forEach((type,i)=>assert.equal(g.place(type,55+(i%5)*80,380+Math.floor(i/5)*100),true));
 assert.equal(g.count(null),TEAM_LIMIT);assert.equal(g.placementError('bomber',100,570),'team-full');
 assert.equal(g.place('bomber',100,570),false);assert.equal(g.place('bomber',100,150,1),true);
});
test('零墨水时仍可移动；碰撞与越界退回原位；移位和回收都可以撤销',()=>{
 const g=new Battle();const types=['knight','knight','knight','guard','guard','bomber'];
 types.forEach((type,i)=>g.place(type,50+(i%5)*65,370+Math.floor(i/5)*80));
 assert.equal(g.remaining,0);const u=g.plan[0],pid=u.pid;
 assert.equal(g.move(pid,100,560),true);assert.equal(g.remaining,0);assert.equal(g.plan[0].y,560);
 assert.equal(g.move(pid,100,100),false);assert.equal(g.plan[0].y,560);
 assert.equal(g.move(pid,g.plan[1].x,g.plan[1].y),false);
 g.undo();assert.equal(g.plan[0].y,370);assert.equal(g.remaining,0);
 assert.equal(g.remove(pid),true);assert.equal(g.remaining,10);assert.equal(g.count('knight'),2);
 g.undo();assert.equal(g.remaining,0);assert.equal(g.count('knight'),3);
 g.start();assert.equal(g.move(pid,100,560),false);assert.equal(g.remove(pid),false);
});
test('每关敌军不超过12人，都站在敌方半场内，彼此不重叠',()=>{
 for(const level of LEVELS){
  assert.ok(level.enemies.length>=5&&level.enemies.length<=12,`第${level.index+1}关敌军 ${level.enemies.length} 人`);
  for(const u of level.enemies){assert.ok(TYPES[u.type]);assert.equal(u.team,1);assert.ok(u.x>=25&&u.x<=495&&u.y>=65&&u.y<285,`第${level.index+1}关 ${u.type} 位置越界`);}
  for(let i=0;i<level.enemies.length;i++)for(let j=i+1;j<level.enemies.length;j++){const a=level.enemies[i],b=level.enemies[j];assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=24,`第${level.index+1}关敌军站位重叠`);}
 }
});
test('布阵错误返回代码而不是文字，界面再按语言翻译',()=>{
 const g=new Battle();assert.equal(g.placementError('knight',40,200),'zone-blue');assert.equal(g.placementError('knight',5,400),'bounds');assert.equal(g.placementError('dragon',100,400),'invalid');
 g.place('knight',100,400);assert.equal(g.placementError('knight',105,402),'overlap');
 const rocky=new Battle(7);assert.equal(rocky.placementError('guard',125,340),'rock');
 const wet=new Battle(32);assert.equal(wet.placementError('guard',60,340),'pond');
 const poor=new Battle();for(const [x,y]of[[60,400],[160,400],[260,400],[360,400],[460,400]])poor.place('guard',x,y)||poor.place('archer',x,y);assert.equal(poor.placementError('giant',260,520),'ink');
 poor.start();assert.equal(poor.placementError('knight',100,560),'phase');
});
test('同一批兵调整前后排可以改变胜负，复盘只引用真实战斗数据',()=>{
 function formation(front){const g=new Battle(0,true);
  for(let i=0;i<3;i++){g.place('guard',140+i*80,front?360:520);g.place('archer',140+i*80,front?520:360);}
  for(let i=0;i<5;i++)g.place('knight',100+i*75,190,1);
  for(let i=0;i<2;i++)g.place('archer',180+i*130,90,1);
  g.start();run(g);return g;
 }
 const protectedRear=formation(true),exposedRear=formation(false);
 assert.equal(protectedRear.phase,'won');assert.equal(exposedRear.phase,'lost');
 assert.equal(protectedRear.stats[0].backlineDeaths,0);assert.equal(exposedRear.stats[0].backlineDeaths,3);
 assert.ok(protectedRear.stats[0].blocked>0);assert.equal(report(exposedRear).tip.key,'tip.frontline');
 assert.ok(report(exposedRear).observations.some(o=>o.key==='obs.backlineDeaths'&&o.params.n===3));
});
test('前排护卫实际挡住飞向后排的箭，聚集单位实际受到爆炸范围伤害',()=>{
 const g=new Battle(0,true);g.place('guard',200,360);g.place('archer',200,480);g.place('archer',200,180,1);g.start();
 for(const u of g.units)u.cool=999;
 const p=center(g.units[0]),rear=g.units[1],hp=rear.hp;
 g.shots.push({type:'archer',x:p.x,y:p.y-30,vx:0,vy:1,angle:Math.PI/2,speed:340,damage:18,team:1,t:0});
 for(let i=0;i<10;i++)g.update(1/60);
 assert.equal(rear.hp,hp);assert.ok(g.stats[0].blocked>0);
 const x=center(g.units[0]);g.units[1].x=g.units[0].x+25;g.units[1].y=g.units[0].y;
 g.shots.push({type:'bomber',x:x.x,y:x.y,tx:x.x,ty:x.y,speed:210,damage:33,team:1,t:0});
 g.update(1/60);assert.ok(g.units[1].hp<hp);assert.ok(g.stats[0].explosionTaken>33);
});

test('急救旗满血不消耗、只治疗存活受伤者并返回实际恢复量',()=>{
 const g=new Battle();g.place('guard',100,400);g.place('knight',200,400);g.start();
 assert.equal(g.heal(),false);assert.equal(g.healed,false);
 g.units[0].hp=180;g.units[1].hp=0;
 assert.equal(g.heal(),true);assert.equal(g.units[0].hp,190);assert.equal(g.units[1].hp,0);
 assert.deepEqual(g.healSummary,{targets:1,amount:10});assert.equal(g.heal(),false);
});
