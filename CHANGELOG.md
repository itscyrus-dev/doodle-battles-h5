# Changelog · 更新记录

版本号写在 `release.json`。合并到 `main` 后，GitHub Actions 会把这里对应版本的小节用作 Release 说明，所以每次改版本号都要在最上面加一节。

## 0.10.0

*2026-11-11*

A PC prototype built around drawing the plan, not just the squad: march routes, a roguelike Expedition mode, and a landscape interface for mouse and keyboard.

- **Draw march routes.** Right-drag from a unit to give it a route. It marches along the line, stops to fight anything in reach, then hunts as usual. Circle a group with the route pen and one line moves them in formation; press H to make units hold their ground.
- **Expedition mode (roguelike).** Three acts of branching maps with battles, elites, bosses, events, a quartermaster, campfires and treasure. Pick a warband, collect new units, elite upgrades, ink and items, and 14 relics that change the rules. Three hearts: lose a fight and you can retry it; run out and the expedition ends.
- **Enemies have plans too.** Flanking routes are shown as red dashed lines and holding units carry red flags.
- **Landscape PC interface.** A 1280×720 stage that scales with the window, a three-column campaign map, a battle screen with unit cards and pens on the left and intel, items and relics on the right, hover previews and keyboard shortcuts.
- **Left-versus-right battlefield.** All 40 campaign levels were rotated; old saved formations convert automatically.
- New landscape battlefields, home screen and expedition maps, plus map and relic icons.
- Mobile portrait play is no longer supported; phones are asked to turn sideways.

中文

- **画行军路线。** 右键从士兵身上拖出一条线：开战后沿线行军，射程内有敌人才停下打，走完后照常寻敌。用路线笔圈住一群人，一笔路线他们会保持队形一起走；按 H 让士兵原地驻守。
- **远征（肉鸽模式）。** 三章分岔地图，有遭遇战、精英、首领、奇遇、军需官、营火和宝箱。选编制开局，一路收集新兵种、精锐升级、墨水和道具，以及 14 件改变规则的遗物。3 颗心：输了可以重打，心用光远征结束。
- **敌人也有计划。** 包抄路线用红色虚线画出，驻守的敌人插着红旗。
- **电脑横屏界面。** 1280×720 舞台随窗口缩放；战役地图改为三栏；战斗界面左栏是兵种和三支笔，右栏是敌情、道具和遗物；悬停预览和键盘快捷键。
- **战场改为左右对战。** 40 关整体旋转，旧存档里的阵容自动换算。
- 新的横版战场、主页和远征地图，以及地图节点和遗物图标。
- 不再支持手机竖屏，手机上会提示横过来。

## 0.9.0

*2026-11-11*

The 10-level prototype grows into a full campaign with new art, new units and items, and meta progression.

- **New art and screens.** Painted backgrounds, chapter maps, character sprites and icons, with redesigned home, map, battle and result screens.
- **40 hand-made levels in 4 chapters** (was 10), plus ponds, a terrain that blocks walking but not arrows.
- **3 new units.** The Lancer hunts the back line and hits hard after a run, the Medic heals, and the Frost Mage slows an area.
- **2 new items.** The Thunder Scroll strikes a spot you tap, and the Frost Flask freezes every enemy.
- **Meta progression that never changes stats.** Coins, banner colours, strategist's hints, a daily bounty and 22 awards.
- **Audio.** Sound effects and two music loops, all synthesized in the browser.
- **Chinese and English**, installable as a PWA and playable offline.
- Saves from 0.3.0 migrate automatically. Saved formations that no longer fit a level's budget are dropped.

中文

- **全新美术和界面。** 背景、章节地图、角色和图标全部重绘，主页、关卡地图、战斗和结算界面重做。
- **4 章 40 个手工关卡**（原来 10 关），新增水塘地形：挡路不挡箭。
- **3 个新兵种。** 长枪手直奔后排、助跑后第一击重创；医师持续治疗；冰法师范围减速。
- **2 件新道具。** 落雷符点哪打哪；冰封瓶冻住全部敌人。
- **不影响数值的局外成长。** 金币、军旗配色、军师锦囊、每日悬赏和 22 个成就。
- **音频。** 音效和两段循环配乐，全部在浏览器里实时合成。
- **中英文切换**，可以添加到主屏幕并离线游玩。
- 0.3.0 的存档会自动迁移；超出新预算的已保存阵容会被丢弃。

## 0.3.0

*2026-11-11*

- 2× battle speed, a short pause with a banner when a battle ends, screen shake, haptics and per-action sound effects.
- Ink budgets tightened so that careless formations stop winning the later levels.

中文

- 2 倍速、胜负揭晓时的停顿与横幅、震屏、震动和分动作音效。
- 收紧墨水预算，后面的关卡不再随手就能赢。

## 0.2.0

*2026-11-10*

- First playtest build: 10 levels, 5 units, 3 items, a tutorial, tactical preview and battle review.

中文

- 第一个试玩版：10 关、5 个兵种、3 件道具、新手引导、战术预览和战后复盘。
