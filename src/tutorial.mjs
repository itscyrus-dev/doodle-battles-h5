// 新手教学：三场很短的仗，每场只教一件事——画路线、出牌、打战术牌。打完直接开始第一局远征。
// 只有数据，界面在 battle.mjs。坐标是战场坐标（720×570，我方在左边）。
import { REFUND, cardStats } from './cards.mjs';

const foe = (type, x, y) => ({ type, x, y, team: 1 });
export const LESSONS = [
  {
    // 第 1 课：小队已经站好，只需要画一条线。弓手躲在石头后面；随手画大多能赢，贴着石头绕过去活下来的人最多
    // （模拟：照提示画 4 人全活，直线冲或不画只活 1 个，绕一个大圈会输）。
    id: 'route',
    budget: 0,
    squads: [{ card: 90, type: 'knight', n: 4, x: 280, y: 300 }],
    hand: [],
    enemies: [foe('archer', 575, 245), foe('archer', 605, 300), foe('archer', 575, 355)],
    rocks: [{ x: 455, y: 300, r: 46 }],
    guide: [{ x: 280, y: 292 }, { x: 350, y: 232 }, { x: 455, y: 226 }, { x: 540, y: 255 }],
    autoStart: true
  },
  {
    // 第 2 课：把两张兵牌拖到战场上，再按开战。
    id: 'cards',
    budget: 60,
    squads: [],
    hand: ['knights', 'archers'],
    enemies: [foe('knight', 470, 250), foe('knight', 470, 300), foe('knight', 470, 350), foe('archer', 600, 300)],
    rocks: [],
    drop: [{ type: 'knight', x: 300, y: 300 }]
  },
  {
    // 第 3 课：留 20 墨水，开战后把落雷砸在挤成一团的敌人身上。
    id: 'tactics',
    budget: 84,
    squads: [],
    hand: ['guards', 'archers', 't_thunder'],
    enemies: [foe('knight', 470, 270), foe('knight', 500, 300), foe('knight', 470, 330), foe('knight', 530, 260), foe('knight', 530, 340), foe('archer', 620, 300)],
    rocks: []
  }
];

// 一课的战斗参数，形状和远征的 battleOf 一样，战斗界面可以直接用。
export function lessonCtx(index) {
  index = Math.max(0, Math.min(LESSONS.length - 1, index | 0));
  const lesson = LESSONS[index];
  const hand = lesson.hand.map((id, i) => ({ index: i, ...cardStats({ id, up: false }) }));
  return {
    lesson, index, hand, theme: 'meadow', mods: null,
    def: { index: -1, budget: lesson.budget, enemies: lesson.enemies.map(u => ({ ...u })), rocks: lesson.rocks.map(o => ({ ...o })), par: 30, title: '' },
    refund: lesson.budget ? { perKill: REFUND.perKill, start: 0 } : null
  };
}
