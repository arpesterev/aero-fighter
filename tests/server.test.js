import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createAppServer} from '../server.js';
async function withServer(fn){
  const server=createAppServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${server.address().port}`;
  try{await fn(url);}finally{server.closeAllConnections?.();server.close();await once(server,'close');}
}
test('serves scene and modules without exposing server files',async()=>withServer(async base=>{
  const page=await fetch(base+'/');assert.equal(page.status,200);
  assert.match(await page.text(),/AERO FIGHTER/);
  const module=await fetch(base+'/js/world.js');assert.equal(module.status,200);
  assert.match(module.headers.get('content-type'),/javascript/);
  assert.equal((await fetch(base+'/server.js')).status,404);
  assert.equal((await fetch(base+'/tests/server.test.js')).status,404);
}));
test('validates JSON event and exposes last event',async()=>withServer(async base=>{
  const invalid=await fetch(base+'/api/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'bad'})});
  assert.equal(invalid.status,400);
  const accepted=await fetch(base+'/api/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'incoming',count:2,siren:false})});
  assert.equal(accepted.status,202);
  const value=await accepted.json();assert.equal(value.event.count,2);assert.equal(value.event.type,'incoming');
  const status=await (await fetch(base+'/api/state')).json();assert.equal(status.lastEvent.id,value.event.id);
}));
test('SSE streams published event',async()=>withServer(async base=>{
  const controller=new AbortController();
  const stream=await fetch(base+'/api/events',{signal:controller.signal});
  assert.equal(stream.status,200);
  const reader=stream.body.getReader();
  const send=await fetch(base+'/api/event',{method:'POST',body:JSON.stringify({type:'alert',count:1}),headers:{'Content-Type':'application/json'}});
  assert.equal(send.status,202);
  let text='';
  const deadline=Date.now()+1500;
  while(Date.now()<deadline && !text.includes('"type":"alert"')){
    const {value,done}=await reader.read();if(done)break;text+=new TextDecoder().decode(value);
  }
  assert.match(text,/"type":"alert"/);
  controller.abort();reader.cancel().catch(()=>{});
}));
