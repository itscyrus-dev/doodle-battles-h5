#!/usr/bin/env python3
"""仅依赖 Python 标准库的本地试玩服务器。"""
import argparse
import functools
import http.server
import pathlib
import webbrowser
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=5183)
parser.add_argument('--host', default='127.0.0.1')
parser.add_argument('--no-open', action='store_true')
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parent
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
try:
    server = http.server.ThreadingHTTPServer((args.host, args.port), handler)
except OSError as exc:
    raise SystemExit(f'无法启动端口 {args.port}：{exc}。可加 --port 5184 换端口。')
url = f'http://127.0.0.1:{args.port}'
print(f'涂鸦小队试玩：{url}  按 Ctrl+C 停止。', flush=True)
if args.host == '0.0.0.0':
    for interface in ('en0', 'en1'):
        try:
            result = subprocess.run(['ipconfig', 'getifaddr', interface], capture_output=True, text=True, timeout=2)
            address = result.stdout.strip()
            if result.returncode == 0 and address:
                print(f'同一 Wi-Fi 手机访问：http://{address}:{args.port}', flush=True)
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
if not args.no_open:
    webbrowser.open(url)
try:
    server.serve_forever()
except KeyboardInterrupt:
    server.server_close()
