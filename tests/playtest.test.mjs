import test from 'node:test';import assert from 'node:assert/strict';
import{PlaytestLog,FrameSamples}from'../src/playtest.mjs';import{guideStep,SPOTLIGHTS}from'../src/first-session.mjs';
import{Battle}from'../src/engine.mjs';import{normalizeProgress}from'../src/progression.mjs';
import{draftOf,validateDraft}from'../src/drafts.mjs';import{setup,recipes,plans,build,run}from'./strategy-support.mjs';
const store=()=>{let raw=null;return{getItem:()=>raw,setItem:(k,v)=>{raw=v}};};
test('首次引导随真实布阵推进，并且不阻止玩家自行开战',()=>{
 const g=new Battle();assert.equal(guideStep(g).id,'front');g.place('guard',130,365);assert.equal(guideStep(g).id,'front');g.place('guard',260,365);assert.equal(guideStep(g).id,'rear');
 g.place('archer',110,490);g.place('archer',250,490);assert.equal(guideStep(g).id,'move');assert.equal(guideStep(g,{moved:true}).id,'start');
 g.start();assert.equal(guideStep(g),null);
 const h=new Battle();h.place('knight',100,400);assert.equal(h.start(),true);
});
test('第二、三关分别介绍预览与道具；不会跳过未完成的操作',()=>{
 const g=new Battle(1);assert.equal(guideStep(g).id,'inspect');g.place('guard',100,400);assert.equal(guideStep(g,{inspected:true}).id,'mix');
 g.place('archer',100,500);assert.equal(guideStep(g,{inspected:true}).id,'start');
 const h=new Battle(2);assert.equal(guideStep(h).id,'blast');h.place('bomber',100,500);assert.equal(guideStep(h).id,'item');assert.equal(guideStep(h,{itemChosen:true}).id,'start');
});
test('草稿整份验证预算、数量和障碍，恢复后与原布阵一致',()=>{
 const g=new Battle();g.place('guard',100,400);g.place('archer',200,500);
 assert.deepEqual(validateDraft(0,draftOf(g)).map(({pid,...u})=>u),draftOf(g));
 assert.equal(validateDraft(0,Array(11).fill({type:'knight',x:100,y:400,team:0})),null);
 assert.equal(validateDraft(7,[{type:'guard',x:125,y:340,team:0}]),null);
 assert.equal(validateDraft(0,[{type:'giant',x:100,y:400,team:1}]),null);
 const save=normalizeProgress({unlocked:0,formations:{0:draftOf(g),9:[]},guides:{0:true,1:'true'},lessonActions:{0:{moved:true,inspected:'yes'}},medals:{0:true}});
 assert.equal(save.formations[0].length,2);assert.equal(save.formations[9],undefined);assert.equal(save.guides[1],undefined);assert.equal(save.medals[0],true);assert.deepEqual(save.lessonActions[0],{moved:true});
});
test('挑战依据真实战斗结果，零发射不能获得绕石射击挑战',()=>{
 const g=setup(0,recipes.archers,'wide');run(g);assert.equal(SPOTLIGHTS[0].check(g),true);
 g.phase='lost';assert.equal(SPOTLIGHTS[0].check(g),false);
 const h=new Battle(5);h.place('knight',100,400);h.start();h.phase='won';assert.equal(SPOTLIGHTS[5].check(h),false);
 const j=build(2,recipes.bombsLean);run(j);assert.equal(SPOTLIGHTS[2].check(j),true);
});
test('本机记录只保留允许字段与最多500事件，关闭后不记录，删除不碰关卡存档',()=>{
 const storage=store(),log=new PlaytestLog(storage,()=>1000);
 log.record('battle_end',{level:1,outcome:'won',url:'secret',ip:'secret',comment:'x'.repeat(1500)});
 assert.equal(log.events[0].url,undefined);assert.equal(log.events[0].comment.length,1000);
 log.setEnabled(false);log.record('feedback',{rating:5});assert.equal(log.events.length,1);
 const again=new PlaytestLog(storage);assert.equal(again.enabled,false);again.setEnabled(true);
 for(let i=0;i<600;i++)again.record('formation_place',{level:1});assert.equal(again.events.length,500);
 assert.equal(again.export().scope.includes('本地样本'),true);again.clear();assert.equal(again.events.length,0);
});
test('真实完成事件才进入胜场统计，未知事件和坏存档会忽略',()=>{
 const s=store(),log=new PlaytestLog(s);log.record('battle_start',{level:1});assert.equal(log.summary().battles,0);
 log.record('battle_end',{outcome:'won'});log.record('battle_end',{outcome:'lost'});log.record('feedback',{rating:4});log.record('unknown');
 assert.deepEqual(log.summary(),{sessions:1,battles:2,wins:1,feedback:1});
 const broken={getItem:()=>'{bad',setItem:()=>{throw Error('unavailable')}};const safe=new PlaytestLog(broken);safe.record('session_start');assert.equal(safe.events.length,1);
});
test('性能样本有上限，长时间切后台不会伪装成渲染帧',()=>{
 const p=new FrameSamples();assert.equal(p.result().frames,0);p.add(5000);p.add(NaN);assert.equal(p.result().frames,0);
 for(let i=1;i<=100;i++)p.add(i);assert.equal(p.result().p95FrameMs,95);assert.equal(p.result().avgFrameMs,50.5);
 for(let i=0;i<2000;i++)p.add(16);assert.equal(p.result().frames,1800);
});

test('按照第一关引导的四人阵容，无需道具也可以获胜',()=>{const g=new Battle();for(const [type,x,y]of [['guard',160,365],['guard',260,365],['archer',110,490],['archer',250,490]])assert.equal(g.place(type,x,y),true);g.start();for(let i=0;i<5000&&g.phase==='battle';i++)g.update(1/60);assert.equal(g.phase,'won');assert.equal(SPOTLIGHTS[0].check(g),true);});

test('中期与最终关的可选挑战都有合法、实际可达成的通关样本',()=>{
 const mid=build(5,recipes.balancedLean);run(mid);assert.equal(SPOTLIGHTS[5].check(mid),true);
 const finale=build(9,plans.finale);run(finale,'smoke');assert.equal(SPOTLIGHTS[9].check(finale),true);
});
