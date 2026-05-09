#!/usr/bin/env python3
"""
Gear App · Local dev server
Run:  python3 serve.py
Then open:  http://localhost:8000
"""
import http.server
import socketserver
import os

PORT = 8000

# Serve .jsx files with the correct MIME type so Babel can transpile them
class GearHandler(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        if path.endswith('.jsx'):
            return 'application/javascript'
        return super().guess_type(path)

    def log_message(self, format, *args):
        print(f"  {self.address_string()} — {format % args}")

os.chdir(os.path.dirname(os.path.abspath(__file__)))

with socketserver.TCPServer(("", PORT), GearHandler) as httpd:
    print(f"\n  Gear App running at http://localhost:{PORT}")
    print(f"  Press Ctrl+C to stop\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")
