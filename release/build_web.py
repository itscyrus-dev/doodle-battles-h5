#!/usr/bin/env python3
"""打包网页试玩版：只含运行文件，输出到 dist/web。

不包含测试、工具、开发预览或本机记录。Cloudflare Pages 连接 GitHub 仓库后，
构建命令填 `python3 release/build_web.py`，输出目录填 `dist/web`，推送到 main 即自动发布。
"""
import json
import pathlib
import re
import shutil

root = pathlib.Path(__file__).resolve().parents[1]
version = json.loads((root / 'release.json').read_text())['version']
out = root / 'dist' / 'web'
if out.exists():
    shutil.rmtree(out)
(out / 'src').mkdir(parents=True)
files = ['index.html', 'styles.css', 'favicon.svg']
files += [str(p.relative_to(root)) for p in sorted((root / 'src').glob('*.mjs'))]
for filename in files:
    shutil.copy2(root / filename, out / filename)

# 试玩版不进搜索引擎：页面里加 robots 标记，换别的托管也有效。
page = out / 'index.html'
html = page.read_text(encoding='utf-8')
assert html.count('<meta charset="UTF-8">') == 1
page.write_text(html.replace('<meta charset="UTF-8">', '<meta charset="UTF-8"><meta name="robots" content="noindex,nofollow">'), encoding='utf-8')

# Cloudflare Pages 响应头：每次打开都向服务器确认新版本，避免更新后新旧模块混用。
(out / '_headers').write_text('/*\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: no-cache\n')

# 确认所有相对模块引用都在包里，缺文件时直接报错，不上传半个游戏。
missing = []
for module in sorted((out / 'src').glob('*.mjs')):
    for ref in re.findall(r"""(?:from\s*|import\s*\(\s*)['"](\.{1,2}/[^'"]+)['"]""", module.read_text(encoding='utf-8')):
        if not (module.parent / ref).resolve().is_file():
            missing.append(f'{module.name} -> {ref}')
for ref in re.findall(r'(?:src|href)="([^"#:]+)"', html):
    if ref not in ('./',) and not (out / ref).is_file():
        missing.append(f'index.html -> {ref}')
if missing:
    raise SystemExit('缺少文件：\n' + '\n'.join(missing))
print(json.dumps({'folder': str(out), 'version': version, 'files': len(files) + 1}, ensure_ascii=False))
