// 纯模拟：布阵校验、寻敌、移动、攻击、道具与胜负。不依赖 DOM，固定步长，结果可复现。
import { TYPES, LEVELS, W, H, TEAM_LIMIT, ITEMS, TIME_LIMIT } from './data.mjs';
import { ANGLE_TOLERANCE, wrapAngle, turnTowards, center, muzzle, segmentDistance } from './combat.mjs';
import { clearPath, nextWaypoint, resolveRocks } from './terrain.mjs';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const nearest = (from, list) => list.reduce((a, b) => (dist(a, from) < dist(b, from) ? a : b));
const ATTACK_SOUND = { archer: 'shoot', bomber: 'toss', giant: 'slam', mage: 'cast', lancer: 'thrust' };

export class Battle {
  // level 可以是关卡序号，也可以直接传一份关卡数据。
  constructor(level = 0, sandbox = false) {
    const def = typeof level === 'number' ? LEVELS[level] : level;
    Object.assign(this, {
      level: typeof level === 'number' ? level : (def.index ?? -1), def, sandbox,
      plan: [], history: [], phase: 'build', units: [], shots: [], fx: [], events: [], pending: [],
      elapsed: 0, healed: false, serial: 0
    });
    this.budget = def.budget;
    this.enemy = structuredClone(def.enemies);
    this.rocks = sandbox ? [] : structuredClone(def.rocks || []);
    this.selectedItem = 'heal';
    this.itemUsed = false;
    this.effects = { rally: 0, smoke: 0, frost: 0 };
  }

  get spent() { return this.plan.filter(u => u.team === 0).reduce((s, u) => s + TYPES[u.type].cost, 0); }
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
    if (x < 25 || x > W - 25 || y < 65 || y > H - 35) return 'bounds';
    if ((!this.sandbox && (team !== 0 || y < 335)) || (this.sandbox && ((team === 0 && y < 335) || (team === 1 && y > 285)))) return team === 0 ? 'zone-blue' : 'zone-red';
    const blocker = this.rocks.find(o => Math.hypot(x - o.x, y - o.y) < o.r + TYPES[type].r + 3);
    if (blocker) return blocker.kind === 'pond' ? 'pond' : 'rock';
    if (this.count(null, team, ignoreId) >= TEAM_LIMIT) return 'team-full';
    if (this.count(type, team, ignoreId) >= TYPES[type].limit) return 'type-full';
    const current = ignoreId === null ? null : this.plan.find(u => u.pid === ignoreId);
    if (!this.sandbox && this.remaining + (current?.team === 0 ? TYPES[current.type].cost : 0) < TYPES[type].cost) return 'ink';
    if (this.plan.some(u => (ignoreId === null || u.pid !== ignoreId) && Math.hypot(u.x - x, u.y - y) < Math.max(27, (TYPES[u.type].r + TYPES[type].r) * .9))) return 'overlap';
    return '';
  }
  place(type, x, y, team = 0) {
    if (this.placementError(type, x, y, team)) return false;
    this.plan.push({ type, x, y, team, pid: this.serial++, born: Date.now() / 1000 });
    return true;
  }
  move(pid, x, y) {
    const u = this.plan.find(u => u.pid === pid);
    if (!u || this.placementError(u.type, x, y, u.team, pid)) return false;
    if (Math.hypot(x - u.x, y - u.y) < .5) return true;
    this.beginStroke(); u.x = x; u.y = y; return true;
  }
  remove(pid) {
    if (this.phase !== 'build' || !this.plan.some(u => u.pid === pid)) return false;
    this.beginStroke(); this.plan = this.plan.filter(u => u.pid !== pid); return true;
  }
  erase(x, y) { if (this.phase === 'build') this.plan = this.plan.filter(u => Math.hypot(u.x - x, u.y - y) > 30); }
  undo() { if (this.phase === 'build' && this.history.length) this.plan = this.history.pop(); }
  clear() { if (this.phase === 'build') { this.beginStroke(); this.plan = []; } }

  start() {
    if (this.phase !== 'build' || !this.plan.some(u => u.team === 0) || !(this.sandbox ? this.plan.some(u => u.team === 1) : this.enemy.length)) return false;
    this.units = [...this.plan, ...(this.sandbox ? [] : this.enemy)].map((u, i) => ({
      ...u, id: i, hp: TYPES[u.type].hp, max: TYPES[u.type].hp,
      cool: .2 + (i % 5) * .07, flash: 0, swing: 0, walk: 0, moving: 0, angle: u.team === 0 ? -Math.PI / 2 : Math.PI / 2,
      windup: 0, windupTotal: 0, targetId: null, recoil: 0, hitAngle: 0, dx: 0, dy: u.team === 0 ? -1 : 1,
      damageDealt: 0, damageTaken: 0, deathAt: null, blockFlash: 0, threat: 0, chill: 0, run: 0, frozen: false
    }));
    Object.assign(this, { phase: 'battle', elapsed: 0, healed: false, shots: [], fx: [], pending: [] });
    this.itemUsed = false;
    this.effects = { rally: 0, smoke: 0, frost: 0 };
    this.itemStats = { healed: 0, prevented: 0, boostedAttacks: 0, struck: 0, strikeDamage: 0, frozen: 0 };
    this.feedback = null;
    this.stats = [0, 1].map(() => ({
      blocked: 0, explosionTaken: 0, damageTaken: 0, backlineDeaths: 0, stoneArrows: 0, arrowsFired: 0, charges: 0, chilled: 0, firstLoss: null,
      byType: Object.fromEntries(Object.keys(TYPES).map(type => [type, { dealt: 0, taken: 0, kills: 0, healed: 0 }]))
    }));
    return true;
  }

  selectItem(id) {
    if (this.phase !== 'build' || typeof id !== 'string' || !Object.hasOwn(ITEMS, id)) return false;
    this.selectedItem = id; return true;
  }
  get canUseItem() { return this.phase === 'battle' && !this.itemUsed && (this.selectedItem !== 'heal' || this.canHeal); }
  get itemNeedsTarget() { return !!ITEMS[this.selectedItem].targeted; }
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
    const life = { death: .6, boom: .5, frostburst: .55, thunder: .5, healbeam: .35, charge: .36 }[kind] ?? .32;
    this.fx.push({ x, y, kind, team, t: 0, life, ...extra });
  }

  hit(u, amount, source, ranged = false) {
    if (u.hp <= 0) return;
    const def = TYPES[u.type];
    const blocked = !!def.rangedTaken && ranged, guardDamage = amount * (blocked ? def.rangedTaken : 1);
    const smoked = u.team === 0 && ranged && source?.type === 'archer' && this.effects.smoke > 0;
    const damage = guardDamage * (smoked ? ITEMS.smoke.arrowTaken : 1);
    if (smoked) this.itemStats.prevented += guardDamage - damage;
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
    }
    if (source?.spell && this.itemStats) this.itemStats.strikeDamage += actual;
    if (blocked) { u.blockFlash = .24; this.events.push('block'); }
    if (!ranged && !source?.spell && def.backline) {
      u.threat = .95;
      if (u.team === 0) this.say({ kind: 'rear' }, 1.6);
    }
    u.hp -= damage; u.flash = .13; u.recoil = .18;
    u.hitAngle = source ? Math.atan2(u.y - source.y, u.x - source.x) : 0;
    const p = center(u);
    this.effect(p.x, p.y, blocked ? 'block' : 'hit', u.team, { angle: u.hitAngle, actor: true, amount: Math.round(actual), big: actual >= 30 });
    this.events.push('hit');
    if (source) { u.x += Math.cos(u.hitAngle) * 4; u.y += Math.sin(u.hitAngle) * 4; }
    if (u.hp <= 0) {
      u.deathAt = this.elapsed;
      if (stats && !stats.firstLoss) stats.firstLoss = { type: u.type, time: this.elapsed };
      if (stats && def.backline) stats.backlineDeaths++;
      this.effect(u.x, u.y, 'death', u.team, { unit: { ...u, waypoint: null } });
      this.events.push('death');
    }
  }

  attack(u, target) {
    const def = TYPES[u.type];
    u.cool = def.cooldown; u.swing = def.projectile ? .22 : .28; u.windup = 0; u.windupTotal = 0; u.targetId = null;
    if (u.team === 0 && this.effects.rally > 0) this.itemStats.boostedAttacks++;
    // 表现事件只供音效、震屏和震动使用，不参与模拟。
    this.events.push('attack', ATTACK_SOUND[u.type] || 'swing');
    if (def.projectile) {
      if (u.type === 'archer') this.stats[u.team].arrowsFired++;
      const start = muzzle(u), end = center(target), angle = u.angle;
      this.shots.push({
        x: start.x, y: start.y, sx: start.x, sy: start.y, tx: end.x, ty: end.y, target: target.id,
        ownerId: u.id, angle, vx: Math.cos(angle), vy: Math.sin(angle), team: u.team, type: u.type, speed: def.projSpeed,
        damage: def.damage, t: 0, distance: Math.hypot(end.x - start.x, end.y - start.y)
      });
      this.effect(start.x, start.y, 'release', u.team, { angle });
      return;
    }
    const charged = !!def.charge && u.run >= def.charge.time, p = center(u);
    this.effect(p.x, p.y, charged ? 'charge' : 'slash', u.team, { angle: u.angle, heavy: u.type === 'giant' });
    this.hit(target, def.damage * (charged ? def.charge.mult : 1), u);
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

  // 医师：治疗射程内最危险的伤员；没有伤员时跟在最近的战斗单位身后。
  support(u, def, alive, dt, speedScale) {
    const allies = alive.filter(v => v.team === u.team && v.id !== u.id && v.hp > 0);
    if (!allies.length) { u.windup = 0; u.windupTotal = 0; return; }
    const reach = v => dist(center(u), center(v)) <= def.range + TYPES[v.type].r;
    const hurt = allies.filter(v => v.hp < v.max);
    let target = hurt.find(v => v.id === u.targetId);
    if (!target) {
      u.windup = 0; u.windupTotal = 0;
      const close = hurt.filter(reach);
      target = close.length ? close.reduce((a, b) => (a.hp / a.max <= b.hp / b.max ? a : b)) : hurt.length ? nearest(u, hurt) : null;
    }
    const fighters = allies.filter(v => !TYPES[v.type].heals);
    const anchor = target || nearest(u, fighters.length ? fighters : allies);
    const a = center(u), b = center(anchor), desired = Math.atan2(b.y - a.y, b.x - a.x);
    u.angle = turnTowards(u.angle, desired, dt * 8); u.dx = Math.cos(u.angle); u.dy = Math.sin(u.angle);
    if (!target) { if (dist(u, anchor) > def.follow && u.swing < .1) this.advance(u, def, anchor, dt, speedScale); return; }
    const inRange = reach(target);
    if (u.windupTotal) {
      if (!inRange || target.hp <= 0) { u.windup = 0; u.windupTotal = 0; u.targetId = null; }
      else { u.windup = Math.max(0, u.windup - dt); if (u.windup === 0) this.mend(u, def, target); }
    } else if (inRange && u.cool <= 0) { u.windupTotal = def.windup; u.windup = u.windupTotal; u.targetId = target.id; }
    else if (!inRange && u.swing < .1) this.advance(u, def, target, dt, speedScale);
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
      if (before > 0 && this.effects[key] === 0) this.say({ kind: 'item-end', item: key }, 1.6);
    }
    for (const p of this.pending) { p.t -= dt; if (p.t <= 0) { p.done = true; this.strike(p); } }
    if (this.pending.length) this.pending = this.pending.filter(p => !p.done);

    const alive = this.units.filter(u => u.hp > 0);
    // 箭矢按身体高度飞行，所以把障碍上移到同一高度再判断；水塘不挡箭。
    const arrowRocks = this.rocks.filter(o => o.kind !== 'pond').map(o => ({ ...o, y: o.y - 24 }));
    for (const u of alive) {
      if (u.hp <= 0) continue;
      const def = TYPES[u.type];
      const rallied = u.team === 0 && this.effects.rally > 0;
      u.blockFlash = Math.max(0, u.blockFlash - dt); u.threat = Math.max(0, u.threat - dt);
      u.flash = Math.max(0, u.flash - dt); u.swing = Math.max(0, u.swing - dt); u.recoil = Math.max(0, u.recoil - dt); u.moving = 0;
      u.frozen = u.team === 1 && this.effects.frost > 0;
      if (u.frozen) { u.windup = 0; u.windupTotal = 0; u.targetId = null; continue; }
      const chilled = u.chill > 0; u.chill = Math.max(0, u.chill - dt);
      u.cool -= dt * (rallied ? ITEMS.rally.haste : 1) * (chilled ? .6 : 1);
      const speedScale = (rallied ? ITEMS.rally.speed : 1) * (chilled ? .55 : 1);
      if (def.heals) { this.support(u, def, alive, dt, speedScale); continue; }
      const targets = alive.filter(v => v.team !== u.team && v.hp > 0);
      if (!targets.length) continue;
      let target = targets.find(v => v.id === u.targetId);
      if (!target) {
        u.windup = 0; u.windupTotal = 0;
        // 长枪手优先追后排单位；其他兵种找最近的敌人。
        const prey = def.hunter ? targets.filter(v => TYPES[v.type].backline) : [];
        target = nearest(u, prey.length ? prey : targets);
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
      } else if (!inRange && u.swing < .1) this.advance(u, def, target, dt, speedScale);
    }

    // 身体分离只改变位置；武器朝向始终由上面的瞄准状态决定。
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j]; if (a.hp <= 0 || b.hp <= 0) continue;
      let dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy), min = (TYPES[a.type].r + TYPES[b.type].r) * .85;
      if (d < .001) { dx = 1; dy = 0; d = 1; }
      if (d < min) { const p = (min - d) * .5; a.x += dx / d * p; a.y += dy / d * p; b.x -= dx / d * p; b.y -= dy / d * p; }
    }
    for (const u of alive) { resolveRocks(u, this.rocks, TYPES[u.type].r + 3); u.x = Math.max(20, Math.min(W - 20, u.x)); u.y = Math.max(60, Math.min(H - 25, u.y)); }

    for (const s of this.shots) {
      s.t += dt;
      const def = TYPES[s.type];
      // 炸弹和冰球投向出手时的位置；箭沿出手方向直飞，不在空中追踪转弯。
      if (def.projectile !== 'arrow') {
        const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy);
        if (d <= s.speed * dt + 5) {
          s.done = true;
          const frost = def.projectile === 'orb';
          this.effect(s.tx, s.ty, frost ? 'frostburst' : 'boom', s.team, { radius: def.aoe });
          this.events.push(frost ? 'frost' : 'boom');
          for (const u of this.units) if (u.hp > 0 && u.team !== s.team) {
            const p = center(u);
            if (Math.hypot(p.x - s.tx, p.y - s.ty) < def.aoe) {
              if (frost) { if (u.chill <= 0) this.stats[u.team].chilled++; u.chill = Math.max(u.chill, def.chill); }
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
