import test from 'node:test';
import assert from 'node:assert/strict';
import {renderInWebView} from '../src/agent/web-render';
import {mobileRenderRequest} from '../src/server/mobile-render';
const origin='http://127.0.0.1:8795';
function get(){return new Request(origin+'/api/mobile-render',{headers:{host:'127.0.0.1:8795'}});}
function post(body:unknown,requestOrigin=origin){return new Request(origin+'/api/mobile-render',{method:'POST',headers:{host:'127.0.0.1:8795',origin:requestOrigin,'Content-Type':'application/json'},body:JSON.stringify(body)});}
test('web render jobs are authenticated, delivered once and clean up on success/error',async()=>{
 const previous=process.env.LH_MOBILE_WEB;process.env.LH_MOBILE_WEB='1';
 try{
  assert.equal((await mobileRenderRequest(get())).status,204);
  const pending=renderInWebView({kind:'svg',svg:'<svg/>',width:200,height:100});
  const job=await(await mobileRenderRequest(get())).json();assert.equal(job.input.kind,'svg');
  assert.equal((await mobileRenderRequest(get())).status,204);
  assert.equal((await mobileRenderRequest(post({...job,result:[]},'https://untrusted.example'))).status,403);
  assert.equal((await mobileRenderRequest(post({...job,secret:'wrong',result:[]}))).status,404);
  const result=[{page:0,png:'iVBORw0KGgo='}];
  assert.equal((await mobileRenderRequest(post({...job,result}))).status,204);assert.deepEqual(await pending,result);
  const failed=renderInWebView({kind:'svg',svg:'<svg/>',width:1,height:1});const failure=assert.rejects(failed,/web canvas failed/);
  const next=await(await mobileRenderRequest(get())).json();assert.equal((await mobileRenderRequest(post({...next,error:'web canvas failed'}))).status,204);await failure;
  assert.equal((await mobileRenderRequest(get())).status,204);
 }finally{if(previous===undefined)delete process.env.LH_MOBILE_WEB;else process.env.LH_MOBILE_WEB=previous;}
});
