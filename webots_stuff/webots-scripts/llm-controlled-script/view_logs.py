#!/usr/bin/env python3
import http.server
import socketserver
import os
import webbrowser
import sys
import glob

PORT = 8000
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DIRECTORY = SCRIPT_DIR

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path == '/api/missions':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            missions = glob.glob(os.path.join(SCRIPT_DIR, "drone_logs/mission_*"))
            # Return relative paths to SCRIPT_DIR
            rel_missions = [os.path.relpath(m, SCRIPT_DIR) for m in sorted(missions, reverse=True)]
            
            import json
            self.wfile.write(json.dumps(rel_missions).encode())
        else:
            return super().do_GET()

def find_latest_mission():
    missions = glob.glob(os.path.join(SCRIPT_DIR, "drone_logs/mission_*"))
    if not missions:
        return None
    return sorted(missions)[-1]

def main():
    latest = find_latest_mission()
    if not latest:
        print("❌ No missions found in drone_logs/")
        # Even without missions, we can start the server
        url = f"http://localhost:{PORT}/frontend/index.html"
    else:
        print(f"📂 Found latest mission: {latest}")
        # Get relative path from SCRIPT_DIR to latest mission folder
        rel_latest = os.path.relpath(latest, SCRIPT_DIR)
        url = f"http://localhost:{PORT}/frontend/index.html?mission={rel_latest}"

    port = PORT
    server = None
    while port < PORT + 10:
        try:
            server = socketserver.TCPServer(("", port), Handler)
            break
        except OSError as e:
            if e.errno == 48: # Address already in use
                print(f"⚠️  Port {port} is busy, trying {port + 1}...")
                port += 1
            else:
                raise e

    if not server:
        print("❌ Could not find an available port in range 8000-8010")
        return

    # Update URL if port changed
    if port != PORT:
        url = url.replace(f":{PORT}", f":{port}")

    print(f"🚀 Starting server at http://localhost:{port}")
    print(f"📊 Dashboard available at: {url}")
    
    try:
        with server as httpd:
            print("Press Ctrl+C to stop the server")
            webbrowser.open(url)
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Server stopped")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
