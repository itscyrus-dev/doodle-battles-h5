export const PLAYTEST_VERSION='0.12.0';
const KEY='doodle-playtest-v1',LIMIT=500;
const ALLOWED=new Set(['session_start','level_enter','battle_start','battle_end','formation_move','formation_remove','formation_place','placement_rejected','guide_step','guide_skip','guide_complete','item_used','performance','feedback','formation_route','run_start','run_node','run_end','card_play','tactic_cast','first_route','tutorial_step']);
const FIELDS=new Set(['level','sandbox','units','spent','item','outcome','seconds','survivors','stars','type','reason','step','frames','avgFrameMs','p95FrameMs','rating','difficulty','comment','speed','run','kind','act','warband','result','nodes','wins','payout','card','effect','routes','cards','tactics','lesson','tutorial','first']);
function cleanFields(fields){
 const data={};for(const[k,v]of Object.entries(fields||{}))if(FIELDS.has(k)){
  if(typeof v==='number'&&Number.isFinite(v))data[k]=Math.round(v*100)/100;
  else if(typeof v==='boolean')data[k]=v;
  else if(typeof v==='string')data[k]=v.slice(0,k==='comment'?1000:100);
 }return data;
}
export class PlaytestLog{
 constructor(storage=null,now=()=>Date.now()){
  if(!storage)try{storage=globalThis.localStorage;}catch{}
  storage??={getItem:()=>null,setItem:()=>{throw Error('storage unavailable')}};this.storage=storage;this.now=now;let raw;try{raw=JSON.parse(storage.getItem(KEY));}catch{}
  this.enabled=raw?.enabled!==false;this.events=Array.isArray(raw?.events)?raw.events.filter(e=>e&&ALLOWED.has(e.name)&&Number.isFinite(e.at)).slice(-LIMIT).map(e=>({name:e.name,at:e.at,session:String(e.session||'legacy').slice(0,80),version:String(e.version||'legacy').slice(0,20),...cleanFields(e)})):[];
  this.session=globalThis.crypto?.randomUUID?.()||`session-${now()}-${Math.random().toString(36).slice(2)}`;
 }
 record(name,fields={}){
  if(!this.enabled||!ALLOWED.has(name))return;
  const data=cleanFields(fields);
  this.events.push({name,at:this.now(),session:this.session,version:PLAYTEST_VERSION,...data});this.events=this.events.slice(-LIMIT);this.persist();
 }
 persist(){try{this.storage.setItem(KEY,JSON.stringify({enabled:this.enabled,events:this.events}));this.storageError=false;}catch{this.storageError=true;}}
 setEnabled(value){this.enabled=!!value;this.persist();}
 clear(){this.events=[];this.persist();}
 summary(){const battles=this.events.filter(e=>e.name==='battle_end');return{sessions:new Set(this.events.map(e=>e.session)).size,battles:battles.length,wins:battles.filter(e=>e.outcome==='won').length,feedback:this.events.filter(e=>e.name==='feedback').length};}
 export(){return{version:PLAYTEST_VERSION,exportedAt:new Date(this.now()).toISOString(),scope:'仅当前浏览器本地样本；无自动上传，不代表全部玩家',enabled:this.enabled,summary:this.summary(),events:this.events};}
}
export class FrameSamples{
 constructor(){this.values=[];}
 add(ms){if(Number.isFinite(ms)&&ms>0&&ms<=1000&&this.values.length<1800)this.values.push(ms);}
 result(){const a=this.values.slice().sort((x,y)=>x-y);return{frames:a.length,avgFrameMs:a.length?a.reduce((s,n)=>s+n,0)/a.length:0,p95FrameMs:a.length?a[Math.max(0,Math.ceil(a.length*.95)-1)]:0};}
}
