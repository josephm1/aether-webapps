/** On-demand web host using Mobile Codex’s bundled Node and Codex directly. */
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mobile=path.join(root,'mobile'),port=Number(process.env.LH_MOBILE_PORT||8795),backendPort=port+1;
const children=new Set();
let mode='starting',log='',backendReady=false,stopping=false;
function record(value){log=(log+String(value)).slice(-32000);}
function stopChild(child){if(child.exitCode!==null||child.signalCode!==null)return;try{process.kill(-child.pid,'SIGTERM');}catch{child.kill('SIGTERM');}const timer=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{child.kill('SIGKILL');}},1800);timer.unref();}
function launch(command,args,options={}){
 const child=spawn(command,args,{cwd:root,detached:true,...options});children.add(child);
 child.on('error',error=>{record(error.message+'\n');});
 child.once('close',()=>children.delete(child));return child;
}
async function startBackend(){
 if(stopping)return;mode='starting';backendReady=false;
 try{
  const reservation=net.createServer();
  await new Promise((resolve,reject)=>{reservation.once('error',reject);reservation.listen(backendPort,'127.0.0.1',resolve);});
  await new Promise(resolve=>reservation.close(resolve));
 }catch{mode='error';record('The backend port is already occupied; the existing server was left untouched.\n');return;}
 const child=launch(process.execPath,[path.join(mobile,'run-web.mjs')],{env:{...process.env,LH_MOBILE_BACKEND_PORT:String(backendPort)},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',record);child.stderr.on('data',record);
 child.once('close',()=>{backendReady=false;if(!stopping)mode='error';});
 for(let i=0;i<120&&!stopping;i++){
  if(child.exitCode!==null||child.signalCode!==null)break;
  try{const reply=await fetch(`http://127.0.0.1:${backendPort}/api/models`,{signal:AbortSignal.timeout(500)});if(reply.ok){backendReady=true;mode='ready';return;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 if(!stopping){record('Web server did not become ready. Check Mobile Codex’s bundled runtime and Codex sign-in.\n');mode='error';stopChild(child);}
}
function hostOK(req){return req.headers.host===`127.0.0.1:${port}`;}
function json(res,code,value){res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
const html=fs.readFileSync(path.join(mobile,'index.html'),'utf8');
const app=http.createServer(async(req,res)=>{
 if(!hostOK(req)){res.writeHead(403);res.end();return;}
 const url=new URL(req.url,`http://127.0.0.1:${port}`);
 if(url.pathname.startsWith('/__mobile_host__/')&&req.method!=='GET'&&req.headers.origin!==`http://127.0.0.1:${port}`){json(res,403,{error:'Origin must match this app.'});return;}
 if(url.pathname==='/__mobile_host__/status'){json(res,200,{mode,log,sourceDirectory:root,ready:backendReady});return;}
 if(url.pathname==='/__mobile_host__/retry'&&req.method==='POST'){if(mode==='error')void startBackend();json(res,202,{mode});return;}
 if(url.pathname==='/__mobile_host__/book'&&req.method==='POST'){
  let size=0;const chunks=[];
  try{
   for await(const chunk of req){size+=chunk.length;if(size>32*1024*1024){json(res,413,{error:'Book limit is 32 MiB per file.'});req.resume();return;}chunks.push(chunk);}
   const name=path.basename(url.searchParams.get('name')||'book.txt').replace(/[^a-zA-Z0-9._ -]/g,'_');
   if(!/\.(pdf|txt|md|markdown)$/i.test(name)){json(res,400,{error:'Choose a PDF, Markdown or text file.'});return;}
   const folder=path.join(mobile,'books');fs.mkdirSync(folder,{recursive:true,mode:0o700});
   const saved=randomUUID()+'-'+name;fs.writeFileSync(path.join(folder,saved),Buffer.concat(chunks),{mode:0o600});
   json(res,201,{path:path.join(folder,saved)});
  }catch{if(!res.headersSent)json(res,400,{error:'Could not import this file.'});}return;
 }
 if(url.pathname==='/__mobile_host__/manage'||!backendReady){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'"});res.end(html);return;}
 // Stream responses (including SSE) without buffering; keep the public origin for Next.
 const upstream=http.request({hostname:'127.0.0.1',port:backendPort,path:req.url,method:req.method,headers:{...req.headers,host:`127.0.0.1:${port}`}},response=>{
  res.writeHead(response.statusCode,response.headers);response.pipe(res);res.once('close',()=>response.destroy());
 });
 upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('The learning server is unavailable. Reopen the app.');});
 req.on('aborted',()=>upstream.destroy());req.pipe(upstream);
});
await new Promise(resolve=>app.listen(port,'127.0.0.1',resolve));
function shutdown(){if(stopping)return;stopping=true;for(const child of children)stopChild(child);app.close();setTimeout(()=>process.exit(0),2000).unref();}
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,shutdown);
void startBackend();
console.log(`LearnHarness web app: http://127.0.0.1:${port}`);
