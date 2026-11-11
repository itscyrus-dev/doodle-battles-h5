#!/usr/bin/env python3
"""打包本地试玩版：网页版文件 + 本地启动器 + 试玩说明，压成一个 zip 方便发给别人。"""
import hashlib
import json
import pathlib
import shutil
import subprocess
import sys
import zipfile

root = pathlib.Path(__file__).resolve().parents[1]
version = json.loads((root / 'release.json').read_text())['version']
subprocess.run([sys.executable, str(root / 'release' / 'build_web.py')], check=True, stdout=subprocess.DEVNULL)
name = f'draw-clash-playtest-{version}'
out = root / 'dist'
staging = out / name
if staging.exists():
    shutil.rmtree(staging)
shutil.copytree(out / 'web', staging)
# 本地启动不需要 Cloudflare 的响应头文件；离线缓存只在正式站点启用。
(staging / '_headers').unlink()
for filename in ['serve.py', 'start.command', 'start-lan.command', 'PLAYTEST.md', 'release.json']:
    shutil.copy2(root / filename, staging / filename)
manifest = {str(p.relative_to(staging)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(staging.rglob('*')) if p.is_file()}
(staging / 'SHA256.json').write_text(json.dumps(manifest, indent=2) + '\n')
archive = out / f'{name}.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for path in sorted(staging.rglob('*')):
        if path.is_file():
            z.write(path, str(path.relative_to(out)))
print(json.dumps({'archive': str(archive), 'folder': str(staging), 'files': len(manifest) + 1, 'bytes': archive.stat().st_size}, ensure_ascii=False))
