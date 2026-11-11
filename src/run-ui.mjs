// 远征界面：开局选编制、分岔地图、战利品、军需官、营火、奇遇和结算。规则都在 run.mjs，这里只负责显示和点击。
import { CHAPTERS } from './data.mjs';
import { newRun, available, enter, choose, leave, buy, canBuy, camp, campOptions, eventChoices, resolveEvent, abandon, runPayout, mapOf, nodeOf, perksOf, handSize, WARBANDS, WARBAND_ORDER, CAMP, MIN_DECK } from './run.mjs';
import { CARDS, CARD_ORDER } from './cards.mjs';
import { cardName, cardFace } from './card-view.mjs';
import { RELICS } from './relics.mjs';
import { ROWS, ACT_THEMES } from './encounters.mjs';
import { recordRunEnd } from './meta.mjs';
import { paintUnit } from './render.mjs';
import { assetUrl } from './assets.mjs';
import { t, pick } from './i18n.mjs';
import * as audio from './audio.mjs';
import { $, $$, esc, icon, img, toast, openSheet, closeSheet, tipAttrs } from './ui.mjs';

const unitName = type => t(`unit.${type}.name`), relicName = id => t(`relic.${id}`);
const NODE_ICON = { battle: 'node-battle', elite: 'node-elite', boss: 'node-boss', event: 'node-event', shop: 'node-shop', camp: 'node-camp', treasure: 'chest' };
const nodeArt = kind => NODE_ICON[kind] === 'chest' ? 'icons/chest.webp' : `icons/${NODE_ICON[kind]}.webp`;
const hearts = r => `<span class="hearts">${Array.from({ length: r.maxHearts }, (_, i) => img('icons/heart.webp', i < r.hearts ? '' : 'lost')).join('')}</span>`;

// 一个奖励或商品的显示：类别、名字、说明和图。
export function optionView(o, perks = {}) {
  if (o.kind === 'card') { const { c, html } = cardFace(o, perks); return { kind: '', title: cardName(o.id, !!o.up), desc: '', art: '', face: html, cls: c.kind === 'tactic' ? 'tactic-card' : '', rare: CARDS[o.id].rarity === 'rare' }; }
  if (o.kind === 'service') return { kind: t('shop.service'), title: t(`shop.${o.service}`), desc: t(`shop.${o.service}.desc`), art: img(o.service === 'remove' ? 'icons/item-smoke.webp' : 'icons/star.webp') };
  if (o.kind === 'relic') return { kind: `${t('opt.kind.relic')} · ${t(`relic.${RELICS[o.id].tier}`)}`, title: relicName(o.id), desc: t(`relic.${o.id}.desc`), art: img(`icons/relic-${o.id}.webp`), rare: RELICS[o.id].tier === 'rare' };
  if (o.kind === 'ink') return { kind: t('opt.kind.ink'), title: t('opt.ink', { n: o.n }), desc: t('opt.ink.desc'), art: img('icons/ink.webp') };
  if (o.kind === 'coins') return { kind: t('opt.kind.coins'), title: t('opt.coins', { n: o.n }), desc: t('opt.coins.desc'), art: img('icons/coin.webp') };
  return { kind: t('opt.kind.heart'), title: t('opt.heart', { n: o.n }), desc: t('opt.heart.desc'), art: img('icons/heart.webp') };
}
function paintArt(root, skin) {
  for (const c of $$('canvas[data-unit]', root)) paintUnit(c, c.dataset.unit, skin);
}

// 牌库的简短列表：同名同级的牌合并成“名字 ×n”。
function deckChips(deck) {
  const groups = new Map();
  for (const e of deck) { const key = `${e.id}:${e.up}`; groups.set(key, { ...e, n: (groups.get(key)?.n || 0) + 1 }); }
  return [...groups.values()].map(e => `<span class="${CARDS[e.id].kind} ${e.up ? 'up' : ''}">${esc(cardName(e.id, e.up))}${e.n > 1 ? ` ×${e.n}` : ''}</span>`).join('');
}

export function createRunUI(app) {
  const run = () => app.save.run, skin = () => app.save.skin;
  const where = r => r.at === null ? t('run.where.start') : nodeOf(r, r.at).kind === 'boss' ? t('run.where.boss') : t('run.floor', { n: nodeOf(r, r.at).row + 1 });
  const chapterName = act => pick(CHAPTERS[Math.min(act, CHAPTERS.length - 1)].name);

  // ---------- 开局：选编制 ----------
  // 第一次远征不选编制，直接用铁卫营（教学打完、主页点“开始”都走这里）；打完一局以后才让玩家挑编制。
  function begin() {
    const r = run();
    if (r && r.screen !== 'over') { show(); return; }
    if (app.save.runStats.runs) { app.go('home'); openStart(); return; }
    app.save.run = newRun({ warband: 'iron' }); app.persist(); app.metrics.record('run_start', { warband: 'iron', first: true });
    closeSheet(true); audio.sfx('start'); show();
  }
  function openStart() {
    if (!app.save.runStats.runs && !(run() && run().screen !== 'over')) { begin(); return; }
    let chosen = 'iron';
    const draw = () => {
      const sheet = openSheet({
        className: 'wide', kicker: esc(t('run.new')), title: esc(t('run.warband')),
        body: `<p class="muted">${esc(t('run.warbandSub'))}</p>${run() && run().screen !== 'over' ? `<p class="muted" style="color:var(--red)">${esc(t('run.replace'))}</p>` : ''}
          <div class="warbands">${WARBAND_ORDER.map(id => { const w = WARBANDS[id]; return `<button class="warband ${id === chosen ? 'on' : ''}" data-band="${id}">
            <b>${esc(t(`warband.${id}`))}</b><div class="units">${[...new Set(w.deck.filter(c => CARDS[c].kind === 'unit').map(c => CARDS[c].type))].map(type => `<canvas width="108" height="108" data-unit="${type}" ${tipAttrs(unitName(type), t(`unit.${type}.role`))}></canvas>`).join('')}</div>
            <p>${esc(t(`warband.${id}.desc`))}</p>
            <div class="deck-list">${deckChips(w.deck.map(c => ({ id: c, up: false })))}</div>
            <div class="gear">${w.relics.map(r => `<span ${tipAttrs(relicName(r), t(`relic.${r}.desc`))}>${img(`icons/relic-${r}.webp`)}</span>${esc(relicName(r))}`).join('')}</div></button>`; }).join('')}</div>
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
    return `<div><h4>${esc(t('run.hearts'))}</h4>${hearts(r)}</div>
      <div><h4>${esc(t('deck.title'))} · ${esc(t('deck.count', { n: r.deck.length }))}</h4><div class="deck-list">${deckChips(r.deck)}</div>
        <button class="btn btn-paper small block" id="run-deck" style="margin-top:8px">${esc(t('deck.view'))}</button></div>
      <div><h4>${esc(t('run.relics'))}</h4>${r.relics.length ? `<div class="relic-row">${r.relics.map(id => `<span class="relic" ${tipAttrs(relicName(id), t(`relic.${id}.desc`))}>${img(`icons/relic-${id}.webp`)}</span>`).join('')}</div>` : `<p class="muted">${esc(t('run.noRelics'))}</p>`}</div>
      <div class="actions"><p class="muted">${esc(t('run.saved'))}</p><button class="btn btn-paper small block" id="run-abandon">${esc(t('run.abandon'))}</button></div>`;
  }
  // 牌库一览，兵牌在前、战术牌在后。不给 pick 时只看不点；给了 pick 就是按钮：filter 决定哪些牌能点，preview 显示升级后的样子。
  function deckGrid(r, pick = null) {
    const perks = perksOf(r), rank = e => (CARDS[e.id].kind === 'unit' ? 0 : 1000) + CARD_ORDER.indexOf(e.id) * 2 + (e.up ? 1 : 0);
    const order = r.deck.map((e, i) => ({ e, i })).sort((a, b) => rank(a.e) - rank(b.e));
    return `<div class="deck-grid">${order.map(({ e, i }) => {
      const ok = !pick?.filter || pick.filter(e), { c, html } = cardFace(pick?.preview && ok ? { ...e, up: true } : e, perks), cls = `pick ${c.kind === 'tactic' ? 'tactic-card' : ''} ${c.up ? 'up' : ''}`;
      return pick ? `<button class="${cls}" data-deck="${i}" ${ok ? '' : 'disabled'}>${html}</button>` : `<div class="${cls}">${html}</div>`;
    }).join('')}</div>`;
  }
  function openDeck() {
    const r = run(), sheet = openSheet({ className: 'wide full', title: `${esc(t('deck.title'))} · ${esc(t('deck.count', { n: r.deck.length }))}`, body: `<p class="muted">${esc(t('deck.note', { n: handSize(r) }))}</p>${deckGrid(r)}` });
    paintArt(sheet, skin());
  }
  // 从牌库里挑一张牌（删牌、升级）：点中就回调 done(牌库序号)；back 回到上一个窗口，什么都不花。
  function pickCard({ title, note, filter = null, preview = false, done, back }) {
    const r = run(), sheet = openSheet({ className: 'wide full', dismissable: false, title: esc(title), body: `<p class="muted">${esc(note)}</p>${deckGrid(r, { filter, preview })}<div class="actions"><button class="btn btn-paper" id="pick-back">${esc(t('common.back'))}</button></div>` });
    paintArt(sheet, skin());
    for (const b of $$('[data-deck]', sheet)) b.onclick = () => done(+b.dataset.deck);
    $('#pick-back', sheet).onclick = back;
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
    $('#run-deck').onclick = openDeck;
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
  // 奖励或商品按钮里的内容：卡牌是整张牌面，其他是类别、图标、名字和说明。
  const optionBody = v => v.face || `<span class="kind">${esc(v.kind)}</span>${v.art}<b>${esc(v.title)}</b><small>${esc(v.desc)}</small>`;
  function showReward() {
    const r = run(), p = r.pending, perks = perksOf(r), cards = p.options.some(o => o.kind === 'card'), two = p.options.length === 2;
    const title = { spoils: t('reward.spoils'), elite: t('reward.elite'), boss: t('reward.boss'), treasure: t('reward.treasure') }[p.kind] || t('reward.spoils');
    const rows = (p.coins ? `<div class="row"><span>${esc(t('run.coins'))}${p.bounty ? ` · ${esc(t('reward.bounty', { n: p.bounty }))}` : ''}</span><b>+${p.coins} ${img('icons/coin.webp')}</b></div>` : '')
      + (p.ink ? `<div class="row"><span>${esc(t('reward.ink'))}</span><b>+${p.ink} ${img('icons/ink.webp')}</b></div>` : '');
    const sheet = openSheet({
      className: 'wide', dismissable: false, kicker: esc(`${t('run.act', { n: r.act + 1 })} · ${chapterName(r.act)}`), title: esc(title),
      body: `${rows ? `<div class="rewards">${rows}</div>` : ''}
        ${p.kind === 'boss' ? `<p class="muted">${esc(t('reward.bossBonus'))}</p>` : ''}<p class="muted">${esc(t(cards ? 'reward.pickCard' : 'reward.pickOne'))}</p>
        <div class="picks" style="${two ? 'grid-template-columns:repeat(2,1fr)' : ''}">${p.options.map((o, i) => { const v = optionView(o, perks); return `<button class="pick ${v.cls || ''} ${v.rare ? 'rare' : ''}" data-pick="${i}">${optionBody(v)}</button>`; }).join('')}</div>
        <div class="actions"><button class="text-link" id="reward-skip">${esc(t(cards ? 'reward.skipCard' : 'reward.skip'))}</button></div>`
    });
    paintArt(sheet, skin());
    if (p.coins) audio.sfx('coin');
    for (const b of $$('[data-pick]', sheet)) b.onclick = () => {
      const o = r.pending.options[+b.dataset.pick];
      choose(r, +b.dataset.pick); app.persist(); closeSheet(true);
      toast(t(o.kind === 'card' ? 'toast.added' : 'toast.got', { name: optionView(o).title })); audio.sfx(o.kind === 'relic' ? 'unlock' : 'coin');
      show();
    };
    $('#reward-skip', sheet).onclick = () => { choose(r, -1); app.persist(); closeSheet(true); show(); };
  }
  function shopBlocked(r, s) {
    if (s.sold) return t('shop.sold');
    if (s.kind === 'heart' && r.hearts >= r.maxHearts) return t('shop.full');
    if (s.kind === 'relic' && r.relics.includes(s.id)) return t('shop.owned');
    if (s.kind === 'service' && s.service === 'remove' && r.deck.length <= MIN_DECK) return t('shop.minDeck', { n: MIN_DECK });
    if (s.kind === 'service' && s.service === 'upgrade' && r.deck.every(e => e.up)) return t('shop.allUp');
    return r.coins < s.price ? t('shop.poor') : '';
  }
  function showShop() {
    const r = run(), perks = perksOf(r), stock = r.pending.stock.map((s, i) => ({ s, i }));
    const ware = ({ s, i }) => {
      const v = optionView(s, perks), blocked = shopBlocked(r, s);
      return `<button class="pick ${v.cls || ''} ${s.sold ? 'sold' : ''} ${v.rare ? 'rare' : ''}" data-buy="${i}" ${canBuy(r, i) ? '' : 'disabled'} ${v.face ? '' : tipAttrs(v.title, v.desc)}>${optionBody(v)}<span class="price">${s.sold ? esc(blocked) : `${img('icons/coin.webp')}${s.price}`}</span>${blocked && !s.sold ? `<small class="why">${esc(blocked)}</small>` : ''}</button>`;
    };
    const sheet = openSheet({
      className: 'wide full', dismissable: false, title: `${img(nodeArt('shop'), 'coin-inline')} ${esc(t('shop.title'))}`,
      body: `<div class="shop-head"><p class="muted">${esc(t('shop.sub'))}</p><span class="pill">${img('icons/coin.webp')}${r.coins}</span></div>
        <div class="shop-grid">${stock.filter(x => x.s.kind === 'card').map(ware).join('')}</div>
        <div class="shop-grid">${stock.filter(x => x.s.kind !== 'card').map(ware).join('')}</div>
        <div class="actions"><button class="btn btn-gold big block" id="shop-leave">${esc(t('shop.leave'))} ${icon('next')}</button></div>`
    });
    paintArt(sheet, skin());
    for (const b of $$('[data-buy]', sheet)) b.onclick = () => {
      const i = +b.dataset.buy, s = r.pending.stock[i];
      if (s.kind === 'service') { shopService(i, s); return; }
      if (buy(r, i)) { app.persist(); audio.sfx('coin'); toast(t(s.kind === 'card' ? 'toast.added' : 'toast.bought', { name: optionView(s).title })); showShop(); render(); }
    };
    $('#shop-leave', sheet).onclick = () => { leave(r); app.persist(); closeSheet(true); show(); };
  }
  // 军需官的删牌和升级：先挑一张牌再付钱；点返回就不花钱。
  function shopService(i, s) {
    const r = run(), up = s.service === 'upgrade';
    pickCard({
      title: t(`shop.${s.service}`), note: t(up ? 'pick.upgradePaid' : 'pick.removePaid', { n: s.price }), filter: up ? e => !e.up : null, preview: up,
      done: d => { const name = cardName(r.deck[d].id); if (buy(r, i, d)) { app.persist(); audio.sfx(up ? 'unlock' : 'coin'); toast(t(up ? 'toast.upgraded' : 'toast.removed', { name })); render(); } showShop(); },
      back: showShop
    });
  }
  function showCamp() {
    const r = run(), opts = campOptions(r), art = { rest: 'icons/heart.webp', upgrade: 'icons/star.webp', remove: 'icons/item-smoke.webp' };
    const body = r.pending.done
      ? `<p>${esc(t('camp.done'))}</p><div class="actions"><button class="btn btn-gold big block" id="camp-leave">${esc(t('camp.leave'))} ${icon('next')}</button></div>`
      : `<p class="muted">${esc(t('camp.sub'))}</p><div class="picks">${opts.map(o => `<button class="pick" data-camp="${o.id}" ${o.ok ? '' : 'disabled'}><span class="kind">${esc(t('camp.title'))}</span>${img(art[o.id])}<b>${esc(t(`camp.${o.id}`))}</b><small>${esc(t(`camp.${o.id}.${o.ok ? 'desc' : 'no'}`, { n: o.id === 'rest' ? CAMP.rest : MIN_DECK }))}</small></button>`).join('')}</div>`;
    const sheet = openSheet({ className: 'wide', dismissable: false, title: `${img(nodeArt('camp'), 'coin-inline')} ${esc(t('camp.title'))}`, body });
    for (const b of $$('[data-camp]', sheet)) b.onclick = () => {
      const id = b.dataset.camp, up = id === 'upgrade';
      if (id === 'rest') { if (camp(r, 'rest')) { app.persist(); audio.sfx('unlock'); toast(t('opt.heart', { n: CAMP.rest })); render(); showCamp(); } return; }
      pickCard({
        title: t(`camp.${id}`), note: t(up ? 'pick.upgradeFree' : 'pick.removeFree'), filter: up ? e => !e.up : null, preview: up,
        done: d => { const name = cardName(r.deck[d].id); if (camp(r, id, d)) { app.persist(); audio.sfx('unlock'); toast(t(up ? 'toast.upgraded' : 'toast.removed', { name })); render(); } showCamp(); },
        back: showCamp
      });
    };
    if ($('#camp-leave', sheet)) $('#camp-leave', sheet).onclick = () => { leave(r); app.persist(); closeSheet(true); show(); };
  }
  // 奇遇里提到的牌：雇佣兵和补给箱给的新牌，或者书记官要升级的那张。
  const eventTarget = r => (r.pending.index !== undefined ? r.deck[r.pending.index] || null : null);
  function eventLabel(r, id) {
    const p = r.pending, target = eventTarget(r);
    return t(`event.${p.event}.${id}`, { name: p.card ? cardName(p.card) : target ? cardName(target.id) : '', relic: p.relic ? relicName(p.relic) : '' });
  }
  function showEvent() {
    const r = run(), p = r.pending, target = eventTarget(r);
    const shown = p.card ? { id: p.card, up: false } : target ? { ...target, up: true } : null, face = shown && cardFace(shown, perksOf(r));
    const sheet = openSheet({
      dismissable: false, kicker: esc(t('node.event')), title: esc(t(`event.${p.event}`)),
      body: `${img(nodeArt('event'), 'event-art')}<p>${esc(t(`event.${p.event}.text`))}</p>
        ${p.relic ? `<div class="option" style="margin-top:10px" ${tipAttrs(relicName(p.relic), t(`relic.${p.relic}.desc`))}>${img(`icons/relic-${p.relic}.webp`)}<span><b>${esc(relicName(p.relic))}</b><small>${esc(t(`relic.${p.relic}.desc`))}</small></span></div>` : ''}
        ${face ? `<div class="event-card"><div class="pick ${face.c.kind === 'tactic' ? 'tactic-card' : ''} ${shown.up ? 'up' : ''}">${face.html}</div></div>` : ''}
        <div class="actions">${eventChoices(r).map(c => `<button class="btn ${c.ok ? 'btn-gold' : 'btn-paper'} block" data-choice="${c.id}" ${c.ok ? '' : 'disabled'}>${esc(eventLabel(r, c.id))}</button>`).join('')}</div>`
    });
    paintArt(sheet, skin());
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
  return { show, openStart, render, begin };
}
