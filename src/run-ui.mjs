// 远征界面：开局选编制、分岔地图、战利品、军需官、营火、奇遇和结算。规则都在 run.mjs，这里只负责显示和点击。
import { UNIT_ORDER, CHAPTERS } from './data.mjs';
import { newRun, available, enter, choose, leave, buy, canBuy, camp, campOptions, eventChoices, resolveEvent, abandon, runPayout, mapOf, nodeOf, isFight, WARBANDS, WARBAND_ORDER, EVENTS, EVENT_GAIN, CAMP } from './run.mjs';
import { RELICS } from './relics.mjs';
import { ROWS, ACT_THEMES } from './encounters.mjs';
import { recordRunEnd } from './meta.mjs';
import { paintUnit } from './render.mjs';
import { assetUrl } from './assets.mjs';
import { t, pick } from './i18n.mjs';
import * as audio from './audio.mjs';
import { $, $$, esc, icon, img, toast, openSheet, closeSheet, tipAttrs } from './ui.mjs';

const unitName = type => t(`unit.${type}.name`), itemName = id => t(`item.${id}.name`), relicName = id => t(`relic.${id}`);
const NODE_ICON = { battle: 'node-battle', elite: 'node-elite', boss: 'node-boss', event: 'node-event', shop: 'node-shop', camp: 'node-camp', treasure: 'chest' };
const nodeArt = kind => NODE_ICON[kind] === 'chest' ? 'icons/chest.webp' : `icons/${NODE_ICON[kind]}.webp`;
const hearts = r => `<span class="hearts">${Array.from({ length: r.maxHearts }, (_, i) => img('icons/heart.webp', i < r.hearts ? '' : 'lost')).join('')}</span>`;

// 一个奖励或商品的显示：类别、名字、说明和图。
export function optionView(o) {
  if (o.kind === 'unit') return { kind: t('opt.kind.unit'), title: unitName(o.type), desc: t(`unit.${o.type}.good`), art: `<canvas width="168" height="168" data-unit="${o.type}"></canvas>` };
  if (o.kind === 'upgrade') return { kind: t('opt.kind.upgrade'), title: t('opt.upgrade', { name: unitName(o.type) }), desc: t(`upgrade.${o.type}`), art: `<canvas width="168" height="168" data-unit="${o.type}" data-elite="1"></canvas>` };
  if (o.kind === 'relic') return { kind: `${t('opt.kind.relic')} · ${t(`relic.${RELICS[o.id].tier}`)}`, title: relicName(o.id), desc: t(`relic.${o.id}.desc`), art: img(`icons/relic-${o.id}.webp`), rare: RELICS[o.id].tier === 'rare' };
  if (o.kind === 'item') return { kind: t('opt.kind.item'), title: t('opt.item', { name: itemName(o.id), n: o.n }), desc: t(`item.${o.id}.desc`), art: img(`icons/item-${o.id}.webp`) };
  if (o.kind === 'ink') return { kind: t('opt.kind.ink'), title: t('opt.ink', { n: o.n }), desc: t('opt.ink.desc'), art: img('icons/ink.webp') };
  if (o.kind === 'coins') return { kind: t('opt.kind.coins'), title: t('opt.coins', { n: o.n }), desc: t('opt.coins.desc'), art: img('icons/coin.webp') };
  return { kind: t('opt.kind.heart'), title: t('opt.heart', { n: o.n }), desc: t('opt.heart.desc'), art: img('icons/heart.webp') };
}
function paintArt(root, skin) {
  for (const c of $$('canvas[data-unit]', root)) {
    paintUnit(c, c.dataset.unit, skin);
    if (c.dataset.elite) { const g = c.getContext('2d'); g.font = `900 ${c.width * .26}px sans-serif`; g.fillStyle = '#ffcf4a'; g.strokeStyle = '#22304a'; g.lineWidth = c.width * .03; g.strokeText('★', c.width * .7, c.height * .3); g.fillText('★', c.width * .7, c.height * .3); }
  }
}

export function createRunUI(app) {
  const run = () => app.save.run, skin = () => app.save.skin;
  const where = r => r.at === null ? t('run.where.start') : nodeOf(r, r.at).kind === 'boss' ? t('run.where.boss') : t('run.floor', { n: nodeOf(r, r.at).row + 1 });
  const chapterName = act => pick(CHAPTERS[Math.min(act, CHAPTERS.length - 1)].name);

  // ---------- 开局：选编制 ----------
  function openStart() {
    let chosen = 'iron';
    const draw = () => {
      const sheet = openSheet({
        className: 'wide', kicker: esc(t('run.new')), title: esc(t('run.warband')),
        body: `<p class="muted">${esc(t('run.warbandSub'))}</p>${run() && run().screen !== 'over' ? `<p class="muted" style="color:var(--red)">${esc(t('run.replace'))}</p>` : ''}
          <div class="warbands">${WARBAND_ORDER.map(id => { const w = WARBANDS[id]; return `<button class="warband ${id === chosen ? 'on' : ''}" data-band="${id}">
            <b>${esc(t(`warband.${id}`))}</b><div class="units">${w.deck.map(type => `<canvas width="108" height="108" data-unit="${type}" ${tipAttrs(unitName(type), t(`unit.${type}.role`))}></canvas>`).join('')}</div>
            <p>${esc(t(`warband.${id}.desc`))}</p>
            <div class="gear">${w.relics.map(r => `<span ${tipAttrs(relicName(r), t(`relic.${r}.desc`))}>${img(`icons/relic-${r}.webp`)}</span>${esc(relicName(r))}`).join('')}</div>
            <div class="gear">${Object.entries(w.items).map(([item, n]) => `<span ${tipAttrs(itemName(item), t(`item.${item}.short`))}>${img(`icons/item-${item}.webp`)}</span>×${n}`).join(' ')}</div></button>`; }).join('')}</div>
          <div class="actions"><button class="btn btn-gold big block" id="run-start">${esc(t('run.start'))} ${icon('next')}</button></div>`
      });
      paintArt(sheet, skin());
      for (const b of $$('[data-band]', sheet)) b.onclick = () => { chosen = b.dataset.band; audio.sfx('pickup'); draw(); };
      $('#run-start', sheet).onclick = () => {
        if (run() && run().screen !== 'over') { abandon(run()); settle(run(), false); }
        app.save.run = newRun({ warband: chosen }); app.persist(); app.metrics.record('run_start', { warband: chosen });
        closeSheet(true); audio.sfx('start'); show();
      };
    };
    draw();
  }

  // ---------- 地图 ----------
  function graph(r) {
    const map = mapOf(r), W = 946, H = 626, x = row => 70 + row * (W - 140) / ROWS, y = lane => 64 + lane * (H - 128) / 3;
    const open = new Set(available(r)), path = new Set(r.path), here = r.at;
    // 还能走到的节点：从当前位置出发沿连线可达的节点。
    const reach = new Set(); const stack = r.at === null ? map.rows[0].map(n => n.id) : [...nodeOf(r, r.at).next];
    while (stack.length) { const id = stack.pop(); if (reach.has(id)) continue; reach.add(id); stack.push(...map.nodes.get(id).next); }
    const lines = [];
    for (const n of map.nodes.values()) for (const id of n.next) {
      const m = map.nodes.get(id), walked = path.has(n.id) && path.has(id) && r.path.indexOf(id) === r.path.indexOf(n.id) + 1, next = n.id === here && open.has(id);
      lines.push(`<line x1="${x(n.row)}" y1="${y(n.lane)}" x2="${x(m.row)}" y2="${y(m.lane)}" stroke="${walked ? '#e3a51c' : next ? '#22304a' : 'rgba(34,48,74,.45)'}" stroke-width="${walked ? 7 : next ? 5 : 3.5}" stroke-linecap="round" ${walked ? '' : `stroke-dasharray="${next ? '2 10' : '2 9'}"`}/>`);
    }
    const nodes = [...map.nodes.values()].map(n => {
      const cls = [n.kind === 'boss' ? 'boss' : '', n.kind === 'elite' ? 'elite' : '', open.has(n.id) ? 'open' : '', path.has(n.id) && n.id !== here ? 'done' : '', n.id === here ? 'here done' : '', !open.has(n.id) && !path.has(n.id) && !reach.has(n.id) ? 'skip' : ''].join(' ');
      return `<button class="rnode ${cls}" style="left:${x(n.row)}px;top:${y(n.lane)}px" data-node="${n.id}" ${open.has(n.id) ? '' : 'tabindex="-1"'} ${tipAttrs(t(`node.${n.kind}`), t(`node.${n.kind}.desc`))}>${img(nodeArt(n.kind))}</button>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">${lines.join('')}</svg>${nodes}`;
  }
  function side(r) {
    const items = Object.entries(r.items).filter(([, n]) => n > 0);
    return `<div><h4>${esc(t('run.hearts'))}</h4>${hearts(r)}</div>
      <div><h4>${esc(t('run.deck'))}</h4><div class="deck">${UNIT_ORDER.filter(u => r.deck.includes(u)).map(type => `<div class="unit" ${tipAttrs(unitName(type), r.upgrades.includes(type) ? `${t('upgrade.badge')}：${t(`upgrade.${type}`)}` : t(`unit.${type}.role`))}><canvas width="88" height="88" data-unit="${type}"></canvas>${esc(unitName(type))}${r.upgrades.includes(type) ? '<span class="elite">★</span>' : ''}</div>`).join('')}</div></div>
      <div><h4>${esc(t('run.relics'))}</h4>${r.relics.length ? `<div class="relic-row">${r.relics.map(id => `<span class="relic" ${tipAttrs(relicName(id), t(`relic.${id}.desc`))}>${img(`icons/relic-${id}.webp`)}</span>`).join('')}</div>` : `<p class="muted">${esc(t('run.noRelics'))}</p>`}</div>
      <div><h4>${esc(t('run.items'))}</h4>${items.length ? `<div class="items-row">${items.map(([id, n]) => `<span class="item-chip" ${tipAttrs(itemName(id), t(`item.${id}.desc`))}>${img(`icons/item-${id}.webp`)}<b>${n}</b></span>`).join('')}</div>` : `<p class="muted">${esc(t('run.noItems'))}</p>`}</div>
      <div class="actions"><p class="muted">${esc(t('run.saved'))}</p><button class="btn btn-paper small block" id="run-abandon">${esc(t('run.abandon'))}</button></div>`;
  }
  function render() {
    const r = run(), screen = $('#screen-run');
    const theme = ACT_THEMES[r.act] || 'meadow';
    screen.style.backgroundImage = `url(${assetUrl(`map/run-${theme}.webp`)}), url(${assetUrl(`map/${theme}.webp`)})`;
    screen.innerHTML = `
      <header class="run-top"><button class="ibtn dark" id="run-home" aria-label="${esc(t('run.home'))}">${icon('home')}</button>
        <div class="title"><small>${esc(t('run.title'))} · ${esc(t(`warband.${r.warband}`))}</small><strong>${esc(t('run.act', { n: r.act + 1 }))} · ${esc(chapterName(r.act))}</strong></div>
        <span class="stat" ${tipAttrs(t('run.hearts'))}>${img('icons/heart.webp')}${r.hearts}/${r.maxHearts}</span>
        <span class="stat" ${tipAttrs(t('run.ink'))}>${img('icons/ink.webp')}${r.ink}</span>
        <span class="stat" ${tipAttrs(t('run.coins'))}>${img('icons/coin.webp')}${r.coins}</span>
        <span class="spacer" style="flex:1"></span>
        ${r.screen === 'map' ? `<span class="stat">${esc(t('run.pick'))}</span>` : ''}</header>
      <div class="run-body"><div class="run-graph">${graph(r)}</div><aside class="run-side panel">${side(r)}</aside></div>`;
    paintArt(screen, skin());
    $('#run-home').onclick = () => app.go('home');
    $('#run-abandon').onclick = confirmAbandon;
    for (const b of $$('.rnode.open', screen)) b.onclick = () => pickNode(b.dataset.node);
  }
  function pickNode(id) {
    const r = run(); if (!enter(r, id)) return;
    app.persist(); app.metrics.record('run_node', { act: r.act + 1, kind: nodeOf(r, id).kind });
    audio.sfx('tap');
    if (r.screen === 'battle') { app.go('battle', { run: true }); return; }
    show();
  }
  function confirmAbandon() {
    const sheet = openSheet({ title: esc(t('run.abandon')), body: `<p>${esc(t('run.abandonConfirm'))}</p><div class="actions two"><button class="btn btn-paper" id="ab-no">${esc(t('common.cancel'))}</button><button class="btn btn-red" id="ab-yes">${esc(t('common.confirm'))}</button></div>` });
    $('#ab-no', sheet).onclick = () => closeSheet();
    $('#ab-yes', sheet).onclick = () => { abandon(run()); app.persist(); closeSheet(true); show(); };
  }

  // ---------- 节点弹窗 ----------
  function showReward() {
    const r = run(), p = r.pending, two = p.options.length === 2;
    const title = { spoils: t('reward.spoils'), elite: t('reward.elite'), boss: t('reward.boss'), treasure: t('reward.treasure') }[p.kind] || t('reward.spoils');
    const sheet = openSheet({
      className: 'wide', dismissable: false, kicker: esc(`${t('run.act', { n: r.act + 1 })} · ${chapterName(r.act)}`), title: esc(title),
      body: `${p.coins ? `<div class="rewards"><div class="row"><span>${esc(t('run.coins'))}${p.bounty ? ` · ${esc(t('reward.bounty', { n: p.bounty }))}` : ''}</span><b>+${p.coins} ${img('icons/coin.webp')}</b></div></div>` : ''}
        ${p.kind === 'boss' ? `<p class="muted">${esc(t('reward.bossBonus'))}</p>` : ''}<p class="muted">${esc(t('reward.pickOne'))}</p>
        <div class="picks" style="${two ? 'grid-template-columns:repeat(2,1fr)' : ''}">${p.options.map((o, i) => { const v = optionView(o); return `<button class="pick ${v.rare ? 'rare' : ''}" data-pick="${i}"><span class="kind">${esc(v.kind)}</span>${v.art}<b>${esc(v.title)}</b><small>${esc(v.desc)}</small></button>`; }).join('')}</div>
        <div class="actions"><button class="text-link" id="reward-skip">${esc(t('reward.skip'))}</button></div>`
    });
    paintArt(sheet, skin());
    if (p.coins) audio.sfx('coin');
    for (const b of $$('[data-pick]', sheet)) b.onclick = () => {
      const o = r.pending.options[+b.dataset.pick];
      choose(r, +b.dataset.pick); app.persist(); closeSheet(true);
      toast(t('toast.got', { name: optionView(o).title })); audio.sfx(o.kind === 'relic' ? 'unlock' : 'coin');
      show();
    };
    $('#reward-skip', sheet).onclick = () => { choose(r, -1); app.persist(); closeSheet(true); show(); };
  }
  function shopBlocked(r, s) { return s.sold ? t('shop.sold') : s.kind === 'heart' && r.hearts >= r.maxHearts ? t('shop.full') : (s.kind === 'unit' && r.deck.includes(s.type)) || (s.kind === 'relic' && r.relics.includes(s.id)) || (s.kind === 'upgrade' && r.upgrades.includes(s.type)) ? t('shop.owned') : r.coins < s.price ? t('shop.poor') : ''; }
  function showShop() {
    const r = run();
    const sheet = openSheet({
      className: 'wide', dismissable: false, title: `${img(nodeArt('shop'), 'coin-inline')} ${esc(t('shop.title'))}`,
      body: `<p class="muted">${esc(t('shop.sub'))}</p><p style="margin-top:6px"><span class="pill">${img('icons/coin.webp')}${r.coins}</span></p>
        <div class="shop-grid">${r.pending.stock.map((s, i) => { const v = optionView(s), blocked = shopBlocked(r, s); return `<button class="pick ${s.sold ? 'sold' : ''} ${v.rare ? 'rare' : ''}" data-buy="${i}" ${canBuy(r, i) ? '' : 'disabled'} ${tipAttrs(v.title, v.desc)}><span class="kind">${esc(v.kind)}</span>${v.art}<b>${esc(v.title)}</b><span class="price">${blocked && s.sold ? esc(blocked) : `${img('icons/coin.webp')}${s.price}`}</span>${blocked && !s.sold ? `<small>${esc(blocked)}</small>` : ''}</button>`; }).join('')}</div>
        <div class="actions"><button class="btn btn-gold big block" id="shop-leave">${esc(t('shop.leave'))} ${icon('next')}</button></div>`
    });
    paintArt(sheet, skin());
    for (const b of $$('[data-buy]', sheet)) b.onclick = () => { const s = r.pending.stock[+b.dataset.buy]; if (buy(r, +b.dataset.buy)) { app.persist(); audio.sfx('coin'); toast(t('toast.bought', { name: optionView(s).title })); showShop(); render(); } };
    $('#shop-leave', sheet).onclick = () => { leave(r); app.persist(); closeSheet(true); show(); };
  }
  function showCamp(picking = false) {
    const r = run(), done = r.pending.done, opts = campOptions(r);
    const body = picking
      ? `<p class="muted">${esc(t('camp.pick'))}</p><div class="picks">${r.deck.filter(type => !r.upgrades.includes(type)).map(type => `<button class="pick" data-train="${type}"><span class="kind">${esc(t('opt.kind.upgrade'))}</span><canvas width="168" height="168" data-unit="${type}" data-elite="1"></canvas><b>${esc(unitName(type))}</b><small>${esc(t(`upgrade.${type}`))}</small></button>`).join('')}</div><div class="actions"><button class="text-link" id="camp-back">${esc(t('common.back'))}</button></div>`
      : done ? `<p>${esc(t('camp.done'))}</p><div class="actions"><button class="btn btn-gold big block" id="camp-leave">${esc(t('camp.leave'))} ${icon('next')}</button></div>`
      : `<p class="muted">${esc(t('camp.sub'))}</p><div class="picks">${opts.map(o => `<button class="pick" data-camp="${o.id}" ${o.ok ? '' : 'disabled'}><span class="kind">${esc(t('camp.title'))}</span>${img(o.id === 'rest' ? 'icons/heart.webp' : o.id === 'study' ? 'icons/ink.webp' : nodeArt('battle'))}<b>${esc(t(`camp.${o.id}`))}</b><small>${esc(o.id === 'rest' && !o.ok ? t('camp.full') : t(`camp.${o.id}.desc`))}</small></button>`).join('')}</div>`;
    const sheet = openSheet({ className: 'wide', dismissable: false, title: `${img(nodeArt('camp'), 'coin-inline')} ${esc(t('camp.title'))}`, body });
    paintArt(sheet, skin());
    for (const b of $$('[data-camp]', sheet)) b.onclick = () => {
      if (b.dataset.camp === 'train') { showCamp(true); return; }
      if (camp(r, b.dataset.camp)) { app.persist(); audio.sfx('unlock'); toast(t(b.dataset.camp === 'rest' ? 'opt.heart' : 'opt.ink', { n: b.dataset.camp === 'rest' ? CAMP.rest : CAMP.study })); render(); showCamp(); }
    };
    for (const b of $$('[data-train]', sheet)) b.onclick = () => { if (camp(r, 'train', b.dataset.train)) { app.persist(); audio.sfx('unlock'); toast(t('toast.got', { name: t('opt.upgrade', { name: unitName(b.dataset.train) }) })); render(); showCamp(); } };
    if ($('#camp-back', sheet)) $('#camp-back', sheet).onclick = () => showCamp();
    if ($('#camp-leave', sheet)) $('#camp-leave', sheet).onclick = () => { leave(r); app.persist(); closeSheet(true); show(); };
  }
  function eventLabel(r, id) {
    const p = r.pending, key = `event.${p.event}.${id}`;
    return t(key, { name: p.unit ? unitName(p.unit) : p.upgrade ? unitName(p.upgrade) : '', relic: p.relic ? relicName(p.relic) : '', item: p.item ? itemName(p.item) : '' });
  }
  function showEvent() {
    const r = run(), p = r.pending;
    const sheet = openSheet({
      dismissable: false, kicker: esc(t('node.event')), title: esc(t(`event.${p.event}`)),
      body: `${img(nodeArt('event'), 'event-art')}<p>${esc(t(`event.${p.event}.text`))}</p>
        ${p.relic ? `<div class="option" style="margin-top:10px" ${tipAttrs(relicName(p.relic), t(`relic.${p.relic}.desc`))}>${img(`icons/relic-${p.relic}.webp`)}<span><b>${esc(relicName(p.relic))}</b><small>${esc(t(`relic.${p.relic}.desc`))}</small></span></div>` : ''}
        <div class="actions">${eventChoices(r).map(c => `<button class="btn ${c.ok ? 'btn-gold' : 'btn-paper'} block" data-choice="${c.id}" ${c.ok ? '' : 'disabled'}>${esc(eventLabel(r, c.id))}</button>`).join('')}</div>`
    });
    for (const b of $$('[data-choice]', sheet)) b.onclick = () => {
      const label = eventLabel(r, b.dataset.choice);
      if (resolveEvent(r, b.dataset.choice)) { app.persist(); closeSheet(true); audio.sfx('unlock'); toast(label, 2400); show(); }
    };
  }
  // 远征结束：把带回的金币记进主线，然后清掉这局；结算画面用一份快照显示。
  function settle(r, display = true) {
    const payout = runPayout(r), earned = recordRunEnd(app.save, r, payout), snapshot = structuredClone(r);
    app.save.run = null; app.persist(); app.announce(earned);
    app.metrics.record('run_end', { result: r.result, act: r.act + 1, nodes: r.stats.nodes, wins: r.stats.wins, payout });
    if (display) showOver(snapshot, payout);
  }
  function showOver(r, payout) {
    const key = r.result === 'victory' ? 'victory' : r.result === 'abandoned' ? 'abandoned' : 'defeat';
    const sheet = openSheet({
      dismissable: false, className: 'result-sheet',
      body: `<div class="result">${img(key === 'victory' ? 'ui/victory.webp' : 'ui/defeat.webp', 'emblem')}<div class="kicker">${esc(t('run.title'))} · ${esc(t(`warband.${r.warband}`))}</div>
        <h2 id="sheet-title">${esc(t(`run.over.${key}`))}</h2><p class="muted">${esc(t(`run.over.${key}Sub`))}</p>
        <div class="statrow four"><div><strong>${r.act + 1}</strong><small>${esc(t('run.stat.acts'))}</small></div><div><strong>${r.stats.nodes}</strong><small>${esc(t('run.stat.nodes'))}</small></div><div><strong>${r.stats.wins}</strong><small>${esc(t('run.stat.wins'))}</small></div><div><strong>${r.stats.kills}</strong><small>${esc(t('run.stat.kills'))}</small></div></div>
        ${r.relics.length ? `<div class="relic-row" style="justify-content:center">${r.relics.map(id => `<span class="relic" ${tipAttrs(relicName(id), t(`relic.${id}.desc`))}>${img(`icons/relic-${id}.webp`)}</span>`).join('')}</div>` : ''}
        <div class="rewards"><div class="row"><span>${esc(t('run.payout', { n: payout }))}</span><b>+${payout} ${img('icons/coin.webp')}</b></div></div>
        <p class="muted">${esc(t('run.records', { runs: app.save.runStats.runs, wins: app.save.runStats.wins }))}</p>
        <div class="actions two"><button class="btn btn-gold big" id="over-again">${esc(t('run.again'))}</button><button class="btn btn-paper big" id="over-home">${esc(t('run.toHome'))}</button></div></div>`
    });
    audio.sfx(key === 'victory' ? 'won' : 'lost');
    $('#over-again', sheet).onclick = () => { closeSheet(true); openStart(); };
    $('#over-home', sheet).onclick = () => { closeSheet(true); app.go('home'); };
  }

  // 根据远征状态显示对应画面：地图，或在地图上弹出当前节点的窗口。
  function show() {
    const r = run();
    if (!r) { app.go('home'); openStart(); return; }
    if (r.screen === 'battle') { app.go('battle', { run: true }); return; }
    if (r.screen === 'over') { app.go('home'); settle(r); return; }
    render(); app.show('run');
    if (r.screen === 'reward') showReward();
    else if (r.screen === 'shop') showShop();
    else if (r.screen === 'camp') showCamp();
    else if (r.screen === 'event') showEvent();
  }
  return { show, openStart, render };
}
