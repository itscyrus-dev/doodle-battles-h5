import {Battle} from './engine.mjs';import {TYPES,LEVELS,starsFor,TEAM_LIMIT,ITEMS} from './data.mjs';import {Renderer,drawUnit} from './render.mjs';
import {FormationInput} from './formation-input.mjs';
import {report,rosterKey} from './battle-report.mjs';
import {normalizeProgress,campaignSummary,recordVictory} from './progression.mjs';
import {campaignMarkup} from './campaign.mjs';
import {guideStep,UNIT_GUIDE,SPOTLIGHTS} from './first-session.mjs';
import {PlaytestLog,FrameSamples,PLAYTEST_VERSION} from './playtest.mjs';
import {draftOf} from './drafts.mjs';
const $=id=>document.getElementById(id);
let rawSave=null;try{rawSave=JSON.parse(localStorage.getItem('doodle-battles-v1'));}catch{}
let save=normalizeProgress(rawSave);const metrics=new PlaytestLog();metrics.record('session_start');let frameSamples=new FrameSamples();const lessonFlags=new Map();let lastGuideKey='';const flags=()=>{if(!lessonFlags.has(g.level))lessonFlags.set(g.level,{...save.lessonActions[g.level]});return lessonFlags.get(g.level);};
let g=new Battle(save.currentLevel),selected=save.currentLevel===0&&!save.guides[0]?'guard':'knight',eraser=false,shown=false,ac,input=null,quotaTeam=0,speed=save.speed,beat=null,lastBuzz=0,noiseBuffer=null;g.selectedItem=save.item;g.plan=structuredClone(save.formations[g.level]||[]);g.serial=g.plan.length;const renderer=new Renderer($('arena'));window.__game=g;const motion=matchMedia('(prefers-reduced-motion: reduce)');motion.addEventListener('change',e=>{renderer.reduced=e.matches;});let progressSaved=true;const persist=()=>{try{localStorage.setItem('doodle-battles-v1',JSON.stringify(save));progressSaved=true;}catch{progressSaved=false;}};// 程序合成音效：不同兵种动作各有声音，同类声音50毫秒内只响一次，避免嘈杂。
function sound(kind){
 if(!save.sound)return;
 try{
  ac??=new AudioContext();ac.resume();const now=ac.currentTime;
  sound.last??={};if(now-(sound.last[kind]??-1)<.05)return;sound.last[kind]=now;
  if(!noiseBuffer){noiseBuffer=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);const d=noiseBuffer.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
  const tone=(type,f0,f1,dur,vol,at=0)=>{const o=ac.createOscillator(),v=ac.createGain();o.type=type;o.frequency.setValueAtTime(f0,now+at);o.frequency.exponentialRampToValueAtTime(f1,now+at+dur);v.gain.setValueAtTime(vol,now+at);v.gain.exponentialRampToValueAtTime(.0005,now+at+dur);o.connect(v);v.connect(ac.destination);o.start(now+at);o.stop(now+at+dur+.02);};
  const noise=(dur,vol,hz)=>{const s=ac.createBufferSource(),f=ac.createBiquadFilter(),v=ac.createGain();s.buffer=noiseBuffer;f.type='lowpass';f.frequency.setValueAtTime(hz,now);f.frequency.exponentialRampToValueAtTime(Math.max(60,hz*.2),now+dur);v.gain.setValueAtTime(vol,now);v.gain.exponentialRampToValueAtTime(.0005,now+dur);s.connect(f);f.connect(v);v.connect(ac.destination);s.start(now,Math.random()*.4,dur+.02);};
  const kinds={
   place:()=>tone('sine',620,400,.09,.03),
   hit:()=>{noise(.06,.045,2600);tone('triangle',190,120,.07,.022);},
   block:()=>tone('square',1300,1150,.06,.01),
   shoot:()=>tone('triangle',880,500,.07,.016),
   toss:()=>tone('sine',300,520,.12,.014),
   slam:()=>{noise(.18,.07,600);tone('sine',120,55,.2,.05);},
   boom:()=>{noise(.5,.12,1100);tone('sine',95,40,.4,.07);},
   won:()=>[523,659,784,1047].forEach((f,i)=>tone('triangle',f,f*.99,.2,.035,i*.09)),
   lost:()=>[392,311,262].forEach((f,i)=>tone('sine',f,f*.92,.24,.03,i*.13))
  };
  (kinds[kind]||(()=>tone('sine',450,300,.1,.025)))();
 }catch{}
}
// 震动只在支持的浏览器生效（多数安卓可以，iPhone 浏览器不支持）；可在帮助菜单关闭。
const canBuzz=typeof navigator.vibrate==='function';
function buzz(pattern,force=false){if(!save.haptics||!canBuzz)return;const now=performance.now();if(!force&&now-lastBuzz<70)return;lastBuzz=now;try{navigator.vibrate(pattern);}catch{}}
// 把模拟里的表现事件变成震屏、震动和音效；只影响表现，不改变战斗。
function feel(events){
 if(events.includes('boom')){renderer.kick(6);buzz(22);sound('boom');}
 else if(events.includes('slam')){renderer.kick(2.5);buzz(12);sound('slam');}
 if(events.includes('shoot'))sound('shoot');
 if(events.includes('toss'))sound('toss');
 if(events.includes('block'))sound('block');else if(events.includes('hit'))sound('hit');
}
function toast(s){$('toast').textContent=s;$('toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('visible'),1700)}
function reset(level=g.level,sandbox=g.sandbox,plan=null){input?.cancel();renderer.selectedPid=null;g=new Battle(level,sandbox);g.selectedItem=save.item;g.plan=structuredClone(plan??(!sandbox?save.formations[level]||[]:[]));g.serial=Math.max(0,...g.plan.map(u=>(u.pid??-1)+1));window.__game=g;shown=false;beat=null;$('overlay').hidden=true;quotaTeam=0;metrics.record('level_enter',{level:level+1,sandbox});if(!sandbox){save.currentLevel=level;persist();}update();}
function checkpoint(){if(g.phase!=='build'||g.sandbox)return;const draft=draftOf(g);if(JSON.stringify(draft)!==JSON.stringify((save.formations[g.level]||[]).map(({type,x,y})=>({type,x,y,team:0})))){save.formations[g.level]=draft;persist();}}
function updateGuide(){
 const step=!g.sandbox&&!save.guides[g.level]?guideStep(g,flags()):null;
 $('coach').hidden=!step;$('app').classList.toggle('coached',!!step);renderer.guideGhosts=step?.ghosts||[];
 for(const id of ['roster','arena','start','heal'])$(id).classList.toggle('coach-focus',step?.target===id);
 if(step){$('coach-title').textContent=step.title;$('coach-text').textContent=step.text;const key=`${g.level}:${step.id}`;if(lastGuideKey!==key){metrics.record('guide_step',{level:g.level+1,step:step.id});lastGuideKey=key;}}
 return step;
}
function update(){checkpoint();document.querySelector('.footnote').textContent=progressSaved?`试玩版 ${PLAYTEST_VERSION} · 10关挑战 · 本机保存`:'本机存储不可用 · 刷新可能丢失进度';const lesson=updateGuide();$('sound').style.color=save.sound?'#477cdb':'';$('sound').setAttribute('aria-label',save.sound?'关闭音效':'开启音效');const build=g.phase==='build';const progress=campaignSummary(save);const inspection=build&&!renderer.drag?renderer.inspect(g):null;$('inspection-info').hidden=!inspection;if(inspection){$('inspection-title').textContent=`${TYPES[inspection.unit.type].name} · 基础射程 ${inspection.range}`;$('inspection-status').textContent=inspection.status+' · 开战后目标会移动';}const feedback=g.feedback&&g.feedback.until>g.elapsed&&g.phase==='battle'?g.feedback:null;$('combat-alert').hidden=!feedback;if(feedback){$('combat-alert').textContent=(feedback.kind==='rear'?'! ':'')+feedback.message;$('combat-alert').className=feedback.kind;}$('campaign-map').hidden=g.sandbox;$('stage-tip').hidden=g.sandbox||!build||!!lesson;$('stage-tip').textContent=`布阵提示 · ${LEVELS[g.level].hint}`;$('campaign-progress').textContent=`${progress.completed} / 10 已通关`;$('campaign-stars').textContent=`★ ${progress.stars} / 30　→`;$('campaign').textContent='闯关挑战 · 10关';$('campaign').classList.toggle('active',!g.sandbox);$('sandbox').classList.toggle('active',g.sandbox);$('chapter').textContent=g.sandbox?'YOUR RULES / YOUR BATTLE':`第 ${g.level+1} / 10 关 · ${LEVELS[g.level].group.split(' · ')[1]}`;$('leveltitle').innerHTML=g.sandbox?'自由沙盒 <span>⌄</span>':`${LEVELS[g.level].title} <span>⌄</span>`;$('budgetlabel').textContent=g.sandbox?'蓝 / 红 部队':'可用墨水';$('budget').textContent=g.sandbox?g.plan.filter(u=>!u.team).length:g.remaining;$('maxbudget').textContent=g.sandbox?`/ ${g.plan.filter(u=>u.team).length}`:`/${g.budget}`;const list=build?[...g.plan,...(g.sandbox?[]:g.enemy)]:g.units.filter(u=>u.hp>0);$('bluecount').textContent=list.filter(u=>!u.team).length+(build?`/${TEAM_LIMIT}`:'');$('redcount').textContent=list.filter(u=>u.team).length+(build?`/${TEAM_LIMIT}`:'');$('timer').textContent=build?'布阵阶段':g.phase==='paused'?'已暂停':`${g.elapsed.toFixed(1)} s`;$('speed').hidden=!['battle','paused'].includes(g.phase);$('speed').textContent=`${speed}×`;$('speed').setAttribute('aria-pressed',String(speed===2));$('hint').hidden=!build||!!inspection;$('hint').textContent=g.sandbox?'上方红队，下方蓝队 · 每队10人 · 均有兵种限额':'拖入兵种 · 拖动士兵调位置 · 拖回下方回收';$('autofill').hidden=!build||g.plan.length>0;$('autofill').textContent='✧ 放一组基础阵型';$('start').disabled=build&&(!g.plan.some(u=>u.team===0)||(g.sandbox&&!g.plan.some(u=>u.team===1)));$('start').innerHTML=build?'开始战斗 <span>↗</span>':g.phase==='paused'?'继续战斗 <span>▷</span>':g.phase==='battle'?'暂停战斗 <span>Ⅱ</span>':beat&&!shown?'查看战报 <span>→</span>':'再试一次 ↻';$('clear').textContent=build?'清空':'重新布阵';$('undo').disabled=!build||!g.history.length;$('erase').disabled=!build;const item=ITEMS[g.selectedItem],active=g.effects[g.selectedItem]||0;
$('heal').hidden=false;$('heal').disabled=!build&&!g.canUseItem;
$('heal').innerHTML=build?`<b>${item.icon} ${item.name}</b><small>战前选择 · 每场一次</small>`:g.itemUsed?active>0?`<span class="item-timer" style="--remaining:${active/item.duration*100}%">${item.icon}</span><span>${active.toFixed(1)}秒</span>`:`${item.icon} 已使用`:`${item.icon} ${item.name} ×1`;
$('heal').title=build?'选择本场战术道具':item.description;$('heal').setAttribute('aria-label',build?'选择战术道具':`使用${item.name}，${item.description}`);
$('erase').classList.toggle('on',eraser);$('erase').setAttribute('aria-pressed',String(eraser));$('selectedinfo').textContent=eraser?'橡皮 · 滑动移除部队':`${g.sandbox?(quotaTeam?'红方 · ':'蓝方 · '):''}${TYPES[selected].name} · ${TYPES[selected].role}`;for(const b of $('roster').children){b.classList.toggle('selected',b.dataset.type===selected&&!eraser);const count=g.count(b.dataset.type,quotaTeam),limit=TYPES[b.dataset.type].limit;b.classList.toggle('full',count>=limit||g.count(null,quotaTeam)>=TEAM_LIMIT);b.querySelector('.quota').textContent=`${count}/${limit}`;const locked=!g.sandbox&&b.dataset.type==='giant'&&save.unlocked<3;b.disabled=!build||locked;b.querySelector('small').textContent=locked?'第4关解锁':g.sandbox?'自由放置':`${TYPES[b.dataset.type].cost} 墨水`;b.setAttribute('aria-label',`${TYPES[b.dataset.type].name}，${locked?'第4关解锁':g.sandbox?'自由放置':TYPES[b.dataset.type].cost+'墨水'}，${TYPES[b.dataset.type].role}，已放${count}名，上限${limit}名`);}}
for(const [type,d]of Object.entries(TYPES)){const b=document.createElement('button');b.className='unit';b.dataset.type=type;b.setAttribute('aria-label',`${d.name}，${d.cost}墨水，${d.role}`);b.innerHTML=`<span class="quota">0/${d.limit}</span><canvas width="100" height="100"></canvas><strong>${d.name}</strong><small>${d.cost} 墨水</small>`;const c=b.querySelector('canvas').getContext('2d');drawUnit(c,{type,x:50,y:87,team:0,angle:.3},0,1.65,true);b.onclick=()=>{selected=type;eraser=false;update();};$('roster').append(b);}
input=new FormationInput({canvas:$('arena'),renderer,getGame:()=>g,getSelection:()=>({type:selected,eraser}),
 select:type=>{selected=type;eraser=false;update();},message:toast,
 onChange:(event,team,detail={})=>{if(event==='move')flags().moved=true;if(event==='inspect')flags().inspected=true;if(event==='move'||event==='inspect'){save.lessonActions[g.level]={...flags()};persist();}if(event)metrics.record(({place:'formation_place',move:'formation_move',remove:'formation_remove',rejected:'placement_rejected'})[event]||'guide_step',{level:g.level+1,sandbox:g.sandbox,type:detail.type,reason:detail.reason,step:event});if(team!==undefined)quotaTeam=team;if(event==='place'){sound('place');buzz(8);}update();}});
$('skip-coach').onclick=()=>{save.guides[g.level]=true;metrics.record('guide_skip',{level:g.level+1});persist();update();};
$('selectedinfo').onclick=()=>openCodex(selected);
$('clear-inspection').onclick=()=>{renderer.selectedPid=null;update();};
$('undo').onclick=()=>{g.undo();update()};$('erase').onclick=()=>{eraser=!eraser;update()};$('clear').onclick=()=>{if(g.phase==='build'){g.clear();update();}else reset();};$('start').onclick=()=>{input?.cancel();if(g.phase==='build'){const step=guideStep(g,flags());if(g.start()){frameSamples=new FrameSamples();metrics.record('battle_start',{level:g.level+1,sandbox:g.sandbox,units:g.plan.filter(u=>!u.team).length,spent:g.spent,item:g.selectedItem,speed});if(!g.sandbox&&!save.guides[g.level]&&step?.id==='start'){save.guides[g.level]=true;metrics.record('guide_complete',{level:g.level+1});persist();}}}else if(g.phase==='battle')g.phase='paused';else if(g.phase==='paused')g.phase='battle';else if(beat&&!shown)showResult();else reset(g.level,g.sandbox,g.plan);update();};
$('speed').onclick=()=>{speed=speed===2?1:2;save.speed=speed;persist();update();};
// 胜负揭晓的停顿中轻点战场，直接看战报。
$('arena').addEventListener('pointerdown',()=>{if(beat&&!shown)showResult();});$('heal').onclick=()=>{
 if(g.phase==='build'){openItems();return;}
 if(g.useItem())metrics.record('item_used',{level:g.level+1,sandbox:g.sandbox,item:g.selectedItem,seconds:g.elapsed});
 update();
};
function openItems(){
 if(g.phase!=='build')return;
 input?.cancel();sheet(`<div class="eyebrow">战前装备 · 每场使用一次</div><h2 id="sheettitle">带上哪件战术道具？</h2><p>只带一件，不花墨水。开战后选择使用时机，重试会补满。</p><div class="item-options">${Object.entries(ITEMS).map(([id,item])=>`<button data-item="${id}" class="item-option ${g.selectedItem===id?'equipped':''}" aria-pressed="${g.selectedItem===id}"><span class="item-art">${item.icon}</span><span><b>${item.name}${g.selectedItem===id?' · 已装备':''}</b><small>${item.description}</small></span></button>`).join('')}</div><p>本关建议：${ITEMS[LEVELS[g.level].recommendedItem].name}。你也可以根据自己的阵容选择。</p>`);
 for(const b of document.querySelectorAll('[data-item]'))b.onclick=()=>{if(g.selectItem(b.dataset.item)){flags().itemChosen=true;save.lessonActions[g.level]={...flags()};save.item=b.dataset.item;persist();$('overlay').hidden=true;update();}};
}
$('autofill').onclick=()=>{
  g.beginStroke();
  const formation=[['guard',130,365],['guard',260,365],['knight',390,365],['archer',110,470],['archer',250,470]];
  for(const [type,x,y]of formation)g.place(type,x,y);
  if(g.sandbox)for(const u of LEVELS[2].enemies)g.place(u.type,u.x,u.y,1);
  update();
};
$('campaign').onclick=()=>openCampaign(g.sandbox?save.currentLevel:g.level);$('sandbox').onclick=()=>reset(0,true);$('sound').onclick=()=>{save.sound=!save.sound;persist();$('sound').style.color=save.sound?'#477cdb':'';$('sound').setAttribute('aria-label',save.sound?'关闭音效':'开启音效');toast(save.sound?'音效已开启':'音效已关闭');sound('place');};
let lastFocus;function sheet(html){lastFocus=document.activeElement;$('sheetcontent').innerHTML=html;$('overlay').hidden=false;$('close').focus();}function close(){if(['won','lost'].includes(g.phase))reset(g.level,g.sandbox,g.plan);else $('overlay').hidden=true;lastFocus?.focus();}$('close').onclick=close;$('overlay').onclick=e=>{if(e.target===$('overlay'))close();};
function openRules(){if(g.phase==='battle')g.phase='paused';update();sheet(`<div class="eyebrow">A LITTLE FIELD GUIDE</div><h2 id="sheettitle">三步，画出一场胜利。</h2><div class="help-row"><b>01 选一个兵种</b><br>先锋冲锋，护卫挡箭。弓手与爆破手适合放在后排。第4关解锁巨人。巨石阻挡行走和箭矢，爆破手可越石投弹。</div><div class="help-row"><b>02 画出你的部队</b><br>把兵种卡拖入蓝色区域，或点击、滑动画兵。点选已放士兵查看射程与预计接敌路线；绿色虚线是静态路线，红色线表示巨石挡箭。预览不是胜负预测。已放士兵可直接拖动；拖回兵种栏或战场下方回收区可退还墨水。无效落点会退回原位。每队最多10人；先锋5、护卫3、弓手4、爆破手2、巨人1。沙盒不限墨水，红蓝两队分别计算数量。</div><div class="help-row"><b>03 开战，观察，调整</b><br>护卫在前，弓手在后；箭会被路径上的敌人挡住，爆炸会伤到聚集的单位。开战后不可拖动。战前点底部道具选择急救旗、集结号或烟雾弹，每场只能使用所带的一件一次。急救治疗伤员；集结加速5秒；烟雾降低箭矢伤害4秒，但不防炸弹。80秒未获胜判失败。</div><p>星级：获胜★；至少半数队员存活再得★；25秒内获胜再得★。关卡进度自动保存在当前浏览器。<br>战斗中点上方的 1× 切换2倍速；计时按战斗内时间，不影响结果和星级。<br>电脑快捷键：空格 开战/暂停；F 倍速；Z 撤销；Esc 关闭。</p>`);}
function openCampaign(preview=g.sandbox?save.currentLevel:g.level){
  input?.cancel();if(g.phase==='battle')g.phase='paused';update();
  save.campaignSeen=true;persist();
  sheet(campaignMarkup(save,g.sandbox?save.currentLevel:g.level,preview));
  for(const b of document.querySelectorAll('[data-preview]'))b.onclick=()=>openCampaign(+b.dataset.preview);
  $('challenge-stage').onclick=()=>{
    if(preview>save.unlocked)return;
    if(!g.sandbox&&preview===g.level){if(g.phase==='build')$('overlay').hidden=true;else reset(preview,false,g.plan);}
    else reset(preview,false);
  };
}
$('levels').onclick=()=>openCampaign();$('campaign-map').onclick=()=>openCampaign();
$('help').onclick=()=>{
 if(g.phase==='battle')g.phase='paused';input?.cancel();update();
 sheet(`<div class="eyebrow">随时可以回来查看</div><h2 id="sheettitle">战地手册</h2><div class="help-menu"><button id="rules-open">玩法与操作 <span>→</span></button><button id="codex-open">五种兵种，怎么搭配 <span>→</span></button><button id="guide-replay">重新显示本关引导 <span>→</span></button><button id="haptics-toggle" aria-pressed="${save.haptics&&canBuzz}" ${canBuzz?'':'disabled'}>震动反馈 <span>${canBuzz?(save.haptics?'开':'关'):'此浏览器不支持'}</span></button><button id="feedback-open">试玩反馈与本机记录 <span>→</span></button></div><p>单机试玩版 ${PLAYTEST_VERSION} · 没有广告和付费。进度、阵容和试玩记录均保存在当前浏览器。</p>`);
 $('rules-open').onclick=openRules;$('codex-open').onclick=()=>openCodex(selected);
 $('guide-replay').onclick=()=>{save.guides[g.level]=false;lessonFlags.delete(g.level);delete save.lessonActions[g.level];lastGuideKey='';persist();if(g.phase!=='build')reset(g.level,g.sandbox,g.plan);else $('overlay').hidden=true;update();};
 $('feedback-open').onclick=openFeedback;
 $('haptics-toggle').onclick=()=>{save.haptics=!save.haptics;persist();buzz(20,true);$('haptics-toggle').setAttribute('aria-pressed',String(save.haptics));$('haptics-toggle').querySelector('span').textContent=save.haptics?'开':'关';};
};
function openCodex(type='knight'){
 if(g.phase==='battle')g.phase='paused';input?.cancel();update();const d=TYPES[type],brief=UNIT_GUIDE[type];
 sheet(`<div class="eyebrow">兵种手册 · 共5种</div><h2 id="sheettitle">每个人都有位置。</h2><div class="codex-tabs">${Object.entries(TYPES).map(([id,u])=>`<button data-codex="${id}" class="${id===type?'chosen':''}">${u.name}</button>`).join('')}</div><div class="unit-profile"><canvas id="unit-portrait" width="240" height="200"></canvas><div><h3>${d.name}</h3><p>${d.role}</p><small>${d.cost}墨水 · 每队最多${d.limit}名</small></div></div><div class="profile-numbers"><span>生命 <b>${d.hp}</b></span><span>伤害 <b>${d.damage}</b></span><span>基础射程 <b>${d.range}</b></span></div><div class="profile-note"><b>适合这样用</b><p>${brief.good}</p><b>要留意</b><p>${brief.watch}</p></div><button class="primary" id="codex-return">回到布阵</button>`);
 const c=$('unit-portrait').getContext('2d');drawUnit(c,{type,x:120,y:175,team:0,angle:.35},0,3,true);
 for(const b of document.querySelectorAll('[data-codex]'))b.onclick=()=>openCodex(b.dataset.codex);
 $('codex-return').onclick=()=>{if(g.phase==='build')$('overlay').hidden=true;else reset(g.level,g.sandbox,g.plan);};
}
function openFeedback(){
 if(g.phase==='battle')g.phase='paused';input?.cancel();update();const summary=metrics.summary();
 sheet(`<div class="eyebrow">本地试玩 · ${PLAYTEST_VERSION}</div><h2 id="sheettitle">告诉我们哪里卡住了。</h2><p>只保存在本机，不会自动上传。你可以导出后自行分享。</p><form id="feedback-form"><label>这次好玩吗？<select id="feedback-rating" required><option value="">请选择</option>${[1,2,3,4,5].map(n=>`<option value="${n}">${n} / 5</option>`).join('')}</select></label><label>难度感受<select id="feedback-difficulty"><option value="fair">刚好</option><option value="easy">偏简单</option><option value="hard">偏难</option></select></label><label>哪里不明白、卡住或想再玩？<textarea id="feedback-comment" maxlength="1000" rows="3" placeholder="例如：不知道为什么箭射不出去"></textarea></label><button class="primary" type="submit">保存反馈到本机</button><p id="feedback-status" role="status"></p></form><div class="local-records"><label><input id="record-enabled" type="checkbox" ${metrics.enabled?'checked':''}>在此设备记录试玩过程</label><p id="local-summary">当前保留 ${summary.battles} 场结果、${summary.feedback} 条反馈；最多500条事件。只记录关卡、布阵操作与战斗结果，不记录鼠标轨迹。</p><button id="export-records" class="secondary">导出试玩记录 JSON</button><button id="clear-records" class="text-action">删除本机试玩记录</button><small>仅当前浏览器样本，不能据此判断整体留存率。</small></div>`);
 const refreshSummary=()=>{const s=metrics.summary();$('local-summary').textContent=`当前保留 ${s.battles} 场结果、${s.feedback} 条反馈；最多500条事件。只记录关卡、布阵操作与战斗结果，不记录鼠标轨迹。`;};
 $('record-enabled').onchange=e=>metrics.setEnabled(e.target.checked);
 $('feedback-form').onsubmit=e=>{e.preventDefault();if(!metrics.enabled){$('feedback-status').textContent='本机记录已关闭。勾选后可以保存反馈，或直接把想法告诉开发者。';return;}metrics.record('feedback',{level:g.level+1,sandbox:g.sandbox,rating:Number($('feedback-rating').value),difficulty:$('feedback-difficulty').value,comment:$('feedback-comment').value});refreshSummary();$('feedback-status').textContent=metrics.storageError?'浏览器无法保存，反馈暂存本页；请立即导出。':'反馈已保存在本机；可用下方按钮导出。';};
 $('export-records').onclick=()=>{const blob=new Blob([JSON.stringify(metrics.export(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`draw-clash-playtest-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('clear-records').onclick=()=>{metrics.clear();refreshSummary();$('feedback-status').textContent='本机试玩记录已删除，关卡与阵容保留。';};
}
$('playtest').onclick=openFeedback;
const lastAttempts=new Map();
// 胜负一出就记录进度和试玩数据；战报在短暂停顿后再弹出，停顿中离开也不会丢星。
function finalize(){
  const review=report(g),key=rosterKey(g)+':'+g.selectedItem,previous=lastAttempts.get(key);
  const survivors=g.units.filter(u=>u.team===0&&u.hp>0).length;
  const comparison=previous?`同阵容上次存活 ${previous.survivors} 人 → 本次 ${survivors} 人；用时 ${previous.time.toFixed(1)} → ${g.elapsed.toFixed(1)} 秒。`:'';
  lastAttempts.set(key,{survivors,time:g.elapsed});
  metrics.record('performance',{level:g.level+1,...frameSamples.result()});
  const won=g.phase==='won',stars=starsFor(g),unlockGiant=won&&!g.sandbox&&g.level===2&&save.unlocked<3;
  metrics.record('battle_end',{level:g.level+1,sandbox:g.sandbox,outcome:g.phase,seconds:g.elapsed,survivors,stars,spent:g.spent,item:g.selectedItem,speed});
  const spotlight=!g.sandbox?SPOTLIGHTS[g.level]:null,earned=spotlight?.check(g)||false;if(earned)save.medals[g.level]=true;
  if(won&&!g.sandbox){recordVictory(save,g.level,stars);persist();}
  const progress=campaignSummary(save),next=won&&!g.sandbox&&g.level<LEVELS.length-1;
  sound(g.phase);buzz(won?[18,50,30]:70,true);
  return {review,survivors,comparison,won,stars,unlockGiant,spotlight,earned,progress,next};
}
function showResult(){
  if(!beat||shown)return;shown=true;update();
  const {review,survivors,comparison,won,stars,unlockGiant,spotlight,earned,progress,next}=beat.summary;
  sheet(`<div class="result-icon">${won?'⚑':'↻'}</div>
    <div class="eyebrow">${g.sandbox?'沙盒战斗结束':`第 ${g.level+1} / 10 关 · 已通关 ${progress.completed} / 10`}</div>
    <h2 id="sheettitle">${won?(!g.sandbox&&progress.completed===10?'十关通关，漂亮！':'漂亮的一笔！'):'调整布阵，再来一次。'}</h2>
    <p>${won?(g.sandbox?'你的小队赢下了这场沙盒战斗。':'这场胜利已记录，通关进度已保存。'):g.elapsed>=80?'战斗超时，调整站位和输出组合再试。':'阵容已保留。拖动几名士兵，验证下一种安排。'}</p>
    <div class="stars" aria-label="本场${stars}星">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</div>
    <div class="stats"><div><strong>${g.elapsed.toFixed(1)}s</strong><small>战斗用时</small></div><div><strong>${survivors}</strong><small>我方存活</small></div><div><strong>${g.spent}</strong><small>阵容墨水</small></div></div>
    ${spotlight?`<div class="challenge-result ${earned?'earned':''}"><b>${earned?'✦ 挑战达成':'可选挑战'} · ${spotlight.goal}</b><small>${spotlight.description}</small></div>`:''}
    ${unlockGiant?'<div class="next-stage"><strong>新兵种已解锁 · 巨人</strong><small>高血量重型近战，最多1名。从兵种栏拖入即可布阵。</small></div>':''}
    ${next?`<div class="next-stage"><strong>下一关 · ${LEVELS[g.level+1].title}</strong><small>${LEVELS[g.level+1].hint}</small></div><button class="primary result-primary" id="next">挑战第 ${g.level+2} 关 →</button>`:won&&!g.sandbox?'<button class="primary result-primary" id="result-map">查看十关地图 · 挑战三星</button>':'<button class="primary result-primary" id="retry">调整阵容，再试一次</button>'}
    <div class="review"><h3>布阵复盘</h3>${review.observations.map(text=>`<p>${text}</p>`).join('')}${comparison?`<p class="comparison">${comparison}</p>`:''}<p class="tip">${review.tip}</p>${review.rows.length?`<table class="unit-stats"><caption>我方兵种表现 · 实际伤害</caption><thead><tr><th scope="col">兵种</th><th scope="col">输出</th><th scope="col">承伤</th><th scope="col">存活</th></tr></thead><tbody>${review.rows.map(row=>`<tr><th scope="row">${row.name}</th><td>${Math.round(row.dealt)}</td><td>${Math.round(row.taken)}</td><td>${row.alive}/${row.total}</td></tr>`).join('')}</tbody></table>`:''}</div>
    ${won&&!g.sandbox?'<button class="result-secondary" id="retry">保留阵容，重试本关</button>':''}
    ${!g.sandbox&&!(won&&g.level===LEVELS.length-1)?'<button class="result-secondary" id="view-map">关卡地图 · 查看全部10关</button>':''}
    <button class="result-secondary" id="result-feedback">这局的试玩反馈</button><p class="campaign-foot">三星：获胜 · 至少半数存活 · 25秒内获胜</p>`);
  $('result-feedback').onclick=openFeedback;
  if($('next'))$('next').onclick=()=>reset(g.level+1,false);
  if($('retry'))$('retry').onclick=()=>reset(g.level,g.sandbox,g.plan);
  if($('result-map'))$('result-map').onclick=()=>openCampaign();
  if($('view-map'))$('view-map').onclick=()=>openCampaign();
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('overlay').hidden)close();if(e.key==='Tab'&&!$('overlay').hidden){const els=[...document.querySelectorAll('#overlay button:not(:disabled)')];if(e.shiftKey&&document.activeElement===els[0]){e.preventDefault();els.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===els.at(-1)){e.preventDefault();els[0].focus();}}if(!$('overlay').hidden||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;if(e.code==='Space'){e.preventDefault();$('start').click();}if(e.key.toLowerCase()==='z')$('undo').click();if(e.key.toLowerCase()==='f'&&!$('speed').hidden)$('speed').click();});document.addEventListener('visibilitychange',()=>{if(document.hidden)input?.cancel();if(document.hidden&&g.phase==='battle'){g.phase='paused';update();}});
let prev=performance.now(),acc=0,ui=0;function frame(now){if(g.phase==='battle'&&!document.hidden)frameSamples.add(now-prev);const dt=Math.min(.05,(now-prev)/1000);prev=now;acc+=dt*(g.phase==='battle'?speed:1);while(acc>=1/60){g.update(1/60);acc-=1/60;}
 if(g.events.length)feel(g.events.splice(0));
 if(['won','lost'].includes(g.phase)&&!beat){beat={start:now,summary:finalize()};update();}
 // 停顿前0.14秒定格，随后以慢动作播完倒地与烟尘，再弹出战报。
 if(beat&&!shown){const age=(now-beat.start)/1000;g.settle(age<.14?0:dt*(renderer.reduced?1:.45));if(age>=(renderer.reduced?.6:1.25))showResult();}
 renderer.draw(g,now/1000);ui+=dt;if(ui>.1){update();ui=0;}requestAnimationFrame(frame);}metrics.record('level_enter',{level:g.level+1,sandbox:false});update();if(!save.campaignSeen)openCampaign();requestAnimationFrame(frame);
