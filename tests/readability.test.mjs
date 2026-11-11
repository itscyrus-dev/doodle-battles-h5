import test from 'node:test';import assert from 'node:assert/strict';
import{Battle}from'../src/engine.mjs';import{TYPES}from'../src/data.mjs';
import{formationPreview}from'../src/tactical-preview.mjs';
import{clearPath}from'../src/terrain.mjs';import{report}from'../src/battle-report.mjs';
import{setup,recipes,run}from'./strategy-support.mjs';
test('预览按实际最近目标选敌，射程等于兵种数据且不改变布阵',()=>{
 const g=new Battle(0,true);g.place('archer',100,420);g.place('guard',100,270,1);g.place('knight',450,100,1);
 const before=structuredClone(g.plan),p=formationPreview(g,g.plan[0]);
 assert.equal(p.target.type,'guard');assert.equal(p.range,TYPES.archer.range);assert.equal(p.inRange,true);assert.deepEqual(g.plan,before);
});
test('弓手被石头挡住时显示绕行，炸弹抛投不受同一石头视线限制',()=>{
 const g=new Battle(0,true);g.rocks=[{x:260,y:290,r:45}];g.place('archer',260,380);g.place('guard',260,190,1);
 const p=formationPreview(g,g.plan[0]);assert.equal(p.blocked,true);assert.ok(p.route.length>2);assert.ok(p.route.some(q=>Math.abs(q.x-260)>45));
 for(let i=1;i<p.route.length;i++)assert.ok(clearPath(p.route[i-1],p.route[i],g.rocks,TYPES.archer.r+1));
 assert.equal(formationPreview(g,{...g.plan[0],type:'bomber'}).blocked,false);
});
test('无敌人预览不虚构目标，改动落点会改变静态路线',()=>{
 const g=new Battle(0,true);g.place('knight',100,450);assert.equal(formationPreview(g,g.plan[0]).target,null);
 g.place('guard',400,150,1);const a=formationPreview(g,g.plan[0]),b=formationPreview(g,{...g.plan[0],x:400});
 assert.notDeepEqual(a.route,b.route);
});
test('过量伤害按实际生命计，延迟弹道按射手归属，首次阵亡只记录一次',()=>{
 const g=new Battle(0,true);g.place('archer',100,450);g.place('knight',100,150,1);g.start();
 const a=g.units[0],b=g.units[1];g.elapsed=3.2;b.hp=5;
 g.hit(b,100,{ownerId:a.id,type:'archer',x:100,y:400},true);
 assert.equal(a.damageDealt,5);assert.equal(g.stats[0].byType.archer.dealt,5);assert.equal(g.stats[1].byType.knight.taken,5);
 assert.deepEqual(g.stats[1].firstLoss,{type:'knight',time:3.2});assert.equal(g.stats[0].byType.archer.kills,1);
 g.hit(b,100,a);assert.equal(a.damageDealt,5);assert.equal(g.stats[0].byType.archer.kills,1);
});
test('岩石挡箭记录准确；只有后排受近战命中才发出遇袭提示',()=>{
 const g=new Battle(0,true);g.place('archer',200,450);g.place('guard',200,140,1);g.start();g.rocks=[{x:200,y:300,r:38}];
 for(const u of g.units)u.cool=999;
 g.shots.push({type:'archer',ownerId:0,x:200,y:350,vx:0,vy:-1,angle:-Math.PI/2,team:0,damage:18,speed:340,t:0});
 for(let i=0;i<30;i++)g.update(1/60);assert.equal(g.stats[0].stoneArrows,1);
 const u=g.units[0];g.hit(u,1,{type:'archer',x:200,y:100},true);assert.equal(u.threat,0);
 g.hit(u,1,g.units[1],false);assert.ok(u.threat>0);assert.equal(g.feedback.kind,'rear');
 g.phase='lost';const review=report(g);assert.match(review.tip,/1 支箭/);assert.ok(review.rows.some(row=>row.name==='弓手'));
});
test('真实战斗的输出和对方承伤守恒，复盘有兵种表与最早阵亡时间',()=>{
 const g=setup(0,recipes.balanced,'wide');run(g);
 for(const team of [0,1]){
  const dealt=Object.values(g.stats[team].byType).reduce((s,r)=>s+r.dealt,0);
  assert.ok(Math.abs(dealt-g.stats[1-team].damageTaken)<.001);
 }
 const r=report(g);assert.ok(r.rows.length>1);assert.ok(r.observations.some(s=>s.includes('最早阵亡')));
});
test('道具倒计时暂停冻结，效果结束只出现一次结束提示',()=>{
 const g=new Battle(0,true);g.place('guard',100,450);g.place('guard',100,150,1);g.selectItem('smoke');g.start();g.useItem();
 g.phase='paused';g.update(10);assert.equal(g.effects.smoke,4);
 g.phase='battle';for(let i=0;i<245;i++)g.update(1/60);assert.equal(g.effects.smoke,0);assert.equal(g.feedback.kind,'item-end');
 const until=g.feedback.until;g.update(.1);assert.equal(g.feedback.until,until);
});
