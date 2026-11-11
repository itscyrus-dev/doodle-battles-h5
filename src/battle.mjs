// 战斗界面：布阵、开战、道具、引导和结算。模拟在 engine.mjs，这里只负责交互和表现。
import { Battle } from './engine.mjs';
import { TYPES, LEVELS, CHAPTERS, ITEMS, UNIT_ORDER, ITEM_ORDER, TEAM_LIMIT, W, H, starsFor, unitUnlocked, itemUnlocked } from './data.mjs';
import { Renderer, paintUnit } from './render.mjs';
import { PALETTES } from './assets.mjs';
import { FormationInput } from './formation-input.mjs';
import { report, rosterKey } from './battle-report.mjs';
import { guideStep, SPOTLIGHTS } from './first-session.mjs';
import { FrameSamples } from './playtest.mjs';
import { draftOf } from './drafts.mjs';
import { recordBattle, buyHint, HINT_COST, REWARDS } from './meta.mjs';
import { SOLUTIONS } from './solutions.mjs';
import { t, pick } from './i18n.mjs';
import * as audio from './audio.mjs';
import { $, $$, esc, icon, img, starsMarkup, toast, openSheet, closeSheet, sheetOpen, buzz } from './ui.mjs';

const el = id => document.getElementById(id);
const unitName = type => t(`unit.${type}.name`);
const itemName = id => t(`item.${id}.name`);

export function createBattle(app) {
  const renderer = new Renderer(el('arena'));
  renderer.unitName = unitName;
  let g = new Battle(0), selected = 'knight', eraser = false, shown = false, beat = null, targeting = false, quotaTeam = 0, hintOn = false;
  let running = false, loop = 0, prev = 0, acc = 0, uiClock = 0, lastGuideKey = '', frameSamples = new FrameSamples(), speed = 1;
  const lessonFlags = new Map(), lastAttempts = new Map();
  const save = () => app.save;
  const flags = () => { if (!lessonFlags.has(g.level)) lessonFlags.set(g.level, { ...save().lessonActions[g.level] }); return lessonFlags.get(g.level); };
  const over = () => g.phase === 'won' || g.phase === 'lost';
  const fighting = () => g.phase === 'battle' || g.phase === 'paused';

  // ---------- 文案 ----------
  function errorText(code, params = {}) {
    return t(`err.${code}`, { n: code === 'team-full' ? TEAM_LIMIT : params.n, name: params.type ? unitName(params.type) : '' });
  }
  function say(code, params = {}) {
    if (code === 'drag.back') toast(t('drag.back', { reason: errorText(params.reasonCode, params) }));
    else if (code.startsWith('drag.')) toast(t(code, params));
    else toast(errorText(code, params));
  }
  function relabel() {
    renderer.words = {
      victory: g.sandbox ? t('result.sandboxWin') : t('battle.victory'), defeat: g.sandbox ? t('result.sandboxLose') : t('battle.defeat'), timeUp: t('battle.timeUp'),
      paused: t('battle.paused'), block: t('battle.block'), yourZone: g.sandbox ? t('battle.zone.yours') : t('battle.zone.yours'), enemyZone: g.sandbox ? t('battle.zone.red') : t('battle.zone.enemy')
    };
    el('b-back').innerHTML = icon('back'); el('b-back').setAttribute('aria-label', t('common.back'));
    el('b-undo').innerHTML = icon('undo'); el('b-undo').setAttribute('aria-label', t('battle.undo'));
    el('b-erase').innerHTML = icon('eraser'); el('b-erase').setAttribute('aria-label', t('battle.erase'));
    el('b-clear').innerHTML = icon('trash'); el('b-clear').setAttribute('aria-label', t('battle.clear'));
    el('b-hint').innerHTML = icon('bulb'); el('b-hint').setAttribute('aria-label', t('battle.hint'));
    el('b-inspect-close').innerHTML = icon('close'); el('b-inspect-close').setAttribute('aria-label', t('common.close'));
    el('coach-skip').textContent = t('guide.skip');
    el('recycle').textContent = t('recycle.zone');
    el('b-autofill').textContent = t('battle.autofill');
    el('b-speed').setAttribute('aria-label', t('battle.speed'));
    el('b-redeploy').textContent = t('battle.redeploy');
    el('arena').setAttribute('aria-label', t('battle.tip.build'));
    el('hud-blue-name').textContent = g.sandbox ? t('battle.blue') : t('battle.you'); el('hud-red-name').textContent = g.sandbox ? t('battle.red') : t('battle.enemy');
    if (g.sandbox) { el('b-chapter').textContent = t('battle.sandboxSub'); el('b-name').textContent = t('battle.sandbox'); }
    else { el('b-chapter').textContent = `${t('map.chapter', { n: LEVELS[g.level].chapter + 1 })} · ${pick(CHAPTERS[LEVELS[g.level].chapter].name)}`; el('b-name').textContent = `${g.level + 1} · ${pick(LEVELS[g.level].title)}`; }
    buildRoster();
  }

  // ---------- 兵种卡 ----------
  function buildRoster() {
    const unlocked = save().unlocked, types = UNIT_ORDER.filter(type => unitUnlocked(type, unlocked)), teaser = UNIT_ORDER.find(type => !unitUnlocked(type, unlocked));
    el('roster').innerHTML = [...types, ...(teaser ? [teaser] : [])].map(type => {
      const d = TYPES[type], locked = !unitUnlocked(type, unlocked), fresh = !g.sandbox && !locked && d.unlock === g.level && d.unlock > 0 && !save().stars[g.level];
      return `<button class="card ${locked ? 'locked' : ''} ${fresh ? 'is-new' : ''}" data-type="${type}" data-new="${esc(t('common.new'))}" ${locked ? 'disabled' : ''}>
        ${locked ? '' : `<span class="quota">0/${d.limit}</span>`}${g.sandbox && !locked ? '' : `<small class="cost">${locked ? `${icon('lock')}${d.unlock + 1}` : `${img('icons/ink.webp')}${d.cost}`}</small>`}
        <canvas width="96" height="96"></canvas><strong>${esc(unitName(type))}</strong></button>`;
    }).join('');
    for (const card of $$('#roster .card')) paintUnit(card.querySelector('canvas'), card.dataset.type, save().skin, { locked: card.disabled });
    if (!unitUnlocked(selected, unlocked)) selected = 'knight';
  }
  function repaintCards() { for (const card of $$('#roster .card')) paintUnit(card.querySelector('canvas'), card.dataset.type, save().skin, { locked: card.disabled }); }

  // ---------- 进入、重置 ----------
  function reset(level = g.level, sandbox = g.sandbox, plan = null) {
    input.cancel(); renderer.selectedPid = null; renderer.reticle = null; renderer.faces.clear(); targeting = false; hintOn = false; eraser = false;
    g = new Battle(level, sandbox);
    g.selectItem(itemUnlocked(save().item, save().unlocked) ? save().item : 'heal');
    g.plan = structuredClone(plan ?? (!sandbox ? save().formations[level] || [] : []));
    g.serial = Math.max(0, ...g.plan.map(u => (u.pid ?? -1) + 1));
    globalThis.__game = g;
    shown = false; beat = null; quotaTeam = 0; speed = save().settings.speed;
    renderer.setTheme(sandbox ? 'meadow' : CHAPTERS[LEVELS[level].chapter].id); renderer.skin = save().skin;
    if (!sandbox) { save().currentLevel = level; app.persist(); if (level === 0 && !save().guides[0]) selected = 'guard'; }
    el('b-tray').style.height = ''; el('tray-build').hidden = false; el('tray-fight').hidden = true;
    app.metrics.record('level_enter', { level: level + 1, sandbox });
    audio.music('menu');
    relabel(); update();
  }
  function enter({ level = 0, sandbox = false, plan = null } = {}) {
    app.show('battle');
    reset(level, sandbox, plan);
    renderer.resize();
    running = true; prev = performance.now(); acc = 0; const id = ++loop; requestAnimationFrame(now => frame(now, id));
  }
  function leave() { running = false; loop++; input.cancel(); if (g.phase === 'battle') g.phase = 'paused'; }
  function checkpoint() {
    if (g.phase !== 'build' || g.sandbox) return;
    const draft = draftOf(g), stored = (save().formations[g.level] || []).map(({ type, x, y }) => ({ type, x, y, team: 0 }));
    if (JSON.stringify(draft) !== JSON.stringify(stored)) { save().formations[g.level] = draft; app.persist(); }
  }

  // ---------- 引导 ----------
  function updateGuide() {
    const step = !g.sandbox && !save().guides[g.level] ? guideStep(g, flags()) : null;
    el('coach').hidden = !step;
    const hint = hintOn && !g.sandbox ? SOLUTIONS[g.level].plan.map(([type, x, y]) => ({ type, x, y, team: 0 })) : [];
    renderer.guideGhosts = step?.ghosts || hint;
    for (const [target, id] of [['roster', 'roster'], ['start', 'b-start'], ['item', 'b-item']]) el(id).classList.toggle('coach-focus', step?.target === target);
    if (step) {
      el('coach-title').textContent = t(step.title); el('coach-text').textContent = t(step.text);
      const key = `${g.level}:${step.id}`; if (lastGuideKey !== key) { app.metrics.record('guide_step', { level: g.level + 1, step: step.id }); lastGuideKey = key; }
    }
    return step;
  }

  // ---------- 刷新界面 ----------
  function update() {
    checkpoint();
    const build = g.phase === 'build', lesson = build ? updateGuide() : (el('coach').hidden = true, null);
    const item = ITEMS[g.selectedItem];
    el('b-ink').textContent = g.sandbox ? '∞' : g.remaining; el('b-inkmax').textContent = g.sandbox ? '' : `/${g.budget}`;
    el('b-inkpill').classList.toggle('low', !g.sandbox && build && g.remaining < 10);

    const list = build ? [...g.plan, ...(g.sandbox ? [] : g.enemy)] : g.units.filter(u => u.hp > 0);
    const blue = list.filter(u => !u.team).length, red = list.filter(u => u.team).length;
    el('hud-blue').textContent = build ? `${blue}/${TEAM_LIMIT}` : blue; el('hud-red').textContent = red;
    const share = team => { if (build) return 100; const all = g.units.filter(u => u.team === team), max = all.reduce((s, u) => s + u.max, 0); return max ? Math.round(all.reduce((s, u) => s + Math.max(0, u.hp), 0) / max * 100) : 0; };
    el('hud-blue-bar').style.width = `${share(0)}%`; el('hud-red-bar').style.width = `${share(1)}%`;
    el('hud-blue-bar').parentElement.parentElement.style.setProperty('--team', PALETTES[save().skin]?.swatch || PALETTES.blue.swatch);
    el('hud-time').textContent = build ? t('battle.deploy') : g.phase === 'paused' ? t('battle.paused') : `${g.elapsed.toFixed(1)}s`;
    el('b-speed').hidden = !fighting(); el('b-speed').textContent = `${speed}×`; el('b-speed').setAttribute('aria-pressed', String(speed === 2));

    const inspection = build && !renderer.drag ? renderer.inspect(g) : null;
    el('b-inspect').hidden = !inspection;
    if (inspection) { el('b-inspect-title').textContent = t('preview.title', { name: unitName(inspection.unit.type), range: inspection.range }); el('b-inspect-status').textContent = `${t(`preview.${inspection.status}`)} · ${t('preview.note')}`; }
    const feedback = g.feedback && g.feedback.until > g.elapsed && g.phase === 'battle' ? g.feedback : null;
    el('b-alert').hidden = !feedback || targeting;
    if (feedback) {
      el('b-alert').className = feedback.kind;
      el('b-alert').textContent = feedback.kind === 'rear' ? `! ${t('feedback.rear')}` : feedback.kind === 'item-end' ? t('feedback.itemEnd', { name: itemName(feedback.item) })
        : feedback.item === 'heal' ? t('feedback.heal', { targets: feedback.targets, amount: Math.round(feedback.amount) }) : t('feedback.item', { name: itemName(feedback.item) });
    }
    el('b-target').hidden = !(targeting && g.phase === 'battle'); el('b-target').textContent = t('battle.item.target');
    el('b-tip').hidden = !build || !!lesson;
    el('b-tip').textContent = eraser ? t('battle.tip.eraser') : g.sandbox ? t('battle.tip.sandbox') : g.plan.length ? `${unitName(selected)} · ${t(`unit.${selected}.role`)}` : t('battle.tip.build');
    el('b-autofill').hidden = !build || g.plan.length > 0 || !!lesson?.ghosts || hintOn;

    el('b-start').disabled = !g.plan.some(u => u.team === 0) || (g.sandbox && !g.plan.some(u => u.team === 1));
    el('b-start').textContent = t('battle.start');
    el('b-undo').disabled = !g.history.length; el('b-erase').classList.toggle('on', eraser); el('b-erase').setAttribute('aria-pressed', String(eraser));
    el('b-clear').disabled = !g.plan.length; el('b-hint').hidden = g.sandbox || !build || !!lesson;
    el('b-item').innerHTML = img(`icons/item-${g.selectedItem}.webp`); el('b-item').setAttribute('aria-label', `${t('battle.item.pick')} · ${itemName(g.selectedItem)}`);

    if (!build) {
      const active = g.effects[g.selectedItem] || 0, use = el('b-use'), ready = g.phase === 'battle' && g.canUseItem;
      use.disabled = !ready; use.classList.toggle('ready', ready && !targeting); use.classList.toggle('targeting', targeting);
      const status = targeting ? t('battle.item.target') : g.itemUsed ? (active > 0 ? t('battle.item.active', { n: active.toFixed(1) }) : t('battle.item.used')) : g.selectedItem === 'heal' && !g.canHeal && g.phase === 'battle' ? t('battle.item.none') : t('battle.item.use');
      use.innerHTML = `<span class="art">${img(`icons/item-${g.selectedItem}.webp`)}${active > 0 ? `<i class="ring" style="--left:${(active / item.duration * 100).toFixed(0)}%"></i>` : ''}</span><span><b>${esc(itemName(g.selectedItem))}</b><small>${esc(status)}</small></span>`;
      el('b-pause').textContent = beat && !shown ? t('battle.report') : g.phase === 'paused' ? t('battle.resume') : t('battle.pause');
      el('b-pause').disabled = shown;
    }
    for (const card of $$('#roster .card')) {
      const type = card.dataset.type, d = TYPES[type]; if (card.classList.contains('locked')) { card.setAttribute('aria-label', `${unitName(type)} · ${t('battle.unitLocked', { n: d.unlock + 1 })}`); continue; }
      const count = g.count(type, quotaTeam), full = count >= d.limit || g.count(null, quotaTeam) >= TEAM_LIMIT;
      card.classList.toggle('selected', type === selected && !eraser); card.classList.toggle('full', full);
      card.classList.toggle('unaffordable', !g.sandbox && !full && d.cost > g.remaining);
      card.querySelector('.quota').textContent = `${count}/${d.limit}`;
      card.setAttribute('aria-label', t('battle.quota', { name: unitName(type), cost: d.cost, count, limit: d.limit }));
    }
  }

  // ---------- 布阵手势 ----------
  const input = new FormationInput({
    canvas: el('arena'), roster: el('roster'), renderer, getGame: () => g, getSelection: () => ({ type: selected, eraser }),
    select: type => { if (selected !== type || eraser) { selected = type; eraser = false; audio.sfx('pickup'); } }, say,
    onChange: (event, team, detail = {}) => {
      if (event === 'move') flags().moved = true;
      if (event === 'inspect') flags().inspected = true;
      if ((event === 'move' || event === 'inspect') && !g.sandbox) { save().lessonActions[g.level] = { ...flags() }; app.persist(); }
      if (team !== undefined && team !== null) quotaTeam = team;
      if (event === 'place') { audio.sfx('place'); buzz(8); el('b-inkpill').classList.remove('bump'); void el('b-inkpill').offsetWidth; el('b-inkpill').classList.add('bump'); }
      if (event === 'remove' || event === 'erase') audio.sfx('recycle');
      if (event === 'move') audio.sfx('place');
      if (event === 'rejected') { audio.sfx('invalid'); buzz(18); }
      if (event === 'drag') {
        const status = el('dragstatus'); status.hidden = false;
        status.textContent = detail.recycle ? t(g.sandbox ? 'drag.recycleFree' : 'drag.recycle', { n: TYPES[detail.type].cost }) : detail.error ? errorText(detail.error, { type: detail.type, n: TYPES[detail.type].limit }) : t('drag.drop');
      }
      if (event === 'idle') el('dragstatus').hidden = true;
      const metric = { place: 'formation_place', move: 'formation_move', remove: 'formation_remove', rejected: 'placement_rejected' }[event];
      if (metric) app.metrics.record(metric, { level: g.level + 1, sandbox: g.sandbox, type: detail.type, reason: detail.reason });
      update();
    }
  });

  // ---------- 按钮 ----------
  el('coach-skip').onclick = () => { save().guides[g.level] = true; app.metrics.record('guide_skip', { level: g.level + 1 }); app.persist(); update(); };
  el('b-inspect-close').onclick = () => { renderer.selectedPid = null; update(); };
  el('b-undo').onclick = () => { g.undo(); audio.sfx('undo'); update(); };
  el('b-erase').onclick = () => { eraser = !eraser; update(); };
  el('b-clear').onclick = () => { g.clear(); audio.sfx('recycle'); update(); };
  el('b-autofill').onclick = () => {
    g.beginStroke();
    for (const [type, x, y] of [['guard', 130, 365], ['guard', 260, 365], ['knight', 390, 365], ['archer', 110, 470], ['archer', 250, 470]]) g.place(type, x, y);
    if (g.sandbox) for (const u of LEVELS[2].enemies) g.place(u.type, u.x, u.y, 1);
    audio.sfx('place'); update();
  };
  function startBattle() {
    input.cancel(); const step = guideStep(g, flags());
    if (!g.start()) return;
    frameSamples = new FrameSamples(); renderer.selectedPid = null; hintOn = false; eraser = false;
    el('b-tray').style.height = `${el('b-tray').offsetHeight}px`; el('tray-build').hidden = true; el('tray-fight').hidden = false;
    app.metrics.record('battle_start', { level: g.level + 1, sandbox: g.sandbox, units: g.plan.filter(u => !u.team).length, spent: g.spent, item: g.selectedItem, speed });
    if (!g.sandbox && !save().guides[g.level] && step?.id && ['start', 'wall', 'area'].includes(step.id)) { save().guides[g.level] = true; app.metrics.record('guide_complete', { level: g.level + 1 }); app.persist(); }
    audio.sfx('start'); audio.music('battle'); buzz(25, true); update();
  }
  el('b-start').onclick = startBattle;
  el('b-pause').onclick = () => {
    if (beat && !shown) showResult();
    else if (g.phase === 'battle') { g.phase = 'paused'; targeting = false; renderer.reticle = null; }
    else if (g.phase === 'paused') g.phase = 'battle';
    update();
  };
  el('b-redeploy').onclick = () => reset(g.level, g.sandbox, g.plan);
  el('b-speed').onclick = () => { speed = speed === 2 ? 1 : 2; save().settings.speed = speed; app.persist(); update(); };
  el('b-use').onclick = () => {
    if (g.phase !== 'battle' || !g.canUseItem) return;
    if (g.itemNeedsTarget) { targeting = !targeting; if (!targeting) renderer.reticle = null; update(); return; }
    if (g.useItem()) { app.metrics.record('item_used', { level: g.level + 1, sandbox: g.sandbox, item: g.selectedItem, seconds: g.elapsed }); audio.sfx('item'); buzz(20, true); }
    update();
  };
  el('b-item').onclick = openItems;
  el('b-hint').onclick = openHint;
  el('b-back').onclick = () => {
    if (g.phase === 'build') return g.sandbox ? app.go('home') : app.go('map', { chapter: LEVELS[g.level].chapter });
    if (g.phase === 'battle') g.phase = 'paused';
    update(); openPause();
  };
  // 落雷符选点；胜负揭晓的停顿中轻点战场直接看战报。
  el('arena').addEventListener('pointerdown', e => {
    if (beat && !shown) { showResult(); return; }
    if (!targeting || g.phase !== 'battle') return;
    const p = renderer.point(e); if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) return;
    if (g.useItem(p)) { targeting = false; renderer.reticle = null; app.metrics.record('item_used', { level: g.level + 1, sandbox: g.sandbox, item: g.selectedItem, seconds: g.elapsed }); audio.sfx('item'); buzz(15, true); update(); }
  });
  el('arena').addEventListener('pointermove', e => { if (targeting && g.phase === 'battle') { const p = renderer.point(e); renderer.reticle = { x: p.x, y: p.y, r: ITEMS[g.selectedItem].radius || 60 }; } });

  // ---------- 弹层：道具、锦囊、暂停 ----------
  function openItems() {
    if (g.phase !== 'build') return; input.cancel();
    const recommended = g.sandbox ? null : LEVELS[g.level].recommendedItem;
    const sheet = openSheet({
      kicker: `${t('battle.item.pick')} · ${t('battle.item.once')}`, title: esc(t('item.pickTitle')),
      body: `<p class="muted">${esc(t('item.pickSub'))}</p><div class="options">${ITEM_ORDER.map(id => {
        const locked = !itemUnlocked(id, save().unlocked);
        return `<button class="option ${g.selectedItem === id ? 'chosen' : ''} ${locked ? 'locked' : ''}" data-item="${id}" ${locked ? 'disabled' : ''}>${img(`icons/item-${id}.webp`)}<span><b>${esc(itemName(id))}${g.selectedItem === id ? ` · ${esc(t('item.equipped'))}` : ''}${recommended === id && !locked ? ` <span class="chip gold">${esc(t('item.recommend'))}</span>` : ''}</b><small>${esc(locked ? t('item.unlockAt', { n: ITEMS[id].unlock }) : t(`item.${id}.desc`))}</small></span></button>`;
      }).join('')}</div>`
    });
    for (const b of $$('[data-item]', sheet)) b.onclick = () => {
      if (!g.selectItem(b.dataset.item)) return;
      flags().itemChosen = true; if (!g.sandbox) save().lessonActions[g.level] = { ...flags() };
      save().item = b.dataset.item; app.persist(); closeSheet(); update();
    };
  }
  function applyHint() {
    g.beginStroke(); g.plan = [];
    for (const [type, x, y] of SOLUTIONS[g.level].plan) g.place(type, x, y);
    hintOn = false; audio.sfx('place'); toast(t('hint.applied')); update();
  }
  function openHint() {
    if (g.phase !== 'build' || g.sandbox) return; input.cancel();
    const owned = !!save().hints[g.level], solution = SOLUTIONS[g.level], poor = save().coins < HINT_COST;
    const sheet = openSheet({
      kicker: esc(`${t('common.level', { n: g.level + 1 })} · ${pick(LEVELS[g.level].title)}`), title: esc(t('hint.title')),
      body: `<div class="daily-card">${img('icons/hint.webp')}<p>${esc(t('hint.text', { stars: solution.stars }))}</p></div>
        ${owned ? `<p class="muted" style="margin-top:10px">${esc(t('hint.owned'))}</p><div class="actions"><button class="btn btn-gold block" id="hint-apply">${esc(t('hint.apply'))}</button><button class="btn btn-paper block" id="hint-show">${esc(t('hint.show'))}</button></div>`
          : `<div class="actions"><button class="btn btn-gold block" id="hint-buy" ${poor ? 'disabled' : ''}>${poor ? esc(t('hint.poor', { n: HINT_COST })) : `${img('icons/coin.webp', 'coin-inline')} ${esc(t('hint.buy', { n: HINT_COST }))}`}</button></div><p class="muted" style="margin-top:10px;text-align:center">${img('icons/coin.webp', 'coin-inline')} ${save().coins}</p>`}`
    });
    if ($('#hint-buy', sheet)) $('#hint-buy', sheet).onclick = () => { if (buyHint(save(), g.level)) { app.persist(); audio.sfx('coin'); openHint(); } };
    if ($('#hint-apply', sheet)) $('#hint-apply', sheet).onclick = () => { closeSheet(); applyHint(); };
    if ($('#hint-show', sheet)) $('#hint-show', sheet).onclick = () => { hintOn = true; closeSheet(); toast(t('hint.ghosts'), 2600); update(); };
  }
  function openPause() {
    const sheet = openSheet({
      title: esc(t('pause.title')), onClose: () => update(),
      body: `<p class="muted">${esc(t('pause.keep'))}</p><div class="actions"><button class="btn btn-gold block" id="pause-resume">${esc(t('pause.resume'))}</button><button class="btn btn-paper block" id="pause-redeploy">${esc(t('pause.redeploy'))}</button><button class="btn btn-paper block" id="pause-exit">${esc(g.sandbox ? t('pause.home') : t('pause.map'))}</button></div>`
    });
    $('#pause-resume', sheet).onclick = () => { closeSheet(); if (g.phase === 'paused') g.phase = 'battle'; update(); };
    $('#pause-redeploy', sheet).onclick = () => { closeSheet(); reset(g.level, g.sandbox, g.plan); };
    $('#pause-exit', sheet).onclick = () => { closeSheet(); const level = g.level, sandbox = g.sandbox, plan = g.plan; reset(level, sandbox, plan); sandbox ? app.go('home') : app.go('map', { chapter: LEVELS[level].chapter }); };
  }

  // ---------- 结算 ----------
  // 胜负一出就记录进度和奖励；战报在短暂停顿后再弹出，停顿中离开也不会丢星。
  function finalize() {
    const review = report(g), key = `${rosterKey(g)}:${g.selectedItem}`, previous = lastAttempts.get(key);
    const survivors = g.units.filter(u => u.team === 0 && u.hp > 0).length, deployed = g.units.filter(u => u.team === 0).length;
    const comparison = previous ? t('result.compare', { a: previous.survivors, b: survivors, c: previous.time.toFixed(1), d: g.elapsed.toFixed(1) }) : '';
    lastAttempts.set(key, { survivors, time: g.elapsed });
    const won = g.phase === 'won', spotlight = !g.sandbox ? SPOTLIGHTS[g.level] : null, medalNow = !!spotlight?.check(g), hadMedal = !!save().medals[g.level];
    const summary = recordBattle(save(), g, { medal: medalNow });
    app.persist();
    app.metrics.record('performance', { level: g.level + 1, ...frameSamples.result() });
    app.metrics.record('battle_end', { level: g.level + 1, sandbox: g.sandbox, outcome: g.phase, seconds: g.elapsed, survivors, stars: summary.stars, spent: g.spent, item: g.selectedItem, speed });
    audio.music(null); audio.sfx(won ? 'won' : 'lost'); buzz(won ? [18, 50, 30] : 70, true);
    return { review, survivors, deployed, comparison, won, spotlight, medalNow, hadMedal, summary, timeout: !won && g.elapsed >= 80 };
  }
  function showResult() {
    if (!beat || shown) return; shown = true; update();
    const { review, survivors, deployed, comparison, won, spotlight, medalNow, hadMedal, summary, timeout } = beat.summary;
    const level = g.level, sandbox = g.sandbox, last = level === LEVELS.length - 1, next = won && !sandbox && !last;
    const coin = n => `<b>+${n} ${img('icons/coin.webp')}</b>`;
    const rewards = [];
    if (summary.firstClear) rewards.push([t('result.firstClear'), REWARDS.firstClear]);
    if (summary.newStars) rewards.push([t('result.newStars', { n: summary.newStars }), summary.newStars * REWARDS.star]);
    if (summary.medal) rewards.push([t('result.medal'), REWARDS.medal]);
    if (summary.daily) rewards.push([t('result.daily'), REWARDS.daily]);
    for (const a of summary.achievements) rewards.push([t('result.achievement', { name: t(`ach.${a.id}.name`) }), a.reward]);
    const title = sandbox ? (won ? t('result.sandboxWin') : t('result.sandboxLose')) : won ? (last && Object.keys(save().stars).length === LEVELS.length ? t('result.winFinal') : t('result.win')) : timeout ? t('result.timeout') : t('result.lose');
    const sub = sandbox ? t('result.sandboxSub') : won ? t('result.winSub') : timeout ? t('result.timeoutSub') : t('result.loseSub');
    const sheet = openSheet({
      className: 'result-sheet', onClose: () => reset(level, sandbox, g.plan),
      body: `<div class="result">
        ${img(won ? 'ui/victory.webp' : 'ui/defeat.webp', 'emblem')}
        <div class="kicker">${esc(sandbox ? t('battle.sandbox') : `${t('common.level', { n: level + 1 })} · ${pick(LEVELS[level].title)}`)}</div>
        <h2 id="sheet-title">${esc(title)}</h2>
        ${won && !sandbox ? `<div class="stars big-stars">${starsMarkup(summary.stars).replace(/^<span[^>]*>|<\/span>$/g, '')}</div>` : ''}
        <p class="muted">${esc(sub)}</p>
        <div class="statrow"><div><strong>${g.elapsed.toFixed(1)}s</strong><small>${esc(t('result.time'))}</small></div><div><strong>${survivors}/${deployed}</strong><small>${esc(t('result.survivors'))}</small></div><div><strong>${sandbox ? '—' : g.spent}</strong><small>${esc(t('result.ink'))}</small></div></div>
        ${rewards.length ? `<div class="rewards">${rewards.map(([name, n], i) => `<div class="row" style="animation-delay:${.15 + i * .12}s"><span>${esc(name)}</span>${coin(n)}</div>`).join('')}</div>` : won && !sandbox ? `<p class="muted">${esc(t('result.noReward'))}</p>` : ''}
        ${summary.unlockedUnits.map(type => `<div class="unlock-card"><canvas width="128" height="128" data-unit="${type}"></canvas><div><small>${esc(t('result.unlockUnit'))}</small><b>${esc(unitName(type))}</b><p>${esc(t(`unit.${type}.good`))}</p></div></div>`).join('')}
        ${summary.unlockedItems.map(id => `<div class="unlock-card">${img(`icons/item-${id}.webp`)}<div><small>${esc(t('result.unlockItem'))}</small><b>${esc(itemName(id))}</b><p>${esc(t(`item.${id}.short`))}</p></div></div>`).join('')}
        ${summary.chapterCleared !== null ? `<div class="box gold" style="margin:10px 0;font-weight:900">${esc(t('result.chapter', { n: summary.chapterCleared + 1, name: pick(CHAPTERS[summary.chapterCleared].name) }))}</div>` : ''}
        ${spotlight ? `<div class="box challenge ${medalNow || hadMedal ? 'done' : 'soft'}" style="text-align:left">${img('icons/trophy.webp')}<div><b>${esc(t(medalNow || hadMedal ? 'result.challengeDone' : 'result.challenge', { goal: t(`spot.${spotlight.id}.goal`) }))}</b><p class="muted">${esc(t(`spot.${spotlight.id}.desc`))}</p></div></div>` : ''}
        ${next ? `<p class="next-level"><b>${esc(t('result.nextTitle', { title: pick(LEVELS[level + 1].title) }))}</b><br>${esc(pick(LEVELS[level + 1].hint))}</p>` : ''}
        <div class="actions">
          ${next ? `<button class="btn btn-gold big block" id="r-next">${esc(t('result.next'))} ${icon('next')}</button>` : `<button class="btn btn-gold big block" id="r-retry">${esc(won ? t('result.retryKeep') : t('result.retry'))}</button>`}
          ${!won && !sandbox ? `<button class="btn btn-paper block" id="r-hint">${img('icons/hint.webp', 'coin-inline')} ${esc(t('result.hint'))}</button>` : ''}
        </div>
        <div class="actions ${next ? 'two' : ''}">${next ? `<button class="btn btn-paper small" id="r-retry">${esc(t('result.retryKeep'))}</button>` : ''}<button class="btn btn-paper small" id="r-exit">${esc(sandbox ? t('result.home') : t('result.map'))}</button></div>
        <details class="review" ${won ? '' : 'open'}><summary>${esc(t('result.review'))}</summary>
          ${review.observations.map(o => `<p>${esc(t(o.key, { ...o.params, name: o.params.type ? unitName(o.params.type) : undefined }))}</p>`).join('')}
          ${comparison ? `<p class="muted">${esc(comparison)}</p>` : ''}
          <p class="tip">${esc(t(review.tip.key, review.tip.params))}</p>
          ${review.rows.length ? `<table class="units"><thead><tr><th>${esc(t('result.tableUnit'))}</th><th>${esc(t('result.tableDealt'))}</th><th>${esc(t('result.tableTaken'))}</th><th>${esc(t('result.tableAlive'))}</th></tr></thead><tbody>${review.rows.map(r => `<tr><td>${esc(unitName(r.type))}</td><td>${r.healed > 0 ? `+${Math.round(r.healed)}` : Math.round(r.dealt)}</td><td>${Math.round(r.taken)}</td><td>${r.alive}/${r.total}</td></tr>`).join('')}</tbody></table>` : ''}
        </details></div>`
    });
    for (const c of $$('canvas[data-unit]', sheet)) paintUnit(c, c.dataset.unit, save().skin);
    if (won && !sandbox) for (let i = 0; i < summary.stars; i++) setTimeout(() => audio.sfx('star', i), 120 + i * 250);
    if (rewards.length) setTimeout(() => audio.sfx('coin'), 900);
    if (summary.unlockedUnits.length || summary.unlockedItems.length) setTimeout(() => audio.sfx('unlock'), 1200);
    const exit = fn => { closeSheet(true); fn(); };
    if ($('#r-next', sheet)) $('#r-next', sheet).onclick = () => exit(() => reset(level + 1, false));
    if ($('#r-retry', sheet)) $('#r-retry', sheet).onclick = () => exit(() => reset(level, sandbox, g.plan));
    if ($('#r-hint', sheet)) $('#r-hint', sheet).onclick = () => exit(() => { reset(level, sandbox, g.plan); openHint(); });
    $('#r-exit', sheet).onclick = () => exit(() => { reset(level, sandbox, g.plan); sandbox ? app.go('home') : app.go('map', { chapter: LEVELS[Math.min(LEVELS.length - 1, won ? level + 1 : level)].chapter }); });
  }

  // 把模拟里的表现事件变成震屏、震动和音效；只影响表现，不改变战斗。
  function feel(events) {
    const has = name => events.includes(name);
    if (has('thunder')) { renderer.kick(9); buzz([12, 30, 40], true); audio.sfx('thunder'); }
    if (has('boom')) { renderer.kick(6); buzz(22); audio.sfx('boom'); }
    else if (has('slam')) { renderer.kick(2.5); buzz(12); audio.sfx('slam'); }
    if (has('charge')) { renderer.kick(2); audio.sfx('charge'); }
    if (has('freeze')) audio.sfx('freeze');
    if (has('frost')) audio.sfx('frost');
    for (const name of ['shoot', 'toss', 'cast', 'thrust', 'mend']) if (has(name)) audio.sfx(name);
    if (has('swing')) audio.sfx('swing');
    if (has('block')) audio.sfx('block'); else if (has('hit')) audio.sfx('hit');
    if (has('death')) audio.sfx('death');
  }

  function frame(now, id) {
    if (!running || id !== loop) return;
    if (g.phase === 'battle' && !document.hidden) frameSamples.add(now - prev);
    const dt = Math.min(.05, (now - prev) / 1000); prev = now;
    // 选落点时放慢时间，方便瞄准。
    acc += dt * (g.phase === 'battle' ? (targeting ? .25 : speed) : 1);
    while (acc >= 1 / 60) { g.update(1 / 60); acc -= 1 / 60; }
    if (g.events.length) feel(g.events.splice(0));
    if (over() && !beat) { targeting = false; renderer.reticle = null; beat = { start: now, summary: finalize() }; update(); }
    // 停顿前0.14秒定格，随后以慢动作播完倒地与烟尘，再弹出战报。
    if (beat && !shown) { const age = (now - beat.start) / 1000; g.settle(age < .14 ? 0 : dt * (renderer.reduced ? 1 : .45)); if (age >= (renderer.reduced ? .6 : 1.25)) showResult(); }
    renderer.draw(g, now / 1000);
    uiClock += dt; if (uiClock > .1) { update(); uiClock = 0; }
    requestAnimationFrame(next => frame(next, id));
  }

  document.addEventListener('keydown', e => {
    if (app.screen !== 'battle' || sheetOpen() || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); if (g.phase === 'build') startBattle(); else el('b-pause').click(); }
    if (e.key.toLowerCase() === 'z' && g.phase === 'build') el('b-undo').click();
    if (e.key.toLowerCase() === 'f' && fighting()) el('b-speed').click();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { input.cancel(); if (g.phase === 'battle') { g.phase = 'paused'; targeting = false; renderer.reticle = null; update(); } } });

  return {
    enter, leave, relabel: () => { relabel(); update(); }, update, renderer,
    setSkin: skin => { renderer.skin = skin; repaintCards(); },
    setReduced: on => { renderer.reduced = on || matchMedia('(prefers-reduced-motion: reduce)').matches; },
    get game() { return g; }
  };
}
