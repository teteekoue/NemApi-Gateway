#!/usr/bin/env python3
"""Debug Proxy pour NemApi / Qwen Coder
Enregistre les requêtes reçues pour analyse.
"""

import json
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import threading

HOST, PORT = "127.0.0.1", 8081
LOG_FILE = "debug_requests.json"
log_lock = threading.Lock()


class DebugHandler(BaseHTTPRequestHandler):
    server_version = "DebugProxy/1.0"

    def log_message(self, _fmt, *_args):
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def _json(self, obj, code=200):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_json(self):
        size = int(self.headers.get("Content-Length") or 0)
        if size <= 0:
            return {}
        return json.loads(self.rfile.read(size).decode("utf-8") or "{}")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        path = self.path
        try:
            if path == "/v1/chat/completions":
                self._handle_chat_completion()
            elif path == "/v1/models":
                self._json({
                    "object": "list",
                    "data": [
                        {"id": "deepseek-chat", "object": "model", "owned_by": "deepseek"},
                        {"id": "qwen-plus", "object": "model", "owned_by": "qwen"},
                        {"id": "claude-sonnet", "object": "model", "owned_by": "claude"},
                        {"id": "gemini-2.5-flash", "object": "model", "owned_by": "gemini"}
                    ]
                })
            else:
                self._json({"error": {"message": "not found", "type": "not_found"}}, 404)
        except Exception as e:
            self._json({"error": {"message": str(e), "type": "server_error"}}, 500)

    def _handle_chat_completion(self):
        body = self._read_json()
        request_record = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f"),
            "headers": dict(self.headers),
            "body": body,
        }
        with log_lock:
            try:
                try:
                    with open(LOG_FILE, "r", encoding="utf-8") as f:
                        requests = json.load(f)
                except Exception:
                    requests = []
                requests.append(request_record)
                if len(requests) > 100:
                    requests = requests[-100:]
                with open(LOG_FILE, "w", encoding="utf-8") as f:
                    json.dump(requests, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print(f"[ERREUR] Impossible de sauvegarder: {e}")

        response = {
            "id": f"chatcmpl-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": body.get("model", "deepseek-chat"),
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "Réponse de test du debug proxy."
                },
                "finish_reason": "stop"
            }],
            "usage": {"prompt_tokens": 10, "completion_tokens": 10, "total_tokens": 20}
        }
        self._json(response)


def main():
    server = ThreadingHTTPServer((HOST, PORT), DebugHandler)
    print(f"Debug Proxy listening on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
