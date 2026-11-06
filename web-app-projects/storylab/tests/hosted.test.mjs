import test from 'node:test';
import assert from 'node:assert/strict';
test('Aether hosting selects shared storage and sends AI through the native bridge only',async()=>{
 const calls=[];
 globalThis.AetherHosted={postMessage(text){const req=JSON.parse(text);calls.push(req);let result;if(req.op==='ai.selection')result={model:{provider:'test',id:'test-model',name:'Test model'},thinkingLevel:'low',selectionId:'selection-1'};else if(req.op==='ai.complete')result={message:{content:[{type:'text',text:'test response'}]}};else throw Error('Unexpected bridge operation '+req.op);queueMicrotask(()=>this.onmessage({data:JSON.stringify({id:req.id,ok:true,result})}));}};
 const platform=await import('../pwa/dist/platform.mjs');
 try{assert.equal(platform.hosted,true);assert.equal(platform.db.constructor.name,'LocalStore');assert.equal(platform.db.name,'aether-storylab-v1');assert.equal(calls.length,0,'no AI or file requests merely by loading adapter');const context={systemPrompt:'study',messages:[],tools:[]};await platform.ai(context);assert.deepEqual(calls.map(x=>x.op),['ai.selection','ai.complete']);const request=calls[1].args;assert.deepEqual(request.context,context);assert.equal(request.maxTokens,2200);assert.equal(request.expected.id,'test-model');assert.equal(request.expected.selectionId,'selection-1');}finally{platform.db.close();delete globalThis.AetherHosted;delete globalThis[Symbol.for('aether.hosted.app.channel.v1')];}
});
