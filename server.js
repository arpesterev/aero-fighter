import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname, sep } from 'node:path';
import { validateEvent } from './js/events.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIMES = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon'};
function json(res,code,obj){res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(obj));}
function readBody(req){return new Promise((ok,fail)=>{let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>12_000){req.destroy();fail(new Error('body too large'));}});req.on('end',()=>ok(raw));req.on('error',fail);});}
export function createAppServer({stateFile=null}={}){
  // Last external event is durable across browser refreshes and server restarts.
  const clients=new Set();
  let sequence=0;
  let lastEvent=null;
  if(stateFile && existsSync(stateFile)){
    const saved=JSON.parse(readFileSync(stateFile,'utf8'));
    if(saved.lastEvent){
      validateEvent(saved.lastEvent);
      if(!Number.isSafeInteger(saved.lastEvent.id)||saved.lastEvent.id<1)
        throw new Error('Invalid persisted event ID');
      lastEvent=saved.lastEvent;
      sequence=lastEvent.id;
    }
  }
  function broadcast(event){
    const msg=`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`;
    for(const c of clients){try{c.write(msg);}catch{clients.delete(c);}}
  }
  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      const route=url.pathname;
      if(req.method==='GET' && route==='/api/state'){return json(res,200,{connected:true,active:!!lastEvent&&lastEvent.type!=='clear',lastEvent});}
      if(req.method==='GET' && route==='/api/events'){
        res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-store, no-transform','connection':'keep-alive','x-accel-buffering':'no'});
        res.write(': connected\n\n');clients.add(res);
        const timer=setInterval(()=>{try{res.write(': ping\n\n');}catch{}},15_000);
        req.on('close',()=>{clearInterval(timer);clients.delete(res);});return;
      }
      if(req.method==='POST' && (route==='/api/event'||route==='/api/events')){
        if(!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type']??''))
          return json(res,415,{error:'Content-Type must be application/json'});
        let obj;
        try{obj=validateEvent(JSON.parse(await readBody(req)));}
        catch(error){return json(res,400,{error:String(error.message)});}
        const event={...obj,id:sequence+1,receivedAt:new Date().toISOString()};
        if(stateFile){
          try{
            const tmp=stateFile+'.tmp';
            writeFileSync(tmp,JSON.stringify({lastEvent:event})+'\n',{mode:0o600});
            renameSync(tmp,stateFile);
          }catch(error){console.error('Failed persisting event',error);return json(res,500,{error:'Failed to persist event'});}
        }
        sequence=event.id;lastEvent=event;
        broadcast(event);return json(res,202,{ok:true,event});
      }
      if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed'});
      const requested=route==='/'?'index.html':decodeURIComponent(route).replace(/^\/+/, '');
      if(!['index.html','style.css'].includes(requested) && !/^js\/[a-zA-Z0-9_-]+\.js$/.test(requested) && requested!=='vendor/three/three.module.js'){
        return json(res,404,{error:'Not found'});
      }
      const target=resolve(ROOT,requested);
      if(target!==ROOT && !target.startsWith(ROOT+sep))return json(res,403,{error:'Forbidden'});
      const file=await readFile(target);
      res.writeHead(200,{'content-type':MIMES[extname(target)]??'application/octet-stream','cache-control':'no-cache','x-content-type-options':'nosniff'});
      if(req.method==='HEAD')res.end();else res.end(file);
    }catch(error){if(error.code==='ENOENT')return json(res,404,{error:'Not found'});if(!res.headersSent)json(res,500,{error:'Internal server error'});else res.end();}
  });
  return server;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const host='127.0.0.1';
  const port=Number.parseInt(process.env.PORT??'8011',10);
  if(!Number.isSafeInteger(port)||port<1||port>65535)throw new Error('Invalid PORT');
  createAppServer({stateFile:resolve(ROOT,'.aero-state.json')}).listen(port,host,()=>console.log(`Aero Fighter http://${host}:${port}`));
}
