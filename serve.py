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
class Handler(http.server.SimpleHTTPRequestHandler):
    # 游戏启动时会同时请求几十个模块和图片，用长连接减少建连次数。
    protocol_version = 'HTTP/1.1'

    def end_headers(self):
        # 本地试玩时每次都拿最新文件，避免改了代码却加载到旧模块。
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *values):
        if len(values) > 1 and str(values[1]) in ('200', '304'):
            return
        super().log_message(fmt, *values)


class Server(http.server.ThreadingHTTPServer):
    # 默认的等待队列只有 5，浏览器并发连接多时会被拒绝。
    request_queue_size = 128
    daemon_threads = True


handler = functools.partial(Handler, directory=str(root))
try:
    server = Server((args.host, args.port), handler)
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
