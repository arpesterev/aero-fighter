import { World } from './world.js';
import { Radar } from './radar.js';
import { SceneController } from './controller.js';
import { Siren } from './audio.js';
import { daylightState } from './daylight.js';

const el=id=>document.getElementById(id);
let world;
try{world=new World(el('world'));}catch(err){console.error('WebGL failed',err);el('webgl-error').hidden=false;throw err;}
const radar=new Radar(el('radar'));
const controller=new SceneController(world,el('activity-log'));
const siren=new Siren();
let lastEventId=0;
let connected=false;

async function publish(input){
  try{
    const r=await fetch('/api/event',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
  }catch(err){controller.note('API недоступен. Локальная демонстрация',true);handleEvent(input);}
}
function handleEvent(event){
  if(event.id!==undefined){
    // Do not allow a delayed /api/state response to roll back a newer SSE event.
    if(!Number.isSafeInteger(event.id)||event.id<=lastEventId)return;
    lastEventId=event.id;
  }
  try{
    const valid=controller.trigger(event);
    if(valid.siren)siren.play();
  }catch(error){controller.note('Неизвестное событие отклонено',true);console.warn(error);}
}
async function restoreLastEvent(){
  try{
    const response=await fetch('/api/state',{cache:'no-store'});
    if(!response.ok)throw new Error('Unable to restore event state');
    const state=await response.json();
    if(state.lastEvent)handleEvent(state.lastEvent);
  }catch(error){console.warn('State recovery failed',error);controller.note('Восстановление состояния недоступно',true);}
}
const stream=new EventSource('/api/events');
stream.onopen=()=>{connected=true;controller.note('Связь с локальным API установлена');void restoreLastEvent();};
stream.onmessage=evt=>{try{handleEvent(JSON.parse(evt.data));}catch(error){console.warn('Bad event',error);}};
stream.onerror=()=>{connected=false;};

el('demo-button').addEventListener('click',()=>publish({type:'incoming',count:3,severity:2,siren:true}));
el('clear-button').addEventListener('click',()=>publish({type:'clear'}));
el('siren-button').addEventListener('click',async()=>{
  const enabled=await siren.setEnabled(!siren.enabled);
  el('siren-button').setAttribute('aria-pressed',String(enabled));
  el('siren-button').textContent=enabled?'♫ СИРЕНА: ВКЛ':'♫ СИРЕНА: ВЫКЛ';
  controller.note(enabled?'Сирена включена по согласию пользователя':'Сирена выключена');
});
function toggleFullscreen(){
  if(document.fullscreenElement){document.exitFullscreen?.();return;}
  document.documentElement.requestFullscreen?.().catch(()=>controller.note('Полноэкранный режим недоступен'));
}
el('fullscreen-button').addEventListener('click',toggleFullscreen);
window.addEventListener('keydown',e=>{
  if(e.repeat||e.metaKey||e.ctrlKey||e.altKey)return;
  const target=e.target;
  if(target instanceof HTMLElement && ['INPUT','TEXTAREA'].includes(target.tagName))return;
  switch(e.key.toLowerCase()){
    case 't':publish({type:'incoming',count:3,severity:2,siren:true});break;
    case 'c':publish({type:'clear'});break;
    case 'f':toggleFullscreen();break;
  }
});

let previous=performance.now(),hudElapsed=0;
function tick(now){
  const dt=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;
  controller.update(dt);world.update(dt,controller.phase);radar.draw(dt,world.threats,now);
  hudElapsed+=dt;
  if(hudElapsed>.2){hudElapsed=0;refreshHUD();}
  requestAnimationFrame(tick);
}
function refreshHUD(){
  const state=controller.getStatus();
  el('scene-title').textContent=state.title;
  el('scene-description').textContent=state.description;
  el('state-title').textContent=state.top;
  el('phase-value').textContent=state.state;
  el('threat-count').textContent=String(state.contacts).padStart(2,'0');
  el('radar-count').textContent=`${String(state.contacts).padStart(2,'0')} CONTACTS`;
  el('radar-status').textContent=state.contacts?'TRACKING':'SCANNING';
  el('connection-value').textContent=connected?'ONLINE':'OFFLINE';
  el('time-value').textContent=daylightState().label;
  el('clock').textContent=new Date().toLocaleTimeString('ru-RU',{hour12:false});
  document.body.classList.toggle('combat',controller.phase==='alert'||controller.phase==='engaging');
  el('signal').classList.toggle('warning',controller.phase==='alert'||controller.phase==='engaging');
}
refreshHUD();requestAnimationFrame(tick);
