export const W=520,H=620;
export const TEAM_LIMIT=10;
export const TYPES={
 knight:{limit:5,name:'先锋',role:'近战突击',cost:10,hp:82,damage:14,cooldown:.7,range:25,speed:47,r:11},
 guard:{limit:3,name:'护卫',role:'抵挡箭矢',cost:18,hp:190,damage:12,cooldown:1,range:28,speed:30,r:14},
 archer:{limit:4,name:'弓手',role:'远程输出',cost:16,hp:52,damage:18,cooldown:1,range:145,speed:34,r:10},
 bomber:{limit:2,name:'爆破手',role:'范围伤害',cost:24,hp:65,damage:33,cooldown:1.65,range:125,speed:32,r:12},
 giant:{limit:1,name:'巨人',role:'重型近战',cost:48,hp:360,damage:35,cooldown:1.35,range:34,speed:25,r:20}
};
export const ITEMS={
 heal:{name:'急救旗',icon:'✚',duration:0,description:'恢复所有存活伤员30%最大生命；满血时不消耗。',short:'伤员恢复30%生命'},
 rally:{name:'集结号',icon:'⚑',duration:5,description:'持续5秒：我方移速提高40%，攻击冷却恢复加快30%。适合接敌或追击。',short:'5秒加速接敌与攻击'},
 smoke:{name:'烟雾弹',icon:'≋',duration:4,description:'持续4秒：我方受到的箭矢伤害降低65%。不减免近战和炸弹伤害。',short:'4秒箭矢减伤65%'}
};
const squad=(type,points)=>points.map(([x,y])=>({type,x,y,team:1}));
const level=(title,budget,tag,hint,enemies,rocks=[],recommendedItem='heal')=>({title,budget,tag,hint,enemies,rocks,recommendedItem});
// 预算按 tools/level-report.mjs 的随机胜率逐章收紧：第一章宽松，之后逐关变难；改动前先跑工具复核。
export const LEVELS=[
 level('初次交锋',90,'前后排保护','近战在前、弓手在后。先观察谁先接敌，再尝试移动后排。',[
 ...squad('knight',[[160,225],[260,225],[360,225]]),...squad('archer',[[190,115],[330,115]])]),
 level('盾墙阵地',105,'近战破盾','三名护卫挡住正面箭矢。尝试近战接敌，别只堆弓手。',[
 ...squad('guard',[[170,230],[260,230],[350,230]]),...squad('archer',[[205,125],[315,125]])]),
 level('密集冲锋',90,'范围伤害','先锋集中在中路，护卫在后。试试爆破手打聚集目标，前排负责拖住冲锋。',[
 ...squad('knight',[[185,225],[220,225],[255,225],[290,225],[325,225]]),...squad('guard',[[225,160],[295,160]])]),
 level('四方箭雨',120,'盾与烟雾','弓手分散，爆炸很难同时命中多人。护卫承伤，烟雾留到箭雨到来时。',[
 ...squad('archer',[[65,185],[195,155],[325,155],[455,185]]),...squad('guard',[[160,260],[360,260]])],[],'smoke'),
 level('爆破封线',105,'分散与快攻','两翼都有爆破手。拉开站位，从一侧接敌；集结号可缩短暴露时间。',[
 ...squad('bomber',[[135,165],[385,165]]),...squad('guard',[[135,245],[385,245]]),...squad('knight',[[260,245]])],[],'rally'),
 level('巨石守卫',95,'绕行与集火','中央巨石挡住箭矢和通行。选择一侧绕行，先处理护卫巨人的远程单位。',[
 ...squad('giant',[[260,170]]),...squad('guard',[[325,185]]),...squad('archer',[[90,135],[430,135],[90,220]])],[{x:260,y:285,r:52}]),
 level('左右夹击',115,'双翼防线','敌军从左右两侧接近，中央被巨石分开。只保护一侧，另一侧后排可能被突破。',[
 ...squad('knight',[[80,240],[130,240],[390,240],[440,240]]),...squad('guard',[[70,175],[450,175]]),...squad('archer',[[100,125],[420,125]])],[{x:260,y:260,r:55}],'rally'),
 level('峡口阻击',95,'狭路爆破','两块巨石形成窄口。爆破手能越过石头投弹，箭矢会被石头挡住。',[
 ...squad('guard',[[225,225],[295,225]]),...squad('bomber',[[215,125],[305,125]]),...squad('knight',[[260,175]])],[{x:125,y:295,r:62},{x:395,y:295,r:62}]),
 level('两翼火力',140,'进攻路线选择','左侧弓手、右侧爆破手。两侧威胁不同，选择突破口和对应的战术道具。',[
 ...squad('archer',[[70,120],[130,165],[70,220]]),...squad('bomber',[[400,140],[450,205]]),...squad('guard',[[145,245],[375,245]])],[{x:260,y:265,r:48}],'smoke'),
 level('最后一笔',145,'综合布阵','巨人居中、护卫在前，两翼远程。结合绕行、前排保护和道具时机拆解阵线。',[
 ...squad('giant',[[260,145]]),...squad('guard',[[200,230],[320,230]]),...squad('archer',[[85,145],[435,145]]),...squad('bomber',[[130,210],[390,210]]),...squad('knight',[[260,235]])],[{x:150,y:300,r:32},{x:370,y:300,r:32}])
].map((l,i)=>({...l,group:i<3?'第一章 · 学会布阵':i<7?'第二章 · 火力配合':'第三章 · 综合挑战'}));
export function starsFor(game){return game.phase==='won'?1+(game.units.filter(u=>u.team===0&&u.hp>0).length>=Math.ceil(game.plan.filter(u=>u.team===0).length*.5)?1:0)+(game.elapsed<=25?1:0):0;}
