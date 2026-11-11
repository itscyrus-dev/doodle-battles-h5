// 中英文文案。t(key, params) 取当前语言的句子并替换 {占位符}；缺失时回退到中文，再回退到 key 本身。
const zh = {
  'app.name': '涂鸦小队',
  'app.tagline': '把战术，画出来。',
  'common.close': '关闭', 'common.back': '返回', 'common.cancel': '取消', 'common.confirm': '确定', 'common.ok': '好的',
  'common.level': '第 {n} 关', 'common.locked': '未解锁', 'common.on': '开', 'common.off': '关',
  'common.coins': '金币', 'common.stars': '星星', 'common.new': '新',

  'boot.loading': '正在集结小队…', 'boot.error': '加载遇到问题，请重新加载。', 'boot.retry': '重新加载', 'boot.tap': '点击开始',

  'home.continue': '继续闯关', 'home.start': '开始闯关', 'home.levelTag': '第 {n} 关 · {title}', 'home.allClear': '全部通关 · 挑战三星',
  'home.map': '关卡', 'home.daily': '悬赏', 'home.collection': '图鉴', 'home.shop': '配色', 'home.sandbox': '沙盒', 'home.achievements': '成就', 'home.settings': '设置',

  'map.title': '征途', 'map.chapter': '第 {n} 章', 'map.progress': '已通关 {done}/{total}', 'map.lockedChapter': '通关第 {n} 关后开启', 'map.prev': '上一章', 'map.next': '下一章', 'map.boss': '首领',

  'level.enemies': '敌军', 'level.ink': '墨水', 'level.par': '限时', 'level.seconds': '{n} 秒', 'level.yourMax': '我方上限',
  'level.rocks': '巨石 ×{n}', 'level.ponds': '水塘 ×{n}', 'level.open': '开阔战场',
  'level.hint': '布阵提示', 'level.recommended': '推荐道具', 'level.challenge': '可选挑战', 'level.challengeDone': '挑战已达成', 'level.challengeReward': '+{n} 金币',
  'level.fight': '出战', 'level.resume': '继续布阵', 'level.lockedBtn': '先通关第 {n} 关', 'level.best': '最佳成绩',
  'level.starRule': '三星：获胜 · 至少半数存活 · {n} 秒内获胜',
  'level.unlockUnit': '通关后解锁新兵种：{name}', 'level.unlockItem': '通关后解锁新道具：{name}',

  'battle.deploy': '布阵阶段', 'battle.you': '我方', 'battle.enemy': '敌方', 'battle.red': '红方', 'battle.blue': '蓝方',
  'battle.start': '开战！', 'battle.pause': '暂停', 'battle.resume': '继续', 'battle.redeploy': '重新布阵', 'battle.report': '查看战报', 'battle.again': '再试一次',
  'battle.undo': '撤销', 'battle.erase': '橡皮', 'battle.clear': '清空', 'battle.hint': '锦囊', 'battle.autofill': '✦ 放一组基础阵型',
  'battle.speed': '切换战斗倍速，不影响结果和星级',
  'battle.zone.yours': '我 方 布 阵 区', 'battle.zone.enemy': '敌 方 阵 地', 'battle.zone.red': '红 方 布 阵 区',
  'battle.paused': '暂停中', 'battle.victory': '胜利！', 'battle.defeat': '全军覆没', 'battle.timeUp': '时间到', 'battle.block': '格挡',
  'battle.tip.build': '点按或滑动画兵 · 拖动调位置 · 拖回下方回收', 'battle.tip.sandbox': '上半场放红队，下半场放蓝队 · 每队最多 10 人',
  'battle.tip.eraser': '橡皮：滑动擦掉士兵，墨水会退还', 'battle.sandbox': '自由沙盒', 'battle.sandboxSub': '你的规则，你的战场',
  'battle.item.pick': '战前选择', 'battle.item.once': '每场一次', 'battle.item.use': '点击使用', 'battle.item.used': '已使用', 'battle.item.active': '{n} 秒',
  'battle.item.target': '点战场上的位置释放', 'battle.item.none': '满血时不消耗', 'battle.quota': '{name}，{cost} 墨水，已放 {count} 名，上限 {limit} 名',
  'battle.unitLocked': '第 {n} 关解锁', 'battle.free': '自由放置', 'battle.storage': '本机存储不可用 · 刷新可能丢失进度',

  'err.phase': '开战后不能调整阵容', 'err.invalid': '无效的布阵位置', 'err.bounds': '请放在战场范围内',
  'err.zone-blue': '请放在下方的蓝色布阵区', 'err.zone-red': '请放在上方的红色布阵区', 'err.rock': '巨石占着这里，换个落点', 'err.pond': '这里是水塘，换个落点',
  'err.team-full': '全队最多 {n} 人，先回收一名士兵', 'err.type-full': '{name}最多 {n} 名', 'err.ink': '墨水不够，换个兵种或回收士兵', 'err.overlap': '这里已有士兵，稍微拉开一点',
  'drag.drop': '松手放置 · 拖回下方可回收', 'drag.recycle': '松手回收 · 退还 {n} 墨水', 'drag.recycleFree': '松手回收',
  'drag.recycled': '已回收，退还 {n} 墨水', 'drag.recycledFree': '已回收', 'drag.back': '{reason}，已退回原位', 'recycle.zone': '⌫ 拖到这里回收 · 退还墨水',

  'preview.title': '{name} · 射程 {range}', 'preview.note': '开战后目标会移动',
  'preview.no-enemy': '先布置敌方，才能预览接敌路线', 'preview.support': '治疗射程内受伤的队友，没有伤员时跟在队友身后',
  'preview.unreachable': '当前路线受阻，试试换个落点', 'preview.blocked': '巨石挡箭 · 需要绕行', 'preview.in-range': '当前目标已在射程内',
  'preview.lob': '抛投可以越过巨石 · 虚线是接敌路线', 'preview.hunt': '会绕过前排直奔后排 · 虚线是冲锋路线', 'preview.route': '虚线是静态接敌路线',

  'feedback.rear': '后排被近战接触 · 注意保护', 'feedback.heal': '{targets} 名伤员恢复 {amount} 生命', 'feedback.item': '{name}已生效', 'feedback.itemEnd': '{name}效果结束',

  'pause.title': '暂停', 'pause.resume': '继续战斗', 'pause.redeploy': '重新布阵', 'pause.map': '返回关卡地图', 'pause.home': '返回主页', 'pause.keep': '布阵会自动保存',

  'result.win': '漂亮的一笔！', 'result.winFinal': '全部通关，了不起！', 'result.lose': '调整布阵，再来一次', 'result.timeout': '时间到，没能分出胜负',
  'result.winSub': '这场胜利已记录，进度已保存。', 'result.loseSub': '阵容已保留。换几名士兵的位置，试试新的安排。', 'result.timeoutSub': '80 秒内没有打完。加强输出，或者换一条进攻路线。',
  'result.sandboxWin': '蓝队获胜', 'result.sandboxLose': '红队获胜', 'result.sandboxSub': '沙盒战斗不计入进度。',
  'result.time': '战斗用时', 'result.survivors': '我方存活', 'result.ink': '花费墨水',
  'result.rewards': '本场奖励', 'result.firstClear': '首次通关', 'result.newStars': '新星 ×{n}', 'result.medal': '挑战达成', 'result.daily': '每日悬赏', 'result.noReward': '重玩已三星的关卡没有额外金币',
  'result.unlockUnit': '新兵种解锁', 'result.unlockItem': '新道具解锁', 'result.chapter': '第 {n} 章「{name}」通关！', 'result.achievement': '成就达成 · {name}',
  'result.next': '下一关', 'result.nextTitle': '下一关 · {title}', 'result.retry': '调整阵容，再试一次', 'result.retryKeep': '保留阵容重试', 'result.map': '关卡地图', 'result.home': '主页',
  'result.review': '布阵复盘', 'result.tableUnit': '兵种', 'result.tableDealt': '输出', 'result.tableTaken': '承伤', 'result.tableAlive': '存活',
  'result.compare': '同阵容上次存活 {a} 人 → 本次 {b} 人；用时 {c} → {d} 秒。', 'result.challenge': '可选挑战 · {goal}', 'result.challengeDone': '✦ 挑战达成 · {goal}',
  'result.hint': '卡住了？试试军师锦囊',

  'obs.itemHeal': '急救旗实际恢复 {n} 点生命。', 'obs.itemSmoke': '烟雾实际减免 {n} 点箭矢伤害。', 'obs.itemRally': '集结期间我方完成 {n} 次攻击。',
  'obs.itemThunder': '落雷击中 {n} 名敌人，造成 {damage} 点伤害。', 'obs.itemFrost': '冰封瓶冻住了 {n} 名敌人。',
  'obs.mended': '医师累计治疗 {n} 点生命。', 'obs.blocked': '护卫累计抵挡 {n} 点远程伤害。', 'obs.charges': '长枪手打出 {n} 次冲锋重击。',
  'obs.backlineDeaths': '{n} 名后排单位倒下。', 'obs.explosion': '我方承受了 {n} 点爆炸伤害。', 'obs.chilled': '我方有 {n} 人次被寒气减速。',
  'obs.summary': '存活 {alive} / {total} 人，战斗持续 {time} 秒。', 'obs.stoneArrows': '本场 {n} 支我方箭矢撞上巨石。', 'obs.firstLoss': '最早阵亡：{name}，发生在 {time} 秒。',
  'tip.default': '试着集中一侧兵力，观察哪一组先接敌；每次只移动几名士兵，更容易看出效果。',
  'tip.spread': '下次尝试：拉开士兵间距，降低一次爆炸同时伤到多人的风险。',
  'tip.frontline': '下次尝试：把护卫和先锋往前放，后排单位往后挪，让近战先接敌。',
  'tip.chill': '下次尝试：分散站位，或者让长枪手优先解决冰法师。',
  'tip.guardsWorked': '这次护卫确实减少了远程伤害。可以保留前排，再微调后排距离，挑战更多存活人数。',
  'tip.stone': '下次尝试：本场 {n} 支箭被巨石挡住。把弓手移到侧翼，或换用能越石投弹的爆破手。',

  'unit.knight.name': '先锋', 'unit.knight.role': '近战突击', 'unit.knight.good': '便宜、跑得快，适合补足前排和近战输出。', 'unit.knight.watch': '生命不高，单独冲进敌阵容易被集火。',
  'unit.guard.name': '护卫', 'unit.guard.role': '抵挡远程', 'unit.guard.good': '站在后排前面挡箭；受到的远程伤害减少 45%。', 'unit.guard.watch': '移动慢，单次伤害不高。',
  'unit.archer.name': '弓手', 'unit.archer.role': '远程输出', 'unit.archer.good': '留在后排持续射箭；点选可以看射程。', 'unit.archer.watch': '箭会被巨石和路径上的敌人挡住，被近战贴身时很脆弱。',
  'unit.bomber.name': '爆破手', 'unit.bomber.role': '范围伤害', 'unit.bomber.good': '对付聚在一起的敌人；炸弹可以越过巨石。', 'unit.bomber.watch': '炸弹投向出手时的位置，分散或移动中的敌人不容易同时命中。',
  'unit.giant.name': '巨人', 'unit.giant.role': '重型前排', 'unit.giant.good': '生命极高的重型前排，适合承伤并推进阵线。', 'unit.giant.watch': '贵、慢，每队最多 1 名，需要后排配合。',
  'unit.lancer.name': '长枪手', 'unit.lancer.role': '突袭后排', 'unit.lancer.good': '跑得最快，会绕过前排直奔敌方后排；助跑后的第一击伤害是平时的 2.4 倍。', 'unit.lancer.watch': '冲得太深容易被围；对面的护卫和巨人能接下它的冲锋。',
  'unit.healer.name': '医师', 'unit.healer.role': '持续治疗', 'unit.healer.good': '不断治疗射程内伤得最重的队友，适合配合护卫或巨人打持久战。', 'unit.healer.watch': '不会攻击，自己很脆；只剩医师时赢不了。',
  'unit.mage.name': '冰法师', 'unit.mage.role': '范围减速', 'unit.mage.good': '冰球命中一片区域：造成少量伤害，并让敌人移动和攻击变慢。可以越过巨石。', 'unit.mage.watch': '伤害低、出手慢，需要队友来完成击杀。',

  'item.heal.name': '急救旗', 'item.heal.short': '伤员恢复 30% 生命', 'item.heal.desc': '所有存活的伤员恢复 30% 最大生命。不能复活；全员满血时不会消耗。',
  'item.smoke.name': '烟雾罐', 'item.smoke.short': '4 秒箭矢减伤 65%', 'item.smoke.desc': '4 秒内我方受到的箭矢伤害降低 65%，可以和护卫减伤叠加。不防近战和炸弹。',
  'item.rally.name': '集结号', 'item.rally.short': '5 秒加速接敌与攻击', 'item.rally.desc': '5 秒内我方移动速度 +40%，攻击冷却恢复 +30%。适合接敌或追击。',
  'item.thunder.name': '落雷符', 'item.thunder.short': '点选位置，范围重击', 'item.thunder.desc': '战斗中点选战场上的一处：片刻后落雷，对范围内所有敌人造成 46 点伤害，无视护卫减伤。',
  'item.frost.name': '冰封瓶', 'item.frost.short': '冻住全部敌人 2.6 秒', 'item.frost.desc': '所有敌人被冻住 2.6 秒，不能移动也不能攻击。已经飞出的箭和炸弹不受影响。',
  'item.unlockAt': '通关第 {n} 关后解锁', 'item.equipped': '已装备', 'item.pickTitle': '带上哪件战术道具？', 'item.pickSub': '只带一件，不花墨水。开战后自己决定使用时机，重试会补满。', 'item.recommend': '本关推荐',

  'codex.title': '图鉴', 'codex.units': '兵种', 'codex.items': '道具',
  'codex.hp': '生命', 'codex.damage': '伤害', 'codex.heal': '治疗', 'codex.range': '射程', 'codex.speed': '速度', 'codex.cost': '墨水', 'codex.limit': '每队上限',
  'codex.good': '适合这样用', 'codex.watch': '要留意', 'codex.unlockAt': '通关第 {n} 关后解锁',

  'shop.title': '军旗配色', 'shop.blurb': '只改变小队的颜色，不影响任何数值。', 'shop.equip': '使用', 'shop.equipped': '使用中', 'shop.buy': '购买', 'shop.poor': '金币不够',
  'skin.blue': '宝蓝', 'skin.teal': '青绿', 'skin.green': '草绿', 'skin.purple': '紫藤', 'skin.pink': '樱粉', 'skin.gold': '鎏金',

  'hint.title': '军师锦囊', 'hint.text': '显示一个测试中不靠道具也能获胜的阵型（测试成绩 {stars} 星）。每关只需购买一次。', 'hint.buy': '花 {n} 金币查看', 'hint.poor': '金币不够（需要 {n}）',
  'hint.apply': '一键摆好', 'hint.show': '显示虚影，我自己摆', 'hint.owned': '本关锦囊已解锁', 'hint.applied': '已按锦囊布阵，可以直接开战', 'hint.ghosts': '虚影就是锦囊阵型：点一下虚影就能放置',

  'daily.title': '每日悬赏', 'daily.locked': '通关 3 关后开启每日悬赏', 'daily.goal': '今天在第 {n} 关「{title}」打出三星', 'daily.reward': '奖励 {n} 金币',
  'daily.done': '今日悬赏已完成，明天再来', 'daily.streak': '已连续完成 {n} 天', 'daily.go': '前往挑战', 'daily.reset': '每天零点更新',

  'ach.title': '成就', 'ach.toast': '成就达成：{name}　+{n} 金币', 'ach.toastMany': '达成 {count} 个成就　+{n} 金币', 'ach.done': '已达成',
  'ach.first_win.name': '初战告捷', 'ach.first_win.desc': '赢下第一场战斗',
  'ach.wins_10.name': '小有名气', 'ach.wins_10.desc': '累计获胜 10 场', 'ach.wins_50.name': '百战老兵', 'ach.wins_50.desc': '累计获胜 50 场',
  'ach.chapter_1.name': '草原之主', 'ach.chapter_1.desc': '通关第一章全部关卡', 'ach.chapter_2.name': '峡谷征服者', 'ach.chapter_2.desc': '通关第二章全部关卡',
  'ach.chapter_3.name': '破冰者', 'ach.chapter_3.desc': '通关第三章全部关卡', 'ach.chapter_4.name': '执笔之人', 'ach.chapter_4.desc': '通关第四章全部关卡',
  'ach.stars_30.name': '星光初现', 'ach.stars_30.desc': '累计获得 30 颗星', 'ach.stars_60.name': '群星闪耀', 'ach.stars_60.desc': '累计获得 60 颗星',
  'ach.stars_90.name': '星河', 'ach.stars_90.desc': '累计获得 90 颗星', 'ach.stars_all.name': '满天星', 'ach.stars_all.desc': '所有关卡都拿到三星',
  'ach.perfect_chapter.name': '完美章节', 'ach.perfect_chapter.desc': '任意一章全部三星', 'ach.medals_5.name': '挑战者', 'ach.medals_5.desc': '完成 5 个可选挑战',
  'ach.all_units.name': '兵种大师', 'ach.all_units.desc': '每个兵种都上过战场', 'ach.all_items.name': '道具行家', 'ach.all_items.desc': '每种道具都用过一次',
  'ach.flawless.name': '毫发无损', 'ach.flawless.desc': '一人不损地赢下一关', 'ach.small_squad.name': '以少胜多', 'ach.small_squad.desc': '用不超过 3 名士兵赢下一关',
  'ach.fast_win.name': '闪电战', 'ach.fast_win.desc': '10 秒内赢下一关', 'ach.daily_3.name': '持之以恒', 'ach.daily_3.desc': '连续 3 天完成每日悬赏',
  'ach.daily_7.name': '风雨无阻', 'ach.daily_7.desc': '连续 7 天完成每日悬赏', 'ach.skins_3.name': '调色盘', 'ach.skins_3.desc': '拥有 3 种军旗配色',
  'ach.sandbox.name': '沙盘推演', 'ach.sandbox.desc': '完成一场沙盒战斗',

  'settings.title': '设置', 'settings.language': '语言', 'settings.music': '背景音乐', 'settings.sfx': '音效', 'settings.haptics': '震动反馈', 'settings.hapticsNA': '此浏览器不支持',
  'settings.reduced': '减少动效', 'settings.reducedNote': '关闭震屏和多余的动画', 'settings.feedback': '试玩反馈', 'settings.reset': '重置全部进度', 'settings.resetConfirm': '确定清空关卡进度、金币和配色吗？这个操作无法撤销。',
  'settings.resetDone': '进度已重置', 'settings.privacy': '单机游戏：进度只保存在这台设备的浏览器里，不会上传。', 'settings.version': '版本 {v}',
  'feedback.title': '告诉我们哪里卡住了', 'feedback.note': '只保存在本机，不会自动上传。可以导出后自行分享。', 'feedback.rating': '这次好玩吗？', 'feedback.choose': '请选择',
  'feedback.difficulty': '难度感受', 'feedback.fair': '刚好', 'feedback.easy': '偏简单', 'feedback.hard': '偏难', 'feedback.comment': '哪里不明白、卡住或想再玩？', 'feedback.placeholder': '例如：不知道为什么箭射不出去',
  'feedback.save': '保存反馈到本机', 'feedback.saved': '反馈已保存在本机；可以用下方按钮导出。', 'feedback.unsaved': '浏览器无法保存，请立即导出。', 'feedback.off': '本机记录已关闭，勾选后才能保存反馈。',
  'feedback.record': '在此设备记录试玩过程', 'feedback.summary': '当前保留 {battles} 场结果、{feedback} 条反馈；最多 500 条事件。', 'feedback.export': '导出试玩记录 JSON', 'feedback.clear': '删除本机试玩记录', 'feedback.cleared': '试玩记录已删除，关卡与阵容保留。',

  'guide.skip': '收起',
  'guide.front.title': '1 / 4 · 放两名前排', 'guide.front.text': '把“护卫”拖到蓝色区域靠前的位置，或者点一下虚影。',
  'guide.rear.title': '2 / 4 · 加两名弓手', 'guide.rear.text': '把两名弓手放在护卫身后，形成前后排配合。',
  'guide.move.title': '3 / 4 · 调整一下位置', 'guide.move.text': '拖动场上任意士兵换个位置；移动不会重复扣墨水。',
  'guide.start.title': '4 / 4 · 看看你的安排', 'guide.start.text': '还可以用剩下的墨水补兵。准备好就点“开战！”。',
  'guide.inspect.title': '盾墙阵地 · 先观察', 'guide.inspect.text': '放兵后点一下场上的士兵，可以看到射程和接敌路线。',
  'guide.mix.title': '试试混合编队', 'guide.mix.text': '敌方护卫会减免箭伤。搭配近战兵种，比较不同结果。',
  'guide.wall.title': '看看盾墙怎么被突破', 'guide.wall.text': '开始战斗吧；失败后阵容会保留，每次只调整一部分。',
  'guide.blast.title': '新兵种 · 爆破手', 'guide.blast.text': '敌人聚在中路。加入爆破手，让前排拖住他们。',
  'guide.item.title': '战前选一件道具', 'guide.item.text': '点右下角的道具格选择。每场只能用一次，带哪件由你决定。',
  'guide.area.title': '留意范围伤害', 'guide.area.text': '开战后观察炸弹落点，以及战报里爆破手的输出。',
  'guide.cover.title': '巨石守卫 · 观察路线', 'guide.cover.text': '点选士兵看绕行路线；弓手被挡住时，把它拖到侧翼。',
  'guide.lancer.title': '新兵种 · 长枪手', 'guide.lancer.text': '长枪手会绕过前排直奔敌方后排，助跑后的第一击特别痛。',
  'guide.thunder.title': '新道具 · 落雷符', 'guide.thunder.text': '先在道具格里换上落雷符。战斗中点道具，再点战场上的位置释放。',
  'guide.healer.title': '新兵种 · 医师', 'guide.healer.text': '医师会治疗射程内受伤的队友。把它放在前排身后。',
  'guide.mage.title': '新兵种 · 冰法师', 'guide.mage.text': '冰球命中一片区域并让敌人变慢，很适合对付冲锋。',
  'guide.frost.title': '新道具 · 冰封瓶', 'guide.frost.text': '把全部敌人冻住 2.6 秒。留到敌人冲到面前时再用。',

  'spot.rear.goal': '保护后排', 'spot.rear.desc': '获胜，且至少一名弓手参战、全部弓手存活。',
  'spot.mixed.goal': '混合编队', 'spot.mixed.desc': '用至少两种兵种获胜。',
  'spot.blast.goal': '范围输出', 'spot.blast.desc': '获胜，且爆破手实际造成过伤害。',
  'spot.sight.goal': '绕石射击', 'spot.sight.desc': '获胜、弓手射过箭，且没有一支箭撞上巨石。',
  'spot.teamwork.goal': '协同作战', 'spot.teamwork.desc': '至少三种兵种参战，获胜且至少三人存活。',
  'spot.intact.goal': '全身而退', 'spot.intact.desc': '获胜，且至少 5 人存活。',
  'spot.swift.goal': '速战速决', 'spot.swift.desc': '在 25 秒内获胜。',
  'spot.bare.goal': '不靠道具', 'spot.bare.desc': '全程不使用道具并获胜。',

  'toast.storage': '本机存储不可用，进度可能无法保存', 'toast.welcomeBack': '已恢复你之前的进度', 'toast.lang': '已切换为中文'
};

const en = {
  'app.name': 'Draw & Clash',
  'app.tagline': 'Draw your tactics.',
  'common.close': 'Close', 'common.back': 'Back', 'common.cancel': 'Cancel', 'common.confirm': 'Confirm', 'common.ok': 'OK',
  'common.level': 'Level {n}', 'common.locked': 'Locked', 'common.on': 'On', 'common.off': 'Off',
  'common.coins': 'Coins', 'common.stars': 'Stars', 'common.new': 'NEW',

  'boot.loading': 'Rallying the squad…', 'boot.error': 'Something went wrong while loading. Please reload.', 'boot.retry': 'Reload', 'boot.tap': 'Tap to start',

  'home.continue': 'Continue', 'home.start': 'Play', 'home.levelTag': 'Level {n} · {title}', 'home.allClear': 'All clear · Go for 3 stars',
  'home.map': 'Levels', 'home.daily': 'Bounty', 'home.collection': 'Codex', 'home.shop': 'Colours', 'home.sandbox': 'Sandbox', 'home.achievements': 'Awards', 'home.settings': 'Settings',

  'map.title': 'Campaign', 'map.chapter': 'Chapter {n}', 'map.progress': '{done}/{total} cleared', 'map.lockedChapter': 'Clear level {n} to open', 'map.prev': 'Previous chapter', 'map.next': 'Next chapter', 'map.boss': 'Boss',

  'level.enemies': 'Enemies', 'level.ink': 'Ink', 'level.par': 'Par time', 'level.seconds': '{n}s', 'level.yourMax': 'Your squad cap',
  'level.rocks': 'Boulders ×{n}', 'level.ponds': 'Ponds ×{n}', 'level.open': 'Open field',
  'level.hint': 'Briefing', 'level.recommended': 'Suggested item', 'level.challenge': 'Bonus challenge', 'level.challengeDone': 'Challenge complete', 'level.challengeReward': '+{n} coins',
  'level.fight': 'Battle', 'level.resume': 'Back to deployment', 'level.lockedBtn': 'Clear level {n} first', 'level.best': 'Best result',
  'level.starRule': '3 stars: win · keep at least half your squad · win within {n}s',
  'level.unlockUnit': 'Clear this level to unlock: {name}', 'level.unlockItem': 'Clear this level to unlock: {name}',

  'battle.deploy': 'Deploy', 'battle.you': 'You', 'battle.enemy': 'Enemy', 'battle.red': 'Red', 'battle.blue': 'Blue',
  'battle.start': 'Fight!', 'battle.pause': 'Pause', 'battle.resume': 'Resume', 'battle.redeploy': 'Redeploy', 'battle.report': 'See report', 'battle.again': 'Try again',
  'battle.undo': 'Undo', 'battle.erase': 'Eraser', 'battle.clear': 'Clear', 'battle.hint': 'Hint', 'battle.autofill': '✦ Drop a starter formation',
  'battle.speed': 'Toggle battle speed. It does not change the result or the stars.',
  'battle.zone.yours': 'YOUR DEPLOYMENT ZONE', 'battle.zone.enemy': 'ENEMY LINES', 'battle.zone.red': 'RED DEPLOYMENT ZONE',
  'battle.paused': 'Paused', 'battle.victory': 'Victory!', 'battle.defeat': 'Defeated', 'battle.timeUp': 'Time up', 'battle.block': 'BLOCK',
  'battle.tip.build': 'Tap or swipe to draw units · drag to move · drag down to recycle', 'battle.tip.sandbox': 'Red on the top half, blue on the bottom · up to 10 per team',
  'battle.tip.eraser': 'Eraser: swipe over units to remove them and refund their ink', 'battle.sandbox': 'Sandbox', 'battle.sandboxSub': 'Your rules, your battle',
  'battle.item.pick': 'Choose before battle', 'battle.item.once': 'Once per battle', 'battle.item.use': 'Tap to use', 'battle.item.used': 'Used', 'battle.item.active': '{n}s',
  'battle.item.target': 'Tap a spot on the field to strike', 'battle.item.none': 'Not spent at full health', 'battle.quota': '{name}, {cost} ink, {count} placed, limit {limit}',
  'battle.unitLocked': 'Unlocks at level {n}', 'battle.free': 'Free', 'battle.storage': 'Local storage is unavailable · progress may be lost on reload',

  'err.phase': 'You cannot change the formation after the battle starts', 'err.invalid': 'That is not a valid spot', 'err.bounds': 'Place it inside the field',
  'err.zone-blue': 'Place it in the blue zone at the bottom', 'err.zone-red': 'Place it in the red zone at the top', 'err.rock': 'A boulder is in the way', 'err.pond': 'That is water — pick another spot',
  'err.team-full': 'A squad holds {n} units at most — recycle one first', 'err.type-full': '{name}: limit {n}', 'err.ink': 'Not enough ink — pick a cheaper unit or recycle one', 'err.overlap': 'Too close to another unit',
  'drag.drop': 'Release to place · drag down to recycle', 'drag.recycle': 'Release to recycle · refund {n} ink', 'drag.recycleFree': 'Release to recycle',
  'drag.recycled': 'Recycled · {n} ink refunded', 'drag.recycledFree': 'Recycled', 'drag.back': '{reason} — moved back', 'recycle.zone': '⌫ Drag here to recycle · ink refunded',

  'preview.title': '{name} · range {range}', 'preview.note': 'Targets will move once the battle starts',
  'preview.no-enemy': 'Place some enemies to preview a route', 'preview.support': 'Heals injured allies in range and follows the squad when nobody is hurt',
  'preview.unreachable': 'The route is blocked — try another spot', 'preview.blocked': 'A boulder blocks the shot · it must walk around', 'preview.in-range': 'The target is already in range',
  'preview.lob': 'Lobs over boulders · the dashed line is its route', 'preview.hunt': 'Slips past the front line to hunt the back line · the dashed line is its run', 'preview.route': 'The dashed line is its route to the first target',

  'feedback.rear': 'Your back line is under melee attack!', 'feedback.heal': '{targets} wounded restored {amount} HP', 'feedback.item': '{name} is active', 'feedback.itemEnd': '{name} has worn off',

  'pause.title': 'Paused', 'pause.resume': 'Resume battle', 'pause.redeploy': 'Redeploy', 'pause.map': 'Back to levels', 'pause.home': 'Back to home', 'pause.keep': 'Your formation is saved automatically',

  'result.win': 'A fine stroke!', 'result.winFinal': 'Campaign complete. Superb!', 'result.lose': 'Adjust the formation and try again', 'result.timeout': 'Time ran out before a winner emerged',
  'result.winSub': 'The win is recorded and your progress is saved.', 'result.loseSub': 'Your formation is kept. Move a few units and try a new idea.', 'result.timeoutSub': 'The fight was not over after 80 seconds. Bring more damage or pick another route.',
  'result.sandboxWin': 'Blue wins', 'result.sandboxLose': 'Red wins', 'result.sandboxSub': 'Sandbox battles do not count towards progress.',
  'result.time': 'Battle time', 'result.survivors': 'Survivors', 'result.ink': 'Ink spent',
  'result.rewards': 'Rewards', 'result.firstClear': 'First clear', 'result.newStars': 'New stars ×{n}', 'result.medal': 'Challenge', 'result.daily': 'Daily bounty', 'result.noReward': 'No extra coins for replaying a 3-star level',
  'result.unlockUnit': 'New unit unlocked', 'result.unlockItem': 'New item unlocked', 'result.chapter': 'Chapter {n} “{name}” complete!', 'result.achievement': 'Award earned · {name}',
  'result.next': 'Next level', 'result.nextTitle': 'Next · {title}', 'result.retry': 'Adjust and try again', 'result.retryKeep': 'Retry with this formation', 'result.map': 'Levels', 'result.home': 'Home',
  'result.review': 'Battle review', 'result.tableUnit': 'Unit', 'result.tableDealt': 'Dealt', 'result.tableTaken': 'Taken', 'result.tableAlive': 'Alive',
  'result.compare': 'Same squad, last time: {a} survivors → now {b}; time {c}s → {d}s.', 'result.challenge': 'Bonus challenge · {goal}', 'result.challengeDone': '✦ Challenge complete · {goal}',
  'result.hint': 'Stuck? Try the strategist\'s hint',

  'obs.itemHeal': 'The aid flag restored {n} HP.', 'obs.itemSmoke': 'Smoke prevented {n} arrow damage.', 'obs.itemRally': 'Your squad landed {n} attacks during the rally.',
  'obs.itemThunder': 'The thunder strike hit {n} enemies for {damage} damage.', 'obs.itemFrost': 'The frost flask froze {n} enemies.',
  'obs.mended': 'Your medics healed {n} HP.', 'obs.blocked': 'Your guards blocked {n} ranged damage.', 'obs.charges': 'Your lancers landed {n} charge hits.',
  'obs.backlineDeaths': 'You lost {n} back-line units.', 'obs.explosion': 'Your squad took {n} blast damage.', 'obs.chilled': 'Your units were chilled {n} times.',
  'obs.summary': '{alive} of {total} survived; the battle lasted {time}s.', 'obs.stoneArrows': '{n} of your arrows hit a boulder.', 'obs.firstLoss': 'First to fall: {name}, at {time}s.',
  'tip.default': 'Try massing your squad on one side and watch who makes contact first. Move only a few units at a time so you can see what changed.',
  'tip.spread': 'Next time: spread your units out so one blast cannot catch several of them.',
  'tip.frontline': 'Next time: move guards and vanguards forward and your back line further back so melee meets the enemy first.',
  'tip.chill': 'Next time: spread out, or send lancers to deal with the frost mages first.',
  'tip.guardsWorked': 'Your guards really did soak up ranged damage. Keep the front line and fine-tune the back line to save more units.',
  'tip.stone': 'Next time: {n} arrows hit a boulder. Move archers to a flank, or use bombers, who can lob over rock.',

  'unit.knight.name': 'Vanguard', 'unit.knight.role': 'Melee fighter', 'unit.knight.good': 'Cheap and quick. Good for filling the front line and adding melee damage.', 'unit.knight.watch': 'Not very sturdy; a lone vanguard gets focused down.',
  'unit.guard.name': 'Guard', 'unit.guard.role': 'Blocks ranged', 'unit.guard.good': 'Stands in front of the back line and takes 45% less ranged damage.', 'unit.guard.watch': 'Slow, and does not hit hard.',
  'unit.archer.name': 'Archer', 'unit.archer.role': 'Ranged damage', 'unit.archer.good': 'Shoots steadily from the back. Tap a placed archer to see its range.', 'unit.archer.watch': 'Arrows stop at boulders and at the first enemy in the way. Fragile in melee.',
  'unit.bomber.name': 'Bomber', 'unit.bomber.role': 'Area damage', 'unit.bomber.good': 'Punishes clustered enemies and can lob bombs over boulders.', 'unit.bomber.watch': 'Bombs land where the target stood, so spread-out or moving enemies are hard to catch together.',
  'unit.giant.name': 'Giant', 'unit.giant.role': 'Heavy front line', 'unit.giant.good': 'A huge pool of health for soaking damage and pushing the line forward.', 'unit.giant.watch': 'Expensive and slow, limit one per squad, and needs back-line support.',
  'unit.lancer.name': 'Lancer', 'unit.lancer.role': 'Back-line raider', 'unit.lancer.good': 'The fastest unit. Slips past the front line to hunt the enemy back line; its first hit after a run deals 2.4× damage.', 'unit.lancer.watch': 'Dives deep and can get surrounded. Enemy guards and giants can absorb its charge.',
  'unit.healer.name': 'Medic', 'unit.healer.role': 'Steady healing', 'unit.healer.good': 'Keeps healing the most wounded ally in range. Great with guards or a giant in a long fight.', 'unit.healer.watch': 'Cannot attack and is fragile. A squad of only medics cannot win.',
  'unit.mage.name': 'Frost Mage', 'unit.mage.role': 'Area slow', 'unit.mage.good': 'Its orb hits an area for light damage and slows enemy movement and attacks. Lobs over boulders.', 'unit.mage.watch': 'Low damage and slow to cast; it needs allies to finish the job.',

  'item.heal.name': 'Aid Flag', 'item.heal.short': 'Wounded recover 30% HP', 'item.heal.desc': 'Every living wounded unit recovers 30% of its max HP. Does not revive, and is not spent if everyone is at full health.',
  'item.smoke.name': 'Smoke Pot', 'item.smoke.short': '-65% arrow damage for 4s', 'item.smoke.desc': 'For 4 seconds your squad takes 65% less arrow damage, stacking with guards. Does nothing against melee or bombs.',
  'item.rally.name': 'Rally Horn', 'item.rally.short': '5s of speed and haste', 'item.rally.desc': 'For 5 seconds your squad moves 40% faster and recovers attacks 30% faster. Good for closing in or chasing.',
  'item.thunder.name': 'Thunder Scroll', 'item.thunder.short': 'Tap a spot to strike', 'item.thunder.desc': 'During battle, tap a spot on the field. A moment later lightning deals 46 damage to every enemy in the area, ignoring guard armour.',
  'item.frost.name': 'Frost Flask', 'item.frost.short': 'Freeze all enemies 2.6s', 'item.frost.desc': 'Every enemy is frozen for 2.6 seconds and can neither move nor attack. Arrows and bombs already in the air are not affected.',
  'item.unlockAt': 'Unlocks after level {n}', 'item.equipped': 'Equipped', 'item.pickTitle': 'Which item will you bring?', 'item.pickSub': 'Bring one. It costs no ink, you choose when to use it, and it refills on every retry.', 'item.recommend': 'Suggested here',

  'codex.title': 'Codex', 'codex.units': 'Units', 'codex.items': 'Items',
  'codex.hp': 'Health', 'codex.damage': 'Damage', 'codex.heal': 'Healing', 'codex.range': 'Range', 'codex.speed': 'Speed', 'codex.cost': 'Ink', 'codex.limit': 'Squad limit',
  'codex.good': 'Good for', 'codex.watch': 'Watch out', 'codex.unlockAt': 'Unlocks after level {n}',

  'shop.title': 'Banner Colours', 'shop.blurb': 'Changes only the colour of your squad. It never affects stats.', 'shop.equip': 'Use', 'shop.equipped': 'In use', 'shop.buy': 'Buy', 'shop.poor': 'Not enough coins',
  'skin.blue': 'Royal Blue', 'skin.teal': 'Teal', 'skin.green': 'Meadow Green', 'skin.purple': 'Wisteria', 'skin.pink': 'Blossom', 'skin.gold': 'Gilded',

  'hint.title': 'Strategist\'s Hint', 'hint.text': 'Shows a formation that won in testing without using an item ({stars} stars in testing). You only pay once per level.', 'hint.buy': 'Reveal for {n} coins', 'hint.poor': 'Not enough coins ({n} needed)',
  'hint.apply': 'Place it for me', 'hint.show': 'Show ghosts, I will place them', 'hint.owned': 'Hint unlocked for this level', 'hint.applied': 'Formation placed — you can start the battle', 'hint.ghosts': 'The ghosts are the hint formation: tap one to place it',

  'daily.title': 'Daily Bounty', 'daily.locked': 'Clear 3 levels to open the daily bounty', 'daily.goal': 'Earn 3 stars on level {n} “{title}” today', 'daily.reward': 'Reward: {n} coins',
  'daily.done': 'Today\'s bounty is done. Come back tomorrow!', 'daily.streak': '{n}-day streak', 'daily.go': 'Take it on', 'daily.reset': 'Refreshes at midnight',

  'ach.title': 'Awards', 'ach.toast': 'Award earned: {name}  +{n} coins', 'ach.toastMany': '{count} awards earned  +{n} coins', 'ach.done': 'Earned',
  'ach.first_win.name': 'First Blood', 'ach.first_win.desc': 'Win your first battle',
  'ach.wins_10.name': 'Making a Name', 'ach.wins_10.desc': 'Win 10 battles', 'ach.wins_50.name': 'Veteran', 'ach.wins_50.desc': 'Win 50 battles',
  'ach.chapter_1.name': 'Lord of the Meadow', 'ach.chapter_1.desc': 'Clear every level in chapter 1', 'ach.chapter_2.name': 'Canyon Conqueror', 'ach.chapter_2.desc': 'Clear every level in chapter 2',
  'ach.chapter_3.name': 'Icebreaker', 'ach.chapter_3.desc': 'Clear every level in chapter 3', 'ach.chapter_4.name': 'The Last Stroke', 'ach.chapter_4.desc': 'Clear every level in chapter 4',
  'ach.stars_30.name': 'First Light', 'ach.stars_30.desc': 'Earn 30 stars', 'ach.stars_60.name': 'Shining', 'ach.stars_60.desc': 'Earn 60 stars',
  'ach.stars_90.name': 'Galaxy', 'ach.stars_90.desc': 'Earn 90 stars', 'ach.stars_all.name': 'Sky Full of Stars', 'ach.stars_all.desc': 'Earn 3 stars on every level',
  'ach.perfect_chapter.name': 'Perfect Chapter', 'ach.perfect_chapter.desc': 'Earn 3 stars on every level of one chapter', 'ach.medals_5.name': 'Challenger', 'ach.medals_5.desc': 'Complete 5 bonus challenges',
  'ach.all_units.name': 'Master of Arms', 'ach.all_units.desc': 'Send every unit type into battle', 'ach.all_items.name': 'Quartermaster', 'ach.all_items.desc': 'Use every item at least once',
  'ach.flawless.name': 'Untouched', 'ach.flawless.desc': 'Win a level without losing a unit', 'ach.small_squad.name': 'Against the Odds', 'ach.small_squad.desc': 'Win a level with 3 units or fewer',
  'ach.fast_win.name': 'Blitz', 'ach.fast_win.desc': 'Win a level within 10 seconds', 'ach.daily_3.name': 'Persistent', 'ach.daily_3.desc': 'Complete the daily bounty 3 days in a row',
  'ach.daily_7.name': 'Rain or Shine', 'ach.daily_7.desc': 'Complete the daily bounty 7 days in a row', 'ach.skins_3.name': 'Palette', 'ach.skins_3.desc': 'Own 3 banner colours',
  'ach.sandbox.name': 'War Games', 'ach.sandbox.desc': 'Finish a sandbox battle',

  'settings.title': 'Settings', 'settings.language': 'Language', 'settings.music': 'Music', 'settings.sfx': 'Sound effects', 'settings.haptics': 'Vibration', 'settings.hapticsNA': 'Not supported in this browser',
  'settings.reduced': 'Reduce motion', 'settings.reducedNote': 'Turns off screen shake and extra animation', 'settings.feedback': 'Playtest feedback', 'settings.reset': 'Reset all progress', 'settings.resetConfirm': 'Erase level progress, coins and colours? This cannot be undone.',
  'settings.resetDone': 'Progress reset', 'settings.privacy': 'Single-player game: progress is stored only in this browser on this device and is never uploaded.', 'settings.version': 'Version {v}',
  'feedback.title': 'Tell us where you got stuck', 'feedback.note': 'Saved on this device only. Nothing is uploaded; you can export and share it yourself.', 'feedback.rating': 'Was it fun?', 'feedback.choose': 'Choose',
  'feedback.difficulty': 'How was the difficulty?', 'feedback.fair': 'Just right', 'feedback.easy': 'Too easy', 'feedback.hard': 'Too hard', 'feedback.comment': 'What was confusing, frustrating or fun?', 'feedback.placeholder': 'e.g. I could not tell why my arrows were not firing',
  'feedback.save': 'Save feedback on this device', 'feedback.saved': 'Saved on this device. Use the button below to export it.', 'feedback.unsaved': 'The browser could not save it. Please export now.', 'feedback.off': 'Recording is off. Turn it on to save feedback.',
  'feedback.record': 'Record play sessions on this device', 'feedback.summary': '{battles} battle results and {feedback} feedback notes stored; 500 events at most.', 'feedback.export': 'Export play data (JSON)', 'feedback.clear': 'Delete play data on this device', 'feedback.cleared': 'Play data deleted. Levels and formations are kept.',

  'guide.skip': 'Hide',
  'guide.front.title': '1 / 4 · Place two front-liners', 'guide.front.text': 'Drag the Guard into the front of the blue zone, or just tap a ghost.',
  'guide.rear.title': '2 / 4 · Add two archers', 'guide.rear.text': 'Put two archers behind the guards so the front protects the back.',
  'guide.move.title': '3 / 4 · Adjust a position', 'guide.move.text': 'Drag any unit to a new spot. Moving never costs extra ink.',
  'guide.start.title': '4 / 4 · See how it plays', 'guide.start.text': 'Spend leftover ink if you like, then tap “Fight!”.',
  'guide.inspect.title': 'Shield Wall · look first', 'guide.inspect.text': 'After placing a unit, tap it to see its range and route.',
  'guide.mix.title': 'Try a mixed squad', 'guide.mix.text': 'Enemy guards shrug off arrows. Add melee and compare the result.',
  'guide.wall.title': 'Watch the wall break', 'guide.wall.text': 'Start the battle. If you lose, your formation stays, so change one thing at a time.',
  'guide.blast.title': 'New unit · Bomber', 'guide.blast.text': 'The enemy bunches up in the middle. Add a bomber and let your front line hold them.',
  'guide.item.title': 'Pick an item', 'guide.item.text': 'Tap the item slot at the bottom right. You can use it once per battle.',
  'guide.area.title': 'Watch the blast', 'guide.area.text': 'See where the bombs land and check the bomber\'s damage in the review.',
  'guide.cover.title': 'Boulder Guard · check routes', 'guide.cover.text': 'Tap a unit to see how it walks around. If an archer is blocked, drag it to a flank.',
  'guide.lancer.title': 'New unit · Lancer', 'guide.lancer.text': 'Lancers slip past the front line to hunt the back line, and the first hit after a run hurts.',
  'guide.thunder.title': 'New item · Thunder Scroll', 'guide.thunder.text': 'Equip it in the item slot. In battle, tap the item and then a spot on the field.',
  'guide.healer.title': 'New unit · Medic', 'guide.healer.text': 'Medics heal wounded allies in range. Keep one behind your front line.',
  'guide.mage.title': 'New unit · Frost Mage', 'guide.mage.text': 'Its orb hits an area and slows enemies, which is great against a charge.',
  'guide.frost.title': 'New item · Frost Flask', 'guide.frost.text': 'Freezes every enemy for 2.6 seconds. Save it for when they reach you.',

  'spot.rear.goal': 'Protect the rear', 'spot.rear.desc': 'Win with at least one archer deployed and every archer alive.',
  'spot.mixed.goal': 'Mixed squad', 'spot.mixed.desc': 'Win using at least two unit types.',
  'spot.blast.goal': 'Area damage', 'spot.blast.desc': 'Win with a bomber that actually dealt damage.',
  'spot.sight.goal': 'Clean shots', 'spot.sight.desc': 'Win with archers who fired and never hit a boulder.',
  'spot.teamwork.goal': 'Teamwork', 'spot.teamwork.desc': 'Win using at least three unit types with three or more survivors.',
  'spot.intact.goal': 'In one piece', 'spot.intact.desc': 'Win with at least 5 survivors.',
  'spot.swift.goal': 'Swift victory', 'spot.swift.desc': 'Win within 25 seconds.',
  'spot.bare.goal': 'No items', 'spot.bare.desc': 'Win without using an item.',

  'toast.storage': 'Local storage is unavailable; progress may not be saved', 'toast.welcomeBack': 'Your earlier progress has been restored', 'toast.lang': 'Switched to English'
};

export const STRINGS = { zh, en };
export const LANGUAGES = [{ id: 'zh', label: '中文' }, { id: 'en', label: 'English' }];
let current = 'zh';
export function setLang(lang) { if (STRINGS[lang]) current = lang; return current; }
export const lang = () => current;
// 根据浏览器语言猜一个默认值：中文环境用中文，其余用英文。
export function detectLang(languages = globalThis.navigator?.languages || [globalThis.navigator?.language || 'en']) {
  return (languages[0] || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}
export function t(key, params = {}) {
  const text = STRINGS[current][key] ?? STRINGS.zh[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (m, name) => (params[name] !== undefined ? params[name] : m));
}
// 取关卡数据里 { zh, en } 形式的文字。
export const pick = value => (value && typeof value === 'object' ? value[current] ?? value.zh ?? '' : value ?? '');
