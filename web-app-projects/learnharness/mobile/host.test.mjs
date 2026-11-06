import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawn} from 'node:child_process';import {once} from 'node:events';
const delay=ms=>new Promise(r=>setTimeout(r,ms));async function waitFor(fn){for(let i=0;i<120;i++){try{const v=await fn();if(v)return v;}catch{}await delay(50);}throw Error('Timeout');}
test('bundled Node host: direct startup, web streaming, origin guards, imports and process shutdown',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lh-web-')),mobile=path.join(root,'mobile');fs.mkdirSync(mobile);
 for(const file of ['host.mjs','index.html'])fs.copyFileSync(new URL(file,import.meta.url),path.join(mobile,file));
 const reserve=net.createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port;await new Promise(r=>reserve.close(r));
 fs.writeFileSync(path.join(mobile,'run-web.mjs'),`import http from 'node:http';http.createServer((q,r)=>{if(q.url==='/api/models')r.end('{}');else if(q.url==='/events'){r.writeHead(200,{'content-type':'text/event-stream'});r.end('data: ready\\n\\n');}else r.end('learning-ui');}).listen(Number(process.env.LH_MOBILE_BACKEND_PORT),'127.0.0.1');`);
 const child=spawn(process.execPath,[path.join(mobile,'host.mjs')],{env:{...process.env,LH_MOBILE_PORT:String(port)},stdio:'ignore'}),base=`http://127.0.0.1:${port}`;
 try{
  await waitFor(async()=>{const r=await fetch(base+'/__mobile_host__/status');return(await r.json()).ready;});
  assert.equal(await(await fetch(base)).text(),'learning-ui');assert.equal(await(await fetch(base+'/events')).text(),'data: ready\n\n');
  assert.equal((await fetch(base+'/__mobile_host__/book?name=x.pdf',{method:'POST',body:'x'})).status,403);
  let response=await fetch(base+'/__mobile_host__/book?name='+encodeURIComponent('../../notes.pdf'),{method:'POST',headers:{origin:base},body:'%PDF fixture'});assert.equal(response.status,201);
  const saved=await response.json();assert.equal(path.dirname(saved.path),path.join(mobile,'books'));assert.equal(fs.readFileSync(saved.path,'utf8'),'%PDF fixture');
  assert.equal((await fetch(base+'/__mobile_host__/book?name=bad.exe',{method:'POST',headers:{origin:base},body:'x'})).status,400);
  assert.equal(fs.existsSync(path.join(mobile,'runtime.json')),false);
  child.kill('SIGTERM');await once(child,'exit');await assert.rejects(fetch(base));await assert.rejects(fetch(`http://127.0.0.1:${port+1}`));
 }finally{child.kill('SIGKILL');fs.rmSync(root,{recursive:true,force:true});}
});
