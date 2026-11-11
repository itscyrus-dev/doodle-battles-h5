#!/usr/bin/env python3
"""打出一次发布要用的全部文件：网页包 zip 和本地试玩包 zip，都放在 dist/。

GitHub Actions 的 CI 和自动发布都调用这个脚本；本地也可以直接运行来检查。
"""
import json
import pathlib
import subprocess
import sys
import zipfile

root = pathlib.Path(__file__).resolve().parents[1]
version = json.loads((root / 'release.json').read_text())['version']
# build_playtest.py 会先调用 build_web.py 生成 dist/web，再打本地试玩包。
subprocess.run([sys.executable, str(root / 'release' / 'build_playtest.py')], check=True, stdout=subprocess.DEVNULL)

web = root / 'dist' / 'web'
web_zip = root / 'dist' / f'draw-clash-web-{version}.zip'
with zipfile.ZipFile(web_zip, 'w', zipfile.ZIP_DEFLATED) as z:
    for path in sorted(web.rglob('*')):
        if path.is_file():
            # index.html 在压缩包根目录，解压后可以直接放到任何静态托管。
            z.write(path, str(path.relative_to(web)))
playtest_zip = root / 'dist' / f'draw-clash-playtest-{version}.zip'
for archive in (web_zip, playtest_zip):
    if not archive.is_file() or archive.stat().st_size < 100_000:
        raise SystemExit(f'发布文件缺失或过小：{archive}')
print(json.dumps({'version': version, 'files': [{'name': a.name, 'bytes': a.stat().st_size} for a in (web_zip, playtest_zip)]}, ensure_ascii=False))
