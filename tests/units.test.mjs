// 第二轮内容的规则测试：长枪手、医师、冰法师、落雷符、冰封瓶和水塘。
import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/engine.mjs';
import { TYPES, ITEMS, LEVELS, UNIT_ORDER, ITEM_ORDER, CHAPTERS, LEVELS_PER_CHAPTER, unitUnlocked, itemUnlocked } from '../src/data.mjs';
import { center } from '../src/combat.mjs';
import { formationPreview } from '../src/tactical-preview.mjs';
import { report } from '../src/battle-report.mjs';
import { bestStrikePoint } from '../tools/policy.mjs';

const sandbox = (blue, red) => { const g = new Battle(0, true); for (const [t, x, y] of blue) assert.equal(g.place(t, x, y, 0), true); for (const [t, x, y] of red) assert.equal(g.place(t, x, y, 1), true); return g; };
const run = (g, steps = 4805) => { for (let i = 0; i < steps && g.phase === 'battle'; i++) g.update(1 / 60); return g; };

test('长枪手绕过最近的前排去追后排；没有后排时照常找最近的敌人', () => {
  const g = sandbox([['lancer', 270, 300]], [['guard', 400, 300], ['archer', 550, 460]]); g.start(); g.update(1 / 60);
  const lancer = g.units[0], archer = g.units[2];
  const before = Math.hypot(lancer.x - archer.x, lancer.y - archer.y); run(g, 60);
  assert.ok(Math.hypot(lancer.x - archer.x, lancer.y - archer.y) < before - 40, '应朝弓手移动');
  assert.equal(formationPreview(sandbox([['lancer', 270, 300]], [['guard', 400, 300], ['archer', 550, 460]]), { type: 'lancer', x: 270, y: 300, team: 0 }).target.type, 'archer');
  assert.equal(formationPreview(sandbox([['lancer', 270, 300]], [['guard', 400, 300]]), { type: 'lancer', x: 270, y: 300, team: 0 }).target.type, 'guard');
});

test('长枪手助跑后的第一击是冲锋重击，之后恢复普通伤害', () => {
  const g = sandbox([['lancer', 110, 300]], [['giant', 520, 300]]); g.start();
  const lancer = g.units[0], giant = g.units[1]; giant.cool = 999;
  let hp = giant.hp; const hits = [];
  for (let i = 0; i < 1200 && hits.length < 3; i++) { g.update(1 / 60); if (giant.hp < hp) { hits.push(hp - giant.hp); hp = giant.hp; } }
  assert.equal(hits.length, 3);
  assert.ok(Math.abs(hits[0] - TYPES.lancer.damage * TYPES.lancer.charge.mult) < 1e-9, `首击 ${hits[0]}`);
  assert.equal(hits[1], TYPES.lancer.damage); assert.equal(hits[2], TYPES.lancer.damage);
  assert.equal(g.stats[0].charges, 1); assert.ok(lancer.run < TYPES.lancer.charge.time);
});

test('医师治疗射程内伤得最重的队友，不会治疗满血或阵亡的人，也不会攻击', () => {
  const g = sandbox([['healer', 190, 300], ['guard', 250, 260], ['knight', 250, 340]], [['knight', 570, 300]]); g.start();
  const [healer, guard, knight, enemy] = g.units; enemy.cool = 999; enemy.x = 600; enemy.y = 80;
  for (const u of g.units) u.waypoint = null;
  guard.hp = 100; knight.hp = 20; const enemyHp = enemy.hp;
  let healedKnight = 0; for (let i = 0; i < 60 && !healedKnight; i++) { const hp = knight.hp; g.update(1 / 60); if (knight.hp > hp) healedKnight = knight.hp - hp; }
  assert.equal(healedKnight, TYPES.healer.heal, '先治疗生命比例最低的先锋');
  assert.equal(guard.hp, 100); assert.equal(enemy.hp, enemyHp);
  knight.hp = 0; guard.hp = guard.max;
  const dead = knight.hp; run(g, 200); assert.equal(knight.hp, dead, '不治疗阵亡单位'); assert.equal(guard.hp, guard.max);
  assert.ok(g.stats[0].byType.healer.healed >= TYPES.healer.heal);
  assert.ok(report(g).observations.some(o => o.key === 'obs.mended'));
  assert.equal(formationPreview(g, { type: 'healer', x: 190, y: 300, team: 0 }).status, 'support');
});

test('只有医师的一方无法取胜；医师会跟着队友前进', () => {
  const alone = sandbox([['healer', 190, 300]], [['knight', 520, 300]]); alone.start(); run(alone); assert.equal(alone.phase, 'lost');
  const g = sandbox([['healer', 110, 300], ['knight', 270, 300]], [['giant', 590, 300]]); g.start(); const x = g.units[0].x; run(g, 180);
  assert.ok(g.units[0].x > x + 20, '医师应跟上前进的先锋');
});

test('冰法师的冰球造成范围伤害并减速：被减速的单位移动和出手都变慢', () => {
  const g = sandbox([['mage', 270, 300]], [['knight', 420, 270], ['knight', 420, 330]]); g.start();
  const [mage, a, b] = g.units; a.cool = b.cool = 999; a.x = 370; a.y = 290; b.x = 370; b.y = 315;
  let landed = false; for (let i = 0; i < 400 && !landed; i++) { g.update(1 / 60); landed = a.chill > 0; a.x = 370; a.y = 290; b.x = 370; b.y = 315; }
  assert.ok(landed); assert.ok(b.chill > 0, '范围内的第二个敌人也被减速');
  assert.equal(a.max - a.hp, TYPES.mage.damage); assert.equal(g.stats[1].chilled, 2);
  const slow = sandbox([['knight', 110, 140]], [['knight', 600, 140]]), fast = sandbox([['knight', 110, 140]], [['knight', 600, 140]]); slow.start(); fast.start();
  slow.units[0].chill = 5; for (let i = 0; i < 30; i++) { slow.update(1 / 60); fast.update(1 / 60); }
  const moved = g2 => g2.units[0].x - 110; assert.ok(Math.abs(moved(slow) / moved(fast) - .55) < .01);
});

test('护卫同样减免冰球伤害，但照样会被减速；冰球可以越过巨石', () => {
  const g = sandbox([['mage', 250, 300]], [['guard', 420, 300]]); g.rocks = [{ x: 310, y: 300, r: 30 }]; g.start();
  const guard = g.units[1]; guard.cool = 999; for (let i = 0; i < 500 && guard.chill <= 0; i++) { g.update(1 / 60); guard.x = 370; guard.y = 300; }
  assert.ok(guard.chill > 0); assert.ok(Math.abs(guard.max - guard.hp - TYPES.mage.damage * TYPES.guard.rangedTaken) < 1e-9);
  assert.equal(formationPreview(g, { type: 'mage', x: 250, y: 300, team: 0 }).blocked, false);
});

test('落雷符必须选落点；只伤范围内的敌人，无视护卫减伤，每场一次', () => {
  const g = sandbox([['knight', 110, 140]], [['guard', 520, 340], ['archer', 505, 370], ['knight', 590, 100]]); g.selectItem('thunder'); g.start();
  for (const u of g.units) u.cool = 999;
  assert.equal(g.itemNeedsTarget, true); assert.equal(g.useItem(), false, '没有落点不能用'); assert.equal(g.useItem({ x: 9999, y: 10 }), false); assert.equal(g.itemUsed, false);
  const [mine, guard, archer, far] = g.units, p = center(guard);
  assert.equal(g.useItem(p), true); assert.equal(g.itemUsed, true); assert.equal(g.useItem(p), false);
  assert.equal(guard.hp, guard.max, '落雷有延迟'); for (let i = 0; i < 40; i++) { g.update(1 / 60); guard.x = 520; guard.y = 340; archer.x = 505; archer.y = 370; }
  assert.equal(guard.max - guard.hp, ITEMS.thunder.damage, '护卫不减免落雷'); assert.equal(archer.hp, archer.max - ITEMS.thunder.damage);
  assert.equal(far.hp, far.max); assert.equal(mine.hp, mine.max);
  assert.equal(g.itemStats.struck, 2); assert.equal(g.itemStats.strikeDamage, ITEMS.thunder.damage * 2);
  assert.equal(archer.threat, 0, '法术不算近战突袭');
  const cluster = bestStrikePoint(g); assert.ok(Math.hypot(cluster.x - p.x, cluster.y - p.y) < 40, '自动落点应选敌人最密的地方');
});

test('冰封瓶冻住全部敌人：不移动不出手，时间到后恢复；暂停时不流逝', () => {
  const g = sandbox([['archer', 110, 300]], [['knight', 570, 300], ['archer', 570, 340]]); g.selectItem('frost'); g.start();
  run(g, 30); assert.equal(g.useItem(), true);
  const knight = g.units[1], spot = { x: knight.x, y: knight.y }, shots = g.shots.filter(s => s.team === 1).length;
  g.phase = 'paused'; g.update(5); assert.equal(g.effects.frost, ITEMS.frost.duration); g.phase = 'battle';
  run(g, 120); assert.equal(knight.frozen, true); assert.equal(knight.x, spot.x); assert.equal(knight.y, spot.y);
  assert.equal(g.shots.filter(s => s.team === 1).length <= shots, true, '被冻住的弓手不再出手');
  assert.equal(g.units[0].frozen, false, '我方不受影响');
  run(g, 60); assert.equal(g.effects.frost, 0); assert.equal(knight.frozen, false); run(g, 30); assert.ok(knight.x < spot.x, '解冻后继续前进');
  assert.equal(g.feedback.kind, 'item-end'); assert.equal(g.itemStats.frozen, 2);
});

test('水塘挡路不挡箭：不能在水里布阵，单位绕行，弓手可以隔水射击', () => {
  const g = new Battle(12); assert.equal(g.rocks[0].kind, 'pond');
  assert.equal(g.placementError('knight', 330, 300), 'pond');
  const duel = sandbox([['archer', 250, 300]], [['guard', 470, 300]]); duel.rocks = [{ x: 360, y: 300, r: 50, kind: 'pond' }];
  assert.equal(formationPreview(duel, duel.plan[0]).blocked, false, '预览里水塘不挡箭');
  duel.start(); const guard = duel.units[1]; guard.cool = 999; for (let i = 0; i < 200 && guard.hp === guard.max; i++) { duel.update(1 / 60); guard.x = 470; guard.y = 300; }
  assert.ok(guard.hp < guard.max, '箭越过水塘命中'); assert.equal(duel.stats[0].stoneArrows, 0);
  const walk = sandbox([['knight', 250, 300]], [['archer', 550, 300]]); walk.rocks = [{ x: 370, y: 300, r: 50, kind: 'pond' }]; walk.start(); walk.units[1].cool = 999;
  for (let i = 0; i < 600 && walk.phase === 'battle'; i++) { walk.update(1 / 60); const u = walk.units[0]; assert.ok(Math.hypot(u.x - 370, u.y - 300) >= 50 + TYPES.knight.r, '不能走进水塘'); }
});

test('兵种和道具按关卡进度解锁；每章十关；关卡数据完整', () => {
  assert.deepEqual(UNIT_ORDER.filter(t => unitUnlocked(t, 0)), ['knight', 'guard', 'archer']);
  assert.equal(unitUnlocked('bomber', 1), false); assert.equal(unitUnlocked('bomber', 2), true);
  assert.equal(unitUnlocked('lancer', 9), false); assert.equal(unitUnlocked('lancer', 10), true);
  assert.deepEqual(ITEM_ORDER.filter(id => itemUnlocked(id, 0)), ['heal']); assert.equal(itemUnlocked('thunder', 12), true); assert.equal(itemUnlocked('frost', 21), false);
  assert.deepEqual(Object.keys(TYPES).sort(), [...UNIT_ORDER].sort()); assert.deepEqual(Object.keys(ITEMS).sort(), [...ITEM_ORDER].sort());
  assert.equal(LEVELS.length, CHAPTERS.length * LEVELS_PER_CHAPTER);
  for (const l of LEVELS) {
    assert.ok(l.title.length > 1); assert.ok(l.hint.length > 10); assert.ok(l.tag.length > 1);
    assert.ok(ITEMS[l.recommendedItem]); assert.ok(l.par >= 25 && l.par <= 45); assert.ok(l.budget >= 60 && l.budget <= 260 && l.budget % 5 === 0);
    // 新兵种不会先于玩家出现在敌方阵营里超过一关：敌人用到的兵种，玩家最迟在下一关也能用。
    for (const u of l.enemies) assert.ok(TYPES[u.type].unlock <= l.index + 1, `第${l.index + 1}关的敌方 ${u.type} 出现得太早`);
    for (const o of l.rocks) { assert.ok(o.r >= 24 && o.r <= 64); assert.ok(o.y - o.r >= 40 && o.y + o.r <= 560 && o.x > 340 && o.x < 440, `第${l.index + 1}关障碍位置`); }
  }
});
