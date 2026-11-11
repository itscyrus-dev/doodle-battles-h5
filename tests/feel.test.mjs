import test from 'node:test';
import assert from 'node:assert/strict';
import {Battle} from '../src/engine.mjs';
import {normalizeSave} from '../src/save.mjs';

function runCollect(g){
  const seen=new Set();
  for(let i=0;i<4805&&g.phase==='battle';i++){g.update(1/60);for(const e of g.events.splice(0))seen.add(e);}
  return seen;
}

test('爆炸、巨人重击、格挡和射箭都会发出表现事件，供震屏、音效和震动使用',()=>{
  const g=new Battle(0,true);
  for(const [type,x,y] of [['guard',320,300],['giant',290,240],['bomber',200,340],['archer',190,400]])assert.equal(g.place(type,x,y,0),true);
  for(const [type,x,y] of [['knight',420,270],['knight',420,300],['knight',420,330],['archer',550,300],['archer',550,240]])assert.equal(g.place(type,x,y,1),true);
  assert.equal(g.start(),true);
  const seen=runCollect(g);
  for(const e of ['boom','slam','block','shoot','toss','hit'])assert.ok(seen.has(e),`缺少表现事件 ${e}`);
});

test('收尾停顿只推进特效，不改变胜负、血量和战斗时间；战斗中调用无效',()=>{
  const g=new Battle(0,true);g.place('giant',270,300,0);g.place('knight',420,300,1);g.start();
  runCollect(g);assert.equal(g.phase,'won');
  const hp=g.units.map(u=>u.hp),elapsed=g.elapsed;
  assert.ok(g.fx.length>0,'刚结束时应还有倒地特效');
  for(let i=0;i<60;i++)g.settle(1/30);
  assert.deepEqual(g.units.map(u=>u.hp),hp);assert.equal(g.elapsed,elapsed);assert.equal(g.phase,'won');
  assert.equal(g.fx.length,0);assert.equal(g.shots.length,0);
  const h=new Battle(0,true);h.place('knight',270,300,0);h.place('knight',420,300,1);h.start();h.update(1/60);
  const view=()=>h.units.map(({x,y,hp,cool,flash,swing,recoil,moving})=>({x,y,hp,cool,flash,swing,recoil,moving}));
  const before=view(),fx=h.fx.length;h.settle(1);assert.deepEqual(view(),before);assert.equal(h.fx.length,fx);
});

test('倍速与震动偏好只接受合法值；旧存档默认正常速度并开启震动',()=>{
  const settings=raw=>normalizeSave(raw).settings;
  assert.equal(settings(null).speed,1);assert.equal(settings(null).haptics,true);
  assert.equal(settings({speed:2,haptics:false}).speed,2,'旧版存档把倍速放在最外层');assert.equal(settings({speed:2,haptics:false}).haptics,false);
  assert.equal(settings({settings:{speed:2,haptics:false}}).speed,2);
  assert.equal(settings({speed:9}).speed,1);assert.equal(settings({settings:{speed:'2'}}).speed,1);
});

test('倍速只是每帧多跑几个固定步长，结果与正常速度逐帧一致',()=>{
  const play=speed=>{
    const g=new Battle(1);for(const [type,x,y] of [['guard',300,240],['guard',300,360],['knight',290,300],['archer',190,260],['archer',190,340]])g.place(type,x,y);
    g.start();let acc=0;
    for(let frame=0;frame<6000&&g.phase==='battle';frame++){acc+=(1/60)*speed;while(acc>=1/60-1e-9){g.update(1/60);acc-=1/60;}}
    return {phase:g.phase,elapsed:g.elapsed.toFixed(4),hp:g.units.map(u=>Math.round(u.hp*1000))};
  };
  assert.deepEqual(play(2),play(1));
});
