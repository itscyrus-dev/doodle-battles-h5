// 数值与关卡数据。文字都带中英两份，界面按当前语言取用。
export const W = 520, H = 620;
export const TEAM_LIMIT = 10;
export const DEFAULT_PAR = 25;
export const TIME_LIMIT = 80;

// unlock：需要已解锁到第几关（从 0 数）才能使用；backline：后排单位，长枪手优先找它们。
export const TYPES = {
  knight: { limit: 5, cost: 10, hp: 82, damage: 14, cooldown: .7, range: 25, speed: 47, r: 11, windup: .15, unlock: 0 },
  guard: { limit: 3, cost: 18, hp: 190, damage: 12, cooldown: 1, range: 28, speed: 30, r: 14, windup: .15, unlock: 0, rangedTaken: .55 },
  archer: { limit: 4, cost: 16, hp: 52, damage: 18, cooldown: 1, range: 145, speed: 34, r: 10, windup: .24, unlock: 0, backline: true, projectile: 'arrow', projSpeed: 340 },
  bomber: { limit: 2, cost: 24, hp: 65, damage: 33, cooldown: 1.65, range: 125, speed: 32, r: 12, windup: .28, unlock: 2, backline: true, projectile: 'bomb', projSpeed: 210, aoe: 48 },
  giant: { limit: 1, cost: 48, hp: 360, damage: 35, cooldown: 1.35, range: 34, speed: 25, r: 20, windup: .26, unlock: 3 },
  lancer: { limit: 3, cost: 20, hp: 92, damage: 15, cooldown: .9, range: 36, speed: 64, r: 11, windup: .16, unlock: 10, hunter: true, charge: { time: .8, mult: 2.4 } },
  healer: { limit: 2, cost: 22, hp: 58, damage: 0, heal: 15, cooldown: 1.4, range: 105, speed: 36, r: 10, windup: .3, unlock: 15, backline: true, heals: true, follow: 70 },
  mage: { limit: 2, cost: 26, hp: 56, damage: 13, cooldown: 1.9, range: 135, speed: 32, r: 10, windup: .32, unlock: 20, backline: true, projectile: 'orb', projSpeed: 230, aoe: 44, chill: 2.4 }
};
export const UNIT_ORDER = ['knight', 'guard', 'archer', 'bomber', 'giant', 'lancer', 'healer', 'mage'];

// targeted：需要点选战场位置；duration：持续型效果的秒数。
export const ITEMS = {
  heal: { unlock: 0, duration: 0, ratio: .3 },
  smoke: { unlock: 2, duration: 4, arrowTaken: .35 },
  rally: { unlock: 4, duration: 5, speed: 1.4, haste: 1.3 },
  thunder: { unlock: 12, duration: 0, targeted: true, delay: .45, damage: 46, radius: 60 },
  frost: { unlock: 22, duration: 2.6 }
};
export const ITEM_ORDER = ['heal', 'smoke', 'rally', 'thunder', 'frost'];

export const CHAPTERS = [
  { id: 'meadow', name: { zh: '青草原', en: 'Greenfields' }, blurb: { zh: '学会布阵：前排、后排与巨石。', en: 'Learn the basics: front line, back line and boulders.' } },
  { id: 'canyon', name: { zh: '赤砂峡谷', en: 'Redsand Canyon' }, blurb: { zh: '长枪手与医师登场，水塘隔断道路。', en: 'Lancers and medics arrive, and ponds cut the roads.' } },
  { id: 'snow', name: { zh: '霜雪原', en: 'Frostfields' }, blurb: { zh: '冰法师的寒气会拖慢整支队伍。', en: 'Frost mages slow whole squads with their chill.' } },
  { id: 'citadel', name: { zh: '王城', en: 'The Citadel' }, blurb: { zh: '最后的考验：混编大军与重重工事。', en: 'The final test: mixed armies behind heavy defences.' } }
];

const E = (type, ...points) => points.map(([x, y]) => ({ type, x, y, team: 1 }));
const rock = (x, y, r) => ({ x, y, r });
const pond = (x, y, r) => ({ x, y, r, kind: 'pond' });
const L = (title, budget, tag, hint, enemies, rocks = [], recommendedItem = 'heal', par = DEFAULT_PAR) =>
  ({ title, budget, tag, hint, enemies: enemies.flat(), rocks, recommendedItem, par });

const RAW = [
  // ---------- 第一章 青草原 ----------
  L({ zh: '初次交锋', en: 'First Clash' }, 90, { zh: '前后排保护', en: 'Front and back' },
    { zh: '近战在前、弓手在后。先观察谁先接敌，再尝试移动后排。', en: 'Melee in front, archers behind. Watch who meets the enemy first, then try moving your back line.' },
    [E('knight', [160, 225], [260, 225], [360, 225]), E('archer', [190, 115], [330, 115])]),
  L({ zh: '盾墙阵地', en: 'Shield Wall' }, 100, { zh: '近战破盾', en: 'Break the shields' },
    { zh: '三名护卫挡住正面箭矢。尝试近战接敌，别只堆弓手。', en: 'Three guards soak up arrows. Bring melee instead of stacking archers.' },
    [E('guard', [170, 230], [260, 230], [350, 230]), E('archer', [205, 125], [315, 125])]),
  L({ zh: '密集冲锋', en: 'Packed Charge' }, 90, { zh: '范围伤害', en: 'Area damage' },
    { zh: '先锋集中在中路，护卫在后。试试爆破手打聚集目标，前排负责拖住冲锋。', en: 'Vanguards bunch up in the middle. Try a bomber on the cluster while your front line holds them.' },
    [E('knight', [185, 225], [220, 225], [255, 225], [290, 225], [325, 225]), E('guard', [225, 160], [295, 160])]),
  L({ zh: '四方箭雨', en: 'Arrow Rain' }, 120, { zh: '盾与烟雾', en: 'Shields and smoke' },
    { zh: '弓手分散，爆炸很难同时命中多人。护卫承伤，烟雾留到箭雨到来时。', en: 'The archers are spread out, so bombs rarely catch two. Let guards take the hits and save smoke for the volley.' },
    [E('archer', [65, 185], [195, 155], [325, 155], [455, 185]), E('guard', [160, 260], [360, 260])], [], 'smoke'),
  L({ zh: '爆破封线', en: 'Bomb Line' }, 105, { zh: '分散与快攻', en: 'Spread and rush' },
    { zh: '两翼都有爆破手。拉开站位，从一侧接敌；集结号可缩短暴露时间。', en: 'Bombers guard both wings. Spread out and strike one side; the rally horn shortens your time under fire.' },
    [E('bomber', [135, 165], [385, 165]), E('guard', [135, 245], [385, 245]), E('knight', [260, 245])], [], 'rally'),
  L({ zh: '巨石守卫', en: 'Boulder Guard' }, 95, { zh: '绕行与集火', en: 'Flank and focus' },
    { zh: '中央巨石挡住箭矢和通行。选择一侧绕行，先处理护卫巨人的远程单位。', en: 'The central boulder blocks arrows and movement. Go around one side and deal with the ranged units guarding the giant.' },
    [E('giant', [260, 170]), E('guard', [325, 185]), E('archer', [90, 135], [430, 135], [90, 220])], [rock(260, 285, 52)]),
  L({ zh: '左右夹击', en: 'Pincer' }, 115, { zh: '双翼防线', en: 'Hold both wings' },
    { zh: '敌军从左右两侧接近，中央被巨石分开。只保护一侧，另一侧后排可能被突破。', en: 'Enemies come down both sides of a boulder. Guard only one wing and the other may break through.' },
    [E('knight', [80, 240], [130, 240], [390, 240], [440, 240]), E('guard', [70, 175], [450, 175]), E('archer', [100, 125], [420, 125])], [rock(260, 260, 55)], 'rally'),
  L({ zh: '峡口阻击', en: 'The Narrows' }, 95, { zh: '狭路爆破', en: 'Bombs in the gap' },
    { zh: '两块巨石形成窄口。爆破手能越过石头投弹，箭矢会被石头挡住。', en: 'Two boulders make a narrow gap. Bombers can lob over rock; arrows cannot.' },
    [E('guard', [225, 225], [295, 225]), E('bomber', [215, 125], [305, 125]), E('knight', [260, 175])], [rock(125, 295, 62), rock(395, 295, 62)]),
  L({ zh: '两翼火力', en: 'Twin Batteries' }, 140, { zh: '进攻路线选择', en: 'Pick your lane' },
    { zh: '左侧弓手、右侧爆破手。两侧威胁不同，选择突破口和对应的战术道具。', en: 'Archers on the left, bombers on the right. Choose which threat to break and bring the matching item.' },
    [E('archer', [70, 120], [130, 165], [70, 220]), E('bomber', [400, 140], [450, 205]), E('guard', [145, 245], [375, 245])], [rock(260, 265, 48)], 'smoke'),
  L({ zh: '草原会战', en: 'Battle of the Meadow' }, 145, { zh: '综合布阵', en: 'All together' },
    { zh: '巨人居中、护卫在前，两翼远程。结合绕行、前排保护和道具时机拆解阵线。', en: 'A giant in the middle, guards in front, ranged on both wings. Combine flanking, a solid front and good item timing.' },
    [E('giant', [260, 145]), E('guard', [200, 230], [320, 230]), E('archer', [85, 145], [435, 145]), E('bomber', [130, 210], [390, 210]), E('knight', [260, 235])], [rock(150, 300, 32), rock(370, 300, 32)]),

  // ---------- 第二章 赤砂峡谷 ----------
  L({ zh: '枪阵初现', en: 'Lances Ahead' }, 120, { zh: '保护后排', en: 'Protect the rear' },
    { zh: '敌方长枪手会直奔你的后排。让护卫贴近弓手，或派出自己的长枪手反冲对面。', en: 'Enemy lancers run straight at your back line. Keep guards near your archers, or send your own lancers at theirs.' },
    [E('lancer', [120, 215], [400, 215]), E('knight', [220, 240], [300, 240]), E('archer', [180, 120], [260, 105], [340, 120])]),
  L({ zh: '沙丘弓阵', en: 'Dune Volley' }, 115, { zh: '快速切入', en: 'Fast dive' },
    { zh: '弓手远远散开，正面有护卫。长枪手跑得快，适合绕过前排去追弓手。', en: 'Archers sit far apart behind guards. Lancers are fast enough to slip past and hunt them.' },
    [E('archer', [60, 150], [170, 110], [350, 110], [460, 150]), E('guard', [215, 235], [305, 235])], [rock(130, 292, 30), rock(390, 292, 30)], 'rally'),
  L({ zh: '绿洲两岸', en: 'Across the Oasis' }, 100, { zh: '隔水对射', en: 'Shoot over water' },
    { zh: '水塘挡路但不挡箭。远程可以隔水对射，近战必须绕行。', en: 'Water blocks walking but not arrows. Ranged units can trade shots across it while melee must go around.' },
    [E('archer', [200, 170], [260, 150], [320, 170]), E('knight', [90, 235], [430, 235]), E('guard', [260, 222])], [pond(260, 300, 56)], 'smoke'),
  L({ zh: '伏击谷道', en: 'Ambush Gulch' }, 110, { zh: '别挤进谷道', en: 'Avoid the funnel' },
    { zh: '两块巨石夹出一条谷道，对面的爆破手正等着你挤进去。长枪手会从外侧包抄。', en: 'Two boulders form a funnel with bombers waiting behind it, and lancers sweep around the outside.' },
    [E('bomber', [230, 120], [290, 120]), E('guard', [260, 215]), E('knight', [260, 165]), E('lancer', [60, 200], [460, 200])], [rock(150, 278, 48), rock(370, 278, 48)], 'thunder'),
  L({ zh: '巨人与医师', en: 'Giant and Medics' }, 95, { zh: '先打治疗', en: 'Medics first' },
    { zh: '两名医师不断给巨人回血。不先解决医师，就很难打倒巨人。', en: 'Two medics keep the giant topped up. Take them out first or the giant will not fall.' },
    [E('giant', [260, 215]), E('healer', [215, 130], [305, 130]), E('guard', [175, 235], [345, 235])], [], 'thunder', 30),
  L({ zh: '战地医师', en: 'Field Medicine' }, 125, { zh: '持久战', en: 'Outlast them' },
    { zh: '你也有医师了。把医师放在护卫身后，让前排顶住这波冲锋。', en: 'Now you have medics too. Keep one behind your guards and let the front line outlast the charge.' },
    [E('knight', [140, 240], [200, 235], [260, 240], [320, 235], [380, 240]), E('archer', [200, 130], [320, 130]), E('guard', [260, 180])], [], 'heal', 30),
  L({ zh: '三路河滩', en: 'Three Fords' }, 110, { zh: '分路作战', en: 'Three lanes' },
    { zh: '两片水塘把战场分成三路，每一路的敌人都不一样。', en: 'Two ponds split the field into three lanes, each with a different threat.' },
    [E('knight', [70, 232]), E('archer', [70, 140]), E('guard', [260, 235]), E('bomber', [260, 140]), E('lancer', [450, 232]), E('archer', [450, 140])], [pond(172, 300, 42), pond(348, 300, 42)], 'thunder'),
  L({ zh: '枪骑风暴', en: 'Lancer Storm' }, 115, { zh: '骗掉冲锋', en: 'Waste the charge' },
    { zh: '长枪手冲锋的第一击最痛。让护卫或巨人去接，后排记得分散。', en: 'A lancer\'s first hit after a run is the nasty one. Let guards or a giant take it and keep your back line apart.' },
    [E('lancer', [100, 225], [260, 240], [420, 225]), E('bomber', [190, 130], [330, 130]), E('guard', [260, 175])], [], 'rally'),
  L({ zh: '石林', en: 'Stone Garden' }, 105, { zh: '视线与走位', en: 'Lines of sight' },
    { zh: '三块巨石切碎了视线。先想好每个远程单位能看到谁。', en: 'Three boulders break up every line of sight. Work out what each ranged unit can actually see.' },
    [E('archer', [110, 150], [410, 150], [260, 105]), E('knight', [170, 225], [350, 225]), E('guard', [260, 190]), E('healer', [260, 148])], [rock(110, 296, 34), rock(260, 268, 38), rock(410, 296, 34)], 'thunder', 30),
  L({ zh: '峡谷之主', en: 'Lord of the Gulch' }, 135, { zh: '首领战', en: 'Boss fight' },
    { zh: '巨人带着医师、长枪手和弓手。拆掉治疗，挡住冲锋，再集火巨人。', en: 'A giant with medics, lancers and archers. Remove the healing, stop the charges, then focus the giant.' },
    [E('giant', [260, 200]), E('healer', [200, 120], [320, 120]), E('lancer', [90, 230], [430, 230]), E('archer', [140, 140], [380, 140]), E('guard', [260, 255])], [rock(120, 308, 34), rock(400, 308, 34)], 'thunder', 35),

  // ---------- 第三章 霜雪原 ----------
  L({ zh: '初雪', en: 'First Frost' }, 100, { zh: '认识寒气', en: 'Meet the chill' },
    { zh: '冰法师的冰球会让一片区域里的人变慢。分散站位，或用长枪手直取法师。', en: 'A frost mage\'s orb slows everyone it lands near. Spread out, or send lancers straight for the mages.' },
    [E('mage', [190, 125], [330, 125]), E('knight', [180, 235], [260, 245], [340, 235]), E('guard', [260, 190])]),
  L({ zh: '冰湖', en: 'Frozen Lake' }, 145, { zh: '绕湖还是对射', en: 'Around or across' },
    { zh: '冰湖挡住了左路。法师躲在湖后，右路则是护卫和弓手。', en: 'A frozen lake blocks the left. Mages hide behind it while guards and archers hold the right.' },
    [E('mage', [120, 150], [220, 130]), E('archer', [380, 130], [450, 170]), E('guard', [330, 232], [410, 240]), E('knight', [262, 222])], [pond(170, 292, 60)], 'smoke', 30),
  L({ zh: '寒风箭阵', en: 'Winter Volley' }, 155, { zh: '破墙', en: 'Crack the wall' },
    { zh: '盾墙后面是三名弓手和一名法师。硬冲会被减速后射成筛子。', en: 'Three archers and a mage behind a shield wall. Charge head-on and you will be slowed and shot to pieces.' },
    [E('guard', [170, 240], [260, 240], [350, 240]), E('archer', [150, 135], [260, 118], [370, 135]), E('mage', [260, 172])], [], 'smoke', 30),
  L({ zh: '雪原冲锋', en: 'Snow Charge' }, 100, { zh: '顶住第一波', en: 'Hold the wave' },
    { zh: '五名先锋加两名长枪手一起冲来，后面还跟着医师。冰法师的减速在这里很值钱。', en: 'Five vanguards and two lancers charge together with a medic behind. Your frost mage\'s slow is worth a lot here.' },
    [E('knight', [140, 240], [200, 250], [260, 240], [320, 250], [380, 240]), E('lancer', [70, 210], [450, 210]), E('healer', [260, 150])], [], 'frost', 30),
  L({ zh: '冰与火', en: 'Ice and Fire' }, 150, { zh: '躲开范围伤害', en: 'Dodge the blasts' },
    { zh: '冰球让你走不动，炸弹接着落下。别让队伍挤成一团。', en: 'Frost pins you in place and bombs follow. Never let your squad bunch up.' },
    [E('giant', [260, 215]), E('mage', [170, 140], [350, 140]), E('bomber', [220, 105], [300, 105]), E('knight', [150, 240], [370, 240])], [], 'thunder', 32),
  L({ zh: '风暴之眼', en: 'Eye of the Storm' }, 150, { zh: '环形阵', en: 'The ring' },
    { zh: '敌人围着中央巨石站成半圈。从一侧撕开，比从正面硬闯要好。', en: 'The enemy stands in an arc around a central boulder. Tear open one side rather than pushing through the middle.' },
    [E('archer', [90, 170], [430, 170]), E('mage', [180, 110], [340, 110]), E('guard', [190, 215], [330, 215]), E('lancer', [260, 150]), E('healer', [260, 100])], [rock(260, 290, 48)], 'thunder', 32),
  L({ zh: '双巨人', en: 'Twin Giants' }, 125, { zh: '逐个击破', en: 'One at a time' },
    { zh: '两名巨人、两名医师。把火力集中到一个目标上，别平均分配。', en: 'Two giants and two medics. Put all your damage into one target instead of spreading it.' },
    [E('giant', [180, 215], [340, 215]), E('healer', [220, 125], [300, 125]), E('archer', [100, 140], [420, 140])], [], 'frost', 35),
  L({ zh: '雪盲', en: 'Whiteout' }, 160, { zh: '远程压制', en: 'Under fire' },
    { zh: '到处都是远程：弓手、法师、爆破手。靠水塘和护卫一步步靠近。', en: 'Ranged units everywhere: archers, mages and bombers. Use the ponds and your guards to close in.' },
    [E('archer', [60, 130], [460, 130]), E('mage', [170, 172], [350, 172]), E('bomber', [260, 105]), E('guard', [220, 240], [300, 240])], [pond(120, 302, 38), pond(400, 302, 38)], 'smoke', 32),
  L({ zh: '寒铁壁', en: 'Iron Wall' }, 170, { zh: '打不动的墙', en: 'The wall that heals' },
    { zh: '三名护卫有两名医师撑着。绕到后面，或者用范围伤害一起打。', en: 'Three guards propped up by two medics. Get behind them, or hit them all at once.' },
    [E('guard', [180, 245], [260, 250], [340, 245]), E('healer', [220, 172], [300, 172]), E('archer', [150, 115], [260, 100], [370, 115]), E('mage', [260, 140])], [], 'thunder', 35),
  L({ zh: '霜原守望者', en: 'Warden of Frost' }, 140, { zh: '首领战', en: 'Boss fight' },
    { zh: '巨人、法师、医师、护卫和长枪手都在。冰封瓶能给你几秒钟的先手。', en: 'Giant, mages, medics, guards and lancers all at once. The frost flask buys you a few seconds of free hits.' },
    [E('giant', [260, 205]), E('mage', [180, 125], [340, 125]), E('healer', [215, 92], [305, 92]), E('guard', [190, 240], [330, 240]), E('lancer', [80, 220], [440, 220])], [pond(110, 306, 32), pond(410, 306, 32)], 'frost', 38),

  // ---------- 第四章 王城 ----------
  L({ zh: '城门', en: 'The Gate' }, 130, { zh: '门洞与两翼', en: 'Gate and wings' },
    { zh: '城门只有中间一条窄路，两侧立着弓手。法师守在门后。', en: 'Only a narrow way leads through the gate. Archers flank it and a mage waits behind.' },
    [E('guard', [230, 220], [290, 220]), E('mage', [260, 150]), E('archer', [110, 170], [410, 170]), E('healer', [260, 100]), E('knight', [200, 165], [320, 165])], [rock(150, 288, 56), rock(370, 288, 56)], 'thunder', 32),
  L({ zh: '箭楼', en: 'Arrow Towers' }, 155, { zh: '水后的弓手', en: 'Archers over water' },
    { zh: '两组弓手躲在水塘后面，近战很难直接够到。', en: 'Two archer pairs shelter behind ponds where melee cannot reach them directly.' },
    [E('archer', [90, 150], [150, 150], [370, 150], [430, 150]), E('guard', [220, 235], [300, 235]), E('mage', [260, 130]), E('knight', [260, 190])], [pond(120, 258, 40), pond(400, 258, 40)], 'smoke', 32),
  L({ zh: '护城河', en: 'The Moat' }, 180, { zh: '唯一的桥', en: 'One bridge' },
    { zh: '护城河只留下中间一座桥。挤在桥上会被炸，隔河对射会被护卫挡住。', en: 'The moat leaves a single bridge. Crowd it and you get bombed; shoot across and the guards soak it up.' },
    [E('guard', [235, 240], [285, 240]), E('archer', [200, 150], [260, 130], [320, 150]), E('bomber', [150, 120], [370, 120]), E('healer', [260, 185])], [pond(60, 302, 46), pond(148, 302, 46), pond(372, 302, 46), pond(460, 302, 46)], 'thunder', 35),
  L({ zh: '禁卫军', en: 'Royal Guard' }, 140, { zh: '精锐混编', en: 'Elite mix' },
    { zh: '护卫、巨人、医师和法师组成的精锐。每一个都得有针对的办法。', en: 'An elite mix of guards, a giant, medics and mages. Each one needs its own answer.' },
    [E('guard', [170, 240], [260, 246], [350, 240]), E('giant', [260, 188]), E('healer', [200, 130], [320, 130]), E('mage', [130, 160], [390, 160])], [], 'frost', 38),
  L({ zh: '火药库', en: 'Powder Store' }, 145, { zh: '三门火炮', en: 'Three bombers' },
    { zh: '三名爆破手。站得越散越好，冲得越快越好。', en: 'Three bombers. Stand as far apart as you can and close the distance as fast as you can.' },
    [E('bomber', [140, 125], [260, 105], [380, 125]), E('guard', [190, 228], [330, 228]), E('lancer', [260, 170])], [], 'rally', 32),
  L({ zh: '三重阵', en: 'Triple Line' }, 130, { zh: '层层推进', en: 'Layer by layer' },
    { zh: '先锋、弓手、法师与医师排成三排。先想清楚怎么处理最后一排。', en: 'Vanguards, archers, then mages and a medic in three rows. Decide early how you will reach the last row.' },
    [E('knight', [140, 245], [220, 250], [300, 250], [380, 245]), E('archer', [170, 175], [260, 165], [350, 175]), E('mage', [200, 105], [320, 105]), E('healer', [260, 92])], [], 'thunder', 35),
  L({ zh: '奇袭', en: 'Flank Raid' }, 135, { zh: '两翼包抄', en: 'Both flanks' },
    { zh: '四名长枪手从两翼包抄，中路是弓手和爆破手。后排需要贴身护卫。', en: 'Four lancers sweep in from both flanks while archers and a bomber hold the centre. Your back line needs bodyguards.' },
    [E('lancer', [50, 180], [50, 240], [470, 180], [470, 240]), E('archer', [200, 120], [260, 105], [320, 120]), E('guard', [260, 205]), E('bomber', [260, 155])], [rock(260, 292, 38)], 'frost', 32),
  L({ zh: '王座之前', en: 'Before the Throne' }, 175, { zh: '双巨人与火力', en: 'Giants and guns' },
    { zh: '两名巨人挡在前面，爆破手、法师和医师躲在后面。', en: 'Two giants in front with bombers, a mage and medics behind them.' },
    [E('giant', [190, 212], [330, 212]), E('bomber', [150, 120], [370, 120]), E('healer', [225, 105], [295, 105]), E('guard', [260, 252]), E('mage', [260, 150])], [], 'frost', 40),
  L({ zh: '最后防线', en: 'The Last Line' }, 190, { zh: '全军出击', en: 'Everything they have' },
    { zh: '十一名守军，所有兵种都到齐了。你的每一滴墨水都要算好。', en: 'Eleven defenders and every unit type. Count every drop of ink.' },
    [E('guard', [170, 245], [260, 250], [350, 245]), E('knight', [100, 240], [420, 240]), E('archer', [150, 150], [260, 130], [370, 150]), E('mage', [205, 105], [315, 105]), E('healer', [260, 182])], [rock(130, 312, 28), rock(390, 312, 28)], 'thunder', 40),
  L({ zh: '最后一笔', en: 'The Last Stroke' }, 210, { zh: '终章', en: 'Finale' },
    { zh: '所有学过的东西都用得上：前排、绕行、集火、道具时机。画下最后一笔吧。', en: 'Everything you have learned matters here: front line, flanking, focus fire and item timing. Make the last stroke.' },
    [E('giant', [260, 190]), E('guard', [200, 240], [320, 240]), E('lancer', [70, 225], [450, 225]), E('archer', [120, 130], [400, 130]), E('mage', [190, 108], [330, 108]), E('healer', [235, 142], [285, 142]), E('bomber', [260, 92])], [rock(150, 306, 30), rock(370, 306, 30)], 'frost', 45)
];

export const LEVELS_PER_CHAPTER = 10;
export const LEVELS = RAW.map((level, i) => ({ ...level, index: i, chapter: Math.floor(i / LEVELS_PER_CHAPTER) }));

export const chapterOf = level => CHAPTERS[LEVELS[level]?.chapter ?? 0];
export const unitUnlocked = (type, unlocked) => unlocked >= TYPES[type].unlock;
export const itemUnlocked = (id, unlocked) => unlocked >= ITEMS[id].unlock;

// 三星：获胜；至少半数队员存活；在本关限时内获胜。
export function starsFor(game) {
  if (game.phase !== 'won') return 0;
  const deployed = game.plan.filter(u => u.team === 0).length;
  const alive = game.units.filter(u => u.team === 0 && u.hp > 0).length;
  const par = game.def?.par ?? DEFAULT_PAR;
  return 1 + (alive >= Math.ceil(deployed * .5) ? 1 : 0) + (game.elapsed <= par ? 1 : 0);
}
