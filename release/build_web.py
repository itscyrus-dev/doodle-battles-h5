#!/usr/bin/env python3
"""打包网页版：只含运行文件，输出到 dist/web。

不包含测试、工具、生图原图或本机记录。Cloudflare Pages 连接 GitHub 仓库后，
构建命令填 `python3 release/build_web.py`，输出目录填 `dist/web`，推送到 main 即自动发布。
"""
import hashlib
import json
import pathlib
import re
import shutil

root = pathlib.Path(__file__).resolve().parents[1]
version = json.loads((root / 'release.json').read_text())['version']
out = root / 'dist' / 'web'
if out.exists():
    shutil.rmtree(out)
out.mkdir(parents=True)

files = ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js']
files += sorted(str(p.relative_to(root)) for p in (root / 'src').rglob('*.mjs'))
files += sorted(str(p.relative_to(root)) for p in (root / 'assets').rglob('*') if p.is_file() and p.name != '.DS_Store')
for filename in files:
    target = out / filename
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / filename, target)

# 试玩阶段不进搜索引擎：页面里加 robots 标记，换别的托管也有效。正式发行时去掉这两处即可。
page = out / 'index.html'
html = page.read_text(encoding='utf-8')
assert html.count('<meta charset="UTF-8">') == 1
page.write_text(html.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n<meta name="robots" content="noindex,nofollow">'), encoding='utf-8')

# 确认所有引用都在包里，缺文件时直接报错，不上传半个游戏。
missing = []
for module in sorted((out / 'src').rglob('*.mjs')):
    for ref in re.findall(r"""(?:from\s*|import\s*\(\s*)['"](\.{1,2}/[^'"]+)['"]""", module.read_text(encoding='utf-8')):
        if not (module.parent / ref).resolve().is_file():
            missing.append(f'{module.name} -> {ref}')
for ref in re.findall(r'(?:src|href)="([^"#:]+)"', html):
    if ref not in ('./',) and not (out / ref).is_file():
        missing.append(f'index.html -> {ref}')
css = (out / 'styles.css').read_text(encoding='utf-8')
for ref in re.findall(r'url\(([^)]+)\)', css):
    if not (out / ref.strip('\'"')).is_file():
        missing.append(f'styles.css -> {ref}')
units = ['knight', 'guard', 'archer', 'bomber', 'giant', 'lancer', 'healer', 'mage']
themes = ['meadow', 'canyon', 'snow', 'citadel']
needed = [f'units/{u}{view}.webp' for u in units for view in ('', '-back')] + [f'icons/item-{i}.webp' for i in ['heal', 'smoke', 'rally', 'thunder', 'frost']]
needed += [f'icons/{i}.webp' for i in ['coin', 'star', 'ink', 'trophy', 'daily', 'codex', 'hint', 'sandbox', 'palette', 'map']]
needed += [f'{kind}-{t}.webp'.replace('bg-', 'bg/field-').replace('map-', 'map/').replace('rock-', 'obstacles/rock-') for kind in ['bg', 'map', 'rock'] for t in themes]
needed += [f'bg/field-{t}-wide.webp' for t in themes] + [f'map/run-{t}.webp' for t in themes[:3]] + ['bg/home-wide.webp', 'icons/heart.webp', 'icons/chest.webp']
needed += [f'icons/node-{k}.webp' for k in ['battle', 'elite', 'boss', 'camp', 'shop', 'event']]
needed += [f'icons/relic-{r}.webp' for r in ['swift', 'charge', 'flank', 'anchor', 'thick', 'sharp', 'thrift', 'squad', 'drum', 'bleed', 'spring', 'echo', 'bounty', 'longbow']]
needed += ['ui/logo.webp', 'ui/victory.webp', 'ui/defeat.webp', 'icon/icon-192.png', 'icon/icon-512.png', 'icon/apple-touch-icon.png', 'icon/favicon-64.png']
missing += [f'assets/{a}' for a in needed if not (out / 'assets' / a).is_file()]
if missing:
    raise SystemExit('缺少文件：\n' + '\n'.join(missing))

# 离线缓存清单：版本号带上内容指纹，任何文件变化都会让旧缓存失效。
digest = hashlib.sha256()
for filename in files:
    if filename != 'sw.js':
        digest.update(filename.encode())
        digest.update((out / filename).read_bytes())
build = f'{version}-{digest.hexdigest()[:10]}'
cache_list = ['./'] + [f for f in files if f not in ('sw.js', 'index.html')]
worker = (out / 'sw.js').read_text(encoding='utf-8')
assert worker.count("'__VERSION__'") == 1 and worker.count('= __FILES__;') == 1
(out / 'sw.js').write_text(worker.replace("'__VERSION__'", json.dumps(build)).replace('= __FILES__;', '= ' + json.dumps(cache_list) + ';'), encoding='utf-8')

# Cloudflare Pages 响应头：页面和代码每次确认新版本；图片可以短暂缓存。
(out / '_headers').write_text('/*\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: no-cache\n/assets/*\n  ! Cache-Control\n  Cache-Control: public, max-age=3600\n')
size = sum(p.stat().st_size for p in out.rglob('*') if p.is_file())
print(json.dumps({'folder': str(out), 'version': version, 'build': build, 'files': len(files) + 1, 'bytes': size}, ensure_ascii=False))
