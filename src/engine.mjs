// 纯模拟：布阵校验、寻敌、移动、行军路线、攻击、道具与胜负。不依赖 DOM，固定步长，结果可复现。
import { TYPES, LEVELS, W, H, TEAM_LIMIT, ITEMS, TIME_LIMIT, ZONE, MARGIN } from './data.mjs';
import { ANGLE_TOLERANCE, wrapAngle, turnTowards, center, muzzle, segmentDistance } from './combat.mjs';
import { clearPath, nextWaypoint, resolveRocks } from './terrain.mjs';
import { shapeRoute, fitRoute, validRoute } from './routes.mjs';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const nearest = (from, list) => list.reduce((a, b) => (dist(a, from) < dist(b, from) ? a : b));
const ATTACK_SOUND = { archer: 'shoot', bomber: 'toss', giant: 'slam', mage: 'cast', lancer: 'thrust' };
const ARRIVE = 12; // 离路点这么近就算走到
// 遗物效果的数值。界面说明文字里的数字与这里一致。
export const RELIC_FX = { swift: 1.4, charge: 2, flank: 1.6, flankAngle: 2.1, anchor: .7, drum: { rate: 1.35, time: 6 }, bleed: { radius: 40, time: 4, slow: .6 }, spring: 1.5, echo: { per: 2, max: .25 }, fervor: { step: .06, max: .6 }, pact: .04 };
// 卡牌关键词：写在兵牌上，作用于这张牌放出的士兵。
export const KEYWORDS = {
  charge: { mult: 2 }, swift: { speed: 1.3 }, bulwark: { taken: .65 }, berserk: { below: .5, mult: 1.5 }, lifesteal: { ratio: .35 },
  inspire: { radius: 80, mult: 1.15 }, volley: { every: 3 }, frostbite: { chill: 1.2 }, veteran: { hp: 1.3 }
};
// 战术牌的效果。up 是升级后的数值。
export const TACTICS = {
  heal: { ratio: .25, up: .4 }, smoke: { duration: 4, up: 6 }, rally: { duration: 5, up: 7.5 }, thunder: { damage: 46, up: 69, radius: 60, delay: .45 },
  frost: { duration: 2.6, up: 3.9 }, reinforce: { type: 'knight', n: 2, up: 3 }, assault: { duration: 4, up: 6, speed: 1.4 }, shield: { amount: 20, up: 32 }
};
export const SQUAD_GAP = 36; // 一队士兵之间的间距

// 战斗修正：远征里的精锐升级、遗物和敌军强化。数字一律是倍率（没有该属性时按 1 计）；chargeMult 乘在冲锋倍率上。
// mods = { all, units: { knight: {...} }, enemy, cost: { knight: 9 }, limit: { bomber: 3 }, teamLimit, flags: { swift: true } }
function scale(d, m) {
  if (!m) return;
  for (const [k, v] of Object.entries(m)) {
    if (typeof v !== 'number') continue;
    if (k === 'chargeMult') { if (d.charge) d.charge = { ...d.charge, mult: d.charge.mult * v }; }
    else d[k] = (d[k] ?? 1) * v;
  }
}
export function unitDef(type, team, mods = null, boss = null) {
  const d = { ...TYPES[type] };
  if (team === 0) { scale(d, mods?.all); scale(d, mods?.units?.[type]); } else scale(d, mods?.enemy);
  if (boss) scale(d, boss);
  return d;
}

export class Battle {
  // level 可以是关卡序号，也可以直接传一份关卡数据。options 为 true 表示沙盒（兼容旧写法），
  // 或 { sandbox, mods, budget, item }。
  constructor(level = 0, options = false) {
    const def = typeof level === 'number' ? LEVELS[level] : level;
    const opts = options && typeof options === 'object' ? options : { sandbox: !!options };
    const sandbox = !!opts.sandbox;
    Object.assign(this, {
      level: typeof level === 'number' ? level : (def.index ?? -1), def, sandbox,
      plan: [], history: [], phase: 'build', units: [], shots: [], fx: [], events: [], pending: [], puddles: [],
      elapsed: 0, healed: false, serial: 0
    });
    this.mods = opts.mods || null;
    this.flags = this.mods?.flags || {};
    this.teamLimit = this.mods?.teamLimit ?? TEAM_LIMIT;
    this.budget = opts.budget ?? def.budget;
    this.enemy = structuredClone(def.enemies);
    this.rocks = sandbox ? [] : structuredClone(def.rocks || []);
    this.selectedItem = opts.item === undefined ? 'heal' : opts.item;
    // 卡牌模式（远征）：墨水按整张牌扣，不限兵种人数；战墨在战斗中靠击杀获得，用来打战术牌。
    this.cardMode = !!opts.cards;
    this.momentumRule = opts.momentum || null;
    this.momentum = 0;
    this.itemUsed = false;
    this.effects = { rally: 0, smoke: 0, frost: 0, assault: 0 };
  }

  cost(type, team = 0) { return team === 0 ? this.mods?.cost?.[type] ?? TYPES[type].cost : TYPES[type].cost; }
  limit(type, team = 0) { return this.cardMode && team === 0 ? Infinity : team === 0 ? this.mods?.limit?.[type] ?? TYPES[type].limit : TYPES[type].limit; }
  get spent() { return this.plan.filter(u => u.team === 0).reduce((s, u) => s + (u.inkCost ?? this.cost(u.type)), 0); }
  get remaining() { return this.budget - this.spent; }
  count(type, team = 0, ignoreId = null) {
    return this.plan.filter(u => u.team === team && (!type || u.type === type) && (ignoreId === null || u.pid !== ignoreId)).length;
  }
  beginStroke() {
    if (this.phase !== 'build') return;
    this.history.push(structuredClone(this.plan));
    if (this.history.length > 64) this.history.shift();
  }

  // 返回错误代码（空字符串表示可以放）；界面负责把代码翻译成当前语言。
  placementError(type, x, y, team = 0, ignoreId = null) {
    if (this.phase !== 'build') return 'phase';
    if (!TYPES[type] || ![0, 1].includes(team) || !Number.isFinite(x) || !Number.isFinite(y)) return 'invalid';
    if (x < MARGIN.side || x > W - MARGIN.side || y < MARGIN.top || y > H - MARGIN.bottom) return 'bounds';
    if ((!this.sandbox && (team !== 0 || x > ZONE.blue)) || (this.sandbox && ((team === 0 && x > ZONE.blue) || (team === 1 && x < ZONE.red)))) return team === 0 ? 'zone-blue' : 'zone-red';
    const blocker = this.rocks.find(o => Math.hypot(x - o.x, y - o.y) < o.r + TYPES[type].r + 3);
    if (blocker) return blocker.kind === 'pond' ? 'pond' : 'rock';
    if (this.count(null, team, ignoreId) >= (team === 0 ? this.teamLimit : TEAM_LIMIT)) return 'team-full';
    if (this.count(type, team, ignoreId) >= this.limit(type, team)) return 'type-full';
    const current = ignoreId === null ? null : this.plan.find(u => u.pid === ignoreId);
    if (!this.sandbox && !this.cardMode && this.remaining + (current?.team === 0 ? this.cost(current.type) : 0) < this.cost(type)) return 'ink';
    if (this.plan.some(u => (ignoreId === null || u.pid !== ignoreId) && Math.hypot(u.x - x, u.y - y) < Math.max(27, (TYPES[u.type].r + TYPES[type].r) * .9))) return 'overlap';
    return '';
  }
  place(type, x, y, team = 0) {
    if (this.placementError(type, x, y, team)) return false;
    this.plan.push({ type, x, y, team, pid: this.serial++, born: Date.now() / 1000 });
    return true;
  }
  // ---------- 卡牌模式：整队放下、整张收回 ----------
  // 一队士兵的站位：以落点为中心排成竖列，人多时排两列；放不下的位置就近找空位。
  squadSpots(type, n, x, y, team = 0) {
    const cols = n >= 4 ? 2 : 1, rows = Math.ceil(n / cols), spots = [], taken = [];
    const free = (px, py) => !this.placementError(type, px, py, team) && taken.every(q => Math.hypot(q.x - px, q.y - py) >= Math.max(27, TYPES[type].r * 1.8));
    for (let i = 0; i < n; i++) {
      const col = cols === 2 ? i % 2 : 0, row = cols === 2 ? Math.floor(i / 2) : i;
      const bx = x - col * SQUAD_GAP, by = y + (row - (rows - 1) / 2) * SQUAD_GAP;
      let spot = null;
      for (let ring = 0; ring <= 4 && !spot; ring++) for (let k = 0; k < Math.max(1, ring * 8) && !spot; k++) {
        const a = k / Math.max(1, ring * 8) * Math.PI * 2, px = Math.round(bx + Math.cos(a) * ring * 14), py = Math.round(by + Math.sin(a) * ring * 14);
        if (free(px, py)) spot = { x: px, y: py };
      }
      if (!spot) return null;
      spots.push(spot); taken.push(spot);
    }
    return spots;
  }
  // 打出一张兵牌：一次放下整队，墨水记在第一名士兵身上，card 是这张牌的编号。返回错误代码或空字符串。
  // spots 是存档里的原位置（读档、重打时用）；能原样放下就照原样，不能就从第一个位置重新排队。
  placeSquad({ card, type, n, kw = [], ink }, x, y, team = 0, saved = null) {
    if (this.phase !== 'build') return 'phase';
    if (this.plan.some(u => u.card === card)) return 'played';
    if (!this.sandbox && this.remaining < ink) return 'ink';
    if (this.count(null, team) + n > (team === 0 ? this.teamLimit : TEAM_LIMIT)) return 'team-full';
    let spots = null;
    if (saved?.length === n) {
      const taken = [];
      spots = saved.every(p => { const ok = !this.placementError(type, p.x, p.y, team) && taken.every(q => Math.hypot(q.x - p.x, q.y - p.y) >= 27); taken.push(p); return ok; }) ? saved.map(p => ({ x: p.x, y: p.y })) : null;
    }
    spots ??= this.squadSpots(type, n, x, y, team);
    if (!spots) { const e = this.placementError(type, x, y, team); return e && e !== 'overlap' ? e : 'crowded'; }
    this.beginStroke();
    spots.forEach((p, i) => this.plan.push({ type, x: p.x, y: p.y, team, pid: this.serial++, born: Date.now() / 1000, card, kw: [...kw], inkCost: i === 0 ? ink : 0 }));
    return '';
  }
  recallCard(card) {
    if (this.phase !== 'build' || !this.plan.some(u => u.card === card)) return false;
    this.beginStroke(); this.plan = this.plan.filter(u => u.card !== card); return true;
  }

  // 移动士兵时，它的路线跟着一起平移。
  move(pid, x, y) {
    const u = this.plan.find(u => u.pid === pid);
    if (!u || this.placementError(u.type, x, y, u.team, pid)) return false;
    if (Math.hypot(x - u.x, y - u.y) < .5) return true;
    this.beginStroke();
    if (u.route) { const route = fitRoute({ x, y }, u.route, x - u.x, y - u.y, this.rocks, TYPES[u.type].r); if (route.length) u.route = route; else delete u.route; }
    u.x = x; u.y = y; return true;
  }
  remove(pid) {
    if (this.phase !== 'build' || !this.plan.some(u => u.pid === pid)) return false;
    this.beginStroke(); this.plan = this.plan.filter(u => u.pid !== pid); return true;
  }
  erase(x, y) { if (this.phase === 'build') this.plan = this.plan.filter(u => Math.hypot(u.x - x, u.y - y) > 30); }
  undo() { if (this.phase === 'build' && this.history.length) this.plan = this.history.pop(); }
  clear() { if (this.phase === 'build') { this.beginStroke(); this.plan = []; } }

  // ---------- 行军路线与驻守 ----------
  // 路线按“起笔的那名士兵”画；同时下令的其他士兵按各自位置平移这条路线，保持队形。返回拿到路线的人数。
  setRoute(pids, points, anchorPid) {
    if (this.phase !== 'build') return 0;
    const anchor = this.plan.find(u => u.pid === anchorPid), path = shapeRoute(points);
    if (!anchor || path.length < 1) return 0;
    const units = this.plan.filter(u => pids.includes(u.pid) && (this.sandbox || u.team === 0));
    if (!units.length) return 0;
    this.beginStroke();
    let given = 0;
    for (const u of units) {
      const route = fitRoute(u, path, u.x - anchor.x, u.y - anchor.y, this.rocks, TYPES[u.type].r);
      if (route.length) { u.route = route; given++; } else delete u.route;
    }
    if (!given) this.history.pop();
    return given;
  }
  clearOrders(pids) {
    if (this.phase !== 'build') return false;
    const units = this.plan.filter(u => pids.includes(u.pid) && (u.route || u.hold));
    if (!units.length) return false;
    this.beginStroke();
    for (const u of units) { delete u.route; delete u.hold; }
    return true;
  }
  // 驻守：走完路线（或没有路线）后原地不动，只打射程内的敌人。
  setHold(pids, on) {
    if (this.phase !== 'build') return false;
    const units = this.plan.filter(u => pids.includes(u.pid) && (this.sandbox || u.team === 0) && !!u.hold !== on);
    if (!units.length) return false;
    this.beginStroke();
    for (const u of units) { if (on) u.hold = true; else delete u.hold; }
    return true;
  }
  // 存档里读到的命令：校验后直接套用，不记撤销。
  applyOrders(pid, { route, hold } = {}) {
    const u = this.plan.find(v => v.pid === pid); if (!u) return false;
    if (route !== undefined && validRoute(route)) { const fitted = fitRoute(u, route, 0, 0, this.rocks, TYPES[u.type].r); if (fitted.length) u.route = fitted; }
    if (hold) u.hold = true;
    return true;
  }

  // 把布阵或敌军数据变成战斗中的单位。echo、pact 是我方的伤害加成；兵牌关键词在这里转成查表用的对象。
  makeUnit(u, i, echo = 1, pact = 1) {
    const def = unitDef(u.type, u.team, this.mods, u.boss);
    if (echo !== 1 && u.team === 0) def.damage *= echo;
    if (pact !== 1 && u.team === 0) def.damage *= pact;
    const kw = u.kw?.length ? Object.fromEntries(u.kw.filter(k => KEYWORDS[k]).map(k => [k, true])) : null;
    if (kw?.veteran) def.hp *= KEYWORDS.veteran.hp;
    return {
      ...u, kw, id: i, def, hp: def.hp, max: def.hp,
      route: u.route?.length ? u.route.map(p => ({ x: p.x, y: p.y })) : null, leg: 0, hold: !!u.hold, legBest: Infinity, legStall: 0, primed: false,
      cool: .2 + (i % 5) * .07, flash: 0, swing: 0, walk: 0, moving: 0, angle: u.team === 0 ? 0 : Math.PI,
      windup: 0, windupTotal: 0, targetId: null, recoil: 0, hitAngle: 0, dx: u.team === 0 ? 1 : -1, dy: 0,
      damageDealt: 0, damageTaken: 0, deathAt: null, blockFlash: 0, threat: 0, chill: 0, run: 0, frozen: false, shield: 0, fervor: 0, volleyCount: 0
    };
  }

  start() {
    if (this.phase !== 'build' || !this.plan.some(u => u.team === 0) || !(this.sandbox ? this.plan.some(u => u.team === 1) : this.enemy.length)) return false;
    const echo = this.flags.echo ? 1 + Math.min(RELIC_FX.echo.max, Math.floor(Math.max(0, this.remaining) / RELIC_FX.echo.per) * .01) : 1;
    this.echoBonus = echo;
    // 墨契：这一场每打出一张兵牌，全体伤害 +4%。
    const cards = new Set(this.plan.filter(u => u.team === 0 && u.card !== undefined).map(u => u.card)).size;
    this.pactBonus = this.flags.pact ? 1 + RELIC_FX.pact * cards : 1;
    this.units = [...this.plan, ...(this.sandbox ? [] : this.enemy)].map((u, i) => this.makeUnit(u, i, echo, this.pactBonus));
    this.inspirers = this.units.filter(u => u.kw?.inspire);
    Object.assign(this, { phase: 'battle', elapsed: 0, healed: false, shots: [], fx: [], pending: [], puddles: [] });
    this.itemUsed = false;
    this.effects = { rally: 0, smoke: 0, frost: 0, assault: 0 };
    this.momentum = this.momentumRule ? this.momentumRule.start : 0; this.momentumClock = 0;
    this.itemStats = { healed: 0, prevented: 0, boostedAttacks: 0, struck: 0, strikeDamage: 0, frozen: 0 };
    this.relicStats = { spring: 0, flanks: 0, primed: 0, arrived: 0, tactics: 0, momentum: 0, lifesteal: 0, shielded: 0, volleys: 0, reinforced: 0 };
    this.feedback = null;
    this.stats = [0, 1].map(() => ({
      blocked: 0, explosionTaken: 0, damageTaken: 0, backlineDeaths: 0, stoneArrows: 0, arrowsFired: 0, charges: 0, chilled: 0, firstLoss: null,
      byType: Object.fromEntries(Object.keys(TYPES).map(type => [type, { dealt: 0, taken: 0, kills: 0, healed: 0 }]))
    }));
    return true;
  }

  selectItem(id) {
    if (this.phase !== 'build') return false;
    if (id === null) { this.selectedItem = null; return true; }
    if (typeof id !== 'string' || !Object.hasOwn(ITEMS, id)) return false;
    this.selectedItem = id; return true;
  }
  get canUseItem() { return this.phase === 'battle' && !!this.selectedItem && !this.itemUsed && (this.selectedItem !== 'heal' || this.canHeal); }
  get itemNeedsTarget() { return !!ITEMS[this.selectedItem]?.targeted; }
  // 需要落点的道具（落雷符）必须传入战场坐标。
  useItem(point = null) {
    if (!this.canUseItem) return false;
    const id = this.selectedItem, item = ITEMS[id];
    let detail = {};
    if (id === 'heal') {
      if (!this.heal()) return false;
      this.itemStats.healed = this.healSummary.amount;
      detail = { targets: this.healSummary.targets, amount: this.healSummary.amount };
    } else if (item.targeted) {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > W || point.y < 0 || point.y > H) return false;
      this.pending.push({ kind: id, x: point.x, y: point.y, t: item.delay, team: 0, damage: item.damage, radius: item.radius });
      this.effect(point.x, point.y, 'mark', 0, { life: item.delay, radius: item.radius });
    } else {
      this.effects[id] = item.duration;
      if (id === 'frost') { this.itemStats.frozen = this.units.filter(u => u.team === 1 && u.hp > 0).length; this.events.push('freeze'); }
    }
    this.itemUsed = true;
    this.say({ kind: 'item', item: id, ...detail }, 1.5);
    this.events.push('item');
    return true;
  }
  // 后排遇袭的提示优先级最高，其他提示不会盖掉它。
  say(feedback, seconds) {
    if (this.feedback && this.feedback.kind === 'rear' && this.feedback.until > this.elapsed && feedback.kind !== 'rear') return;
    this.feedback = { ...feedback, until: this.elapsed + seconds };
  }
  get canHeal() { return this.phase === 'battle' && !this.healed && this.units.some(u => u.team === 0 && u.hp > 0 && u.hp < u.max); }
  heal() {
    if (!this.canHeal) return false;
    this.healed = true; this.healSummary = { targets: 0, amount: 0 };
    for (const u of this.units) if (u.team === 0 && u.hp > 0 && u.hp < u.max) {
      const amount = Math.min(u.max - u.hp, u.max * ITEMS.heal.ratio); u.hp += amount;
      this.healSummary.targets++; this.healSummary.amount += amount; this.effect(u.x, u.y, 'heal');
    }
    return true;
  }

  effect(x, y, kind, team = 0, extra = {}) {
    const life = { death: .6, boom: .5, frostburst: .55, thunder: .5, healbeam: .35, charge: .36, flank: .5, primed: .45, arrive: .5, momentum: .8, shield: .45 }[kind] ?? .32;
    this.fx.push({ x, y, kind, team, t: 0, life, ...extra });
  }

  marching(u) { return !!u.route && u.leg < u.route.length; }
  holding(u) { return !!u.hold && !this.marching(u); }

  hit(u, amount, source, ranged = false) {
    if (u.hp <= 0) return;
    const def = u.def || TYPES[u.type];
    const blocked = !!def.rangedTaken && ranged, guardDamage = amount * (blocked ? def.rangedTaken : 1);
    const smoked = u.team === 0 && ranged && source?.type === 'archer' && this.effects.smoke > 0;
    const melee = !ranged && !source?.spell;
    const anchored = !!this.flags.anchor && u.team === 0 && this.holding(u), bulwark = !!u.kw?.bulwark && this.holding(u);
    let damage = guardDamage * (smoked ? ITEMS.smoke.arrowTaken : 1) * (anchored ? RELIC_FX.anchor : 1) * (melee && def.meleeTaken ? def.meleeTaken : 1) * (bulwark ? KEYWORDS.bulwark.taken : 1);
    if (u.shield > 0 && damage > 0) { const absorbed = Math.min(u.shield, damage); u.shield -= absorbed; damage -= absorbed; if (this.relicStats) this.relicStats.shielded += absorbed; }
    if (smoked) this.itemStats.prevented += guardDamage - guardDamage * ITEMS.smoke.arrowTaken;
    const actual = Math.min(u.hp, damage), stats = this.stats?.[u.team];
    if (stats) {
      stats.damageTaken += actual;
      if (blocked) stats.blocked += amount - guardDamage;
      if (source?.type === 'bomber') stats.explosionTaken += actual;
    }
    if (stats?.byType) { stats.byType[u.type].taken += actual; u.damageTaken += actual; }
    const ownerId = source?.ownerId ?? source?.id, owner = Number.isInteger(ownerId) ? this.units.find(v => v.id === ownerId) : null;
    if (owner && owner.team !== u.team) {
      owner.damageDealt += actual; this.stats[owner.team].byType[owner.type].dealt += actual;
      if (u.hp - damage <= 0) this.stats[owner.team].byType[owner.type].kills++;
      if (owner.kw?.lifesteal && owner.hp > 0 && actual > 0) { const add = Math.min(owner.max - owner.hp, actual * KEYWORDS.lifesteal.ratio); owner.hp += add; this.relicStats.lifesteal += add; }
    }
    if (source?.spell && this.itemStats) this.itemStats.strikeDamage += actual;
    if (blocked) { u.blockFlash = .24; this.events.push('block'); }
    if (melee && def.backline) {
      u.threat = .95;
      if (u.team === 0) this.say({ kind: 'rear' }, 1.6);
    }
    u.hp -= damage; u.flash = .13; u.recoil = .18;
    u.hitAngle = source ? Math.atan2(u.y - source.y, u.x - source.x) : 0;
    const p = center(u);
    this.effect(p.x, p.y, blocked ? 'block' : 'hit', u.team, { angle: u.hitAngle, actor: true, amount: Math.round(actual), big: actual >= 30 });
    this.events.push('hit');
    if (source) { u.x += Math.cos(u.hitAngle) * 4; u.y += Math.sin(u.hitAngle) * 4; }
    if (u.hp > 0 && owner?.kw?.frostbite && owner.team !== u.team) { if (u.chill <= 0) this.stats[u.team].chilled++; u.chill = Math.max(u.chill, KEYWORDS.frostbite.chill); }
    if (u.hp <= 0) {
      if (owner && owner.team !== u.team && owner.team === 0 && this.flags.fervor) owner.fervor = Math.min(RELIC_FX.fervor.max, owner.fervor + RELIC_FX.fervor.step);
      if (u.team === 1 && this.momentumRule) this.gainMomentum(this.momentumRule.perKill, u);
      u.deathAt = this.elapsed;
      if (stats && !stats.firstLoss) stats.firstLoss = { type: u.type, time: this.elapsed };
      if (stats && def.backline) stats.backlineDeaths++;
      this.effect(u.x, u.y, 'death', u.team, { unit: { ...u, waypoint: null } });
      this.events.push('death');
      if (this.flags.bleed && u.team === 0) { this.puddles.push({ x: u.x, y: u.y, r: RELIC_FX.bleed.radius, t: RELIC_FX.bleed.time, life: RELIC_FX.bleed.time }); this.events.push('bleed'); }
    }
  }

  // 关键词和遗物带来的攻击加成：狂暴（残血）、连斩（本场击杀叠加）、鼓舞（附近有旗手）。
  boost(u) {
    let k = 1;
    if (u.kw?.berserk && u.hp < u.max * KEYWORDS.berserk.below) k *= KEYWORDS.berserk.mult;
    if (u.fervor) k *= 1 + u.fervor;
    if (this.inspirers?.length && this.inspirers.some(v => v.hp > 0 && v.team === u.team && Math.hypot(v.x - u.x, v.y - u.y) <= KEYWORDS.inspire.radius)) k *= KEYWORDS.inspire.mult;
    return k;
  }
  gainMomentum(n, at = null) {
    const before = this.momentum;
    this.momentum = Math.min(this.momentumRule.max, this.momentum + n);
    if (this.momentum > before) { this.relicStats.momentum += this.momentum - before; this.events.push('momentum'); if (at) this.effect(at.x, at.y, 'momentum', 0, { n: this.momentum - before }); }
  }

  // 攻击者在目标身后（相对目标的朝向）时算侧击。
  behind(u, target) { return Math.abs(wrapAngle(Math.atan2(u.y - target.y, u.x - target.x) - target.angle)) > RELIC_FX.flankAngle; }

  attack(u, target) {
    const def = u.def;
    u.cool = def.cooldown; u.swing = def.projectile ? .22 : .28; u.windup = 0; u.windupTotal = 0; u.targetId = null;
    if (u.team === 0 && this.effects.rally > 0) this.itemStats.boostedAttacks++;
    let bonus = 1;
    if (u.primed) { bonus = RELIC_FX.charge; u.primed = false; this.relicStats.primed++; const p = center(u); this.effect(p.x, p.y, 'primed', u.team, { angle: u.angle }); }
    const boost = this.boost(u);
    // 表现事件只供音效、震屏和震动使用，不参与模拟。
    this.events.push('attack', ATTACK_SOUND[u.type] || 'swing');
    if (def.projectile) {
      if (u.type === 'archer') this.stats[u.team].arrowsFired++;
      const start = muzzle(u), end = center(target), angle = u.angle;
      const shot = {
        x: start.x, y: start.y, sx: start.x, sy: start.y, tx: end.x, ty: end.y, target: target.id,
        ownerId: u.id, angle, vx: Math.cos(angle), vy: Math.sin(angle), team: u.team, type: u.type, speed: def.projSpeed,
        damage: def.damage * bonus * boost, aoe: def.aoe, chill: def.chill, t: 0, distance: Math.hypot(end.x - start.x, end.y - start.y)
      };
      this.shots.push(shot);
      // 齐射：每第三次射击多射一支箭，跟在第一支后面。
      if (u.kw?.volley && def.projectile === 'arrow' && ++u.volleyCount % KEYWORDS.volley.every === 0) {
        const back = 16; this.shots.push({ ...shot, x: start.x - shot.vx * back, y: start.y - shot.vy * back, sx: start.x - shot.vx * back, sy: start.y - shot.vy * back, damage: def.damage * boost });
        this.relicStats.volleys++;
      }
      this.effect(start.x, start.y, 'release', u.team, { angle });
      return;
    }
    const charged = !!def.charge && u.run >= def.charge.time, p = center(u);
    let mult = charged ? def.charge.mult : 1;
    if (this.flags.flank && u.team === 0 && this.behind(u, target)) {
      mult *= RELIC_FX.flank; this.relicStats.flanks++;
      const q = center(target); this.effect(q.x, q.y, 'flank', u.team, { angle: u.angle });
      this.events.push('flank');
    }
    this.effect(p.x, p.y, charged ? 'charge' : 'slash', u.team, { angle: u.angle, heavy: u.type === 'giant' });
    this.hit(target, def.damage * mult * bonus * boost, u);
    if (charged) { this.stats[u.team].charges++; this.events.push('charge'); }
    u.run = 0;
  }

  // 沿可视图绕开障碍，朝目标移动一步。
  advance(u, def, goal, dt, speedScale) {
    u.navTime = (u.navTime || 0) - dt;
    if (!u.waypoint || u.navTime <= 0 || Math.hypot(u.x - u.waypoint.x, u.y - u.waypoint.y) < 10) { u.waypoint = nextWaypoint(u, goal, this.rocks, def.r + 1); u.navTime = .45; }
    const mx = u.waypoint.x - u.x, my = u.waypoint.y - u.y, md = Math.hypot(mx, my) || 1;
    const speed = def.speed * speedScale;
    u.x += mx / md * Math.min(md, speed * dt); u.y += my / md * Math.min(md, speed * dt); u.walk += dt * 10; u.moving = 1;
    if (def.charge) u.run += dt;
    if ((Math.floor(u.walk * 2) + u.id) % 8 === 0 && u.type === 'giant') this.effect(u.x, u.y, 'dust', u.team);
  }
  // 沿路线行军：朝当前路点走，脸朝前进方向；卡住一会儿就跳到下一个路点。
  march(u, def, dt, speedScale) {
    const goal = u.route[u.leg];
    this.advance(u, def, goal, dt, speedScale);
    const w = u.waypoint || goal;
    if (Math.hypot(w.x - u.x, w.y - u.y) > 1) { u.angle = turnTowards(u.angle, Math.atan2(w.y - u.y, w.x - u.x), dt * 8); u.dx = Math.cos(u.angle); u.dy = Math.sin(u.angle); }
    const d = Math.hypot(u.x - goal.x, u.y - goal.y);
    if (d < u.legBest - 1) { u.legBest = d; u.legStall = 0; } else u.legStall += dt;
    if (d < ARRIVE || u.legStall > .9) this.nextLeg(u);
  }
  nextLeg(u) {
    u.leg++; u.legBest = Infinity; u.legStall = 0; u.navTime = 0; u.waypoint = null;
    if (u.leg < u.route.length) return;
    this.relicStats.arrived++;
    const primed = (!!this.flags.charge && u.team === 0) || !!u.kw?.charge;
    if (primed) u.primed = true;
    this.effect(u.x, u.y, 'arrive', u.team, { primed });
    this.events.push('arrive');
  }
  // 能不能直接打到：与普通寻敌相同的射程和视线判定。
  reaches(u, v, arrowRocks) {
    const def = u.def, a = center(u), b = center(v);
    return Math.hypot(b.x - a.x, b.y - a.y) <= def.range + TYPES[v.type].r && (def.projectile !== 'arrow' || clearPath(a, b, arrowRocks, 0));
  }
  face(u, other, dt) {
    const a = center(u), b = center(other);
    u.angle = turnTowards(u.angle, Math.atan2(b.y - a.y, b.x - a.x), dt * 8); u.dx = Math.cos(u.angle); u.dy = Math.sin(u.angle);
  }

  // 医师：治疗射程内最危险的伤员；没有伤员时跟在最近的战斗单位身后。行军和驻守时只治疗够得着的人。
  support(u, def, alive, dt, speedScale) {
    const allies = alive.filter(v => v.team === u.team && v.id !== u.id && v.hp > 0);
    if (!allies.length) { u.windup = 0; u.windupTotal = 0; return; }
    const marching = this.marching(u), holding = this.holding(u);
    const reach = v => dist(center(u), center(v)) <= def.range + TYPES[v.type].r;
    const hurt = allies.filter(v => v.hp < v.max);
    let target = hurt.find(v => v.id === u.targetId);
    if (!target) {
      u.windup = 0; u.windupTotal = 0;
      const close = hurt.filter(reach);
      target = close.length ? close.reduce((a, b) => (a.hp / a.max <= b.hp / b.max ? a : b)) : (marching || holding) ? null : hurt.length ? nearest(u, hurt) : null;
    }
    const fighters = allies.filter(v => !TYPES[v.type].heals);
    if (!target && (marching || holding)) {
      if (marching) this.march(u, def, dt, speedScale); else this.face(u, nearest(u, fighters.length ? fighters : allies), dt);
      return;
    }
    const anchor = target || nearest(u, fighters.length ? fighters : allies);
    const a = center(u), b = center(anchor), desired = Math.atan2(b.y - a.y, b.x - a.x);
    u.angle = turnTowards(u.angle, desired, dt * 8); u.dx = Math.cos(u.angle); u.dy = Math.sin(u.angle);
    if (!target) { if (dist(u, anchor) > def.follow && u.swing < .1) this.advance(u, def, anchor, dt, speedScale); return; }
    const inRange = reach(target);
    if (u.windupTotal) {
      if (!inRange || target.hp <= 0) { u.windup = 0; u.windupTotal = 0; u.targetId = null; }
      else { u.windup = Math.max(0, u.windup - dt); if (u.windup === 0) this.mend(u, def, target); }
    } else if (inRange && u.cool <= 0) { u.windupTotal = def.windup; u.windup = u.windupTotal; u.targetId = target.id; }
    else if (!inRange && u.swing < .1) { if (marching) this.march(u, def, dt, speedScale); else if (!holding) this.advance(u, def, target, dt, speedScale); }
  }
  mend(u, def, target) {
    const amount = Math.min(target.max - target.hp, def.heal);
    target.hp += amount;
    this.stats[u.team].byType[u.type].healed += amount;
    u.cool = def.cooldown; u.swing = .25; u.windup = 0; u.windupTotal = 0; u.targetId = null;
    const from = center(u), to = center(target);
    this.effect(from.x, from.y, 'healbeam', u.team, { tx: to.x, ty: to.y });
    this.effect(target.x, target.y, 'heal', u.team);
    this.events.push('mend');
  }

  // ---------- 战术牌（卡牌模式） ----------
  // 打出一张战术牌：花掉战墨，立刻生效或在落点生效。up 表示升级过的牌。返回是否成功。
  cast(effect, { up = false, point = null, cost = 0 } = {}) {
    const T = TACTICS[effect];
    if (this.phase !== 'battle' || !T || this.momentum < cost) return false;
    const pick = (base, better) => (up ? better : base), inField = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H;
    if (effect === 'heal') {
      let n = 0;
      for (const u of this.units) if (u.team === 0 && u.hp > 0 && u.hp < u.max) { u.hp += Math.min(u.max - u.hp, u.max * pick(T.ratio, T.up)); n++; this.effect(u.x, u.y, 'heal'); }
      if (!n) return false;
    } else if (effect === 'thunder') {
      if (!inField(point)) return false;
      this.pending.push({ kind: 'thunder', x: point.x, y: point.y, t: T.delay, team: 0, damage: pick(T.damage, T.up), radius: T.radius });
      this.effect(point.x, point.y, 'mark', 0, { life: T.delay, radius: T.radius });
    } else if (effect === 'reinforce') {
      if (!inField(point) || point.x > ZONE.blue + 30) return false;
      this.spawn(T.type, pick(T.n, T.up), point);
    } else if (effect === 'assault') {
      this.effects.assault = Math.max(this.effects.assault, pick(T.duration, T.up));
      for (const u of this.units) if (u.team === 0 && u.hp > 0) { u.route = null; u.hold = false; }
      this.events.push('charge');
    } else if (effect === 'shield') {
      for (const u of this.units) if (u.team === 0 && u.hp > 0) { u.shield = Math.max(u.shield, pick(T.amount, T.up)); this.effect(u.x, u.y, 'shield'); }
    } else {
      this.effects[effect] = Math.max(this.effects[effect] || 0, pick(T.duration, T.up));
      if (effect === 'frost') { this.itemStats.frozen = this.units.filter(u => u.team === 1 && u.hp > 0).length; this.events.push('freeze'); }
    }
    this.momentum -= cost; this.relicStats.tactics++;
    this.say({ kind: 'tactic', effect }, 1.4);
    this.events.push('item');
    return true;
  }
  // 增援：在落点附近出现几名士兵，加入战斗。
  spawn(type, n, point, team = 0) {
    for (let i = 0; i < n; i++) {
      const p = { x: Math.max(MARGIN.side, Math.min(ZONE.blue + 30, point.x - (i % 2) * 14)), y: Math.max(MARGIN.top, Math.min(H - MARGIN.bottom, point.y + (i - (n - 1) / 2) * SQUAD_GAP)) };
      resolveRocks(p, this.rocks, TYPES[type].r + 3);
      const unit = this.makeUnit({ type, x: p.x, y: p.y, team, pid: -1 - this.units.length }, this.units.length);
      unit.cool = .4; this.units.push(unit); this.relicStats.reinforced++;
      this.effect(p.x, p.y, 'arrive', team, { primed: false });
    }
    this.events.push('reinforce');
  }

  // 落雷符等延迟生效的效果。
  strike(p) {
    this.effect(p.x, p.y, 'thunder', p.team, { radius: p.radius });
    this.events.push('thunder');
    for (const u of this.units) if (u.hp > 0 && u.team !== p.team && dist(center(u), p) < p.radius) {
      this.hit(u, p.damage, { type: 'thunder', spell: true, x: p.x, y: p.y });
      this.itemStats.struck++;
    }
  }

  update(dt) {
    if (this.phase !== 'battle') return;
    this.elapsed += dt;
    for (const key of Object.keys(this.effects)) {
      const before = this.effects[key]; this.effects[key] = Math.max(0, before - dt);
      if (before > 0 && this.effects[key] === 0 && ITEMS[key]) this.say({ kind: 'item-end', item: key }, 1.6);
    }
    for (const p of this.pending) { p.t -= dt; if (p.t <= 0) { p.done = true; this.strike(p); } }
    if (this.pending.length) this.pending = this.pending.filter(p => !p.done);
    if (this.puddles.length) { for (const p of this.puddles) p.t -= dt; this.puddles = this.puddles.filter(p => p.t > 0); }
    if (this.momentumRule?.perSeconds) { this.momentumClock += dt; if (this.momentumClock >= this.momentumRule.perSeconds) { this.momentumClock -= this.momentumRule.perSeconds; this.gainMomentum(1); } }

    const flags = this.flags, alive = this.units.filter(u => u.hp > 0);
    // 箭矢按身体高度飞行，所以把障碍上移到同一高度再判断；水塘不挡箭。
    const arrowRocks = this.rocks.filter(o => o.kind !== 'pond').map(o => ({ ...o, y: o.y - 24 }));
    for (const u of alive) {
      if (u.hp <= 0) continue;
      const def = u.def;
      const rallied = u.team === 0 && this.effects.rally > 0;
      u.blockFlash = Math.max(0, u.blockFlash - dt); u.threat = Math.max(0, u.threat - dt);
      u.flash = Math.max(0, u.flash - dt); u.swing = Math.max(0, u.swing - dt); u.recoil = Math.max(0, u.recoil - dt); u.moving = 0;
      u.frozen = u.team === 1 && this.effects.frost > 0;
      if (u.frozen) { u.windup = 0; u.windupTotal = 0; u.targetId = null; continue; }
      const chilled = u.chill > 0; u.chill = Math.max(0, u.chill - dt);
      if (flags.spring && u.team === 0 && u.hp < u.max) { const add = Math.min(u.max - u.hp, RELIC_FX.spring * dt); u.hp += add; this.relicStats.spring += add; }
      const drum = flags.drum && u.team === 0 && this.elapsed <= RELIC_FX.drum.time ? RELIC_FX.drum.rate : 1;
      u.cool -= dt * (rallied ? ITEMS.rally.haste : 1) * (chilled ? .6 : 1) * drum;
      const marching = this.marching(u), holding = this.holding(u);
      const slowed = u.team === 1 && this.puddles.length > 0 && this.puddles.some(p => Math.hypot(u.x - p.x, u.y - p.y) < p.r);
      const speedScale = (rallied ? ITEMS.rally.speed : 1) * (chilled ? .55 : 1) * (slowed ? RELIC_FX.bleed.slow : 1) * (marching && flags.swift && u.team === 0 ? RELIC_FX.swift : 1)
        * (marching && u.kw?.swift ? KEYWORDS.swift.speed : 1) * (u.team === 0 && this.effects.assault > 0 ? TACTICS.assault.speed : 1);
      if (def.heals) { this.support(u, def, alive, dt, speedScale); continue; }
      const targets = alive.filter(v => v.team !== u.team && v.hp > 0);
      if (!targets.length) continue;
      let target = targets.find(v => v.id === u.targetId);
      if (!target) {
        u.windup = 0; u.windupTotal = 0;
        // 长枪手优先追后排单位；其他兵种找最近的敌人。行军和驻守时只考虑够得着的敌人。
        const prefer = list => { const prey = def.hunter ? list.filter(v => TYPES[v.type].backline) : []; return nearest(u, prey.length ? prey : list); };
        if (marching || holding) { const near = targets.filter(v => this.reaches(u, v, arrowRocks)); target = near.length ? prefer(near) : null; }
        else target = prefer(targets);
      }
      if (!target) {
        if (marching) this.march(u, def, dt, speedScale); else this.face(u, nearest(u, targets), dt);
        continue;
      }
      const a = center(u), b = center(target), dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const desired = Math.atan2(dy, dx);
      u.angle = turnTowards(u.angle, desired, dt * 8); u.dx = Math.cos(u.angle); u.dy = Math.sin(u.angle);
      const aligned = Math.abs(wrapAngle(desired - u.angle)) <= ANGLE_TOLERANCE;
      const los = def.projectile !== 'arrow' || clearPath(a, b, arrowRocks, 0);
      const inRange = d <= def.range + TYPES[target.type].r && los;
      if (u.windupTotal) {
        if (!inRange) { u.windup = 0; u.windupTotal = 0; u.targetId = null; }
        else { u.windup = Math.max(0, u.windup - dt); if (u.windup === 0 && aligned) this.attack(u, target); }
      } else if (inRange && u.cool <= 0 && aligned) {
        u.windupTotal = def.windup; u.windup = u.windupTotal; u.targetId = target.id;
      } else if (!inRange && u.swing < .1) {
        if (marching) this.march(u, def, dt, speedScale);
        else if (!holding) this.advance(u, def, target, dt, speedScale);
      }
    }

    // 身体分离只改变位置；武器朝向始终由上面的瞄准状态决定。
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j]; if (a.hp <= 0 || b.hp <= 0) continue;
      let dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy), min = (TYPES[a.type].r + TYPES[b.type].r) * .85;
      if (d < .001) { dx = 1; dy = 0; d = 1; }
      if (d < min) { const p = (min - d) * .5; a.x += dx / d * p; a.y += dy / d * p; b.x -= dx / d * p; b.y -= dy / d * p; }
    }
    for (const u of alive) { resolveRocks(u, this.rocks, TYPES[u.type].r + 3); u.x = Math.max(20, Math.min(W - 20, u.x)); u.y = Math.max(60, Math.min(H - 30, u.y)); }

    for (const s of this.shots) {
      s.t += dt;
      const kind = TYPES[s.type].projectile;
      // 炸弹和冰球投向出手时的位置；箭沿出手方向直飞，不在空中追踪转弯。
      if (kind !== 'arrow') {
        const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy);
        if (d <= s.speed * dt + 5) {
          s.done = true;
          const frost = kind === 'orb', aoe = s.aoe ?? TYPES[s.type].aoe, chill = s.chill ?? TYPES[s.type].chill;
          this.effect(s.tx, s.ty, frost ? 'frostburst' : 'boom', s.team, { radius: aoe });
          this.events.push(frost ? 'frost' : 'boom');
          for (const u of this.units) if (u.hp > 0 && u.team !== s.team) {
            const p = center(u);
            if (Math.hypot(p.x - s.tx, p.y - s.ty) < aoe) {
              if (frost) { if (u.chill <= 0) this.stats[u.team].chilled++; u.chill = Math.max(u.chill, chill); }
              this.hit(u, s.damage, s, true);
            }
          }
        } else { s.x += dx / d * s.speed * dt; s.y += dy / d * s.speed * dt; }
      } else {
        const nx = s.x + s.vx * s.speed * dt, ny = s.y + s.vy * s.speed * dt;
        const hits = this.units.filter(u => u.hp > 0 && u.team !== s.team).map(u => ({ u, p: center(u) }))
          .filter(({ u, p }) => segmentDistance(p.x, p.y, s.x, s.y, nx, ny) < TYPES[u.type].r + 3)
          .sort((a, b) => Math.hypot(a.p.x - s.x, a.p.y - s.y) - Math.hypot(b.p.x - s.x, b.p.y - s.y));
        if (!clearPath({ x: s.x, y: s.y }, { x: nx, y: ny }, arrowRocks)) { s.done = true; this.stats[s.team].stoneArrows++; this.effect(nx, ny, 'block', s.team); }
        else if (hits.length) { this.hit(hits[0].u, s.damage, s, true); s.done = true; }
        s.x = nx; s.y = ny; if (s.t > 2.5 || nx < 0 || nx > W || ny < 0 || ny > H) s.done = true;
      }
    }
    this.shots = this.shots.filter(s => !s.done);
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter(f => f.t < f.life);
    const blue = this.units.some(u => u.team === 0 && u.hp > 0), red = this.units.some(u => u.team === 1 && u.hp > 0);
    if (!blue || !red || this.elapsed >= TIME_LIMIT) { this.phase = blue && !red ? 'won' : 'lost'; this.events.push(this.phase); }
  }

  // 胜负已定后的收尾停顿：只推进倒地、烟尘等特效并让士兵收招，不改变血量、时间和结果。
  settle(dt) {
    if (this.phase !== 'won' && this.phase !== 'lost') return;
    this.shots = [];
    for (const u of this.units) { u.moving = 0; u.flash = Math.max(0, u.flash - dt); u.swing = Math.max(0, u.swing - dt); u.recoil = Math.max(0, u.recoil - dt); u.blockFlash = Math.max(0, u.blockFlash - dt); }
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter(f => f.t < f.life);
  }
}
