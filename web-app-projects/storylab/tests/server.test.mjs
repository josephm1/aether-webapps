import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
test('desktop server refuses cross-origin, oversized and arbitrary AI contexts without a provider call',async()=>{
 const server=spawn(process.execPath,['dev-server.mjs'],{cwd:root,env:{...process.env,PORT:'4174'},stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Server exited '+code)));});
 const base='http://127.0.0.1:4174';
 assert.equal((await fetch(base)).status,200);
 assert.equal((await fetch(base+'/api/generate',{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch(base+'/api/generate',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({context:{systemPrompt:'arbitrary'}})})).status,400);
 assert.equal((await fetch(base+'/api/generate',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'x'.repeat(21000)})).status,413);
 }finally{server.kill();}
});
