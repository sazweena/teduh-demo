"""Serve the v2 map on localhost with the Google key from this Windows user."""

import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def google_maps_key():
    key = os.environ.get("TEDUH_GOOGLE_MAPS_KEY")
    if key or os.name != "nt":
        return key
    import winreg

    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as user_env:
        try:
            return winreg.QueryValueEx(user_env, "TEDUH_GOOGLE_MAPS_KEY")[0]
        except FileNotFoundError:
            return None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).parent), **kwargs)

    def do_GET(self):
        if self.path.split("?", 1)[0] != "/v2-local-config.json":
            return super().do_GET()
        key = google_maps_key()
        body = json.dumps({"googleMapsKey": key}).encode()
        self.send_response(200 if key else 503)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8765), Handler)
    print("Teduh v2: http://127.0.0.1:8765/v2-map.html")
    server.serve_forever()
