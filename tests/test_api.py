import json
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'native'))
from api_server import SignalStore, make_server, validate

class ApiTests(unittest.TestCase):
    def test_rejects_invalid(self):
        for payload in (None, [], {}, {'type':'boom'}, {'type':'engage_heavy','targets':9},
                        {'type':'clear','targets':True}, {'type':'clear','duration':20}):
            with self.assertRaises(ValueError):
                validate(payload)

    def test_persists_until_external_clear(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / 'state.txt'
            store = SignalStore(file)
            event = store.apply({'type':'engage_heavy','targets':4})
            self.assertTrue(event['active'])
            self.assertEqual(file.read_text(), 'AERO1 1 engage_heavy 4\n')
            store = SignalStore(file)
            self.assertEqual(store.status()['type'], 'engage_heavy')
            self.assertTrue(store.status()['active'])
            store.apply({'type':'clear'})
            self.assertFalse(SignalStore(file).status()['active'])

    def test_http(self):
        with tempfile.TemporaryDirectory() as directory:
            server = make_server(SignalStore(Path(directory)/'signal'), 0)
            worker = threading.Thread(target=server.serve_forever, daemon=True)
            worker.start()
            url = f'http://127.0.0.1:{server.server_port}'
            try:
                data = json.dumps({'type':'incoming','targets':2}).encode()
                request = Request(url+'/api/event',data=data,headers={'Content-Type':'application/json'},method='POST')
                with urlopen(request,timeout=2) as response:
                    self.assertEqual(response.status,202)
                    self.assertEqual(json.load(response)['type'],'engage_light')
                with urlopen(url+'/api/state',timeout=2) as response:
                    self.assertTrue(json.load(response)['active'])
                with self.assertRaises(HTTPError) as bad:
                    urlopen(Request(url+'/api/event',data=b'{"type":"clear"}',headers={'Content-Type':'text/plain'}),timeout=2)
                self.assertEqual(bad.exception.code,415)
            finally:
                server.shutdown();server.server_close();worker.join(timeout=3)

if __name__ == '__main__':
    unittest.main()
