import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateWithPi} from './pi-api.mjs';
import {SYSTEM,inputBound} from './pwa/src/core.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||4173),origin='http://127.0.0.1:'+port;
let active=false;
const mime={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.md':'text/plain'};
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
const server=http.createServer(async(req,res)=>{try{
 if(req.headers.host!==new URL(origin).host){send(res,403,{error:'Use the printed loopback URL.'});return;}
 const url=new URL(req.url,origin);
 if(url.pathname==='/api/config'&&req.method==='GET'){
  let s={};try{s=JSON.parse(await fs.readFile(path.join(process.env.HOME,'.pi/agent/settings.json'),'utf8'));}catch{}
  return send(res,200,{label:`Local Pi · ${s.defaultProvider||'default provider'} / ${s.defaultModel||'default model'} · ${s.defaultThinkingLevel||'default thinking'}`});
 }
 if(url.pathname==='/api/generate'&&req.method==='POST'){
  if(req.headers.origin!==origin||req.headers['content-type']!=='application/json')return send(res,403,{error:'Same-origin JSON requests only.'});
  if(active)return send(res,409,{error:'A Pi request is already running.'});
  let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>20000)return send(res,413,{error:'Request too large.'});}
  const {context}=JSON.parse(text);
  if(context?.systemPrompt!==SYSTEM||!Array.isArray(context.messages)||context.messages.length!==1||context.messages[0]?.content?.length!==1||context.messages[0].role!=='user'||context.messages[0].content[0]?.type!=='text'||typeof context.messages[0].content[0].text!=='string'||context.tools?.length!==0||inputBound(context)>4000)return send(res,400,{error:'Invalid or over-budget activity request.'});
  active=true;
  const controller=new AbortController();let ended=false;const timer=setTimeout(()=>controller.abort(),120000);res.on('close',()=>{if(!ended)controller.abort();});
  try{const value=await generateWithPi(context,controller.signal);if(!res.destroyed)send(res,200,value);}catch{if(!res.destroyed)send(res,502,{error:controller.signal.aborted?'Pi request cancelled or timed out. No automatic retry.':'Pi generation failed. Check the local Pi model connection. No automatic retry.'});}finally{ended=true;active=false;clearTimeout(timer);}return;
 }
 if(req.method!=='GET')return send(res,405,{error:'Method not allowed.'});
 const relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);const file=path.resolve(root,'pwa/dist','.'+relative);
 if(!file.startsWith(path.join(root,'pwa/dist')+path.sep))return send(res,403,{error:'Invalid path.'});
 const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://en.wikipedia.org; img-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(data);
 }catch(e){send(res,e.code==='ENOENT'?404:400,{error:e.code==='ENOENT'?'File not found.':'Request could not be processed.'});}});
server.listen(port,'127.0.0.1',()=>console.log('StoryLab desktop preview: '+origin+' (AI runs only on Generate)'));
