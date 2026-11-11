#!/usr/bin/env python3
"""只打包运行文件，不打包开发预览、测试数据或本机记录。"""
import hashlib
import json
import pathlib
import shutil
import zipfile

root = pathlib.Path(__file__).resolve().parents[1]
name = 'doodle-battles-playtest-' + json.loads((root / 'release.json').read_text())['version']
out = root / 'dist'
staging = out / name
out.mkdir(exist_ok=True)
if staging.exists():
    shutil.rmtree(staging)
staging.mkdir()
files = ['index.html', 'styles.css', 'favicon.svg', 'serve.py', 'start.command',
         'start-lan.command', 'PLAYTEST.md', 'release.json']
files += [str(p.relative_to(root)) for p in sorted((root / 'src').glob('*.mjs'))]
for filename in files:
    target = staging / filename
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / filename, target)
manifest = {f: hashlib.sha256((staging / f).read_bytes()).hexdigest() for f in files}
(staging / 'SHA256.json').write_text(json.dumps(manifest, indent=2) + '\n')
archive = out / f'{name}.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for path in sorted(staging.rglob('*')):
        if path.is_file():
            z.write(path, str(path.relative_to(out)))
print(json.dumps({'archive': str(archive), 'folder': str(staging),
                  'files': len(manifest) + 1, 'bytes': archive.stat().st_size}, ensure_ascii=False))
