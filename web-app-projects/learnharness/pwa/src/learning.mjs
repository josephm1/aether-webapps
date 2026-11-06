import {measureRequestContext} from './context-breakdown.mjs';
/* Reuses baseline agents, tools, prompts, input folds and extraction. Only IO/transport changes. */
import {Agent} from '@earendil-works/pi-agent-core';
import {createAssistantMessageEventStream} from '@earendil-works/pi-ai/utils/event-stream';
import {createProberAgent,createTeacherAgent,createPracticeAgent} from '../../src/agent/teacher-agent.ts';
import {parseChatInput,inputAppends,retryDrops,dismissAppends} from '../../src/core/input-events.ts';
import {asAgentMessages,hasProbeDone,newMessageId} from '../../src/core/native-messages.ts';
import {persistTurn} from '../../src/server/turn-service.ts';
import {runPiTurn,piTurnResponse} from '../../src/server/pi/ui-stream.ts';
import {createExtractionPipeline,extractionStatuses,callUsage} from '../../src/agent/subagents/extraction.ts';
import {emit} from '../../src/core/events.ts';
import {getChat,saveChat,chatList,settings,db,graphState,memoryGraph,flushGraph,timestamp,allMetadata,resolveDocument} from './store.mjs';
import {transport,selection} from './connection.mjs';
import {activeTurns} from './api.mjs';
import {APP_IDENTITY} from './models-browser.mjs';

export async function browserEngine(){
 const info=await transport.capabilities();if(!info.supported)throw new Error(info.reason);
 const expected=selection(info),audits=new WeakMap();let calls=0;
 return {model:info.model,level:info.thinkingLevel,contextBreakdownFor:usage=>audits.get(usage),streamFn:(_model,context,options={})=>{
  const stream=createAssistantMessageEventStream();
  void(async()=>{try{
   if(++calls>16)throw new Error('This app turn reached its 16-request safety limit. No automatic retry/continuation is started.');
   const audit=measureRequestContext(context);
   const result=await transport.complete({context,expected,maxTokens:8192,sessionId:options.sessionId,signal:options.signal});const m=result.message;if(m.usage)audits.set(m.usage,audit);
   stream.push({type:'start',partial:m});stream.push({type:'done',reason:m.stopReason,message:m});stream.end(m);
  }catch(error){const message={role:'assistant',content:[],api:info.model.api,provider:info.model.provider,model:info.model.id,usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:options.signal?.aborted?'aborted':'error',errorMessage:error.message,timestamp:Date.now()};stream.push({type:'error',reason:message.stopReason,error:message});stream.end(message);}})();return stream;
 }};
}
function sessionMemory(record,jobs,summaries=[]){
 const chatStore={getChat:id=>id===record.id?record:summaries.find(s=>s.id===id)||null,listChats:()=>summaries.length?summaries:[{id:record.id,title:record.title,createdAt:record.createdAt,updatedAt:record.updatedAt}],saveMessages:(_id,messages)=>{record.messages=messages;record.updatedAt=timestamp();},saveTree:(_id,tree)=>{record.tree=tree;},appendTurnUsage:(_id,entry)=>{record.turns=[...(record.turns||[]),entry];},appendExtractionUsage:(_id,entry)=>{record.extractions=[...(record.extractions||[]),entry];}};
 const jobStore={createJob:init=>{const time=timestamp(),job={...init,id:'job_'+crypto.randomUUID().replace(/-/g,''),status:'running',createdAt:time,updatedAt:time};jobs.push(job);return job;},getJob:id=>jobs.find(j=>j.id===id)||null,updateJob:(id,patch)=>{const j=jobs.find(j=>j.id===id);if(j)Object.assign(j,patch,{updatedAt:timestamp()});return j||null;},listJobs:id=>jobs.filter(j=>j.chatId===id),findJobByToolCallId:(id,call)=>jobs.find(j=>j.chatId===id&&j.toolCallId===call)||null,deleteJobsForChat:()=>0};return {chatStore,jobStore};
}
async function locked(name,fn){if(!navigator.locks)throw new Error('Web Locks are required for safe multi-window session/graph writes. Use a current browser.');return navigator.locks.request(name,{ifAvailable:true},async lock=>{if(!lock)throw new Error('This session/graph is in use in another app window.');return fn();});}
export async function chatRequest(body,signal){
 if(!navigator.locks)return Response.json({error:'Web Locks are required for safe session writes.'},{status:503});
 let unlock,resolveLock;const acquired=new Promise(resolve=>{resolveLock=resolve;});
 const lifetime=navigator.locks.request('learnharness-chat-'+String(body.chatId),{ifAvailable:true},async lock=>{resolveLock(!!lock);if(lock)await new Promise(resolve=>{unlock=resolve;});});
 if(!await acquired)return Response.json({error:'Session is active in another window.'},{status:409});
 try{return await performChat(body,signal,()=>{unlock?.();});}catch(error){unlock?.();throw error;}
}
async function performChat(body,signal,release){
 let attached=false;
 try{
 const record=await getChat(body.chatId);if(!record)return Response.json({error:'Session not found.'},{status:404});
 if(activeTurns.has(record.id))return Response.json({error:'A turn is already running.'},{status:409});
 let input;try{input=parseChatInput(body.input);}catch(error){return Response.json({error:error.message},{status:400});}
 const engine=await browserEngine();
 record.settings={...record.settings,model:{provider:engine.model.provider,id:engine.model.id},thinkingLevel:engine.level};
 const set=await settings(),jobs=[],memory=sessionMemory(record,jobs,await chatList()),values=await graphState(),graphStore=memoryGraph(values);
 const retryOmissions=input.type==='retry'?retryDrops(record.messages):new Set();
 const prefix=input.type==='retry'?record.messages.filter(m=>!retryOmissions.has(m.id)):record.messages;
 const appends=inputAppends(record,input);record.messages=[...record.messages,...appends];await saveChat(record);
 const messages=input.type==='retry'?[...prefix,...appends]:record.messages,base=messages.length;
 let constructed;
 const steps=[],turnUsageId=crypto.randomUUID();
 const common={onUsage:usage=>steps.push({...callUsage(usage),...(engine.contextBreakdownFor(usage)?{contextBreakdown:engine.contextBreakdownFor(usage)}:{})}),engine,messages:asAgentMessages(messages),chatId:record.id,toolToggles:set?.agent?.tools,promptSwitches:set?.agent?.prompts};
 // Baseline factories retain their exact question/plan/practice tool mechanics.
 // Unsupported job/native operations return honest tool errors via browser adapters.
 const context={chatId:record.id,...memory,graphStore,spawn:()=>{},deliver:()=>{}};
 constructed=record.kind==='practice'?createPracticeAgent({...context,jobs:context,graphNodes:()=>values.nodes,graph:{chatStore:memory.chatStore,graphStore}},common):hasProbeDone(messages)?createTeacherAgent(context,common):createProberAgent(context,common);
 let parkedDismissal;
 const timer=setTimeout(()=>constructed.abort(),180000);let resolveSaved,rejectSaved;const saved=new Promise((resolve,reject)=>{resolveSaved=resolve;rejectSaved=reject;});
 const handle=runPiTurn({agent:constructed,usedToolCallIds:new Set(messages.flatMap(m=>m.role==='assistant'?(m.content||[]).filter(c=>c.type==='toolCall').map(c=>c.id):[])),onError:error=>error.message,onSettleError:()=> 'Reply could not be saved. Export data and check shared storage.',onSettleFailure:error=>rejectSaved(error),onFinish:(settled,aborted)=>{
  try{const stamped=persistTurn(memory.chatStore,record.id,base,settled,aborted),response=stamped.find(m=>m.role==='assistant');if(response&&steps.length)memory.chatStore.appendTurnUsage(record.id,{id:turnUsageId,messageId:response.id,at:timestamp(),model:engine.model.provider+':'+engine.model.id,steps});if(parkedDismissal)record.messages=[...record.messages,...dismissAppends(record,parkedDismissal)];void saveChat(record).then(async()=>{for(const job of jobs)await db.put('job',job.id,job);resolveSaved();},rejectSaved);}catch(error){rejectSaved(error);}
 }});
 const response=()=>{const source=piTurnResponse(handle);return new Response(source.body.pipeThrough(new TransformStream({async transform(chunk,controller){if(new TextDecoder().decode(chunk).includes('[DONE]'))await saved;controller.enqueue(chunk);}})),{headers:source.headers});};
 activeTurns.set(record.id,{response,abort:()=>handle.abort(),parkDismissal:input=>{parkedDismissal=input;}});emit('turn-started',{chatId:record.id});
 attached=true;
 void saved.then(()=>{emit('record-changed',{chatId:record.id});emit('chats-changed',{});},error=>{console.error('Offline record persistence failed:',error.message);}).finally(()=>{clearTimeout(timer);activeTurns.delete(record.id);release();emit('turn-settled',{chatId:record.id});});
 const abort=()=>handle.abort();signal?.addEventListener('abort',abort,{once:true});void saved.finally(()=>signal?.removeEventListener('abort',abort)).catch(()=>{});
 return response();
 }finally{if(!attached)release();}
}
export async function extractRequest(path,body){
 const info=await transport.capabilities();if(!info.supported)throw new Error(info.reason);
 return locked('learnharness-graph-write',async()=>{
  const values=await graphState(),graphStore=memoryGraph(values),engine=await browserEngine();
  const chatId=body.chatId||body.input?.chatId,record=chatId?await getChat(chatId):null;
  const {chatStore}=sessionMemory(record||{id:'notes',title:'Notes',messages:[]},[],await chatList());
  const pipeline=createExtractionPipeline({chatStore,graphStore,engineFor:()=>engine,getChunkTokens:()=>2048});
  let result;
  try{
  if(path==='/api/graph/import'){
   const filename=body.path||body.filePath||body.input?.path;if(!filename)throw new Error('Choose an imported text/Markdown document path.');let text;if(typeof body.text==='string'){if(new TextEncoder().encode(body.text).length>2*1048576)throw new Error('Notes extraction limit is 2 MiB.');text=body.text;}else{const {blob}=await resolveDocument(filename);if(blob.size>2*1048576)throw new Error('Explicit notes-to-graph extraction is bounded to 2 MiB; choose a smaller source.');text=await blob.text();}result=await pipeline.importNotes({filePath:filename,text});
  }else{if(!record)throw new Error('Session not found.');result=await pipeline.runExtraction(record.id);}
  return {ok:true,stats:result};
  }finally{await flushGraph(values);if(record)await saveChat(record);}
 });
}
