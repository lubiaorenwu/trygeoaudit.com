#!/usr/bin/env python3
"""API server for GEO Audit Scanner."""
import json, sys, os
from http.server import HTTPServer, BaseHTTPRequestHandler
sys.path.insert(0, os.path.dirname(__file__))
from scanner import GEOScanner

class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
    
    def do_POST(self):
        if self.path != "/scan":
            self.send_response(404); self.end_headers(); return
        
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length))
        brand = body.get("brand", "").strip()
        domain = body.get("domain", "").strip()
        
        if not brand:
            self.send_json({"error": "Brand name required"}, 400); return
        
        scanner = GEOScanner(brand, domain)
        result = scanner.scan()
        self.send_json(result)
    
    def send_json(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())
    
    def log_message(self, *a): pass  # quiet

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    print(f"GEO Audit API on http://localhost:{port}/scan")
    HTTPServer(("127.0.0.1", port), Handler).serve_forever()
