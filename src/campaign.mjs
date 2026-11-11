import {LEVELS,TYPES,ITEMS} from './data.mjs';
import {SPOTLIGHTS} from './first-session.mjs';
import {campaignSummary} from './progression.mjs';
export function campaignMarkup(save,current,preview=current){
  const summary=campaignSummary(save),l=LEVELS[preview],locked=preview>save.unlocked;
  const composition=Object.entries(TYPES).map(([type,d])=>{const n=l.enemies.filter(u=>u.type===type).length;return n?`<span>${d.name} <b>×${n}</b></span>`:'';}).join('');
  return `<div class="eyebrow">10 场挑战 · 单机闯关</div><h2 id="sheettitle">布阵远征</h2>
    <div class="campaign-summary"><span>已通关 <b>${summary.completed} / 10</b></span><span class="star-count">★ ${summary.stars} / ${summary.maxStars}</span></div>
    <div class="campaign-track" aria-label="十关进度">${LEVELS.map((_,i)=>`<i class="${save.stars[i]?'done':''}"></i>`).join('')}</div>
    <p class="map-intro">通关解锁下一关。点选关卡，查看敌方阵容与布阵提示。</p>
    <div class="level-map">${LEVELS.map((stage,i)=>`<button class="map-node ${i===preview?'chosen':''} ${save.stars[i]?'cleared':''} ${i>save.unlocked?'locked':''}" data-preview="${i}" aria-pressed="${i===preview}" aria-label="第${i+1}关 ${stage.title}，${i>save.unlocked?'未解锁，可预览':save.stars[i]?`已获${save.stars[i]}星`:'可挑战'}"><b>${String(i+1).padStart(2,'0')}</b><small>${i>save.unlocked?'锁定':save.stars[i]?'★'.repeat(save.stars[i]):i===save.currentLevel?'继续':'挑战'}</small></button>`).join('')}</div>
    <section class="stage-preview"><div class="stage-kicker">${l.group} ${save.stars[preview]?`· 最佳 ${save.stars[preview]} 星`:''}</div><h3>第${String(preview+1).padStart(2,'0')}关 · ${l.title}</h3>
      <div class="stage-resources"><span>墨水 <b>${l.budget}</b></span><span>敌军 <b>${l.enemies.length} 人</b></span><span>我方最多 <b>10 人</b></span></div>
      <div class="enemy-lineup" aria-label="敌方兵种">${composition}</div>
      <div class="stage-rule">${l.tag} · ${l.rocks.length?l.rocks.length+'处巨石，可绕行':'开阔战场'}</div><p><b>布阵提示</b> ${l.hint}</p>
      ${SPOTLIGHTS[preview]?`<div class="optional-goal"><b>${save.medals?.[preview]?'✦ 已达成':'可选挑战'} · ${SPOTLIGHTS[preview].goal}</b><small>${SPOTLIGHTS[preview].description}</small></div>`:''}<p class="item-recommend">推荐道具：${ITEMS[l.recommendedItem].name} · ${ITEMS[l.recommendedItem].short}</p>${preview===2&&save.unlocked<3?'<p class="unlock-note">通关本关，解锁巨人。</p>':''}
      <button id="challenge-stage" class="primary" ${locked?'disabled':''}>${locked?`先通关第 ${preview} 关`:preview===current?'返回本关布阵':`挑战第 ${preview+1} 关 →`}</button>
    </section><p class="campaign-foot">三星目标：获胜 · 至少半数存活 · 25秒内获胜<br>进度自动保存在当前浏览器。无需账号，无联网对战。</p>`;
}
