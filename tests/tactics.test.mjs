import test from 'node:test';import assert from 'node:assert/strict';
import{Battle}from'../src/engine.mjs';import{LEVELS,TYPES}from'../src/data.mjs';
import{nextWaypoint,resolveRocks,clearPath}from'../src/terrain.mjs';
import{recipes,plans,build,run}from'./strategy-support.mjs';
for(const [level,weak,weakLayout,strong,strongLayout]of[
 [1,'melee','wide','bombs','wide'],[2,'melee','wide','bombsLean','wide'],
 [3,'bombs','wide','shield','wide'],[7,'archers','wide',plans.narrowPass,null],
 [8,'shield','wide','shield','tight'],[9,'balanced','wide','blast','wide']
])test(`第${level+1}关改变阵容/站位能将失败变为胜利`,()=>{
 // build 会确认每名士兵都在预算和地形内放得下，避免配方超预算时悄悄少放兵。
 const make=(spec,layout)=>build(level,typeof spec==='string'?recipes[spec]:spec,layout);
 assert.equal(run(make(weak,weakLayout)).phase,'lost');
 assert.equal(run(make(strong,strongLayout)).phase,'won');
});
test('每关的敌军空间布局都不同，包含窄口、夹击、火力分区',()=>{
 assert.equal(LEVELS.length,40);assert.equal(new Set(LEVELS.map(l=>JSON.stringify(l.enemies.map(u=>[u.type,u.x,u.y])))).size,LEVELS.length);
 assert.ok(LEVELS[7].rocks.length===2);assert.ok(LEVELS[6].enemies.some(u=>u.y<140)&&LEVELS[6].enemies.some(u=>u.y>440));
 for(const l of LEVELS)for(const u of l.enemies)assert.ok(l.rocks.every(o=>Math.hypot(o.x-u.x,o.y-u.y)>o.r+TYPES[u.type].r));
});
test('巨石阻挡布阵、单位绕行且不会穿入石头',()=>{
 const g=new Battle(7);assert.equal(g.place('guard',330,165),false);
 const rocks=[{x:375,y:300,r:60}],u={x:170,y:300},goal={x:570,y:300};
 assert.equal(clearPath(u,goal,rocks,14),false);
 for(let i=0;i<1300&&Math.hypot(u.x-goal.x,u.y-goal.y)>3;i++){
  const p=nextWaypoint(u,goal,rocks,14),d=Math.hypot(p.x-u.x,p.y-u.y)||1;
  u.x+=(p.x-u.x)/d*Math.min(d,1);u.y+=(p.y-u.y)/d*Math.min(d,1);resolveRocks(u,rocks,14);
  assert.ok(Math.hypot(u.x-375,u.y-300)>=74);
 }
 assert.ok(Math.hypot(u.x-goal.x,u.y-goal.y)<4);
});
function duel(){const g=new Battle(0,true);g.place('archer',220,240);g.place('guard',530,240,1);g.start();return g;}
test('箭矢会被巨石挡住，炸弹可以越石落地',()=>{
 const g=duel();g.rocks=[{x:370,y:240,r:38}];for(const u of g.units)u.cool=999;
 const target=g.units[1],hp=target.hp;
 g.shots.push({type:'archer',x:320,y:240,vx:1,vy:0,angle:0,team:0,damage:18,speed:340,t:0});
 for(let i=0;i<30;i++)g.update(1/60);assert.equal(target.hp,hp);assert.equal(g.shots.length,0);
 g.shots.push({type:'bomber',x:320,y:240,tx:target.x,ty:target.y-24,team:0,damage:33,speed:210,t:0});
 for(let i=0;i<80;i++)g.update(1/60);assert.ok(target.hp<hp);
});
test('烟雾只减免箭矢，不防近战和炸弹；每场只可使用所带道具一次',()=>{
 const g=new Battle(0,true);g.place('guard',220,140);g.place('knight',520,140,1);g.selectItem('smoke');g.start();
 assert.equal(g.selectItem('rally'),false);assert.equal(g.useItem(),true);assert.equal(g.useItem(),false);
 const u=g.units[0],hp=u.hp;g.hit(u,20,{x:100,y:100,type:'archer'},true);
 assert.ok(Math.abs(hp-u.hp-20*.55*.35)<.001);assert.ok(g.itemStats.prevented>0);
 const h=u.hp;g.hit(u,20,{type:'bomber'},true);assert.equal(h-u.hp,11);
 const k=u.hp;g.hit(u,20,{type:'knight'},false);assert.equal(k-u.hp,20);
 g.phase='paused';g.update(2);assert.equal(g.effects.smoke,4);
 g.phase='battle';for(let i=0;i<250;i++)g.update(1/60);assert.equal(g.effects.smoke,0);
});
test('集结实际加速移动，效果到期，重试会补满道具',()=>{
 const g=duel(),baseline=duel();g.selectedItem='rally';assert.equal(g.useItem(),true);
 const start=g.units[0].x;for(let i=0;i<10;i++){g.update(1/60);baseline.update(1/60);}
 assert.ok(g.units[0].x-start>baseline.units[0].x-start);
 g.phase='build';g.start();assert.equal(g.itemUsed,false);assert.equal(g.effects.rally,0);
 assert.equal(g.selectItem('toString'),false);
});
