// 数值与关卡数据。文字都带中英两份，界面按当前语言取用。
// 横版战场：我方在左、敌方在右。ZONE 是双方布阵区的分界（蓝方 x ≤ blue，红方 x ≥ red）；
// MARGIN 是布阵时离边缘的最小距离（上边留得多，因为角色画在脚底位置的上方）。
export const W = 720, H = 570;
export const ZONE = { blue: 335, red: 385 };
export const MARGIN = { side: 25, top: 65, bottom: 35 };
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
    [E('knight', [445, 200], [445, 300], [445, 400]), E('archer', [555, 230], [555, 370])]),
  L({ zh: '盾墙阵地', en: 'Shield Wall' }, 100, { zh: '近战破盾', en: 'Break the shields' },
    { zh: '三名护卫挡住正面箭矢。尝试近战接敌，别只堆弓手。', en: 'Three guards soak up arrows. Bring melee instead of stacking archers.' },
    [E('guard', [440, 210], [440, 300], [440, 390]), E('archer', [545, 245], [545, 355])]),
  L({ zh: '密集冲锋', en: 'Packed Charge' }, 90, { zh: '范围伤害', en: 'Area damage' },
    { zh: '先锋集中在中路，护卫在后。试试爆破手打聚集目标，前排负责拖住冲锋。', en: 'Vanguards bunch up in the middle. Try a bomber on the cluster while your front line holds them.' },
    [E('knight', [445, 225], [445, 260], [445, 295], [445, 330], [445, 365]), E('guard', [510, 265], [510, 335])]),
  L({ zh: '四方箭雨', en: 'Arrow Rain' }, 120, { zh: '盾与烟雾', en: 'Shields and smoke' },
    { zh: '弓手分散，爆炸很难同时命中多人。护卫承伤，烟雾留到箭雨到来时。', en: 'The archers are spread out, so bombs rarely catch two. Let guards take the hits and save smoke for the volley.' },
    [E('archer', [485, 105], [515, 235], [515, 365], [485, 495]), E('guard', [410, 200], [410, 400])], [], 'smoke'),
  L({ zh: '爆破封线', en: 'Bomb Line' }, 105, { zh: '分散与快攻', en: 'Spread and rush' },
    { zh: '两翼都有爆破手。拉开站位，从一侧接敌；集结号可缩短暴露时间。', en: 'Bombers guard both wings. Spread out and strike one side; the rally horn shortens your time under fire.' },
    [E('bomber', [505, 175], [505, 425]), E('guard', [425, 175], [425, 425]), E('knight', [425, 300])], [], 'rally'),
  L({ zh: '巨石守卫', en: 'Boulder Guard' }, 95, { zh: '绕行与集火', en: 'Flank and focus' },
    { zh: '中央巨石挡住箭矢和通行。选择一侧绕行，先处理护卫巨人的远程单位。', en: 'The central boulder blocks arrows and movement. Go around one side and deal with the ranged units guarding the giant.' },
    [E('giant', [500, 300]), E('guard', [485, 365]), E('archer', [535, 130], [535, 470], [450, 130])], [rock(385, 300, 52)]),
  L({ zh: '两翼夹击', en: 'Pincer' }, 115, { zh: '双翼防线', en: 'Hold both wings' },
    { zh: '敌军从上下两路接近，中央被巨石分开。只保护一侧，另一侧后排可能被突破。', en: 'Enemies come along both sides of a boulder. Guard only one wing and the other may break through.' },
    [E('knight', [430, 120], [430, 170], [430, 430], [430, 480]), E('guard', [495, 110], [495, 490]), E('archer', [545, 140], [545, 460])], [rock(410, 300, 55)], 'rally'),
  L({ zh: '峡口阻击', en: 'The Narrows' }, 95, { zh: '狭路爆破', en: 'Bombs in the gap' },
    { zh: '两块巨石形成窄口。爆破手能越过石头投弹，箭矢会被石头挡住。', en: 'Two boulders make a narrow gap. Bombers can lob over rock; arrows cannot.' },
    [E('guard', [445, 265], [445, 335]), E('bomber', [545, 255], [545, 345]), E('knight', [495, 300])], [rock(375, 165, 62), rock(375, 435, 62)]),
  L({ zh: '两翼火力', en: 'Twin Batteries' }, 140, { zh: '进攻路线选择', en: 'Pick your lane' },
    { zh: '上路弓手、下路爆破手。两路威胁不同，选择突破口和对应的战术道具。', en: 'Archers on the upper lane, bombers on the lower one. Choose which threat to break and bring the matching item.' },
    [E('archer', [550, 110], [505, 170], [450, 110]), E('bomber', [530, 440], [465, 490]), E('guard', [425, 185], [425, 415])], [rock(405, 300, 48)], 'smoke'),
  L({ zh: '草原会战', en: 'Battle of the Meadow' }, 145, { zh: '综合布阵', en: 'All together' },
    { zh: '巨人居中、护卫在前，两翼远程。结合绕行、前排保护和道具时机拆解阵线。', en: 'A giant in the middle, guards in front, ranged on both wings. Combine flanking, a solid front and good item timing.' },
    [E('giant', [525, 300]), E('guard', [440, 240], [440, 360]), E('archer', [525, 125], [525, 475]), E('bomber', [460, 170], [460, 430]), E('knight', [435, 300])], [rock(370, 190, 32), rock(370, 410, 32)]),

  // ---------- 第二章 赤砂峡谷 ----------
  L({ zh: '枪阵初现', en: 'Lances Ahead' }, 120, { zh: '保护后排', en: 'Protect the rear' },
    { zh: '敌方长枪手会直奔你的后排。让护卫贴近弓手，或派出自己的长枪手反冲对面。', en: 'Enemy lancers run straight at your back line. Keep guards near your archers, or send your own lancers at theirs.' },
    [E('lancer', [455, 160], [455, 440]), E('knight', [430, 260], [430, 340]), E('archer', [550, 220], [565, 300], [550, 380])]),
  L({ zh: '沙丘弓阵', en: 'Dune Volley' }, 115, { zh: '快速切入', en: 'Fast dive' },
    { zh: '弓手远远散开，正面有护卫。长枪手跑得快，适合绕过前排去追弓手。', en: 'Archers sit far apart behind guards. Lancers are fast enough to slip past and hunt them.' },
    [E('archer', [520, 100], [560, 210], [560, 390], [520, 500]), E('guard', [435, 255], [435, 345])], [rock(378, 170, 30), rock(378, 430, 30)], 'rally'),
  L({ zh: '绿洲两岸', en: 'Across the Oasis' }, 100, { zh: '隔水对射', en: 'Shoot over water' },
    { zh: '水塘挡路但不挡箭。远程可以隔水对射，近战必须绕行。', en: 'Water blocks walking but not arrows. Ranged units can trade shots across it while melee must go around.' },
    [E('archer', [500, 240], [520, 300], [500, 360]), E('knight', [435, 130], [435, 470]), E('guard', [448, 300])], [pond(370, 300, 56)], 'smoke'),
  L({ zh: '伏击谷道', en: 'Ambush Gulch' }, 110, { zh: '别挤进谷道', en: 'Avoid the funnel' },
    { zh: '两块巨石夹出一条谷道，对面的爆破手正等着你挤进去。长枪手会从外侧包抄。', en: 'Two boulders form a funnel with bombers waiting behind it, and lancers sweep around the outside.' },
    [E('bomber', [550, 270], [550, 330]), E('guard', [455, 300]), E('knight', [505, 300]), E('lancer', [470, 100], [470, 500])], [rock(392, 190, 48), rock(392, 410, 48)], 'thunder'),
  L({ zh: '巨人与医师', en: 'Giant and Medics' }, 95, { zh: '先打治疗', en: 'Medics first' },
    { zh: '两名医师不断给巨人回血。不先解决医师，就很难打倒巨人。', en: 'Two medics keep the giant topped up. Take them out first or the giant will not fall.' },
    [E('giant', [455, 300]), E('healer', [540, 255], [540, 345]), E('guard', [435, 215], [435, 385])], [], 'thunder', 30),
  L({ zh: '战地医师', en: 'Field Medicine' }, 125, { zh: '持久战', en: 'Outlast them' },
    { zh: '你也有医师了。把医师放在护卫身后，让前排顶住这波冲锋。', en: 'Now you have medics too. Keep one behind your guards and let the front line outlast the charge.' },
    [E('knight', [430, 180], [435, 240], [430, 300], [435, 360], [430, 420]), E('archer', [540, 240], [540, 360]), E('guard', [490, 300])], [], 'heal', 30),
  L({ zh: '三路河滩', en: 'Three Fords' }, 110, { zh: '分路作战', en: 'Three lanes' },
    { zh: '两片水塘把战场分成三路，每一路的敌人都不一样。', en: 'Two ponds split the field into three lanes, each with a different threat.' },
    [E('knight', [438, 110]), E('archer', [530, 110]), E('guard', [435, 300]), E('bomber', [530, 300]), E('lancer', [438, 490]), E('archer', [530, 490])], [pond(370, 212, 42), pond(370, 388, 42)], 'thunder'),
  L({ zh: '枪骑风暴', en: 'Lancer Storm' }, 115, { zh: '骗掉冲锋', en: 'Waste the charge' },
    { zh: '长枪手冲锋的第一击最痛。让护卫或巨人去接，后排记得分散。', en: 'A lancer\'s first hit after a run is the nasty one. Let guards or a giant take it and keep your back line apart.' },
    [E('lancer', [445, 140], [430, 300], [445, 460]), E('bomber', [540, 230], [540, 370]), E('guard', [495, 300])], [], 'rally'),
  L({ zh: '石林', en: 'Stone Garden' }, 105, { zh: '视线与走位', en: 'Lines of sight' },
    { zh: '三块巨石切碎了视线。先想好每个远程单位能看到谁。', en: 'Three boulders break up every line of sight. Work out what each ranged unit can actually see.' },
    [E('archer', [520, 150], [520, 450], [565, 300]), E('knight', [445, 210], [445, 390]), E('guard', [480, 300]), E('healer', [522, 300])], [rock(374, 150, 34), rock(402, 300, 38), rock(374, 450, 34)], 'thunder', 30),
  L({ zh: '峡谷之主', en: 'Lord of the Gulch' }, 135, { zh: '首领战', en: 'Boss fight' },
    { zh: '巨人带着医师、长枪手和弓手。拆掉治疗，挡住冲锋，再集火巨人。', en: 'A giant with medics, lancers and archers. Remove the healing, stop the charges, then focus the giant.' },
    [E('giant', [470, 300]), E('healer', [550, 240], [550, 360]), E('lancer', [440, 130], [440, 470]), E('archer', [530, 180], [530, 420]), E('guard', [415, 300])], [rock(362, 160, 34), rock(362, 440, 34)], 'thunder', 35),

  // ---------- 第三章 霜雪原 ----------
  L({ zh: '初雪', en: 'First Frost' }, 100, { zh: '认识寒气', en: 'Meet the chill' },
    { zh: '冰法师的冰球会让一片区域里的人变慢。分散站位，或用长枪手直取法师。', en: 'A frost mage\'s orb slows everyone it lands near. Spread out, or send lancers straight for the mages.' },
    [E('mage', [545, 230], [545, 370]), E('knight', [435, 220], [425, 300], [435, 380]), E('guard', [480, 300])]),
  L({ zh: '冰湖', en: 'Frozen Lake' }, 145, { zh: '绕湖还是对射', en: 'Around or across' },
    { zh: '冰湖挡住了上路。法师躲在湖后，下路则是护卫和弓手。', en: 'A frozen lake blocks the upper lane. Mages hide behind it while guards and archers hold the lower one.' },
    [E('mage', [520, 160], [540, 260]), E('archer', [540, 420], [500, 490]), E('guard', [438, 370], [430, 450]), E('knight', [448, 302])], [pond(378, 210, 60)], 'smoke', 30),
  L({ zh: '寒风箭阵', en: 'Winter Volley' }, 155, { zh: '破墙', en: 'Crack the wall' },
    { zh: '盾墙后面是三名弓手和一名法师。硬冲会被减速后射成筛子。', en: 'Three archers and a mage behind a shield wall. Charge head-on and you will be slowed and shot to pieces.' },
    [E('guard', [430, 210], [430, 300], [430, 390]), E('archer', [535, 190], [552, 300], [535, 410]), E('mage', [498, 300])], [], 'smoke', 30),
  L({ zh: '雪原冲锋', en: 'Snow Charge' }, 100, { zh: '顶住第一波', en: 'Hold the wave' },
    { zh: '五名先锋加两名长枪手一起冲来，后面还跟着医师。冰法师的减速在这里很值钱。', en: 'Five vanguards and two lancers charge together with a medic behind. Your frost mage\'s slow is worth a lot here.' },
    [E('knight', [430, 180], [420, 240], [430, 300], [420, 360], [430, 420]), E('lancer', [460, 110], [460, 490]), E('healer', [520, 300])], [], 'frost', 30),
  L({ zh: '冰与火', en: 'Ice and Fire' }, 150, { zh: '躲开范围伤害', en: 'Dodge the blasts' },
    { zh: '冰球让你走不动，炸弹接着落下。别让队伍挤成一团。', en: 'Frost pins you in place and bombs follow. Never let your squad bunch up.' },
    [E('giant', [455, 300]), E('mage', [530, 210], [530, 390]), E('bomber', [565, 260], [565, 340]), E('knight', [430, 190], [430, 410])], [], 'thunder', 32),
  L({ zh: '风暴之眼', en: 'Eye of the Storm' }, 150, { zh: '环形阵', en: 'The ring' },
    { zh: '敌人围着中央巨石站成半圈。从一侧撕开，比从正面硬闯要好。', en: 'The enemy stands in an arc around a central boulder. Tear open one side rather than pushing through the middle.' },
    [E('archer', [500, 130], [500, 470]), E('mage', [560, 220], [560, 380]), E('guard', [455, 230], [455, 370]), E('lancer', [520, 300]), E('healer', [570, 300])], [rock(380, 300, 48)], 'thunder', 32),
  L({ zh: '双巨人', en: 'Twin Giants' }, 125, { zh: '逐个击破', en: 'One at a time' },
    { zh: '两名巨人、两名医师。把火力集中到一个目标上，别平均分配。', en: 'Two giants and two medics. Put all your damage into one target instead of spreading it.' },
    [E('giant', [455, 220], [455, 380]), E('healer', [545, 260], [545, 340]), E('archer', [530, 140], [530, 460])], [], 'frost', 35),
  L({ zh: '雪盲', en: 'Whiteout' }, 160, { zh: '远程压制', en: 'Under fire' },
    { zh: '到处都是远程：弓手、法师、爆破手。靠水塘和护卫一步步靠近。', en: 'Ranged units everywhere: archers, mages and bombers. Use the ponds and your guards to close in.' },
    [E('archer', [540, 100], [540, 500]), E('mage', [498, 210], [498, 390]), E('bomber', [565, 300]), E('guard', [430, 260], [430, 340])], [pond(368, 160, 38), pond(368, 440, 38)], 'smoke', 32),
  L({ zh: '寒铁壁', en: 'Iron Wall' }, 170, { zh: '打不动的墙', en: 'The wall that heals' },
    { zh: '三名护卫有两名医师撑着。绕到后面，或者用范围伤害一起打。', en: 'Three guards propped up by two medics. Get behind them, or hit them all at once.' },
    [E('guard', [425, 220], [420, 300], [425, 380]), E('healer', [498, 260], [498, 340]), E('archer', [555, 190], [570, 300], [555, 410]), E('mage', [530, 300])], [], 'thunder', 35),
  L({ zh: '霜原守望者', en: 'Warden of Frost' }, 140, { zh: '首领战', en: 'Boss fight' },
    { zh: '巨人、法师、医师、护卫和长枪手都在。冰封瓶能给你几秒钟的先手。', en: 'Giant, mages, medics, guards and lancers all at once. The frost flask buys you a few seconds of free hits.' },
    [E('giant', [465, 300]), E('mage', [545, 220], [545, 380]), E('healer', [578, 255], [578, 345]), E('guard', [430, 230], [430, 370]), E('lancer', [450, 120], [450, 480])], [pond(364, 150, 32), pond(364, 450, 32)], 'frost', 38),

  // ---------- 第四章 王城 ----------
  L({ zh: '城门', en: 'The Gate' }, 130, { zh: '门洞与两翼', en: 'Gate and wings' },
    { zh: '城门只有中间一条窄路，两侧立着弓手。法师守在门后。', en: 'Only a narrow way leads through the gate. Archers flank it and a mage waits behind.' },
    [E('guard', [450, 270], [450, 330]), E('mage', [520, 300]), E('archer', [500, 150], [500, 450]), E('healer', [570, 300]), E('knight', [505, 240], [505, 360])], [rock(382, 190, 56), rock(382, 410, 56)], 'thunder', 32),
  L({ zh: '箭楼', en: 'Arrow Towers' }, 155, { zh: '水后的弓手', en: 'Archers over water' },
    { zh: '两组弓手躲在水塘后面，近战很难直接够到。', en: 'Two archer pairs shelter behind ponds where melee cannot reach them directly.' },
    [E('archer', [520, 130], [520, 190], [520, 410], [520, 470]), E('guard', [435, 260], [435, 340]), E('mage', [540, 300]), E('knight', [480, 300])], [pond(412, 160, 40), pond(412, 440, 40)], 'smoke', 32),
  L({ zh: '护城河', en: 'The Moat' }, 180, { zh: '唯一的桥', en: 'One bridge' },
    { zh: '护城河只留下中间一座桥。挤在桥上会被炸，隔河对射会被护卫挡住。', en: 'The moat leaves a single bridge. Crowd it and you get bombed; shoot across and the guards soak it up.' },
    [E('guard', [430, 275], [430, 325]), E('archer', [520, 240], [540, 300], [520, 360]), E('bomber', [550, 190], [550, 410]), E('healer', [485, 300])], [pond(368, 100, 46), pond(368, 188, 46), pond(368, 412, 46), pond(368, 500, 46)], 'thunder', 35),
  L({ zh: '禁卫军', en: 'Royal Guard' }, 140, { zh: '精锐混编', en: 'Elite mix' },
    { zh: '护卫、巨人、医师和法师组成的精锐。每一个都得有针对的办法。', en: 'An elite mix of guards, a giant, medics and mages. Each one needs its own answer.' },
    [E('guard', [430, 210], [424, 300], [430, 390]), E('giant', [482, 300]), E('healer', [540, 240], [540, 360]), E('mage', [510, 170], [510, 430])], [], 'frost', 38),
  L({ zh: '火药库', en: 'Powder Store' }, 145, { zh: '三门火炮', en: 'Three bombers' },
    { zh: '三名爆破手。站得越散越好，冲得越快越好。', en: 'Three bombers. Stand as far apart as you can and close the distance as fast as you can.' },
    [E('bomber', [545, 180], [565, 300], [545, 420]), E('guard', [442, 230], [442, 370]), E('lancer', [500, 300])], [], 'rally', 32),
  L({ zh: '三重阵', en: 'Triple Line' }, 130, { zh: '层层推进', en: 'Layer by layer' },
    { zh: '先锋、弓手、法师与医师排成三排。先想清楚怎么处理最后一排。', en: 'Vanguards, archers, then mages and a medic in three rows. Decide early how you will reach the last row.' },
    [E('knight', [425, 180], [420, 260], [420, 340], [425, 420]), E('archer', [495, 210], [505, 300], [495, 390]), E('mage', [565, 240], [565, 360]), E('healer', [578, 300])], [], 'thunder', 35),
  L({ zh: '奇袭', en: 'Flank Raid' }, 135, { zh: '两翼包抄', en: 'Both flanks' },
    { zh: '四名长枪手从两翼包抄，中路是弓手和爆破手。后排需要贴身护卫。', en: 'Four lancers sweep in from both flanks while archers and a bomber hold the centre. Your back line needs bodyguards.' },
    [E('lancer', [490, 90], [430, 90], [490, 510], [430, 510]), E('archer', [550, 240], [565, 300], [550, 360]), E('guard', [465, 300]), E('bomber', [515, 300])], [rock(378, 300, 38)], 'frost', 32),
  L({ zh: '王座之前', en: 'Before the Throne' }, 175, { zh: '双巨人与火力', en: 'Giants and guns' },
    { zh: '两名巨人挡在前面，爆破手、法师和医师躲在后面。', en: 'Two giants in front with bombers, a mage and medics behind them.' },
    [E('giant', [458, 230], [458, 370]), E('bomber', [550, 190], [550, 410]), E('healer', [565, 265], [565, 335]), E('guard', [418, 300]), E('mage', [520, 300])], [], 'frost', 40),
  L({ zh: '最后防线', en: 'The Last Line' }, 190, { zh: '全军出击', en: 'Everything they have' },
    { zh: '十一名守军，所有兵种都到齐了。你的每一滴墨水都要算好。', en: 'Eleven defenders and every unit type. Count every drop of ink.' },
    [E('guard', [425, 210], [420, 300], [425, 390]), E('knight', [430, 140], [430, 460]), E('archer', [520, 190], [540, 300], [520, 410]), E('mage', [565, 245], [565, 355]), E('healer', [488, 300])], [rock(358, 170, 28), rock(358, 430, 28)], 'thunder', 40),
  L({ zh: '最后一笔', en: 'The Last Stroke' }, 210, { zh: '终章', en: 'Finale' },
    { zh: '所有学过的东西都用得上：前排、绕行、集火、道具时机。画下最后一笔吧。', en: 'Everything you have learned matters here: front line, flanking, focus fire and item timing. Make the last stroke.' },
    [E('giant', [480, 300]), E('guard', [430, 240], [430, 360]), E('lancer', [445, 110], [445, 490]), E('archer', [540, 160], [540, 440]), E('mage', [562, 230], [562, 370]), E('healer', [528, 275], [528, 325]), E('bomber', [578, 300])], [rock(364, 190, 30), rock(364, 410, 30)], 'frost', 45)
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
