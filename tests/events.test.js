import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEvent} from '../js/events.js';
test('allows known cinematic events and normalizes defaults',()=>{
  assert.deepEqual(validateEvent({type:'incoming'}),{type:'incoming',count:3,severity:2,siren:false});
  assert.deepEqual(validateEvent({type:'clear',count:1}),{type:'clear',count:1,severity:2,siren:false});
  assert.deepEqual(validateEvent({type:'engage',count:6,severity:3,siren:true}),{type:'engage',count:6,severity:3,siren:true});
});
test('rejects invalid shapes and unsafe values',()=>{
  for(const v of [null,[],7,{},{type:'shell'},{type:'incoming',count:0},{type:'incoming',count:7},{type:'incoming',count:1.4},{type:'incoming',severity:4},{type:'incoming',siren:'true'}])assert.throws(()=>validateEvent(v));
});
test('drops unknown payload fields',()=>{
  const evt=validateEvent({type:'alert',siren:false,command:'launch anything',apiKey:'secret'});
  assert.equal(evt.command,undefined);assert.equal(evt.apiKey,undefined);
});
