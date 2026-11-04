#!/usr/bin/env python3
"""Local, dependency-free bridge: symbolic events -> durable file for Dagor.

The viewer polls the file. Only an external 'clear' changes the active scene
back to quiet. No scheduling or implicit success conditions exist here.
"""
import argparse
import json
import os
from pathlib import Path
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

KINDS = {
    'contact': 'contact', 'alert': 'contact',
    'engage_light': 'engage_light', 'incoming': 'engage_light',
    'engage_heavy': 'engage_heavy', 'engage': 'engage_heavy',
    'clear': 'clear',
}


def validate(payload):
    if not isinstance(payload, dict):
        raise ValueError('event must be a JSON object')
    unknown = set(payload) - {'type', 'targets', 'count', 'siren'}
    if unknown:
        raise ValueError('unknown keys: ' + ', '.join(sorted(unknown)))
    mode = KINDS.get(payload.get('type'))
    if mode is None:
        raise ValueError('type must be contact, engage_light, engage_heavy or clear')
    if 'targets' in payload and 'count' in payload:
        raise ValueError('use either targets or count, not both')
    targets = payload.get('targets', payload.get('count', 1 if mode == 'clear' else 3))
    if type(targets) is not int or not (1 <= targets <= 6):
        raise ValueError('targets must be an integer from 1 to 6')
    if 'siren' in payload and type(payload['siren']) is not bool:
        raise ValueError('siren must be boolean')
    # Siren is reserved for a future opt-in audio backend, not enabled here.
    return mode, targets


class SignalStore:
    def __init__(self, path):
        self.path = Path(path).resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self.sequence = 0
        self.mode = 'clear'
        self.targets = 1
        if self.path.exists():
            parts = self.path.read_text(encoding='ascii').strip().split()
            if len(parts) != 4 or parts[0] != 'AERO1':
                raise ValueError('unknown persisted state format')
            self.sequence = int(parts[1]); self.mode = parts[2]; self.targets = int(parts[3])
            if self.sequence < 0 or self.mode not in KINDS.values() or not 1 <= self.targets <= 6:
                raise ValueError('invalid persisted state')

    def status(self):
        with self.lock:
            return {'sequence': self.sequence, 'type': self.mode,
                    'targets': self.targets, 'active': self.mode != 'clear'}

    def apply(self, payload):
        mode, targets = validate(payload)
        with self.lock:
            sequence = self.sequence + 1
            data = f'AERO1 {sequence} {mode} {targets}\n'
            tmp = None
            try:
                with tempfile.NamedTemporaryFile('w', encoding='ascii', dir=self.path.parent,
                                                 prefix='.aero-', delete=False) as handle:
                    tmp = handle.name
                    os.chmod(tmp, 0o600)
                    handle.write(data)
                    handle.flush()
                    os.fsync(handle.fileno())
                os.replace(tmp, self.path)
            finally:
                if tmp and os.path.exists(tmp):
                    os.unlink(tmp)
            self.sequence, self.mode, self.targets = sequence, mode, targets
            return {'sequence': sequence, 'type': mode, 'targets': targets,
                    'active': mode != 'clear'}


def make_server(store, port=8011):
    class Handler(BaseHTTPRequestHandler):
        def respond(self, code, value):
            data = json.dumps(value, ensure_ascii=False).encode('utf-8')
            self.send_response(code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if self.path in ('/api/state', '/health'):
                self.respond(200, store.status())
            else:
                self.respond(404, {'error': 'not found'})

        def do_POST(self):
            if self.path != '/api/event':
                return self.respond(404, {'error': 'not found'})
            if self.headers.get('Content-Type', '').split(';')[0].strip().lower() != 'application/json':
                return self.respond(415, {'error': 'Content-Type must be application/json'})
            try:
                length = int(self.headers.get('Content-Length', '-1'))
                if not 0 < length <= 4096:
                    raise ValueError('request body must contain 1..4096 bytes')
                raw = self.rfile.read(length)
                payload = json.loads(raw)
                result = store.apply(payload)
            except (ValueError, UnicodeDecodeError) as exc:
                return self.respond(400, {'error': str(exc)})
            self.respond(202, result)

        def log_message(self, fmt, *args):
            print(f'[aero API] {self.address_string()} {fmt % args}', flush=True)

    return ThreadingHTTPServer(('127.0.0.1', port), Handler)


def main():
    ap = argparse.ArgumentParser(description='Aero Fighter local symbolic-event API')
    ap.add_argument('--port', type=int, default=8011)
    ap.add_argument('--state-file', type=Path,
                    default=Path(__file__).resolve().parents[1] / '.runtime' / 'aero.state')
    args = ap.parse_args()
    server = make_server(SignalStore(args.state_file), args.port)
    print(f'Aero API listening at http://127.0.0.1:{server.server_port}; state {args.state_file}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
