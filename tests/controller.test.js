import test from 'node:test';
import assert from 'node:assert/strict';
import { SceneController } from '../js/controller.js';

function makeHarness() {
  // Minimal DOM stub: controller is otherwise independent of rendering.
  const previousDocument = globalThis.document;
  globalThis.document = {createElement:()=>({append(){},remove(){},textContent:'',className:''})};
  const log = {
    children:[],
    prepend(node){this.children.unshift(node);},
    get lastElementChild(){return {remove:()=>this.children.pop()};}
  };
  const world = {
    threats:[],interceptors:[],clearCalls:0,launchCalls:0,
    clear(){this.clearCalls++;this.threats=[];this.interceptors=[];},
    makeThreat(i){const t={id:i,dead:false};this.threats.push(t);return t;},
    launchAt(t){this.launchCalls++;this.interceptors.push({target:t});}
  };
  return {controller:new SceneController(world,log),world,restore:()=>{globalThis.document=previousDocument;}};
}

test('incoming keeps rendering and repeating engagements until external clear',()=>{
  const {controller:c,world:w,restore}=makeHarness();
  try {
    c.trigger({type:'incoming',count:3});
    for(let i=0;i<130;i++){
      c.update(.5);
      // Simulate a complete set of interceptions. The controller must NOT
      // turn this into an implicit clear; it must start another visible cycle.
      if(i%10===8){for(const t of w.threats)t.dead=true;w.interceptors=[];}
    }
    assert.equal(c.phase,'engaging');
    assert.ok(w.clearCalls>1,'more than one cinematic cycle started');
    assert.ok(w.launchCalls>3,'multiple salvos were launched');
    const beforeClear=w.clearCalls;
    c.trigger({type:'clear'});
    assert.equal(c.phase,'idle');
    assert.equal(w.clearCalls,beforeClear+1);
    for(let i=0;i<100;i++)c.update(1);
    assert.equal(c.phase,'idle');
    assert.equal(w.clearCalls,beforeClear+1);
  }finally{restore();}
});

test('radar-only alert persists without any automatic clear',()=>{
  const {controller:c,world:w,restore}=makeHarness();
  try{
    c.trigger({type:'alert',count:2});
    for(let i=0;i<120;i++){
      if(i%20===0)for(const t of w.threats)t.dead=true;
      c.update(1);
    }
    assert.equal(c.phase,'alert');
    assert.ok(w.clearCalls>1,'radar contacts refreshed');
    assert.equal(w.launchCalls,0);
  }finally{restore();}
});

test('a new engage event replaces the active batch but does not clear the alert',()=>{
  const {controller:c,world:w,restore}=makeHarness();
  try{
    c.trigger({type:'incoming',count:2});
    c.update(3);
    c.trigger({type:'engage',count:5});
    c.update(.7);
    assert.equal(c.phase,'engaging');
    assert.equal(c.targetCount,5);
    assert.equal(w.threats.length,5);
  }finally{restore();}
});
