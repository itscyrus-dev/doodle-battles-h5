// 主程序：启动、主页、关卡地图和各个弹层（关卡详情、图鉴、配色、悬赏、成就、设置）。
import { LEVELS, CHAPTERS, TYPES, ITEMS, UNIT_ORDER, ITEM_ORDER, LEVELS_PER_CHAPTER, TEAM_LIMIT, unitUnlocked, itemUnlocked } from './data.mjs';
import { t, pick, setLang, lang, detectLang, LANGUAGES } from './i18n.mjs';
import { preload, CORE_IMAGES, assetUrl, PALETTES, drawUnitImage, loadImage } from './assets.mjs';
import { paintUnit } from './render.mjs';
import * as audio from './audio.mjs';
import { loadSave, writeSave, normalizeSave, campaignSummary, chapterSummary, SAVE_KEY, LEGACY_KEY } from './save.mjs';
import { SKINS, ACHIEVEMENTS, REWARDS, DAILY_MIN_CLEARED, ensureDaily, buySkin, equipSkin, claimAchievements } from './meta.mjs';
import { SPOTLIGHTS } from './first-session.mjs';
import { PlaytestLog, PLAYTEST_VERSION } from './playtest.mjs';
import { $, $$, esc, icon, img, starsMarkup, toast, openSheet, closeSheet, initOverlay, canVibrate, setHaptics, buzz } from './ui.mjs';
import { createBattle } from './battle.mjs';

const storage = (() => { try { const s = globalThis.localStorage; s.getItem('x'); return s; } catch { return { getItem: () => null, setItem: () => { throw new Error('no storage'); }, removeItem: () => {} }; } })();
const loaded = loadSave(storage);
const app = {
  save: loaded.save, screen: 'boot', chapter: 0, metrics: new PlaytestLog(), storageOk: true,
  persist() { const ok = writeSave(storage, app.save); if (!ok && app.storageOk) toast(t('toast.storage'), 3200); app.storageOk = ok; },
  show, go
};
setLang(app.save.settings.lang || detectLang());
let battle = null, squadTimer = 0;
const unitName = type => t(`unit.${type}.name`), itemName = id => t(`item.${id}.name`);
const levelLabel = i => `${t('common.level', { n: i + 1 })} · ${pick(LEVELS[i].title)}`;

function applySettings() {
  const s = app.save.settings;
  audio.configure({ music: s.music, sfx: s.sfx }); setHaptics(s.haptics);
  document.body.classList.toggle('reduced', s.reduced); document.documentElement.lang = lang() === 'zh' ? 'zh-CN' : 'en';
  battle?.setReduced(s.reduced);
}
function show(name) {
  app.screen = name;
  for (const id of ['boot', 'home', 'map', 'battle']) $(`#screen-${id}`).hidden = id !== name;
  if (name !== 'battle') { battle?.leave(); audio.music('menu'); }
  cancelAnimationFrame(squadTimer); if (name === 'home') squadTimer = requestAnimationFrame(drawSquad);
}
function go(name, params = {}) {
  closeSheet(true);
  if (name === 'home') { renderHome(); show('home'); }
  if (name === 'map') { renderMap(params.chapter ?? LEVELS[app.save.currentLevel].chapter); show('map'); }
  if (name === 'battle') battle.enter(params);
}
const currencyPills = () => { const s = campaignSummary(app.save); return `<span class="pill">${img('icons/star.webp')}${s.stars}</span><span class="pill">${img('icons/coin.webp')}${app.save.coins}</span>`; };

// ---------- 主页 ----------
function renderHome() {
  const s = app.save, summary = campaignSummary(s), allClear = summary.completed === LEVELS.length, daily = ensureDaily(s);
  const next = allClear ? s.currentLevel : s.unlocked;
  $('#screen-home').innerHTML = `
    <div class="topbar"><div class="group">${currencyPills()}</div><button class="ibtn" id="home-settings" aria-label="${esc(t('home.settings'))}">${icon('gear')}</button></div>
    ${img('ui/logo.webp', 'home-logo', 'Draw & Clash')}
    ${lang() === 'zh' ? `<div class="home-sub">${esc(t('app.name'))}</div>` : ''}
    <div class="home-stage"><canvas id="home-squad" aria-hidden="true"></canvas></div>
    <div class="home-actions">
      <button class="btn btn-gold play" id="home-play">${esc(summary.completed ? t('home.continue') : t('home.start'))}<small>${esc(allClear ? t('home.allClear') : t('home.levelTag', { n: next + 1, title: pick(LEVELS[next].title) }))}</small></button>
      <div class="tiles">
        <button class="tile" id="home-map">${img('icons/map.webp')}${esc(t('home.map'))}</button>
        <button class="tile" id="home-daily">${img('icons/daily.webp')}${esc(t('home.daily'))}${daily && !daily.done ? '<i class="dot"></i>' : ''}</button>
        <button class="tile" id="home-codex">${img('icons/codex.webp')}${esc(t('home.collection'))}</button>
        <button class="tile" id="home-shop">${img('icons/palette.webp')}${esc(t('home.shop'))}</button>
        <button class="tile" id="home-sandbox">${img('icons/sandbox.webp')}${esc(t('home.sandbox'))}</button>
      </div>
    </div>`;
  $('#home-play').onclick = () => allClear ? go('map') : openLevel(next);
  $('#home-map').onclick = () => go('map', { chapter: LEVELS[next].chapter });
  $('#home-daily').onclick = openDaily;
  $('#home-codex').onclick = () => openCodex();
  $('#home-shop').onclick = openShop;
  $('#home-sandbox').onclick = () => go('battle', { level: 0, sandbox: true });
  $('#home-settings').onclick = openSettings;
  app.persist();
}
// 主页上的小队：已解锁的兵种站成两排，轻轻起伏。
function drawSquad(now) {
  const canvas = $('#home-squad'); if (!canvas || app.screen !== 'home') return;
  const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  if (r.width && (canvas.width !== Math.round(r.width * dpr) || canvas.height !== Math.round(r.height * dpr))) { canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); }
  const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height; c.clearRect(0, 0, w, h);
  const types = UNIT_ORDER.filter(type => unitUnlocked(type, app.save.unlocked)), still = app.save.settings.reduced || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const order = [...types.keys()].sort((a, b) => (a % 2) - (b % 2));
  for (const i of order) {
    const type = types[i], n = types.length, x = w * (n === 1 ? .5 : .12 + .76 * i / (n - 1)), back = i % 2 === 0, size = h * (type === 'giant' ? .78 : .56) * (back ? .92 : 1);
    const y = h * (back ? .8 : .96), bob = still ? 0 : Math.sin(now / 520 + i * 1.7) * h * .012;
    c.fillStyle = 'rgba(25,40,55,.22)'; c.beginPath(); c.ellipse(x, y - h * .01, size * .28, size * .08, 0, 0, Math.PI * 2); c.fill();
    c.save(); c.translate(x, y); c.scale(1, 1 + bob / size); drawUnitImage(c, type, app.save.skin, 0, 0, size); c.restore();
  }
  squadTimer = requestAnimationFrame(drawSquad);
}

// ---------- 关卡地图 ----------
const NODE_POS = [[24, 87], [50, 81], [76, 74], [64, 63], [38, 57], [22, 47], [44, 39], [70, 33], [58, 23], [36, 14]];
function renderMap(chapter) {
  const s = app.save; app.chapter = Math.max(0, Math.min(CHAPTERS.length - 1, chapter));
  const c = app.chapter, info = chapterSummary(s, c), first = c * LEVELS_PER_CHAPTER, open = info.unlocked;
  const current = Object.keys(s.stars).length === LEVELS.length ? -1 : s.unlocked;
  const path = NODE_POS.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  $('#screen-map').innerHTML = `
    <header class="map-top"><button class="ibtn dark" id="map-back" aria-label="${esc(t('common.back'))}">${icon('home')}</button>
      <div class="title"><small>${esc(t('map.chapter', { n: c + 1 }))}</small><strong>${esc(pick(CHAPTERS[c].name))}</strong></div>${currencyPills()}</header>
    <div class="map-stage ${open ? '' : 'locked'}" style="background-image:url(${assetUrl(`map/${CHAPTERS[c].id}.webp`)})">
      <svg class="map-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${path}" fill="none" stroke="#22304a" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" opacity=".85"/><path d="${path}" fill="none" stroke="#fff8e7" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 12" vector-effect="non-scaling-stroke"/></svg>
      ${NODE_POS.map(([x, y], i) => {
        const level = first + i, stars = s.stars[level] || 0, locked = level > s.unlocked, boss = i === LEVELS_PER_CHAPTER - 1;
        return `<button class="node ${stars ? 'cleared' : ''} ${level === current ? 'current' : ''} ${locked ? 'locked' : ''} ${boss ? 'boss' : ''}" style="left:${x}%;top:${y}%" data-level="${level}" aria-label="${esc(levelLabel(level))}${locked ? ` · ${esc(t('common.locked'))}` : ''}">${locked ? icon('lock') : level + 1}${stars ? starsMarkup(stars) : ''}</button>`;
      }).join('')}
      ${open ? '' : `<div class="map-lock">${icon('lock')}<span>${esc(t('map.lockedChapter', { n: first }))}</span></div>`}
    </div>
    <footer class="map-bottom"><button class="ibtn" id="map-prev" aria-label="${esc(t('map.prev'))}" ${c === 0 ? 'disabled' : ''}>${icon('back')}</button>
      <div class="info"><p>${esc(pick(CHAPTERS[c].blurb))}</p><div class="map-progress">${esc(t('map.progress', { done: info.completed, total: info.total }))} · ★ ${info.stars}/${info.maxStars}</div>
        <div class="dots">${CHAPTERS.map((_, i) => `<i class="${i === c ? 'on' : ''}"></i>`).join('')}</div></div>
      <button class="ibtn" id="map-next" aria-label="${esc(t('map.next'))}" ${c === CHAPTERS.length - 1 ? 'disabled' : ''}>${icon('next')}</button></footer>`;
  $('#map-back').onclick = () => go('home');
  $('#map-prev').onclick = () => renderMap(c - 1);
  $('#map-next').onclick = () => renderMap(c + 1);
  for (const node of $$('.node')) node.onclick = () => openLevel(+node.dataset.level);
  for (const id of CHAPTERS.map(ch => `map/${ch.id}.webp`)) loadImage(id).catch(() => {});
}

// ---------- 关卡详情 ----------
function openLevel(i) {
  const s = app.save, l = LEVELS[i], locked = i > s.unlocked, stars = s.stars[i] || 0, spot = SPOTLIGHTS[i];
  const counts = UNIT_ORDER.map(type => [type, l.enemies.filter(u => u.type === type).length]).filter(([, n]) => n);
  const rocks = l.rocks.filter(o => o.kind !== 'pond').length, ponds = l.rocks.length - rocks;
  const nextUnits = UNIT_ORDER.filter(type => TYPES[type].unlock === i + 1), nextItems = ITEM_ORDER.filter(id => ITEMS[id].unlock === i + 1), fresh = !stars;
  const sheet = openSheet({
    kicker: esc(`${t('map.chapter', { n: l.chapter + 1 })} · ${pick(CHAPTERS[l.chapter].name)}`), title: `${esc(levelLabel(i))} ${stars ? starsMarkup(stars) : ''}`,
    body: `<div class="chips"><span class="chip blue">${esc(pick(l.tag))}</span>${rocks ? `<span class="chip">${esc(t('level.rocks', { n: rocks }))}</span>` : ''}${ponds ? `<span class="chip">${esc(t('level.ponds', { n: ponds }))}</span>` : ''}${!l.rocks.length ? `<span class="chip">${esc(t('level.open'))}</span>` : ''}</div>
      <div class="lv-facts"><div><b>${img('icons/ink.webp')}${l.budget}</b><small>${esc(t('level.ink'))}</small></div><div><b>${l.enemies.length}</b><small>${esc(t('level.enemies'))}</small></div><div><b>${esc(t('level.seconds', { n: l.par }))}</b><small>${esc(t('level.par'))}</small></div></div>
      <div class="lineup">${counts.map(([type, n]) => `<div class="who"><canvas width="92" height="92" data-unit="${type}"></canvas><b>×${n}</b><small>${esc(unitName(type))}</small></div>`).join('')}</div>
      <div class="box soft hintbox"><b>${esc(t('level.hint'))}</b><p>${esc(pick(l.hint))}</p></div>
      ${itemUnlocked(l.recommendedItem, i) ? `<div class="rec-item">${img(`icons/item-${l.recommendedItem}.webp`)}<span>${esc(t('level.recommended'))} · ${esc(itemName(l.recommendedItem))}<br><small class="muted">${esc(t(`item.${l.recommendedItem}.short`))}</small></span></div>` : ''}
      ${spot ? `<div class="box challenge ${s.medals[i] ? 'done' : ''}">${img('icons/trophy.webp')}<div><b>${esc(s.medals[i] ? t('level.challengeDone') : t('level.challenge'))} · ${esc(t(`spot.${spot.id}.goal`))}${s.medals[i] ? '' : ` <span class="chip gold">${esc(t('level.challengeReward', { n: REWARDS.medal }))}</span>`}</b><p class="muted">${esc(t(`spot.${spot.id}.desc`))}</p></div></div>` : ''}
      ${fresh ? [...nextUnits.map(type => t('level.unlockUnit', { name: unitName(type) })), ...nextItems.map(id => t('level.unlockItem', { name: itemName(id) }))].map(text => `<p class="muted" style="margin-top:8px">✦ ${esc(text)}</p>`).join('') : ''}
      <p class="muted" style="margin-top:10px">${esc(t('level.starRule', { n: l.par }))}</p>
      <div class="actions"><button class="btn btn-gold big block" id="level-go" ${locked ? 'disabled' : ''}>${locked ? `${icon('lock')} ${esc(t('level.lockedBtn', { n: i }))}` : `${icon('swords')} ${esc(t('level.fight'))}`}</button></div>`
  });
  for (const c of $$('canvas[data-unit]', sheet)) paintUnit(c, c.dataset.unit, 'red', { flip: true });
  $('#level-go', sheet).onclick = () => { if (!locked) { closeSheet(true); go('battle', { level: i }); } };
}

// ---------- 图鉴 ----------
function openCodex(tab = 'units', chosen = null) {
  const s = app.save, unlocked = s.unlocked;
  const stat = (label, value, max) => `<div><span>${esc(label)}</span><i><em style="width:${Math.min(100, value / max * 100)}%"></em></i><span>${value}</span></div>`;
  let body = `<div class="tabs"><button data-tab="units" class="${tab === 'units' ? 'on' : ''}">${esc(t('codex.units'))}</button><button data-tab="items" class="${tab === 'items' ? 'on' : ''}">${esc(t('codex.items'))}</button></div>`;
  if (tab === 'units') {
    const type = chosen || UNIT_ORDER.filter(u => unitUnlocked(u, unlocked)).at(-1), d = TYPES[type], open = unitUnlocked(type, unlocked);
    body += `<div class="codex-grid">${UNIT_ORDER.map(u => `<button class="codex-cell ${u === type ? 'on' : ''} ${unitUnlocked(u, unlocked) ? '' : 'locked'}" data-unit="${u}"><canvas width="116" height="116"></canvas>${esc(unitUnlocked(u, unlocked) ? unitName(u) : '???')}</button>`).join('')}</div>
      <div class="profile box"><div class="head"><canvas id="codex-art" width="192" height="192"></canvas><div><h3>${esc(open ? unitName(type) : '???')}</h3><p class="muted">${esc(open ? t(`unit.${type}.role`) : t('codex.unlockAt', { n: d.unlock }))}</p>
        <div class="chips"><span class="chip gold">${img('icons/ink.webp')}${d.cost}</span><span class="chip">${esc(t('codex.limit'))} ${d.limit}</span></div></div></div>
        ${open ? `<div class="bars">${stat(t('codex.hp'), d.hp, 360)}${d.heals ? stat(t('codex.heal'), d.heal, 35) : stat(t('codex.damage'), d.damage, 35)}${stat(t('codex.range'), d.range, 145)}${stat(t('codex.speed'), d.speed, 64)}</div>
        <div><b>${esc(t('codex.good'))}</b><p>${esc(t(`unit.${type}.good`))}</p></div><div><b>${esc(t('codex.watch'))}</b><p>${esc(t(`unit.${type}.watch`))}</p></div>` : ''}</div>`;
  } else {
    body += `<div class="options">${ITEM_ORDER.map(id => { const open = itemUnlocked(id, unlocked); return `<div class="option ${open ? '' : 'locked'}">${img(`icons/item-${id}.webp`)}<span><b>${esc(itemName(id))}</b><small>${esc(open ? t(`item.${id}.desc`) : t('item.unlockAt', { n: ITEMS[id].unlock }))}</small></span></div>`; }).join('')}</div>`;
  }
  const sheet = openSheet({ title: esc(t('codex.title')), className: 'full', body });
  for (const b of $$('[data-tab]', sheet)) b.onclick = () => openCodex(b.dataset.tab);
  for (const cell of $$('.codex-cell', sheet)) { paintUnit(cell.querySelector('canvas'), cell.dataset.unit, s.skin, { locked: cell.classList.contains('locked') }); cell.onclick = () => openCodex('units', cell.dataset.unit); }
  if ($('#codex-art', sheet)) { const type = chosen || UNIT_ORDER.filter(u => unitUnlocked(u, unlocked)).at(-1); paintUnit($('#codex-art', sheet), type, s.skin, { locked: !unitUnlocked(type, unlocked) }); }
}

// ---------- 军旗配色 ----------
function openShop() {
  const s = app.save;
  const sheet = openSheet({
    title: esc(t('shop.title')), className: 'full',
    body: `<p class="muted">${esc(t('shop.blurb'))}</p><p style="margin-top:8px"><span class="pill">${img('icons/coin.webp')}${s.coins}</span></p>
      <div class="skins">${SKINS.map(k => {
        const owned = s.skins.includes(k.id), on = s.skin === k.id, poor = s.coins < k.price;
        return `<div class="skin ${on ? 'on' : ''}"><canvas width="168" height="168" data-skin="${k.id}"></canvas><b><i style="background:${PALETTES[k.id].swatch}"></i>${esc(t(`skin.${k.id}`))}</b>
          <button class="btn small ${on ? 'btn-paper' : owned ? 'btn-blue' : 'btn-gold'}" data-skin="${k.id}" ${on || (!owned && poor) ? 'disabled' : ''}>${on ? esc(t('shop.equipped')) : owned ? esc(t('shop.equip')) : `<span class="price">${img('icons/coin.webp')}${k.price}</span>`}</button></div>`;
      }).join('')}</div>`
  });
  for (const c of $$('canvas[data-skin]', sheet)) paintUnit(c, 'knight', c.dataset.skin);
  for (const b of $$('button[data-skin]', sheet)) b.onclick = () => {
    const id = b.dataset.skin, owned = s.skins.includes(id);
    if (owned ? equipSkin(s, id) : buySkin(s, id)) { if (!owned) { audio.sfx('coin'); buzz(20, true); } app.persist(); battle.setSkin(s.skin); announce(claimAchievements(s)); openShop(); if (app.screen === 'home') renderHome(); }
  };
}

// ---------- 每日悬赏 ----------
function openDaily() {
  const s = app.save, daily = ensureDaily(s); app.persist();
  const body = !daily ? `<div class="daily-card">${img('icons/daily.webp')}<p>${esc(t('daily.locked'))}</p></div>`
    : `<div class="daily-card">${img('icons/daily.webp')}<div><p><b>${esc(daily.done ? t('daily.done') : t('daily.goal', { n: daily.level + 1, title: pick(LEVELS[daily.level].title) }))}</b></p><p class="muted">${esc(t('daily.reward', { n: REWARDS.daily }))} · ${esc(t('daily.reset'))}</p>${daily.streak ? `<p class="muted">${esc(t('daily.streak', { n: daily.streak }))}</p>` : ''}</div></div>
      ${daily.done ? '' : `<div class="actions"><button class="btn btn-gold big block" id="daily-go">${icon('swords')} ${esc(t('daily.go'))}</button></div>`}`;
  const sheet = openSheet({ title: esc(t('daily.title')), body });
  if ($('#daily-go', sheet)) $('#daily-go', sheet).onclick = () => { closeSheet(true); go('battle', { level: daily.level }); };
}

// ---------- 成就 ----------
function announce(earned) {
  if (!earned.length) return;
  // 一次达成很多个（比如读入旧存档）时合并成一条，免得提示一条接一条挡住画面。
  const text = earned.length > 2 ? t('ach.toastMany', { count: earned.length, n: earned.reduce((s, a) => s + a.reward, 0) }) : earned.map(a => t('ach.toast', { name: t(`ach.${a.id}.name`), n: a.reward })).join('\n');
  toast(text, 3000); audio.sfx('unlock'); app.persist();
}
function openAchievements() {
  const s = app.save;
  openSheet({
    title: esc(t('ach.title')), className: 'full',
    body: `<div class="ach-list">${ACHIEVEMENTS.map(a => {
      const done = !!s.achievements[a.id], value = Math.min(a.goal, a.progress(s));
      return `<div class="ach ${done ? 'done' : ''}">${img('icons/trophy.webp')}<div><b>${esc(t(`ach.${a.id}.name`))}</b><small>${esc(t(`ach.${a.id}.desc`))}</small>${done ? '' : `<div class="meter"><i style="width:${value / a.goal * 100}%"></i></div>`}</div>
        <span class="price">${done ? icon('check') : `${img('icons/coin.webp')}${a.reward}`}</span></div>`;
    }).join('')}</div>`
  });
}

// ---------- 设置 ----------
function openSettings() {
  const s = app.save.settings;
  const toggle = (id, on, disabled = false) => `<button class="switch" role="switch" id="${id}" aria-checked="${on}" ${disabled ? 'disabled' : ''}></button>`;
  const sheet = openSheet({
    title: esc(t('settings.title')), className: 'full',
    body: `<div class="rows">
      <div class="rowline"><span>${esc(t('settings.language'))}</span><div class="seg">${LANGUAGES.map(l => `<button data-lang="${l.id}" class="${lang() === l.id ? 'on' : ''}">${l.label}</button>`).join('')}</div></div>
      <div class="rowline"><span>${esc(t('settings.music'))}</span>${toggle('set-music', s.music)}</div>
      <div class="rowline"><span>${esc(t('settings.sfx'))}</span>${toggle('set-sfx', s.sfx)}</div>
      <div class="rowline"><span>${esc(t('settings.haptics'))}${canVibrate ? '' : `<small>${esc(t('settings.hapticsNA'))}</small>`}</span>${toggle('set-haptics', s.haptics && canVibrate, !canVibrate)}</div>
      <div class="rowline"><span>${esc(t('settings.reduced'))}<small>${esc(t('settings.reducedNote'))}</small></span>${toggle('set-reduced', s.reduced)}</div>
      <button class="rowline" id="set-ach"><span>${esc(t('ach.title'))}</span>${icon('next')}</button>
      <button class="rowline" id="set-feedback"><span>${esc(t('settings.feedback'))}</span>${icon('next')}</button>
    </div>
    <p class="muted" style="margin-top:14px">${esc(t('settings.privacy'))}</p>
    <p class="muted">${esc(t('settings.version', { v: PLAYTEST_VERSION }))}</p>
    <div class="actions"><button class="btn btn-red block" id="set-reset">${esc(t('settings.reset'))}</button></div>`
  });
  const flip = (id, key, after) => { $(`#${id}`, sheet).onclick = e => { s[key] = !s[key]; e.currentTarget.setAttribute('aria-checked', String(s[key])); applySettings(); app.persist(); after?.(); }; };
  flip('set-music', 'music', () => audio.unlock()); flip('set-sfx', 'sfx', () => audio.sfx('tap')); flip('set-haptics', 'haptics', () => buzz(20, true)); flip('set-reduced', 'reduced');
  for (const b of $$('[data-lang]', sheet)) b.onclick = () => { s.lang = setLang(b.dataset.lang); app.persist(); applySettings(); relabelAll(); openSettings(); toast(t('toast.lang')); };
  $('#set-ach', sheet).onclick = openAchievements;
  $('#set-feedback', sheet).onclick = openFeedback;
  $('#set-reset', sheet).onclick = () => {
    const confirm = openSheet({ title: esc(t('settings.reset')), body: `<p>${esc(t('settings.resetConfirm'))}</p><div class="actions two"><button class="btn btn-paper" id="reset-no">${esc(t('common.cancel'))}</button><button class="btn btn-red" id="reset-yes">${esc(t('common.confirm'))}</button></div>` });
    $('#reset-no', confirm).onclick = openSettings;
    $('#reset-yes', confirm).onclick = () => {
      const keep = app.save.settings; try { storage.removeItem(SAVE_KEY); storage.removeItem(LEGACY_KEY); } catch { /* 存储不可用时无事可做 */ }
      app.save = normalizeSave({ settings: keep }); app.persist(); battle.setSkin('blue'); closeSheet(true); go('home'); toast(t('settings.resetDone'));
    };
  };
}
function relabelAll() { if (app.screen === 'home') renderHome(); if (app.screen === 'map') renderMap(app.chapter); battle.relabel(); }

function openFeedback() {
  const m = app.metrics, summary = m.summary();
  const sheet = openSheet({
    title: esc(t('feedback.title')), className: 'full',
    body: `<p class="muted">${esc(t('feedback.note'))}</p>
      <form class="form" id="feedback-form"><label>${esc(t('feedback.rating'))}<select id="feedback-rating" required><option value="">${esc(t('feedback.choose'))}</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}">${n} / 5</option>`).join('')}</select></label>
        <label>${esc(t('feedback.difficulty'))}<select id="feedback-difficulty"><option value="fair">${esc(t('feedback.fair'))}</option><option value="easy">${esc(t('feedback.easy'))}</option><option value="hard">${esc(t('feedback.hard'))}</option></select></label>
        <label>${esc(t('feedback.comment'))}<textarea id="feedback-comment" maxlength="1000" rows="3" placeholder="${esc(t('feedback.placeholder'))}"></textarea></label>
        <button class="btn btn-gold block" type="submit">${esc(t('feedback.save'))}</button><p class="muted" id="feedback-status" role="status"></p></form>
      <div class="form"><label class="check"><input id="record-enabled" type="checkbox" ${m.enabled ? 'checked' : ''}>${esc(t('feedback.record'))}</label><p class="muted" id="local-summary">${esc(t('feedback.summary', summary))}</p>
        <button class="btn btn-paper block" id="export-records">${esc(t('feedback.export'))}</button><button class="text-link" id="clear-records">${esc(t('feedback.clear'))}</button></div>`
  });
  const refresh = () => { $('#local-summary', sheet).textContent = t('feedback.summary', m.summary()); };
  $('#record-enabled', sheet).onchange = e => m.setEnabled(e.target.checked);
  $('#feedback-form', sheet).onsubmit = e => {
    e.preventDefault(); const g = battle.game;
    if (!m.enabled) { $('#feedback-status', sheet).textContent = t('feedback.off'); return; }
    m.record('feedback', { level: g.level + 1, sandbox: g.sandbox, rating: Number($('#feedback-rating', sheet).value), difficulty: $('#feedback-difficulty', sheet).value, comment: $('#feedback-comment', sheet).value });
    refresh(); $('#feedback-status', sheet).textContent = m.storageError ? t('feedback.unsaved') : t('feedback.saved');
  };
  $('#export-records', sheet).onclick = () => { const blob = new Blob([JSON.stringify(m.export(), null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `draw-clash-playtest-${Date.now()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  $('#clear-records', sheet).onclick = () => { m.clear(); refresh(); $('#feedback-status', sheet).textContent = t('feedback.cleared'); };
}

// ---------- 启动 ----------
async function boot() {
  initOverlay(); applySettings();
  $('#boot-status').textContent = t('boot.loading'); $('#boot-retry').textContent = t('boot.retry');
  app.metrics.record('session_start');
  await preload(CORE_IMAGES, p => { $('#boot-fill').style.width = `${Math.round(4 + p * 96)}%`; });
  battle = createBattle(app); applySettings();
  announce(claimAchievements(app.save));
  go('home');
  if (loaded.migrated) { app.persist(); toast(t('toast.welcomeBack'), 2600); }
  // 浏览器要求先有一次点按才能发声。
  const unlock = () => audio.unlock();
  document.addEventListener('pointerdown', unlock, { capture: true }); document.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('click', e => { if (e.target.closest('button')) audio.sfx('tap'); });
  document.addEventListener('visibilitychange', () => audio.setHidden(document.hidden));
  document.addEventListener('contextmenu', e => { if (!e.target.closest('textarea, input, select')) e.preventDefault(); });
  // 只在正式站点注册离线缓存；本地开发时不注册，避免改了代码却看到旧文件。
  if ('serviceWorker' in navigator && !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
}
globalThis.__app = app;
await boot();
