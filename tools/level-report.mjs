// 关卡难度体检：用大量"合法但随手"的阵容模拟每一关，估算新手式布阵的胜率；
// 再从较好的阵容出发做局部搜索，找出能达到的最好成绩，用来调整难度曲线。
// 只读：不修改关卡、存档或测试数据。随机胜率只是相对难度的代理指标，不能代替真人试玩。
// 用法：node tools/level-report.mjs [--samples 150] [--search 120] [--seed 1] [--level 3 | 2-5] [--json 输出路径]
//       node tools/level-report.mjs --sweep 1,0.9,0.8,0.7   按原预算的倍数扫描，看收紧墨水后每关的胜率变化
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import os from 'node:os';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {Battle} from '../src/engine.mjs';
import {TYPES,LEVELS,TEAM_LIMIT,starsFor} from '../src/data.mjs';

const BACK=new Set(['archer','bomber']);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// mulberry32：固定种子，报告可复现。
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const toPlan=g=>g.plan.map(({type,x,y})=>({type,x,y}));
// 巨人在通关第3关后解锁，所以只在第4关起参与。
function pickType(level,g,rand){
  const pool=Object.keys(TYPES).filter(t=>(t!=='giant'||level>=3)&&TYPES[t].cost<=g.remaining&&g.count(t)<TYPES[t].limit);
  return pool.length?pool[Math.floor(rand()*pool.length)]:null;
}
// 七成按常识站位（近战在前、远程在后），三成完全随手。
function spot(type,rand){
  const sensible=rand()<.7,back=BACK.has(type);
  return {x:Math.round(30+rand()*460),y:Math.round(sensible?(back?440+rand()*140:340+rand()*90):340+rand()*240)};
}
function randomPlan(level,rand){
  const g=new Battle(level);
  for(let tries=0;tries<300&&g.count(null)<TEAM_LIMIT;tries++){
    const type=pickType(level,g,rand);if(!type)break;
    const p=spot(type,rand);g.place(type,p.x,p.y);
  }
  return toPlan(g);
}
// 道具用法与测试中的策略一致：急救在有人低于65%生命时用，其他道具开战2秒后用。
function simulate(level,plan,item){
  const g=new Battle(level);
  for(const u of plan)if(!g.place(u.type,u.x,u.y))return null;
  if(!g.plan.length)return null;
  g.selectItem(item);g.start();
  for(let i=0;i<4805&&g.phase==='battle';i++){
    if(!g.itemUsed&&(item==='heal'?g.units.some(u=>!u.team&&u.hp>0&&u.hp<u.max*.65):g.elapsed>2))g.useItem();
    g.update(1/60);g.events.length=0;
  }
  const red=g.units.filter(u=>u.team===1),redLeft=red.reduce((s,u)=>s+Math.max(0,u.hp),0)/red.reduce((s,u)=>s+u.max,0);
  return {won:g.phase==='won',stars:starsFor(g),time:+g.elapsed.toFixed(1),survivors:g.units.filter(u=>u.team===0&&u.hp>0).length,deployed:plan.length,spent:g.spent,redLeft:+redLeft.toFixed(3)};
}
const score=r=>!r?-1:r.won?100+r.stars*30+r.survivors*2-r.time*.4:(1-r.redLeft)*60+r.survivors;
function mutate(level,plan,rand){
  const g=new Battle(level);for(const u of plan)g.place(u.type,u.x,u.y);
  const units=g.plan,r=rand(),u=units[Math.floor(rand()*units.length)];
  if(u&&r<.4)g.move(u.pid,clamp(u.x+(rand()-.5)*140,25,495),clamp(u.y+(rand()-.5)*120,335,585));
  else if(u&&r<.7){const {x,y}=u;g.remove(u.pid);const t=pickType(level,g,rand);if(t)g.place(t,x,y);}
  else if(u&&r<.85)g.remove(u.pid);
  else{const t=pickType(level,g,rand);if(t){const p=spot(t,rand);g.place(t,p.x,p.y);}}
  return toPlan(g);
}
function search(level,start,item,rand,iterations){
  let plan=start,result=simulate(level,start,item),best=score(result);
  for(let i=0;i<iterations;i++){
    const next=mutate(level,plan,rand);if(!next.length)continue;
    const r=simulate(level,next,item),s=score(r);
    if(s>=best){plan=next;result=r;best=s;}
  }
  return {plan,result};
}
const median=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:null;};
export function analyse(level,{samples=150,search:iterations=120,seed=1}={}){
  const rand=rng(seed*7919+level*104729),item=LEVELS[level].recommendedItem,runs=[];
  for(let i=0;i<samples;i++){const plan=randomPlan(level,rand),r=simulate(level,plan,item);if(r)runs.push({plan,r});}
  const wins=runs.filter(x=>x.r.won),starts=runs.slice().sort((a,b)=>score(b.r)-score(a.r)).slice(0,2);
  let best=starts[0];
  for(const s of starts){const found=search(level,s.plan,item,rand,Math.ceil(iterations/starts.length));if(score(found.result)>score(best.r))best={plan:found.plan,r:found.result};}
  return {level:level+1,title:LEVELS[level].title,budget:LEVELS[level].budget,item,samples:runs.length,
    winRate:wins.length/runs.length,threeStarRate:wins.filter(x=>x.r.stars===3).length/runs.length,
    medianWinTime:median(wins.map(x=>x.r.time)),best:{...best.r,plan:best.plan}};
}

function args(){
  const a=process.argv.slice(2),get=(k,d)=>{const i=a.indexOf(`--${k}`);return i>=0&&a[i+1]!==undefined?a[i+1]:d;};
  const range=get('level',`1-${LEVELS.length}`).split('-').map(Number),from=range[0],to=range[1]??range[0];
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<1||to>LEVELS.length||from>to)throw new Error(`--level 应在 1-${LEVELS.length} 之间`);
  const sweep=get('sweep',null)?.split(',').map(Number).filter(v=>v>0&&v<=2)||null;
  // --budgets 90,105,...：按关卡顺序试一组新预算（只在本次分析中生效，不改数据文件）。
  const budgets=get('budgets',null)?.split(',').map(Number)||null;
  if(budgets&&(budgets.length!==LEVELS.length||budgets.some(b=>!Number.isInteger(b)||b<10)))throw new Error(`--budgets 需要 ${LEVELS.length} 个整数`);
  return {levels:Array.from({length:to-from+1},(_,i)=>from-1+i),opts:{samples:+get('samples',150),search:+get('search',120),seed:+get('seed',1)},json:get('json',null),sweep,budgets};
}
// 预算按5取整，且至少买得起一名最便宜的兵。
const scaledBudget=(level,scale)=>Math.max(Math.min(...Object.values(TYPES).map(t=>t.cost)),Math.round(LEVELS[level].budget*scale/5)*5);
const label=r=>r.best.won?r.winRate>=.5?'轻松':r.winRate>=.25?'适中':r.winRate>=.1?'偏难':'很难':'未找到解';
const pct=v=>`${Math.round(v*100)}%`.padStart(4);
const pad=(s,n)=>{s=String(s);const w=[...s].reduce((sum,ch)=>sum+(ch.charCodeAt(0)>255?2:1),0);return s+' '.repeat(Math.max(0,n-w));};

async function runAll(tasks,opts){
  const workers=Math.max(1,Math.min(tasks.length,(os.availableParallelism?.()??os.cpus().length)-1)),queue=[...tasks],results=[];
  await Promise.all(Array.from({length:workers},async()=>{
    while(queue.length){
      const task=queue.shift();
      results.push(await new Promise((resolve,reject)=>{const w=new Worker(new URL(import.meta.url),{workerData:{...task,opts}});w.once('message',resolve);w.once('error',reject);}));
    }
  }));
  return {results,workers};
}
const isCli=isMainThread&&!!process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(isCli){
  const {levels,opts,json,sweep,budgets}=args(),started=Date.now();
  if(sweep){
    const tasks=levels.flatMap(level=>sweep.map(scale=>({level,budget:scaledBudget(level,scale),scale})));
    console.log(`预算扫描 · ${levels.length} 关 × ${sweep.length} 档 · 每档随机阵容 ${opts.samples} 个 + 搜索 ${opts.search} 次 · 种子 ${opts.seed}`);
    const {results}=await runAll(tasks,opts);
    console.log(`\n${pad('关卡',6)}${pad('名称',12)}${sweep.map(s=>pad(`×${s}${s===1?'(原)':''}`,18)).join('')}`);
    for(const level of levels){
      const row=sweep.map(scale=>{const r=results.find(x=>x.level===level+1&&x.scale===scale);return pad(`${r.budget} ${pct(r.winRate).trim()} ${r.best.won?'★'+r.best.stars:'✗'}`,18);});
      console.log(`${pad(level+1,6)}${pad(LEVELS[level].title,12)}${row.join('')}`);
    }
    console.log('\n每格：预算 随机胜率 搜到的最好星级（✗ 表示本次没搜到胜解）。随机胜率只反映相对难度。');
    console.log(`用时 ${((Date.now()-started)/1000).toFixed(1)} 秒。`);
    if(json){writeFileSync(json,JSON.stringify({generatedAt:new Date().toISOString(),opts,sweep,results},null,2));console.log(`完整结果已写入 ${json}`);}
    process.exit(0);
  }
  const {results,workers}=await runAll(levels.map(level=>({level,budget:budgets?.[level]})),opts);
  console.log(`关卡难度体检 · 每关随机阵容 ${opts.samples} 个 + 局部搜索 ${opts.search} 次 · 种子 ${opts.seed} · ${workers} 个线程${budgets?' · 试用预算 '+budgets.join('/'):''}`);
  results.sort((a,b)=>a.level-b.level);
  console.log(`\n${pad('关卡',6)}${pad('名称',12)}${pad('预算',6)}${pad('随机胜率',10)}${pad('随机三星',10)}${pad('胜局中位用时',14)}${pad('搜到的最好成绩',22)}难度`);
  for(const r of results){
    const b=r.best,bestText=b.won?`${'★'.repeat(b.stars)}${'☆'.repeat(3-b.stars)} ${b.time}s 存活${b.survivors}/${b.deployed}`:`未赢 · 敌剩${Math.round(b.redLeft*100)}%血`;
    console.log(`${pad(r.level,6)}${pad(r.title,12)}${pad(r.budget,6)}${pad(pct(r.winRate),10)}${pad(pct(r.threeStarRate),10)}${pad(r.medianWinTime===null?'—':r.medianWinTime+'s',14)}${pad(bestText,22)}${label(r)}`);
  }
  const notes=[];
  for(let i=1;i<results.length;i++){
    const a=results[i-1],b=results[i];if(b.level!==a.level+1)continue;
    if(b.winRate>a.winRate+.2)notes.push(`第${b.level}关比第${a.level}关明显更容易（随机胜率 ${pct(a.winRate).trim()} → ${pct(b.winRate).trim()}）`);
    if(b.winRate<a.winRate-.3)notes.push(`第${b.level}关难度陡增（随机胜率 ${pct(a.winRate).trim()} → ${pct(b.winRate).trim()}）`);
  }
  for(const r of results)if(!r.best.won)notes.push(`第${r.level}关在本次搜索中没找到获胜阵容，需要人工确认是否可解`);
  if(notes.length)console.log(`\n值得关注：\n- ${notes.join('\n- ')}`);
  console.log(`\n说明：随机胜率=按常识但随手布阵的获胜比例，只反映相对难度，不能代替真人试玩。用时 ${((Date.now()-started)/1000).toFixed(1)} 秒。`);
  if(json){writeFileSync(json,JSON.stringify({generatedAt:new Date().toISOString(),opts,results},null,2));console.log(`完整结果（含最好阵容）已写入 ${json}`);}
}else if(!isMainThread){
  // 每个线程有独立的模块副本，改预算不会影响其他任务。
  const {level,budget,scale,opts}=workerData;if(budget)LEVELS[level].budget=budget;
  parentPort.postMessage({...analyse(level,opts),scale});
}
