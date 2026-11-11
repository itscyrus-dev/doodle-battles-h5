# Changelog · 更新记录

版本号写在 `release.json`。合并到 `main` 后，GitHub Actions 会把这里对应版本的小节用作 Release 说明，所以每次改版本号都要在最上面加一节。

## 0.13.0

*2026-11-11*

遗物换成了“贴纸”：每张改一条规则，一半和画线有关；精英、首领、宝箱和军需官那里都能翻贴纸包。

- **12 张贴纸，最多同时贴 5 张。** 画线类：长途奔袭（路线越长，到了以后第一击越疼）、圈出目标（首尾相接的路线圈住的敌人受伤 +50%）、交叉引爆（两支小队的路线交叉处开战后炸开）、墨迹陷阱（路线留下墨迹，敌人踩上去变慢）、疾行（画了路线的小队一路不停）、埋伏（没画线的小队原地埋伏，第一击 ×2.5）。规则类：孤军、人海、滚雪球、掷骰子、回声、存墨。
- **翻贴纸包。** 精英战、首领战、宝箱给一包 3 张挑 1 张，军需官 70 金币卖一包；分普通、稀有、传说三档，翻开时一张张翻过来，传说会发光。贴纸满了要换下一张，换下的按卖价折成金币；在地图上点贴纸也能直接卖掉。
- **画线时就看得到加成。** 布阵时线尾显示长途奔袭的加成，被圈住的敌人脚下出现红圈，路线交叉处出现星标和爆炸范围，墨迹和埋伏也都有预览；和开战后的结算用的是同一套判断。
- **生效时看得见。** 开战后贴纸生效，头顶弹出一张小贴纸（图标、名字、数值），顶栏那张贴纸跳一下；结算的“详细数据”里写着每张贴纸生效了几次。
- **开局贴纸。** 铁卫营带“长途奔袭”，炮术营带“交叉引爆”，游骑营带“疾行”。
- **难度重新校准。** 旧遗物大多是稳定的数值加成，换成贴纸以后前期变难了，所以调低了第一章的敌人强度和每章的成长。机器人整局通关：铁卫营约 13%、炮术营约 20%、游骑营约 10%（之前分别是 22%、8%、0%）。
- **旧存档。** 进行中的远征里，有对应贴纸的遗物换成贴纸，其余每件折成 30 金币。
- 试玩记录多记了贴纸的拿取、卖掉和每场带着哪些贴纸。

## 0.12.2

*2026-11-11*

远征里每一战的结算页做了减法，一屏看完，不用往下滚。

- 输了只看三样：还剩几颗心、为什么输、下次怎么改，下面一个“调整后重打”。
- 赢了只看战利品和“领取战利品”。
- 用时、击倒、存活收成按钮下面的一行小字；造成伤害、冲锋和侧击、战术、本场最佳和每个兵种的表现，收进默认关上的“详细数据”。

## 0.12.1

*2026-11-11*

远征地图上一眼看得出该点哪里。

- 现在能去的节点套上金色光圈，一呼一吸地放大；以后才走得到的节点调淡，错过的节点变灰。
- 点了还去不了的节点，它会晃一下，能去的节点跟着闪几下，并提示“还到不了这里，先点发光的节点”；点到错过的路会提示已经错过。鼠标停在节点上时，提示框也会写明“还到不了”或“已错过”。
- 右上角的“选择下一站”像个按钮，点了却没反应：改成一行说明“点发光的节点前进”，点它会让能去的节点闪几下。

## 0.12.0

*2026-11-11*

让新玩家 20 秒内看懂玩法：打开就是一场教学小仗，界面和规则都做了减法。

- **20 秒开局。** 第一次打开不进主页，直接是教学第一课：小队已经站好，跟着金色虚线从小兵身上拖一条线，松手就开战，十几秒打完。后面两课分别教出牌和战术牌，打完直接开始第一次远征（第一局固定铁卫营，打完一局再挑编制）。“更多”里可以重看教学。
- **拖牌出兵。** 把手牌拖到战场上，就放下一整支小队；从士兵身上拖线，整支小队一起沿线行军；把线拖回手牌区就收回这支小队。远征里去掉了布阵笔、路线笔、橡皮和圈选，全程只用左键。
- **一种资源。** 战墨并进墨水：没用完的墨水开战后打战术牌，每击倒一名敌人返还 4 墨水。去掉加抽和重抽，手牌从 5 张加到 6 张；战吼、军师两件遗物改成墨水版本。
- **战斗界面减法。** 远征的战斗去掉右栏，战场更宽；开战、暂停和倍速挪到手牌下面；顶栏只留遗物、心和墨水；布阵时战场上方用一句话说出敌人的打算；操作说明收进右上角的“？”。
- **画路线的回报更明显。** 开战时路线先亮一下；画了路线的近战打到敌方后排，或者从背后砍中敌人时，头顶弹出“突袭后排！”“绕后！”。
- **主页。** 只剩一个“开始远征”，战役、沙盒、悬赏、成就、图鉴都收进“更多”；右边循环播放一段演示：一条线画出来，小队沿线绕过石头打掉弓手。标志图换成中文“涂鸦小队”。
- 难度按新规则重新校准：敌人每章的属性加成调低，后几层的规模增长放缓。
- 试玩记录多记了第一次画出路线用了几秒、教学每一课的结果，以及之前漏记的远征和卡牌事件。

## 0.11.0

*2026-11-11*

远征改成卡牌玩法；界面只保留中文。

- **手牌出兵。** 远征里不再自由画兵：每场从牌库随机抽 5 张手牌，点一张兵牌再点战场，一次放下一整支小队。放下后照样可以画路线、驻守。墨水有剩可以花 10 墨水加抽（每场 3 次），出牌前还能整手重抽一次。
- **战术牌和战墨。** 开战后花“战墨”打出战术牌：急救、烟幕、集结、落雷、增援、总攻、墨盾、冰封。战墨开局 1 点，每击倒一名敌人 +1，每 8 秒 +1，最多 9 点。
- **构筑牌库。** 打赢普通战三选一挑新牌（也可以不拿）；军需官卖卡牌和遗物，也能付钱删牌、升级；营火可以休息、升级一张牌或精简牌库；奇遇会给牌或升级牌。升级后的小队多 1 人、墨水不变，单人牌墨水 −30%，战术牌效果更强。
- **18 张兵牌、8 张战术牌、9 个关键词**（冲锋、疾行、壁垒、狂暴、吸血、鼓舞、齐射、霜咬、老兵）；新增 6 件和卡牌联动的遗物（战意、墨契、人海、战吼、军师、兵书），一共 20 件。
- 打赢普通战和精英战墨水上限都 +8；卡牌战最多上场 14 人。
- 战后多了“战功”：造成伤害、击倒、冲锋与侧击、打出的战术和本场最佳。
- 难度按卡牌规则重新调过：敌军规模的增长放缓，第一章精英变弱，后两章首领变强。新增 `tools/card-report.mjs`，用机器人从头打整局远征检查难度。
- 炮术营的起始遗物改为长弓；游骑营标为进阶编制。
- 去掉英文和语言切换，界面只有中文。
- 远征的存档格式变了，0.10 里没打完的远征读档时会被清掉；战役进度不受影响。

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
