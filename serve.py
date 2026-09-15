#!/usr/bin/env python3
"""Локальний статичний сервер для Rookh PWA.

    python3 serve.py            # http://localhost:8765 і http://<IP-Mac>:8765
    python3 serve.py 9000       # інший порт
"""
import http.server, socketserver, socket, sys, os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".webmanifest": "application/manifest+json",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Service-Worker-Allowed", "/")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "localhost"
    finally:
        s.close()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


print("Rookh PWA:")
print(f"  http://localhost:{PORT}")
print(f"  http://{lan_ip()}:{PORT}   <- відкрити з iPhone у тій самій Wi-Fi мережі")
print("Ctrl+C щоб зупинити")
Server(("0.0.0.0", PORT), Handler).serve_forever()
