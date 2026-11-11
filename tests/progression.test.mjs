import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProgress,recordVictory,campaignSummary} from '../src/progression.mjs';
import {campaignMarkup} from '../src/campaign.mjs';
import {LEVELS} from '../src/data.mjs';
test('兼容旧进度并恢复已解锁关卡，不再每次回到第一关',()=>{
 const s=normalizeProgress({unlocked:3,stars:{0:3,1:2,2:1},sound:true});
 assert.equal(s.currentLevel,3);assert.equal(s.unlocked,3);assert.equal(s.sound,true);
 assert.deepEqual(campaignSummary(s),{completed:3,stars:6,maxStars:30});
});
test('只恢复可访问关卡；损坏存档不造成锁关绕过或无效数字',()=>{
 assert.equal(normalizeProgress({unlocked:2,currentLevel:8}).currentLevel,2);
 assert.deepEqual(normalizeProgress(null).stars,{});
 const s=normalizeProgress({unlocked:99,currentLevel:-1,stars:{0:3,1:9,2:'3',10:3},sound:'yes'});
 assert.equal(s.unlocked,1);assert.equal(s.currentLevel,1);assert.deepEqual(s.stars,{0:3});assert.equal(s.sound,false);
});
test('胜利只解锁下一关，重玩不降低最高星，不累加虚假通关数',()=>{
 const s=normalizeProgress(null);assert.equal(recordVictory(s,0,3),true);recordVictory(s,0,1);
 assert.equal(s.unlocked,1);assert.equal(s.stars[0],3);assert.equal(campaignSummary(s).completed,1);
 assert.equal(recordVictory(s,10,3),false);assert.equal(recordVictory(s,1,0),false);
 for(let i=1;i<10;i++)recordVictory(s,i,3);
 assert.equal(s.unlocked,9);assert.deepEqual(campaignSummary(s),{completed:10,stars:30,maxStars:30});
});
test('地图展示10关，锁定关可预览但不能挑战，每关有真实敌军和战术提示',()=>{
 const save=normalizeProgress(null),html=campaignMarkup(save,0,9);
 assert.equal((html.match(/data-preview=/g)||[]).length,10);
 assert.match(html,/id="challenge-stage" class="primary" disabled/);
 assert.match(html,/最后一笔/);assert.match(html,/先通关第 9 关/);
 assert.ok(LEVELS.every(l=>l.hint.length>10&&l.group&&l.enemies.length>0));
});
