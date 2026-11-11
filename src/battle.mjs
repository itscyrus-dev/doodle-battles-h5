// 战斗界面（电脑版）：布阵、行军路线、开战、道具、引导和结算。战役、沙盒和远征共用；模拟在 engine.mjs。
import { Battle, TACTICS } from './engine.mjs';
import { TYPES, LEVELS, CHAPTERS, ITEMS, UNIT_ORDER, ITEM_ORDER, TEAM_LIMIT, W, H, TIME_LIMIT, starsFor, unitUnlocked, itemUnlocked } from './data.mjs';
import { Renderer, paintUnit } from './render.mjs';
import { PALETTES } from './assets.mjs';
import { FormationInput } from './formation-input.mjs';
import { report, rosterKey } from './battle-report.mjs';
import { guideStep, SPOTLIGHTS } from './first-session.mjs';
import { FrameSamples } from './playtest.mjs';
import { draftOf, applyDraft } from './drafts.mjs';
import { recordBattle, recordRunBattle, buyHint, HINT_COST, REWARDS } from './meta.mjs';
import { SOLUTIONS } from './solutions.mjs';
import { battleOf, finishBattle, canExtraDraw, extraDraw, canMulligan, mulligan } from './run.mjs';
import { HAND } from './cards.mjs';
import { cardName, kwName, cardText, cardArt } from './card-view.mjs';
import { BOSSES } from './encounters.mjs';
import { t, pick } from './i18n.mjs';
import * as audio from './audio.mjs';
import { $, $$, esc, icon, img, starsMarkup, toast, openSheet, closeSheet, sheetOpen, buzz, tipAttrs } from './ui.mjs';

const el = id => document.getElementById(id);
const unitName = type => t(`unit.${type}.name`);
const itemName = id => t(`item.${id}.name`);
const TOOLS = [['deploy', 'pen', 'Q'], ['route', 'route', 'W'], ['erase', 'eraser', 'E']];
export function createBattle(app) {
  const renderer = new Renderer(el('arena'));
  renderer.unitName = unitName;
  let g = new Battle(0), mode = 'campaign', ctx = null, selected = 'knight', shown = false, beat = null, targeting = false, quotaTeam = 0, hintOn = false;
  let running = false, loop = 0, prev = 0, acc = 0, uiClock = 0, lastGuideKey = '', frameSamples = new FrameSamples(), speed = 1;
  // 卡牌模式（远征）：armed 是选中准备放下的兵牌，used 是这一场已经打出的战术牌，casting 是正在选落点的战术牌。
  let armed = null, casting = null; const used = new Set();
  // 换关期间旧的 g 还在，这时刷新界面会把旧阵容存进新模式的草稿里，所以先挡住。
  let resetting = false;
  const lessonFlags = new Map(), lastAttempts = new Map();
  const save = () => app.save, run = () => app.save.run;
  const flags = () => { if (!lessonFlags.has(g.level)) lessonFlags.set(g.level, { ...save().lessonActions[g.level] }); return lessonFlags.get(g.level); };
  const over = () => g.phase === 'won' || g.phase === 'lost';
  const fighting = () => g.phase === 'battle' || g.phase === 'paused';
  const campaign = () => mode === 'campaign', inRun = () => mode === 'run';

  // ---------- 文案 ----------
  function errorText(code, params = {}) {
    return t(`err.${code}`, { n: code === 'team-full' ? g.teamLimit : params.n, name: params.type ? unitName(params.type) : '' });
  }
  function say(code, params = {}) {
    if (code === 'drag.back') toast(t('drag.back', { reason: errorText(params.reasonCode, params) }));
    else if (code.startsWith('drag.') || code.startsWith('route.')) toast(t(code, params));
    else toast(errorText(code, params));
  }
  function titles() {
    if (mode === 'sandbox') return [t('battle.sandboxSub'), t('battle.sandbox')];
    if (inRun()) { const r = run(), node = ctx.node; return [`${t('run.title')} · ${t('run.battleTitle', { act: r.act + 1, floor: node.row + 1 })}`, `${t(`node.${node.kind}`)} · ${pick(ctx.encounter.name)}`]; }
    return [`${t('map.chapter', { n: LEVELS[g.level].chapter + 1 })} · ${pick(CHAPTERS[LEVELS[g.level].chapter].name)}`, `${g.level + 1} · ${pick(LEVELS[g.level].title)}`];
  }
  function relabel() {
    renderer.words = {
      victory: mode === 'sandbox' ? t('result.sandboxWin') : t('battle.victory'), defeat: mode === 'sandbox' ? t('result.sandboxLose') : t('battle.defeat'), timeUp: t('battle.timeUp'),
      paused: t('battle.paused'), block: t('battle.block'), flank: t('battle.flank'), yourZone: t('battle.zone.yours'), enemyZone: mode === 'sandbox' ? t('battle.zone.red') : t('battle.zone.enemy')
    };
    el('b-back').innerHTML = icon('back'); el('b-back').setAttribute('aria-label', t('common.back'));
    el('b-undo').innerHTML = icon('undo'); el('b-undo').setAttribute('aria-label', t('battle.undo')); el('b-undo').dataset.tipTitle = `${t('battle.undo')} · Ctrl+Z`;
    el('b-clear').innerHTML = icon('trash'); el('b-clear').setAttribute('aria-label', t('battle.clear')); el('b-clear').dataset.tipTitle = t('battle.clear');
    el('coach-skip').textContent = t('guide.skip');
    el('recycle').textContent = t('recycle.zone');
    el('b-autofill').textContent = t('battle.autofill');
    el('b-redeploy').textContent = inRun() ? t('run.surrender') : t('battle.redeploy');
    el('arena').setAttribute('aria-label', t('battle.tip.build'));
    el('hud-blue-name').textContent = mode === 'sandbox' ? t('battle.blue') : t('battle.you'); el('hud-red-name').textContent = mode === 'sandbox' ? t('battle.red') : t('battle.enemy');
    const [kicker, name] = titles(); el('b-chapter').textContent = kicker; el('b-name').textContent = name;
    buildTools(); buildRoster(); buildIntel(); buildLoadout(); buildKeys();
  }

  // ---------- 左栏：三支笔和兵种卡 ----------
  function buildTools() {
    el('b-tools').innerHTML = TOOLS.filter(([id]) => !(inRun() && id === 'erase')).map(([id, ic, key]) => `<button class="tool ${id} ${input.tool === id ? 'on' : ''}" data-tool="${id}" ${tipAttrs(`${t(`tool.${id}`)} · ${key}`, t(`tool.${id}.tip`))}>${icon(ic)}<span>${esc(t(`tool.${id}`))}</span><kbd>${key}</kbd></button>`).join('');
    for (const b of $$('[data-tool]', el('b-tools'))) b.onclick = () => setTool(b.dataset.tool);
  }
  function setTool(tool) { input.setTool(tool); for (const b of $$('[data-tool]', el('b-tools'))) b.classList.toggle('on', b.dataset.tool === tool); update(); }
  function rosterTypes() {
    const unlocked = save().unlocked, types = UNIT_ORDER.filter(type => unitUnlocked(type, unlocked));
    if (mode === 'sandbox') return types;
    const teaser = UNIT_ORDER.find(type => !unitUnlocked(type, unlocked));
    return teaser ? [...types, teaser] : types;
  }
  // ---------- 卡牌模式：手牌 ----------
  const handCards = () => ctx?.hand || [];
  const playedCards = () => new Set(g.plan.filter(u => u.card !== undefined).map(u => u.card));
  function buildHand() {
    el('roster').className = 'roster hand';
    el('roster').innerHTML = handCards().map((c, i) => `<button class="hcard ${c.kind} ${c.up ? 'up' : ''}" data-hand="${c.index}" ${tipAttrs(`${cardName(c.id)}${c.up ? '+' : ''}`, cardText(c))}>
        <span class="key"><kbd>${i + 1}</kbd></span><span class="art">${cardArt(c)}</span>
        <span class="body"><b>${esc(cardName(c.id))}${c.up ? '+' : ''}</b><small>${c.kind === 'unit' ? `${esc(t(`unit.${c.type}.name`))} ×${c.n}` : esc(t('card.tactic'))}</small>${c.kw?.length ? `<i>${c.kw.map(k => esc(kwName(k))).join(' · ')}</i>` : ''}</span>
        <span class="cost ${c.kind}">${c.kind === 'unit' ? img('icons/ink.webp') : img('icons/momentum.webp')}${c.cost}</span><span class="state"></span></button>`).join('');
    for (const cv of $$('canvas[data-unit]', el('roster'))) paintUnit(cv, cv.dataset.unit, save().skin);
    for (const b of $$('[data-hand]', el('roster'))) b.onclick = () => useCard(+b.dataset.hand);
    el('b-handbar').hidden = false;
    el('b-handbar').innerHTML = `<button class="btn btn-paper small" id="b-extra"></button><button class="btn btn-paper small" id="b-mull"></button><span class="deck"></span>`;
    el('b-extra').onclick = () => { if (g.phase !== 'build' || !canExtraDraw(run())) return; disarm(); extraDraw(run()); app.persist(); const plan = currentDraft(); reset(g.level, false, plan); audio.sfx('pickup'); };
    el('b-mull').onclick = () => { if (g.phase !== 'build' || !canMulligan(run()) || playedCards().size) return; disarm(); mulligan(run()); app.persist(); reset(g.level, false, []); audio.sfx('pickup'); toast(t('hand.mulliganDone')); };
  }
  function disarm() { armed = null; input.arm(null); }
  // 点一张牌：布阵时兵牌是“选中 / 收回”，开战后战术牌是“打出”。
  function useCard(index) {
    const c = handCards().find(h => h.index === index); if (!c) return;
    if (g.phase === 'build') {
      if (c.kind === 'tactic') { toast(t('hand.waiting')); audio.sfx('invalid'); return; }
      if (playedCards().has(index)) { g.recallCard(index); disarm(); input.prune(); audio.sfx('recycle'); update(); return; }
      if (armed?.card === index) { disarm(); update(); return; }
      if (g.remaining < c.cost) { toast(t('err.ink')); audio.sfx('invalid'); return; }
      armed = { card: index, type: c.type, n: c.n, kw: c.kw, ink: c.cost }; input.arm(armed); input.setTool('deploy'); audio.sfx('pickup'); update(); return;
    }
    if (g.phase !== 'battle' || c.kind !== 'tactic' || used.has(index)) return;
    if (g.momentum < c.cost) { toast(t('hand.need', { n: c.cost - g.momentum })); audio.sfx('invalid'); return; }
    if (c.targeted) { casting = c; targeting = true; update(); return; }
    cast(c);
  }
  function cast(c, point = null) {
    if (!g.cast(c.effect, { up: c.up, cost: c.cost, point })) { toast(t('hand.noEffect')); audio.sfx('invalid'); return false; }
    used.add(c.index); casting = null; targeting = false; renderer.reticle = null;
    app.metrics.record('tactic_cast', { effect: c.effect, seconds: g.elapsed });
    audio.sfx('item'); buzz(20, true); update(); return true;
  }
  // 点战场放下选中的兵牌：整队按队形排好，放完自动选中这一队，方便接着画路线。
  function stamp(point) {
    if (!armed || g.phase !== 'build') return;
    const error = g.placeSquad(armed, Math.round(point.x), Math.round(point.y));
    if (error) { say(error); audio.sfx('invalid'); buzz(18); return; }
    const card = armed.card; disarm();
    input.setSelection(g.plan.filter(u => u.card === card).map(u => u.pid));
    audio.sfx('place'); buzz(8); el('b-inkpill').classList.remove('bump'); void el('b-inkpill').offsetWidth; el('b-inkpill').classList.add('bump');
    app.metrics.record('card_play', { card: handCards().find(h => h.index === card)?.id }); update();
  }
  const currentDraft = () => g.plan.filter(u => u.team === 0 && u.card !== undefined).map(u => ({ card: u.card, type: u.type, x: u.x, y: u.y, ...(u.route ? { route: u.route.map(p => ({ x: p.x, y: p.y })) } : {}), ...(u.hold ? { hold: true } : {}) }));
  // 读档或重打时，按存好的位置把打出过的牌放回去，路线和驻守也恢复。
  function restoreDraft(draft) {
    const byCard = new Map();
    for (const u of draft || []) { if (!byCard.has(u.card)) byCard.set(u.card, []); byCard.get(u.card).push(u); }
    for (const [card, units] of byCard) {
      const c = handCards().find(h => h.index === card); if (!c || c.kind !== 'unit') continue;
      if (g.placeSquad({ card, type: c.type, n: c.n, kw: c.kw, ink: c.cost }, units[0].x, units[0].y, 0, units.map(u => ({ x: u.x, y: u.y })))) continue;
      g.plan.filter(u => u.card === card).forEach((u, i) => units[i] && g.applyOrders(u.pid, units[i]));
    }
    g.history = [];
  }
  function refreshHand() {
    const build = g.phase === 'build', played = playedCards();
    for (const b of $$('[data-hand]', el('roster'))) {
      const c = handCards().find(h => h.index === +b.dataset.hand); if (!c) continue;
      const isPlayed = played.has(c.index), short = c.kind === 'unit' ? !isPlayed && c.cost > g.remaining : c.cost > g.momentum;
      b.classList.toggle('armed', armed?.card === c.index); b.classList.toggle('played', c.kind === 'unit' && isPlayed);
      b.classList.toggle('short', build ? c.kind === 'unit' && short : c.kind === 'tactic' && !used.has(c.index) && short);
      b.classList.toggle('used', !build && used.has(c.index)); b.classList.toggle('waiting', build ? c.kind === 'tactic' : c.kind === 'unit');
      b.classList.toggle('ready', !build && c.kind === 'tactic' && !used.has(c.index) && !short);
      b.querySelector('.state').textContent = build ? (isPlayed ? t('hand.played') : c.kind === 'tactic' ? t('hand.waiting') : '') : c.kind === 'tactic' ? (used.has(c.index) ? t('hand.used') : short ? t('hand.need', { n: c.cost - g.momentum }) : '') : '';
    }
    const r = run();
    const left = HAND.extraMax - r.extra, deckLine = $('.deck', el('b-handbar'));
    if (deckLine) deckLine.textContent = t('hand.deck', { n: r.deck.length, left });
    if (el('b-extra')) { Object.assign(el('b-extra').dataset, { tipTitle: t('hand.extraTitle'), tip: t('hand.extraTip', { n: HAND.extraCost, left }) }); el('b-extra').textContent = t('hand.extra', { n: HAND.extraCost }); el('b-extra').disabled = !build || !canExtraDraw(r) || g.remaining < HAND.extraCost; }
    if (el('b-mull')) { Object.assign(el('b-mull').dataset, { tipTitle: t('hand.mulligan'), tip: t('hand.mulliganTip') }); el('b-mull').textContent = r.mulligan ? t('hand.mulliganUsed') : t('hand.mulligan'); el('b-mull').disabled = !build || !canMulligan(r) || played.size > 0; }
  }

  function buildRoster() {
    if (inRun()) { buildHand(); return; }
    el('roster').className = 'roster'; el('b-handbar').hidden = true;
    const unlocked = save().unlocked;
    el('roster').innerHTML = rosterTypes().map((type, i) => {
      const locked = !inRun() && !unitUnlocked(type, unlocked), d = TYPES[type];
      const fresh = campaign() && !locked && d.unlock === g.level && d.unlock > 0 && !save().stars[g.level];
      const tipBody = `${t(`unit.${type}.role`)} · ${t(`unit.${type}.good`)}`;
      return `<button class="card ${locked ? 'locked' : ''} ${fresh ? 'is-new' : ''}" data-type="${type}" data-new="${esc(t('common.new'))}" ${locked ? 'disabled' : ''} ${tipAttrs(locked ? '???' : unitName(type), locked ? t('battle.unitLocked', { n: d.unlock + 1 }) : tipBody)}>
        ${locked ? '' : `<span class="key"><kbd>${i + 1}</kbd></span><span class="quota">0/${g.limit(type)}</span>`}
        <canvas width="104" height="104"></canvas><strong>${esc(locked ? '???' : unitName(type))}</strong>
        ${mode === 'sandbox' && !locked ? '' : `<small class="cost">${locked ? `${icon('lock')}${d.unlock + 1}` : `${img('icons/ink.webp')}${g.cost(type)}`}</small>`}</button>`;
    }).join('');
    repaintCards();
    if (!rosterTypes().includes(selected) || $(`#roster [data-type="${selected}"]`)?.disabled) selected = rosterTypes()[0];
  }
  function repaintCards() { for (const card of $$('#roster .card')) paintUnit(card.querySelector('canvas'), card.dataset.type, save().skin, { locked: card.disabled }); }

  // ---------- 右栏：敌情、道具、遗物、操作说明 ----------
  function buildIntel() {
    const enemies = mode === 'sandbox' ? [] : g.enemy, counts = UNIT_ORDER.map(type => [type, enemies.filter(u => u.type === type && !u.boss).length]).filter(([, n]) => n);
    const boss = enemies.find(u => u.boss), bossDef = inRun() && boss ? BOSSES[run().act % BOSSES.length] : null;
    let text = '';
    if (campaign()) text = `<div class="tagline">${esc(pick(LEVELS[g.level].tag))}</div><p class="muted">${esc(pick(LEVELS[g.level].hint))}</p>`;
    else if (inRun()) text = `<div class="tagline">${esc(t(`node.${ctx.node.kind}`))} · ${esc(pick(ctx.encounter.name))}</div>${bossDef ? `<p class="muted">${esc(t('intel.boss', { name: pick(bossDef.name) }))}</p>` : ''}${enemies.some(u => u.route || u.hold) ? `<p class="muted">${esc(t('intel.routes'))}</p>` : ''}`;
    else text = `<p class="muted">${esc(t('battle.tip.sandbox'))}</p>`;
    el('b-intel').innerHTML = mode === 'sandbox' ? `<h4>${esc(t('battle.sandbox'))}</h4>${text}` : `<h4>${esc(t('intel.title'))} · ${esc(t('intel.count', { n: enemies.length }))}</h4>
      <div class="lineup">${boss ? `<div class="mini boss" ${tipAttrs(unitName(boss.type), t(`unit.${boss.type}.role`))}><canvas width="84" height="84" data-unit="${boss.type}"></canvas><b>★</b></div>` : ''}${counts.map(([type, n]) => `<div class="mini" ${tipAttrs(unitName(type), t(`unit.${type}.role`))}><canvas width="84" height="84" data-unit="${type}"></canvas><b>×${n}</b></div>`).join('')}</div>${text}`;
    for (const c of $$('canvas[data-unit]', el('b-intel'))) paintUnit(c, c.dataset.unit, 'red', { flip: true });
  }
  function buildLoadout() {
    const box = el('b-loadout');
    if (inRun()) {
      const r = run();
      const relics = r.relics.map(id => `<span class="relic" ${tipAttrs(t(`relic.${id}`), t(`relic.${id}.desc`))}>${img(`icons/relic-${id}.webp`)}</span>`).join('');
      box.innerHTML = `<h4>${esc(t('momentum.name'))}</h4><p class="muted">${esc(t('momentum.tip'))}</p>${r.relics.length ? `<h4>${esc(t('relics.title'))}</h4><div class="relic-row">${relics}</div>` : ''}`;
      return;
    }
    const item = g.selectedItem;
    box.innerHTML = `<h4>${esc(t('loadout.title'))}</h4><button class="slot" id="b-item" ${tipAttrs(t('battle.item.pick'), t('battle.item.once'))}>${img(`icons/item-${item}.webp`)}<span><b>${esc(itemName(item))}</b><small>${esc(t(`item.${item}.short`))}</small></span></button>
      ${campaign() ? `<button class="btn btn-paper small block" id="b-hint">${img('icons/hint.webp', 'coin-inline')} ${esc(t('battle.hint'))}</button>` : ''}`;
    el('b-item').onclick = openItems;
    if (el('b-hint')) el('b-hint').onclick = openHint;
  }
  function buildKeys() {
    const row = (label, ...keys) => `<div class="row"><span>${esc(label)}</span><span>${keys.map(k => `<kbd>${esc(k)}</kbd>`).join('')}</span></div>`;
    el('b-keys').innerHTML = inRun()
      ? `<h4>${esc(t('keys.title'))}</h4>${row(t('keys.cards'), '1–9')}${row(t('keys.stamp'), t('mouse.leftClick'))}${row(t('keys.recall'), t('keys.recallKey'))}${row(t('keys.route'), t('mouse.right'))}${row(t('keys.hold'), 'H')}${row(t('keys.start'), 'Space')}${row(t('keys.undo'), 'Ctrl+Z')}`
      : `<h4>${esc(t('keys.title'))}</h4>${row(t('keys.paint'), t('mouse.left'))}${row(t('keys.route'), t('mouse.right'))}${row(t('keys.clear'), t('mouse.rightClick'))}${row(t('keys.hold'), 'H')}${row(t('keys.tools'), 'Q', 'W', 'E')}${row(t('keys.start'), 'Space')}${row(t('keys.undo'), 'Ctrl+Z')}`;
  }

  // ---------- 进入、重置 ----------
  function newBattle(level, sandbox) {
    if (inRun()) {
      ctx = battleOf(run());
      return new Battle(ctx.def, { mods: ctx.mods, item: null, cards: true, momentum: ctx.momentum });
    }
    ctx = null;
    return new Battle(level, sandbox);
  }
  function reset(level = g.level, sandbox = g.sandbox, plan = null) {
    resetting = true;
    input.cancel(); input.selection.clear(); renderer.selectedPid = null; renderer.hoverPid = null; renderer.reticle = null; renderer.clearEffects(); targeting = false; hintOn = false;
    armed = null; casting = null; used.clear(); input.arm(null);
    g = newBattle(level, sandbox);
    if (!inRun()) g.selectItem(itemUnlocked(save().item, save().unlocked) ? save().item : 'heal');
    if (inRun()) restoreDraft(plan ?? run().draft);
    else { g.plan = structuredClone(plan ?? (!sandbox ? save().formations[level] || [] : [])); for (const u of g.plan) u.pid ??= g.serial++; }
    g.serial = Math.max(0, ...g.plan.map(u => (u.pid ?? -1) + 1));
    globalThis.__game = g;
    shown = false; beat = null; quotaTeam = 0; speed = save().settings.speed;
    renderer.setTheme(inRun() ? ctx.encounter.theme : sandbox ? 'meadow' : CHAPTERS[LEVELS[level].chapter].id); renderer.skin = save().skin;
    if (campaign()) { save().currentLevel = level; app.persist(); if (level === 0 && !save().guides[0]) selected = 'guard'; }
    el('panel-build').hidden = false; el('panel-fight').hidden = true; el('b-left').classList.remove('locked');
    app.metrics.record('level_enter', { level: level + 1, sandbox, run: inRun() });
    audio.music('menu');
    resetting = false;
    relabel(); update();
  }
  function enter({ level = 0, sandbox = false, plan = null, run: isRun = false } = {}) {
    mode = isRun ? 'run' : sandbox ? 'sandbox' : 'campaign';
    app.show('battle');
    reset(level, sandbox, plan);
    renderer.resize();
    running = true; prev = performance.now(); acc = 0; const id = ++loop; requestAnimationFrame(now => frame(now, id));
  }
  function leave() { running = false; loop++; input.cancel(); if (g.phase === 'battle') g.phase = 'paused'; }
  function checkpoint() {
    if (g.phase !== 'build' || mode === 'sandbox') return;
    const draft = draftOf(g);
    if (inRun()) { const now = currentDraft(); if (JSON.stringify(now) !== JSON.stringify(run().draft)) { run().draft = now; app.persist(); } return; }
    const stored = (save().formations[g.level] || []).map(({ pid, ...u }) => u);
    if (JSON.stringify(draft) !== JSON.stringify(stored)) { save().formations[g.level] = draft; app.persist(); }
  }

  // ---------- 引导 ----------
  function updateGuide() {
    let step = campaign() && !save().guides[g.level] ? guideStep(g, flags()) : null;
    if (!step && inRun() && !save().tips.runcards && !g.plan.some(u => u.team === 0)) step = { id: 'runcards', title: 'guide.runcards.title', text: 'guide.runcards.text', target: 'roster' };
    if (!step && inRun() && !save().tips.runroute && g.plan.some(u => u.team === 0) && !g.plan.some(u => u.route)) step = { id: 'runroute', title: 'guide.runroute.title', text: 'guide.runroute.text', target: 'route' };
    el('coach').hidden = !step;
    const hint = hintOn && campaign() ? SOLUTIONS[g.level].plan.map(([type, x, y]) => ({ type, x, y, team: 0 })) : [];
    renderer.guideGhosts = step?.ghosts || hint;
    for (const [target, node] of [['roster', el('roster')], ['start', el('b-start')], ['item', el('b-loadout')], ['route', $('[data-tool="route"]')]]) node?.classList.toggle('coach-focus', step?.target === target);
    if (step) {
      el('coach-title').textContent = t(step.title); el('coach-text').textContent = t(step.text);
      const key = `${g.level}:${step.id}`; if (lastGuideKey !== key) { app.metrics.record('guide_step', { level: g.level + 1, step: step.id }); lastGuideKey = key; }
    }
    return step;
  }

  // ---------- 刷新界面 ----------
  function tipText(lesson) {
    if (input.tool === 'erase') return t('battle.tip.eraser');
    if (input.selection.size) return t('battle.tip.selected', { n: input.selection.size });
    if (input.tool === 'route') return t('battle.tip.route');
    if (mode === 'sandbox') return t('battle.tip.sandbox');
    return g.plan.length ? `${unitName(selected)} · ${t(`unit.${selected}.role`)}` : t('battle.tip.build');
  }
  function update() {
    if (resetting) return;
    checkpoint();
    const build = g.phase === 'build', lesson = build ? updateGuide() : (el('coach').hidden = true, null);
    el('b-ink').textContent = mode === 'sandbox' ? '∞' : g.remaining; el('b-inkmax').textContent = mode === 'sandbox' ? '' : `/${g.budget}`;
    el('b-inkpill').classList.toggle('low', mode !== 'sandbox' && build && g.remaining < 10);
    el('b-status').innerHTML = inRun() ? `<span class="momentum ${build ? '' : 'live'}" ${tipAttrs(t('momentum.name'), t('momentum.tip'))}>${img('icons/momentum.webp')}<b>${g.momentum}</b>/${ctx.momentum.max}</span><span class="hearts" ${tipAttrs(t('run.hearts'))}>${Array.from({ length: run().maxHearts }, (_, i) => img('icons/heart.webp', i < run().hearts ? '' : 'lost')).join('')}</span><span class="pill">${img('icons/coin.webp')}${run().coins}</span>` : '';
    if (inRun()) { if (!build && armed) disarm(); refreshHand(); }

    const list = build ? [...g.plan, ...(mode === 'sandbox' ? [] : g.enemy)] : g.units.filter(u => u.hp > 0);
    const blue = list.filter(u => !u.team).length, red = list.filter(u => u.team).length;
    el('hud-blue').textContent = build ? `${blue}/${g.teamLimit}` : blue; el('hud-red').textContent = red;
    const share = team => { if (build) return 100; const all = g.units.filter(u => u.team === team), max = all.reduce((s, u) => s + u.max, 0); return max ? Math.round(all.reduce((s, u) => s + Math.max(0, u.hp), 0) / max * 100) : 0; };
    el('hud-blue-bar').style.width = `${share(0)}%`; el('hud-red-bar').style.width = `${share(1)}%`;
    el('hud-blue-bar').closest('.hud-team').style.setProperty('--team', PALETTES[save().skin]?.swatch || PALETTES.blue.swatch);
    el('hud-time').textContent = build ? t('battle.deploy') : g.phase === 'paused' ? t('battle.paused') : `${g.elapsed.toFixed(1)}s`;
    el('b-count').textContent = `${g.count(null, 0)}/${g.teamLimit}`;

    const inspection = build && !renderer.drag ? renderer.inspect(g) : null;
    el('b-inspect').hidden = !inspection;
    if (inspection) {
      const u = inspection.unit, status = t(`preview.${inspection.status}`), orders = u.hold ? t('preview.hold') : u.route ? t('preview.marching') : '';
      el('b-inspect-title').textContent = t('preview.title', { name: unitName(u.type), range: Math.round(inspection.range) });
      el('b-inspect-status').textContent = [orders, u.hold ? '' : status, t('preview.note')].filter(Boolean).join(' · ');
    }
    const feedback = g.feedback && g.feedback.until > g.elapsed && g.phase === 'battle' ? g.feedback : null;
    el('b-alert').hidden = !feedback || targeting;
    if (feedback) {
      el('b-alert').className = feedback.kind;
      el('b-alert').textContent = feedback.kind === 'rear' ? `! ${t('feedback.rear')}` : feedback.kind === 'tactic' ? t('feedback.item', { name: cardName(`t_${feedback.effect}`) }) : feedback.kind === 'item-end' ? t('feedback.itemEnd', { name: itemName(feedback.item) })
        : feedback.item === 'heal' ? t('feedback.heal', { targets: feedback.targets, amount: Math.round(feedback.amount) }) : t('feedback.item', { name: itemName(feedback.item) });
    }
    el('b-target').hidden = !(targeting && g.phase === 'battle'); el('b-target').textContent = casting ? t(`tactic.${casting.effect}.target`) : t('battle.item.target');
    el('arena').classList.toggle('targeting', targeting);
    el('b-tip').hidden = !build || !!lesson || !!inspection;
    el('b-tip').textContent = tipText(lesson);
    el('b-autofill').hidden = !build || g.plan.length > 0 || !!lesson?.ghosts || hintOn || inRun();

    el('b-start').disabled = !g.plan.some(u => u.team === 0) || (mode === 'sandbox' && !g.plan.some(u => u.team === 1));
    el('b-start').innerHTML = `${esc(t('battle.start'))} <kbd>Space</kbd>`;
    el('b-undo').disabled = !g.history.length || !build; el('b-clear').disabled = !g.plan.length || !build;
    el('b-left').classList.toggle('locked', !build && !inRun());

    if (!build) {
      const item = ITEMS[g.selectedItem], active = item ? g.effects[g.selectedItem] || 0 : 0, use = el('b-use'), ready = g.phase === 'battle' && g.canUseItem;
      use.hidden = !g.selectedItem || inRun();
      if (g.selectedItem && !inRun()) {
        use.disabled = !ready; use.classList.toggle('ready', ready && !targeting); use.classList.toggle('targeting', targeting);
        const status = targeting ? t('battle.item.target') : g.itemUsed ? (active > 0 ? t('battle.item.active', { n: active.toFixed(1) }) : t('battle.item.used')) : g.selectedItem === 'heal' && !g.canHeal && g.phase === 'battle' ? t('battle.item.none') : t('battle.item.use');
        use.innerHTML = `<span class="art">${img(`icons/item-${g.selectedItem}.webp`)}${active > 0 ? `<i class="ring" style="--left:${(active / item.duration * 100).toFixed(0)}%"></i>` : ''}</span><span><b>${esc(itemName(g.selectedItem))}</b><small>${esc(status)}</small></span>`;
      }
      el('b-pause').innerHTML = beat && !shown ? esc(t('battle.report')) : `${esc(g.phase === 'paused' ? t('battle.resume') : t('battle.pause'))} <kbd>Space</kbd>`;
      el('b-pause').disabled = shown;
      el('b-speed').innerHTML = `${speed}× <kbd>F</kbd>`; el('b-speed').setAttribute('aria-pressed', String(speed === 2)); el('b-speed').disabled = !fighting();
      el('b-redeploy').disabled = !fighting();
      const alive = g.units.filter(u => u.team === 0 && u.hp > 0).length, total = g.units.filter(u => u.team === 0).length, foes = g.units.filter(u => u.team === 1 && u.hp > 0).length;
      el('b-live').innerHTML = `<div class="row"><span>${esc(t('battle.alive'))}</span><b>${alive}/${total}</b></div><div class="row"><span>${esc(t('battle.enemyLeft'))}</span><b>${foes}</b></div>`;
    }
    for (const card of $$('#roster .card')) {
      const type = card.dataset.type; if (card.classList.contains('locked')) continue;
      const count = g.count(type, quotaTeam), limit = g.limit(type, quotaTeam), full = count >= limit || g.count(null, quotaTeam) >= g.teamLimit;
      card.classList.toggle('selected', type === selected && input.tool === 'deploy'); card.classList.toggle('full', full);
      card.classList.toggle('unaffordable', mode !== 'sandbox' && !full && g.cost(type) > g.remaining);
      card.querySelector('.quota').textContent = `${count}/${limit}`;
      card.setAttribute('aria-label', t('battle.quota', { name: unitName(type), cost: g.cost(type), count, limit }));
    }
  }

  // ---------- 布阵手势 ----------
  const input = new FormationInput({
    canvas: el('arena'), roster: el('roster'), recycle: el('recycle'), renderer, getGame: () => g, getSelection: () => ({ type: selected }), onStamp: point => stamp(point),
    select: type => { if (selected !== type || input.tool !== 'deploy') { selected = type; if (input.tool === 'erase') setTool('deploy'); audio.sfx('pickup'); } }, say,
    onChange: (event, team, detail = {}) => {
      if (event === 'move') flags().moved = true;
      if (event === 'inspect' || (event === 'hover' && renderer.hoverPid !== null && renderer.hoverPid !== undefined)) flags().inspected = true;
      if ((event === 'move' || event === 'inspect' || (event === 'hover' && flags().inspected && !save().lessonActions[g.level]?.inspected)) && campaign()) { save().lessonActions[g.level] = { ...flags() }; app.persist(); }
      if (event === 'route' && inRun() && !save().tips.runroute) { save().tips.runroute = true; app.persist(); }
      if (team !== undefined && team !== null) quotaTeam = team;
      if (event === 'place') { audio.sfx('place'); buzz(8); el('b-inkpill').classList.remove('bump'); void el('b-inkpill').offsetWidth; el('b-inkpill').classList.add('bump'); }
      if (event === 'remove' || event === 'erase' || event === 'recall') audio.sfx('recycle');
      if (event === 'move') audio.sfx('place');
      if (event === 'route') audio.sfx('pickup');
      if (event === 'orders') audio.sfx('undo');
      if (event === 'rejected') { audio.sfx('invalid'); buzz(18); }
      if (event === 'drag') {
        const status = el('dragstatus'); status.hidden = false;
        status.textContent = detail.recycle ? t(mode === 'sandbox' ? 'drag.recycleFree' : 'drag.recycle', { n: g.cost(detail.type) }) : detail.error ? errorText(detail.error, { type: detail.type, n: g.limit(detail.type) }) : t('drag.drop');
      }
      if (event === 'idle') el('dragstatus').hidden = true;
      const metric = { place: 'formation_place', move: 'formation_move', remove: 'formation_remove', rejected: 'placement_rejected', route: 'formation_route' }[event];
      if (metric) app.metrics.record(metric, { level: g.level + 1, sandbox: g.sandbox, run: inRun(), type: detail.type, reason: detail.reason });
      update();
    }
  });

  // ---------- 按钮 ----------
  el('coach-skip').onclick = () => {
    if (inRun()) { if (!g.plan.some(u => u.team === 0)) save().tips.runcards = true; else save().tips.runroute = true; } else save().guides[g.level] = true;
    app.metrics.record('guide_skip', { level: g.level + 1 }); app.persist(); update();
  };
  el('b-undo').onclick = () => { g.undo(); input.prune(); disarm(); audio.sfx('undo'); update(); };
  el('b-clear').onclick = () => { g.clear(); input.setSelection([]); disarm(); audio.sfx('recycle'); update(); };
  el('b-autofill').onclick = () => {
    g.beginStroke();
    for (const [type, x, y] of [['guard', 305, 170], ['guard', 305, 300], ['knight', 305, 430], ['archer', 200, 150], ['archer', 200, 290]]) g.place(type, x, y);
    if (mode === 'sandbox') for (const u of LEVELS[2].enemies) g.place(u.type, u.x, u.y, 1);
    audio.sfx('place'); update();
  };
  function toggleHold() {
    const pids = input.selection.size ? [...input.selection] : renderer.hoverPid !== null && renderer.hoverPid !== undefined ? [renderer.hoverPid] : [];
    if (!pids.length) return;
    const on = !pids.every(pid => g.plan.find(u => u.pid === pid)?.hold);
    if (g.setHold(pids, on)) { audio.sfx(on ? 'place' : 'undo'); toast(t(on ? 'route.holdOn' : 'route.holdOff')); update(); }
  }
  function removeSelection() {
    if (!input.selection.size) return;
    // 卡牌模式：选中的士兵所在的牌整张收回。
    if (g.cardMode) { const cards = new Set(g.plan.filter(u => input.selection.has(u.pid)).map(u => u.card)); if (!cards.size) return; g.beginStroke(); g.plan = g.plan.filter(u => !cards.has(u.card)); input.setSelection([]); audio.sfx('recycle'); update(); return; }
    g.beginStroke(); const before = g.plan.length;
    g.plan = g.plan.filter(u => !input.selection.has(u.pid));
    if (g.plan.length !== before) { input.setSelection([]); audio.sfx('recycle'); update(); } else g.history.pop();
  }
  function startBattle() {
    input.cancel(); disarm(); const step = campaign() ? guideStep(g, flags()) : null;
    if (!g.start()) return;
    frameSamples = new FrameSamples(); renderer.selectedPid = null; renderer.hoverPid = null; hintOn = false; input.setSelection([]);
    el('panel-build').hidden = true; el('panel-fight').hidden = false;
    app.metrics.record('battle_start', { level: g.level + 1, sandbox: g.sandbox, run: inRun(), units: g.plan.filter(u => !u.team).length, routes: g.plan.filter(u => !u.team && u.route).length, spent: g.spent, item: g.selectedItem, speed });
    if (campaign() && !save().guides[g.level] && step?.id && ['start', 'wall', 'area'].includes(step.id)) { save().guides[g.level] = true; app.metrics.record('guide_complete', { level: g.level + 1 }); app.persist(); }
    audio.sfx('start'); audio.music('battle'); buzz(25, true); update();
  }
  el('b-start').onclick = startBattle;
  function togglePause() {
    if (beat && !shown) showResult();
    else if (g.phase === 'battle') { g.phase = 'paused'; targeting = false; renderer.reticle = null; }
    else if (g.phase === 'paused') g.phase = 'battle';
    update();
  }
  el('b-pause').onclick = togglePause;
  el('b-redeploy').onclick = () => {
    if (!fighting()) return;
    if (!inRun()) { reset(g.level, g.sandbox, g.plan); return; }
    const was = g.phase; g.phase = 'paused';
    const sheet = openSheet({ title: esc(t('run.surrender')), onClose: () => { if (g.phase === 'paused') g.phase = was; update(); },
      body: `<p>${esc(t('run.surrenderConfirm'))}</p><div class="actions two"><button class="btn btn-paper" id="sur-no">${esc(t('common.cancel'))}</button><button class="btn btn-red" id="sur-yes">${esc(t('common.confirm'))}</button></div>` });
    $('#sur-no', sheet).onclick = () => closeSheet();
    $('#sur-yes', sheet).onclick = () => { closeSheet(true); g.phase = 'lost'; g.events.push('lost'); update(); };
  };
  el('b-speed').onclick = () => { if (!fighting()) return; speed = speed === 2 ? 1 : 2; save().settings.speed = speed; app.persist(); update(); };
  function useItem() {
    if (g.phase !== 'battle' || !g.canUseItem) return;
    if (g.itemNeedsTarget) { targeting = !targeting; if (!targeting) renderer.reticle = null; update(); return; }
    if (g.useItem()) { app.metrics.record('item_used', { level: g.level + 1, sandbox: g.sandbox, item: g.selectedItem, seconds: g.elapsed }); audio.sfx('item'); buzz(20, true); }
    update();
  }
  el('b-use').onclick = useItem;
  el('b-back').onclick = () => {
    if (g.phase === 'build' && !inRun()) return mode === 'sandbox' ? app.go('home') : app.go('map', { chapter: LEVELS[g.level].chapter });
    if (g.phase === 'battle') g.phase = 'paused';
    update(); openPause();
  };
  // 落雷符选点；胜负揭晓的停顿中点击战场直接看战报。
  el('arena').addEventListener('pointerdown', e => {
    if (beat && !shown) { showResult(); return; }
    if (!targeting || g.phase !== 'battle' || e.button !== 0) return;
    const p = renderer.point(e); if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) return;
    if (casting) { cast(casting, p); return; }
    if (g.useItem(p)) { targeting = false; renderer.reticle = null; app.metrics.record('item_used', { level: g.level + 1, sandbox: g.sandbox, item: g.selectedItem, seconds: g.elapsed }); audio.sfx('item'); buzz(15, true); update(); }
  });
  el('arena').addEventListener('pointermove', e => { if (targeting && g.phase === 'battle') { const p = renderer.point(e); renderer.reticle = { x: p.x, y: p.y, r: casting ? (casting.effect === 'thunder' ? TACTICS.thunder.radius : 40) : ITEMS[g.selectedItem].radius || 60 }; } });

  // ---------- 弹窗：道具、锦囊、暂停 ----------
  function openItems() {
    if (g.phase !== 'build' || inRun()) return; input.cancel();
    const recommended = campaign() ? LEVELS[g.level].recommendedItem : null;
    const sheet = openSheet({
      kicker: `${t('battle.item.pick')} · ${t('battle.item.once')}`, title: esc(t('item.pickTitle')),
      body: `<p class="muted">${esc(t('item.pickSub'))}</p><div class="options">${ITEM_ORDER.map(id => {
        const locked = !itemUnlocked(id, save().unlocked);
        return `<button class="option ${g.selectedItem === id ? 'chosen' : ''} ${locked ? 'locked' : ''}" data-item="${id}" ${locked ? 'disabled' : ''}>${img(`icons/item-${id}.webp`)}<span><b>${esc(itemName(id))}${g.selectedItem === id ? ` · ${esc(t('item.equipped'))}` : ''}${recommended === id && !locked ? ` <span class="chip gold">${esc(t('item.recommend'))}</span>` : ''}</b><small>${esc(locked ? t('item.unlockAt', { n: ITEMS[id].unlock }) : t(`item.${id}.desc`))}</small></span></button>`;
      }).join('')}</div>`
    });
    for (const b of $$('[data-item]', sheet)) b.onclick = () => {
      if (!g.selectItem(b.dataset.item)) return;
      flags().itemChosen = true; if (campaign()) save().lessonActions[g.level] = { ...flags() };
      save().item = b.dataset.item; app.persist(); closeSheet(); buildLoadout(); update();
    };
  }
  function applyHint() {
    g.beginStroke(); g.plan = [];
    for (const [type, x, y] of SOLUTIONS[g.level].plan) g.place(type, x, y);
    hintOn = false; input.setSelection([]); audio.sfx('place'); toast(t('hint.applied')); update();
  }
  function openHint() {
    if (g.phase !== 'build' || !campaign()) return; input.cancel();
    const owned = !!save().hints[g.level], solution = SOLUTIONS[g.level], poor = save().coins < HINT_COST;
    const sheet = openSheet({
      kicker: esc(`${t('common.level', { n: g.level + 1 })} · ${pick(LEVELS[g.level].title)}`), title: esc(t('hint.title')),
      body: `<div class="daily-card">${img('icons/hint.webp')}<p>${esc(t('hint.text', { stars: solution.stars }))}</p></div>
        ${owned ? `<p class="muted" style="margin-top:10px">${esc(t('hint.owned'))}</p><div class="actions two"><button class="btn btn-gold" id="hint-apply">${esc(t('hint.apply'))}</button><button class="btn btn-paper" id="hint-show">${esc(t('hint.show'))}</button></div>`
          : `<div class="actions"><button class="btn btn-gold block" id="hint-buy" ${poor ? 'disabled' : ''}>${poor ? esc(t('hint.poor', { n: HINT_COST })) : `${img('icons/coin.webp', 'coin-inline')} ${esc(t('hint.buy', { n: HINT_COST }))}`}</button></div><p class="muted" style="margin-top:10px;text-align:center">${img('icons/coin.webp', 'coin-inline')} ${save().coins}</p>`}`
    });
    if ($('#hint-buy', sheet)) $('#hint-buy', sheet).onclick = () => { if (buyHint(save(), g.level)) { app.persist(); audio.sfx('coin'); openHint(); } };
    if ($('#hint-apply', sheet)) $('#hint-apply', sheet).onclick = () => { closeSheet(); applyHint(); };
    if ($('#hint-show', sheet)) $('#hint-show', sheet).onclick = () => { hintOn = true; closeSheet(); toast(t('hint.ghosts'), 2600); update(); };
  }
  // 远征里开战后不能中途离开（否则可以先看一遍再重来），只能继续或认输；布阵阶段可以回主页，进度已保存。
  function openPause() {
    const runFight = inRun() && fighting();
    const exitLabel = inRun() ? t('run.retreat') : mode === 'sandbox' ? t('pause.home') : t('pause.map');
    const sheet = openSheet({
      title: esc(t('pause.title')), onClose: () => update(),
      body: `<p class="muted">${esc(inRun() ? t('run.saved') : t('pause.keep'))}</p><div class="actions"><button class="btn btn-gold block" id="pause-resume">${esc(t('pause.resume'))}</button>${inRun() ? '' : `<button class="btn btn-paper block" id="pause-redeploy">${esc(t('pause.redeploy'))}</button>`}${runFight ? `<button class="btn btn-red block" id="pause-surrender">${esc(t('run.surrender'))}</button>` : `<button class="btn btn-paper block" id="pause-exit">${esc(exitLabel)}</button>`}</div>`
    });
    $('#pause-resume', sheet).onclick = () => { closeSheet(); if (g.phase === 'paused') g.phase = 'battle'; update(); };
    if ($('#pause-redeploy', sheet)) $('#pause-redeploy', sheet).onclick = () => { closeSheet(); reset(g.level, g.sandbox, g.plan); };
    if ($('#pause-surrender', sheet)) $('#pause-surrender', sheet).onclick = () => { closeSheet(true); g.phase = 'lost'; g.events.push('lost'); update(); };
    if ($('#pause-exit', sheet)) $('#pause-exit', sheet).onclick = () => {
      closeSheet();
      if (inRun()) { app.go('home'); return; }
      const level = g.level, sandbox = g.sandbox, plan = g.plan; reset(level, sandbox, plan); sandbox ? app.go('home') : app.go('map', { chapter: LEVELS[level].chapter });
    };
  }

  // ---------- 结算 ----------
  // 胜负一出就记录进度和奖励；战报在短暂停顿后再弹出，停顿中离开也不会丢星。
  function finalize() {
    const review = report(g), key = `${rosterKey(g)}:${g.selectedItem}`, previous = lastAttempts.get(key);
    const survivors = g.units.filter(u => u.team === 0 && u.hp > 0).length, deployed = g.units.filter(u => u.team === 0).length;
    const comparison = previous ? t('result.compare', { a: previous.survivors, b: survivors, c: previous.time.toFixed(1), d: g.elapsed.toFixed(1) }) : '';
    lastAttempts.set(key, { survivors, time: g.elapsed });
    const won = g.phase === 'won';
    app.metrics.record('performance', { level: g.level + 1, ...frameSamples.result() });
    audio.music(null); audio.sfx(won ? 'won' : 'lost'); buzz(won ? [18, 50, 30] : 70, true);
    if (inRun()) {
      const kind = ctx.node.kind, kills = g.units.filter(u => u.team === 1 && u.hp <= 0).length;
      const feats = featsOf(g);
      const result = finishBattle(run(), { won, survivors, deployed, stars: starsFor(g), kills, tactics: used.size, plan: g.plan });
      const achievements = recordRunBattle(save(), g, kind);
      app.persist(); app.announce(achievements);
      app.metrics.record('battle_end', { run: true, kind, outcome: g.phase, seconds: g.elapsed, survivors, routes: g.plan.filter(u => !u.team && u.route).length, cards: playedCards().size, tactics: used.size });
      return { review, survivors, deployed, comparison, won, result, kind, feats, timeout: !won && g.elapsed >= TIME_LIMIT };
    }
    const spotlight = campaign() ? SPOTLIGHTS[g.level] : null, medalNow = !!spotlight?.check(g), hadMedal = !!save().medals[g.level];
    const summary = recordBattle(save(), g, { medal: medalNow });
    app.persist();
    app.metrics.record('battle_end', { level: g.level + 1, sandbox: g.sandbox, outcome: g.phase, seconds: g.elapsed, survivors, stars: summary.stars, spent: g.spent, item: g.selectedItem, speed });
    return { review, survivors, deployed, comparison, won, spotlight, medalNow, hadMedal, summary, timeout: !won && g.elapsed >= TIME_LIMIT };
  }
  function reviewBlock(review, comparison, open) {
    return `<details class="review" ${open ? 'open' : ''}><summary>${esc(t('result.review'))}</summary>
      ${review.observations.map(o => `<p>${esc(t(o.key, { ...o.params, name: o.params.type ? unitName(o.params.type) : undefined }))}</p>`).join('')}
      ${comparison ? `<p class="muted">${esc(comparison)}</p>` : ''}
      <p class="tip">${esc(t(review.tip.key, review.tip.params))}</p>
      ${review.rows.length ? `<table class="units"><thead><tr><th>${esc(t('result.tableUnit'))}</th><th>${esc(t('result.tableDealt'))}</th><th>${esc(t('result.tableTaken'))}</th><th>${esc(t('result.tableAlive'))}</th></tr></thead><tbody>${review.rows.map(r => `<tr><td>${esc(unitName(r.type))}</td><td>${r.healed > 0 ? `+${Math.round(r.healed)}` : Math.round(r.dealt)}</td><td>${Math.round(r.taken)}</td><td>${r.alive}/${r.total}</td></tr>`).join('')}</tbody></table>` : ''}
    </details>`;
  }
  // 战功：这一场打出来的数字，给“越打越强”的反馈。
  function featsOf(game) {
    const mine = game.units.filter(u => u.team === 0), mvp = mine.reduce((a, b) => (b.damageDealt > (a?.damageDealt || 0) ? b : a), null);
    return {
      damage: Math.round(mine.reduce((s, u) => s + u.damageDealt, 0)), kills: game.units.filter(u => u.team === 1 && u.hp <= 0).length,
      flanks: game.relicStats.flanks, charges: game.relicStats.primed + game.stats[0].charges, tactics: game.relicStats.tactics, momentum: game.relicStats.momentum,
      routes: game.plan.filter(u => u.team === 0 && u.route).length, mvp: mvp && mvp.damageDealt > 0 ? { type: mvp.type, n: Math.round(mvp.damageDealt) } : null
    };
  }
  function featsBlock(f) {
    const cell = (n, key) => `<div><strong>${n}</strong><small>${esc(t(`feats.${key}`))}</small></div>`;
    return `<h3 style="margin:12px 0 6px">${esc(t('feats.title'))}</h3><div class="statrow four">${cell(f.damage, 'damage')}${cell(f.kills, 'kills')}${cell(f.charges + f.flanks, 'strikes')}${cell(f.tactics, 'tactics')}</div>
      ${f.mvp ? `<p class="muted">${esc(t('feats.mvp', { name: unitName(f.mvp.type), n: f.mvp.n }))}</p>` : ''}`;
  }
  function showRunResult() {
    const { review, survivors, deployed, comparison, won, result, feats } = beat.summary, r = run();
    const coin = n => `<b>+${n} ${img('icons/coin.webp')}</b>`;
    const overNow = r.screen === 'over';
    const title = won ? t('run.won.title') : overNow ? t('run.over.defeat') : t('run.lost.title');
    const sub = won ? t('run.won.sub') : overNow ? t('run.over.defeatSub') : t('run.lost.sub', { n: r.hearts });
    const sheet = openSheet({
      className: 'result-sheet', dismissable: false,
      body: `<div class="result">${img(won ? 'ui/victory.webp' : 'ui/defeat.webp', 'emblem')}
        <div class="kicker">${esc(titles()[1])}</div><h2 id="sheet-title">${esc(title)}</h2><p class="muted">${esc(sub)}</p>
        <div class="statrow"><div><strong>${g.elapsed.toFixed(1)}s</strong><small>${esc(t('result.time'))}</small></div><div><strong>${survivors}/${deployed}</strong><small>${esc(t('result.survivors'))}</small></div><div><strong><span class="hearts">${Array.from({ length: r.maxHearts }, (_, i) => img('icons/heart.webp', i < r.hearts ? '' : 'lost')).join('')}</span></strong><small>${esc(t('run.hearts'))}</small></div></div>
        ${featsBlock(feats)}
        ${won ? `<div class="rewards"><div class="row"><span>${esc(t(`node.${beat.summary.kind}`))}</span>${coin(result.coins)}</div>${result.ink ? `<div class="row"><span>${esc(t('reward.ink', { n: result.ink }))}</span><b>+${result.ink} ${img('icons/ink.webp')}</b></div>` : ''}${result.bounty ? `<div class="row"><span>${esc(t('reward.bounty', { n: result.bounty }))}</span><span></span></div>` : ''}</div>` : ''}
        <div class="actions">${won ? `<button class="btn btn-gold big block" id="r-go">${esc(t('run.toReward'))} ${icon('next')}</button>` : overNow ? `<button class="btn btn-red big block" id="r-go">${esc(t('run.toOver'))}</button>` : `<button class="btn btn-gold big block" id="r-retry">${esc(t('run.retry'))}</button>`}</div>
        ${reviewBlock(review, comparison, !won)}</div>`
    });
    if (won) setTimeout(() => audio.sfx('coin'), 700);
    const exit = fn => { closeSheet(true); fn(); };
    if ($('#r-go', sheet)) $('#r-go', sheet).onclick = () => exit(() => app.go('run'));
    if ($('#r-retry', sheet)) $('#r-retry', sheet).onclick = () => exit(() => reset(g.level, false, r.draft));
  }
  function showResult() {
    if (!beat || shown) return; shown = true; update();
    if (inRun()) { showRunResult(); return; }
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
        <div class="actions ${next ? 'two' : ''}">
          ${next ? `<button class="btn btn-gold big" id="r-next">${esc(t('result.next'))} ${icon('next')}</button><button class="btn btn-paper big" id="r-retry">${esc(t('result.retryKeep'))}</button>` : `<button class="btn btn-gold big block" id="r-retry">${esc(won ? t('result.retryKeep') : t('result.retry'))}</button>`}
        </div>
        <div class="actions two">${!won && !sandbox ? `<button class="btn btn-paper small" id="r-hint">${img('icons/hint.webp', 'coin-inline')} ${esc(t('result.hint'))}</button>` : '<span></span>'}<button class="btn btn-paper small" id="r-exit">${esc(sandbox ? t('result.home') : t('result.map'))}</button></div>
        ${reviewBlock(review, comparison, !won)}</div>`
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
    if (has('charge') || has('flank')) { renderer.kick(2); audio.sfx('charge'); }
    if (has('freeze')) audio.sfx('freeze');
    if (has('frost')) audio.sfx('frost');
    for (const name of ['shoot', 'toss', 'cast', 'thrust', 'mend']) if (has(name)) audio.sfx(name);
    if (has('swing')) audio.sfx('swing');
    if (has('block')) audio.sfx('block'); else if (has('hit')) audio.sfx('hit');
    if (has('death')) { audio.sfx('death'); buzz(10); }
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
    // 粒子跟随战斗的时间：暂停时停住，2 倍速时加快，结算停顿时放慢。
    renderer.timeScale = g.phase === 'paused' ? 0 : g.phase === 'battle' ? (targeting ? .25 : speed) : beat && !shown ? ((now - beat.start) / 1000 < .14 ? 0 : .45) : 1;
    renderer.draw(g, now / 1000);
    uiClock += dt; if (uiClock > .1) { update(); uiClock = 0; }
    requestAnimationFrame(next => frame(next, id));
  }

  document.addEventListener('keydown', e => {
    if (app.screen !== 'battle' || sheetOpen() || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    const key = e.key.toLowerCase(), build = g.phase === 'build', mod = e.ctrlKey || e.metaKey;
    // 刚点过的按钮还带着焦点，空格会再“点”它一次，所以先移开焦点。
    if (document.activeElement?.tagName === 'BUTTON') document.activeElement.blur();
    if (e.code === 'Space') { e.preventDefault(); if (e.repeat) return; if (build) startBattle(); else togglePause(); return; }
    if (key === 'escape') {
      if (input.active) input.cancel(); else if (armed) { disarm(); update(); } else if (targeting) { targeting = false; casting = null; renderer.reticle = null; update(); }
      else if (input.selection.size) input.setSelection([]); else el('b-back').click();
      return;
    }
    if (build) {
      if (key === 'z' && (mod || !e.shiftKey)) { e.preventDefault(); el('b-undo').click(); return; }
      if (key === 'q') setTool('deploy');
      if (key === 'w') setTool('route');
      if (key === 'e' && !inRun()) setTool('erase');
      if (key === 'h') toggleHold();
      if (key === 'delete' || key === 'backspace') { e.preventDefault(); removeSelection(); }
      if (key === 'a' && mod) { e.preventDefault(); input.setSelection(g.plan.filter(u => input.mine(u)).map(u => u.pid)); }
      if (inRun() && /^[1-9]$/.test(e.key)) { const c = handCards()[+e.key - 1]; if (c) useCard(c.index); return; }
      if (/^[1-8]$/.test(e.key)) { const type = rosterTypes()[+e.key - 1], card = type && $(`#roster [data-type="${type}"]`); if (card && !card.disabled) { selected = type; setTool('deploy'); audio.sfx('pickup'); update(); } }
      return;
    }
    if (key === 'f' && fighting()) el('b-speed').click();
    if (inRun() && /^[1-9]$/.test(e.key) && g.phase === 'battle') { const c = handCards()[+e.key - 1]; if (c) useCard(c.index); return; }
    if (key === 'r' && g.phase === 'battle' && !inRun()) useItem();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { input.cancel(); if (g.phase === 'battle') { g.phase = 'paused'; targeting = false; renderer.reticle = null; update(); } } });

  return {
    enter, leave, update, renderer,
    setSkin: skin => { renderer.skin = skin; repaintCards(); },
    setReduced: on => { renderer.reduced = on || matchMedia('(prefers-reduced-motion: reduce)').matches; },
    get game() { return g; }, get mode() { return mode; }
  };
}
