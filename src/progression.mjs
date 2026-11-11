import {validateDraft} from './drafts.mjs';
import {LEVELS,ITEMS} from './data.mjs';
const validLevel=n=>Number.isInteger(n)&&n>=0&&n<LEVELS.length;
// 兼容已有浏览器存档；只接受已知字段，避免坏数据破坏关卡入口。
export function normalizeProgress(raw){
  const s=raw&&typeof raw==='object'?raw:{};
  const stars={};
  for(let i=0;i<LEVELS.length;i++){
    const n=s.stars?.[i];if(Number.isInteger(n)&&n>=1&&n<=3)stars[i]=n;
  }
  const earned=Math.max(0,...Object.keys(stars).map(i=>Math.min(LEVELS.length-1,+i+1)));
  const unlocked=Math.max(validLevel(s.unlocked)?s.unlocked:0,earned);
  const formations={},guides={},medals={},lessonActions={};
  for(let i=0;i<LEVELS.length;i++){
    if(i<=unlocked&&s.formations?.[i]){const draft=validateDraft(i,s.formations[i]);if(draft)formations[i]=draft;}
    if(s.lessonActions?.[i])lessonActions[i]=Object.fromEntries(['moved','inspected','itemChosen'].filter(k=>s.lessonActions[i][k]===true).map(k=>[k,true]));
    if(s.guides?.[i]===true)guides[i]=true;if(s.medals?.[i]===true)medals[i]=true;
  }
  return {unlocked,stars,formations,guides,medals,lessonActions,item:typeof s.item==='string'&&Object.hasOwn(ITEMS,s.item)?s.item:'heal',sound:s.sound===true,haptics:s.haptics!==false,speed:s.speed===2?2:1,currentLevel:validLevel(s.currentLevel)&&s.currentLevel<=unlocked?s.currentLevel:unlocked,campaignSeen:s.campaignSeen===true};
}
export function campaignSummary(save){
  const values=Object.values(save.stars);
  return {completed:values.length,stars:values.reduce((a,b)=>a+b,0),maxStars:LEVELS.length*3};
}
export function recordVictory(save,level,stars){
  if(!validLevel(level)||!Number.isInteger(stars)||stars<1||stars>3)return false;
  save.stars[level]=Math.max(save.stars[level]||0,stars);
  save.unlocked=Math.max(save.unlocked,Math.min(LEVELS.length-1,level+1));return true;
}
