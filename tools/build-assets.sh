#!/bin/bash
# 把生图原图（art/inbox，体积大、不进仓库）处理成游戏用的小图（assets/，进仓库）。
# 需要 ImageMagick（magick）和 cwebp。重复运行会覆盖 assets/ 里的同名文件。
set -euo pipefail
cd "$(dirname "$0")/.."
IN=art/inbox
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p assets/bg assets/map assets/units assets/icons assets/obstacles assets/ui assets/icon

# 不透明大图：缩到指定宽度，有损 WebP。
opaque() { magick "$IN/$1.png" -resize "$3" "$TMP/o.png"; cwebp -quiet -q "$4" -m 6 "$TMP/o.png" -o "$2"; }
# 透明小图：裁掉四周空白，等比缩进方框并居中，保留透明通道。
sprite() { magick "$1" -fuzz 2% -trim +repage -resize "${3}x${3}" -background none -gravity center -extent "${3}x${3}" "$TMP/s.png"; cwebp -quiet -q "${4:-88}" -alpha_q 92 -m 6 "$TMP/s.png" -o "$2"; }
# 角色：裁掉空白后脚底贴着画布下沿，方便按脚底位置绘制。
unit() { magick "$1" -fuzz 2% -trim +repage -resize 300x300 -background none -gravity south -extent 320x320 "$TMP/u.png"; cwebp -quiet -q 90 -alpha_q 95 -m 6 "$TMP/u.png" -o "$2"; }

for t in meadow canyon snow citadel; do
  opaque "bg_field_$t" "assets/bg/field-$t.webp" 864x 78
  opaque "map_$t" "assets/map/$t.webp" 1024x 76
  sprite "$IN/obs_rock_$t.png" "assets/obstacles/rock-$t.webp" 320
done

# 每个兵种从两张候选里挑的那一张。
C=$IN/candidates
unit "$C/unit_knight/unit_knight_1.png" assets/units/knight.webp
unit "$C/unit_guard/unit_guard_2.png" assets/units/guard.webp
unit "$C/unit_archer/unit_archer_1.png" assets/units/archer.webp
unit "$C/unit_bomber/unit_bomber_2.png" assets/units/bomber.webp
unit "$C/unit_giant/unit_giant_2.png" assets/units/giant.webp
unit "$C/unit_lancer/unit_lancer_2.png" assets/units/lancer.webp
unit "$C/unit_healer/unit_healer_1.png" assets/units/healer.webp
unit "$C/unit_mage/unit_mage_2.png" assets/units/mage.webp

# 背面图（朝右上、背对镜头）：以上面选中的正面图为参考生成，同样从两张候选里挑一张。
unit "$C/unit_knight_back/unit_knight_back_1.png" assets/units/knight-back.webp
unit "$C/unit_guard_back/unit_guard_back_1.png" assets/units/guard-back.webp
unit "$C/unit_archer_back/unit_archer_back_1.png" assets/units/archer-back.webp
unit "$C/unit_bomber_back/unit_bomber_back_1.png" assets/units/bomber-back.webp
unit "$C/unit_giant_back/unit_giant_back_2.png" assets/units/giant-back.webp
unit "$C/unit_lancer_back/unit_lancer_back_1.png" assets/units/lancer-back.webp
unit "$C/unit_healer_back/unit_healer_back_2.png" assets/units/healer-back.webp
unit "$C/unit_mage_back/unit_mage_back_1.png" assets/units/mage-back.webp

for i in heal rally smoke thunder frost; do sprite "$IN/item_$i.png" "assets/icons/item-$i.webp" 192; done
for i in coin star ink chest trophy daily codex hint sandbox palette map; do sprite "$IN/ico_$i.png" "assets/icons/$i.webp" 160; done
sprite "$IN/art_victory.png" assets/ui/victory.webp 512
sprite "$IN/art_defeat.png" assets/ui/defeat.webp 384
magick "$IN/logo_zh.png" -fuzz 2% -trim +repage -resize 900x "$TMP/logo.png"; cwebp -quiet -q 90 -alpha_q 95 -m 6 "$TMP/logo.png" -o assets/ui/logo.webp

# 电脑版：横版战场背景、主页、远征地图（各从两张候选里挑一张），地图节点和遗物图标。
pick() { magick "$1" -resize "$3" "$TMP/o.png"; cwebp -quiet -q "$4" -m 6 "$TMP/o.png" -o "$2"; }
pick "$C/bg_home_wide/bg_home_wide_2.png" assets/bg/home-wide.webp 1600x 80
pick "$C/bg_field_meadow_wide/bg_field_meadow_wide_1.png" assets/bg/field-meadow-wide.webp 1400x 78
pick "$C/bg_field_canyon_wide/bg_field_canyon_wide_1.png" assets/bg/field-canyon-wide.webp 1400x 78
pick "$C/bg_field_snow_wide/bg_field_snow_wide_2.png" assets/bg/field-snow-wide.webp 1400x 78
pick "$C/bg_field_citadel_wide/bg_field_citadel_wide_2.png" assets/bg/field-citadel-wide.webp 1400x 78
pick "$C/map_run_meadow/map_run_meadow_1.png" assets/map/run-meadow.webp 1400x 76
pick "$C/map_run_canyon/map_run_canyon_2.png" assets/map/run-canyon.webp 1400x 76
pick "$C/map_run_snow/map_run_snow_2.png" assets/map/run-snow.webp 1400x 76
for k in battle elite boss camp shop event; do sprite "$IN/node_$k.png" "assets/icons/node-$k.webp" 160; done
sprite "$IN/node_heart.png" assets/icons/heart.webp 128
for r in swift charge flank anchor thick sharp thrift squad drum bleed spring echo bounty longbow fervor pact horde warcry tactician scholar; do sprite "$IN/relic_$r.png" "assets/icons/relic-$r.webp" 160; done
# 卡牌：战术牌图标和战墨图标。
for t in reinforce assault shield; do sprite "$IN/tactic_$t.png" "assets/icons/tactic-$t.webp" 160; done
sprite "$IN/icon_momentum.png" assets/icons/momentum.webp 128

# 应用图标：PWA、iOS 主屏幕和浏览器标签页。
magick "$IN/app_icon.png" -resize 512x512 -strip assets/icon/icon-512.png
magick "$IN/app_icon.png" -resize 192x192 -strip assets/icon/icon-192.png
magick "$IN/app_icon.png" -resize 180x180 -strip assets/icon/apple-touch-icon.png
magick "$IN/app_icon.png" -resize 64x64 -strip assets/icon/favicon-64.png
du -sh assets | cut -f1
