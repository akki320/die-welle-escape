#!/usr/bin/env python3
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

os.chdir(os.path.dirname(os.path.abspath(__file__)))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 3456
print(f"Serving on http://localhost:{port}")
HTTPServer(("", port), SimpleHTTPRequestHandler).serve_forever()
