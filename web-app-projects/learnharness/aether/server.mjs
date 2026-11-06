/** Aether Apps host: loopback only; inherited process group; no Codex/account discovery. */
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtime=path.join(root,'build/runtime');
const port=Number(process.argv[2]||8895),backendPort=port+1;
if(!Number.isInteger(port)||port<1024||port>65534) throw new Error('Invalid front/backend ports');
if(!fs.existsSync(path.join(runtime,'aether-build.json'))) throw new Error('Adapted build missing. Run node aether/build.mjs; do not use the reference runtime.');
const data=path.join(process.env.AETHER_APPS_DATA_ROOT||path.join(os.homedir(),'.aether/apps/data'),'aether-learnharness');
const books=path.join(data,'books');fs.mkdirSync(books,{recursive:true,mode:0o700});
const secret=randomBytes(32).toString('hex');
let theme;
try{const saved=JSON.parse(fs.readFileSync(path.join(data,'host-appearance.json'),'utf8'));if(['light','dark','eink'].includes(saved.theme))theme=saved.theme;}catch{}
// Fail on occupied backend; never adopt or terminate an unrelated server.
const reservation=net.createServer();
await new Promise((resolve,reject)=>{reservation.once('error',reject);reservation.listen(backendPort,'127.0.0.1',resolve);});
await new Promise(resolve=>reservation.close(resolve));
// Start with an allowlist, not inherited provider credentials, CLI selectors or account paths.
const env={};
for(const key of ['PATH','HOME','TMPDIR','TMP','TEMP','LANG','LC_ALL','TZ','LD_LIBRARY_PATH']) if(process.env[key])env[key]=process.env[key];
Object.assign(env,{HOSTNAME:'127.0.0.1',PORT:String(backendPort),NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',LH_APP_ROOT:runtime,LH_DATA_DIR:path.join(data,'data'),LH_AUTH_FILE:path.join(data,'unused-auth.json'),LH_MOBILE_WEB:'1',LH_AETHER:'1',LH_DESKTOP_SERVER:'1',LH_DESKTOP_API_SECRET:secret});
let child,closing=false;
const front=http.createServer(async(req,res)=>{
 const origin=`http://127.0.0.1:${port}`;
 const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
 if(req.headers.host!==`127.0.0.1:${port}`||req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'Local app origin required.'});
 if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==origin)return send(403,{error:'Use the local LearnHarness page.'});
 const url=new URL(req.url,origin);
 if(url.pathname==='/__aether_host__/status')return send(200,{sourceDirectory:root,dataDirectory:data,theme,inference:'unsupported',message:'Aether Script API v2 has no authenticated app inference stream.'});
 if(url.pathname==='/__aether_host__/manage'){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors http://127.0.0.1:* http://localhost:*"});
  return res.end(fs.readFileSync(path.join(root,'aether/manage.html')));
 }
 if(url.pathname==='/__aether_host__/manage.css'){
  res.writeHead(200,{'Content-Type':'text/css','Cache-Control':'no-store'});return res.end(fs.readFileSync(path.join(root,'aether/manage.css')));
 }
 if(url.pathname==='/__aether_host__/manage.js'){
  res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});return res.end(fs.readFileSync(path.join(root,'aether/manage.js')));
 }
 if(url.pathname==='/__aether_host__/appearance'&&req.method==='POST'){
  try{
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>256)return send(413,{error:'Appearance request too large.'});}
   const value=JSON.parse(body);
   if(!['light','dark','eink'].includes(value.theme))return send(400,{error:'Choose Light, Dark or E-ink.'});
   fs.writeFileSync(path.join(data,'host-appearance.json'),JSON.stringify({theme:value.theme}),{mode:0o600});theme=value.theme;
   return send(200,{theme,message:'Saved. Return to learning to apply.'});
  }catch(error){return send(400,{error:error.message});}
 }
 if(url.pathname==='/__aether_host__/book'&&req.method==='POST'){
  const name=path.basename(url.searchParams.get('name')||'book.txt').replace(/[^a-zA-Z0-9._ -]/g,'_');
  if(!/\.(pdf|txt|md|markdown)$/i.test(name))return send(400,{error:'Choose PDF, Markdown or text.'});
  const target=path.join(books,randomUUID()+'-'+name);
  let size=0;const chunks=[];
  try{
   for await(const chunk of req){size+=chunk.length;if(size>32*1024*1024){req.resume();return send(413,{error:'File limit is 32 MiB.'});}chunks.push(chunk);}
   fs.writeFileSync(target,Buffer.concat(chunks),{mode:0o600,flag:'wx'});return send(201,{path:target});
  }catch(error){return send(400,{error:error.message});}
 }
 if(url.pathname.startsWith('/__aether_host__/'))return send(404,{error:'Not found'});
 const upstream=http.request({hostname:'127.0.0.1',port:backendPort,path:req.url,method:req.method,headers:{...req.headers,host:`127.0.0.1:${port}`,'x-learnharness-desktop':secret}},reply=>{
  // Apps embeds this origin. Keep streaming/SSE intact, do not buffer responses.
  const headers={...reply.headers,'content-security-policy':"frame-ancestors http://127.0.0.1:* http://localhost:*",'x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
  delete headers['x-frame-options'];res.writeHead(reply.statusCode,headers);reply.pipe(res);res.once('close',()=>reply.destroy());
 });
 upstream.on('error',()=>{if(!res.headersSent)send(503,{error:'Learning backend is starting or unavailable. Reopen through Apps if needed.'});else res.destroy();});
 req.once('aborted',()=>upstream.destroy());req.pipe(upstream);
});
front.on('error',error=>{console.error(error);shutdown(1);});
// Bind front first so a collision cannot leave a backend running.
await new Promise((resolve,reject)=>{front.once('error',reject);front.listen(port,'127.0.0.1',resolve);});
child=spawn(process.execPath,[path.join(runtime,'server.js')],{cwd:runtime,env,stdio:'inherit'});
child.once('error',error=>{console.error(error);shutdown(1);});
child.once('exit',code=>{if(!closing)shutdown(code??1);});
function shutdown(code=0){
 if(closing)return;closing=true;child?.kill('SIGTERM');front.close();
 const timer=setTimeout(()=>{child?.kill('SIGKILL');process.exit(code);},1500);timer.unref();
 process.exitCode=code;
}
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>shutdown());
console.log(`LearnHarness source: ${root}\nPersistent data: ${data}\nAether inference unavailable; no account discovery or model substitution.`);
