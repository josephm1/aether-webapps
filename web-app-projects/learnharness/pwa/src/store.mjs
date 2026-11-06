import {LocalStore,readJSONFile,safeImportName} from './db.mjs';
import {emit,subscribe} from '../../src/core/events.ts';
import {graphSnapshot} from '../../src/core/graph.ts';
import {projectView} from '../../src/core/view.ts';
import {phaseAt3Lh} from '../../src/core/phases.ts';
import {danglingQuestionOf} from '../../src/core/native-messages.ts';
import {sanitizeUserSettings} from '../../src/core/settings.ts';
import {CURRENT_CHAT_VERSION} from '../../src/core/contracts.ts';
export const db=new LocalStore('aether-learnharness-offline-v1',{budget:128*1048576,records:2000});
export const GRAPH_LIMITS={nodes:2000,chains:4000,coverage:10000,checkpoints:5000,sources:1000};
export const timestamp=()=>new Date().toISOString();
export async function allMetadata(kind,maximum=500){const result=[];for(let offset=0;offset<maximum;offset+=50){const page=await db.list(kind,{offset});result.push(...page);if(page.length<50)return result;}return result;}
export async function getChat(id){return await db.get('chat',id)||null;}
export async function saveChat(record){validateChat(record);if(!await db.has('chat',record.id)&&(await allMetadata('chat',501)).length>=500)throw new Error('Offline session limit is 500. Export/remove chosen old sessions first.');await db.put('chat',record.id,record,{summary:{title:record.title,kind:record.kind||'teach',createdAt:record.createdAt,updatedAt:record.updatedAt,messageCount:record.messages.length,phase:phaseAt3Lh(record.messages),pendingQuestion:danglingQuestionOf(record.messages)!==null}});}
export async function chatList(){const metadata=await allMetadata('chat',500);return metadata.map(r=>({id:r.id,title:r.title||r.id,kind:r.kind||'teach',createdAt:r.createdAt,updatedAt:r.updatedAt||r.createdAt||'',messageCount:r.messageCount||0,phase:r.phase||'probe',pendingQuestion:!!r.pendingQuestion,turnInFlight:false})).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
export function validateChat(value){if(!value||typeof value!=='object'||! /^[A-Za-z0-9_-]{1,160}$/.test(value.id||'')||typeof value.title!=='string'||!Array.isArray(value.messages)||value.messages.length>5000)throw new Error('Invalid session record or 5,000-message bound exceeded.');if(typeof value.version==='number'&&value.version>CURRENT_CHAT_VERSION)throw new Error('This session was written by a newer LearnHarness schema; it was not imported.');for(const message of value.messages)if(!message||!['user','assistant','toolResult','custom'].includes(message.role))throw new Error('Invalid native session message.');projectView(value.messages);return value;}
export async function createChat(title,kind='teach'){const time=timestamp(),r={version:CURRENT_CHAT_VERSION,id:'chat_'+Date.now().toString(36)+'_'+crypto.randomUUID().slice(0,8),title:String(title||'Untitled session').slice(0,1000),createdAt:time,updatedAt:time,messages:[],...(kind==='practice'?{kind:'practice'}:{})};await saveChat(r);emit('chats-changed',{});return r;}
export async function settings(){return await db.get('settings','record')||null;}
export async function graphState(){
 const [nodes,chains,coverage,checkpoints,sources,positions]=await db.getMany(['nodes','chains','coverage','checkpoints','sources','positions'].map(id=>({kind:'graph',id})));
 const values={nodes:nodes||[],chains:chains||[],coverage:coverage||[],checkpoints:checkpoints||[],sources:sources||{},positions:positions||{}};validateGraphState(values);return values;
}
export function validateGraphState(value){for(const name of ['nodes','chains','coverage','checkpoints']){if(!Array.isArray(value[name])||value[name].length>GRAPH_LIMITS[name])throw new Error(`Offline graph ${name} limit is ${GRAPH_LIMITS[name]}; records were not silently dropped.`);}if(Object.keys(value.sources||{}).length>GRAPH_LIMITS.sources)throw new Error('Too many graph sources.');for(const n of value.nodes)if(typeof n.id!=='string'||typeof n.name!=='string'||typeof n.statement!=='string'||!Array.isArray(n.aliases)||!Array.isArray(n.provenance))throw new Error('Invalid graph node ledger line.');for(const c of value.chains)if(typeof c.id!=='string'||!Array.isArray(c.premises)||typeof c.conclusion!=='string'||!Array.isArray(c.provenance))throw new Error('Invalid graph chain ledger line.');}
export function memoryGraph(values){
 return {readNodes:()=>values.nodes,readChains:()=>values.chains,readCoverage:()=>values.coverage,readCheckpoints:()=>values.checkpoints,readSources:()=>Object.values(values.sources),readPositions:()=>values.positions,
 appendNode:n=>{if(values.nodes.length>=GRAPH_LIMITS.nodes)throw new Error('Graph node bound reached.');values.nodes.push(n);},appendChain:c=>{if(values.chains.length>=GRAPH_LIMITS.chains)throw new Error('Graph chain bound reached.');values.chains.push(c);},appendCoverage:c=>values.coverage.push(c),appendCheckpoint:c=>values.checkpoints.push(c),upsertSource:s=>{values.sources[s.id]=s;},appendSourceUsage:(id,entry)=>{const s=values.sources[id];if(s)s.extractions=[...(s.extractions||[]),entry];},writePositions:p=>{values.positions=p;},rewriteLedgers:next=>{for(const [name,v]of Object.entries(next))values[name]=v;}};
}
export async function graphView(){const values=await graphState(),summaries=await chatList(),titles=new Map(summaries.map(s=>[s.id,s.title]));return graphSnapshot({graphStore:memoryGraph(values),chatStore:{getChat:id=>titles.has(id)?{id,title:titles.get(id)}:null,listChats:()=>summaries}});}
export async function flushGraph(values,extra=[]){validateGraphState(values);await db.batch([...Object.entries(values).map(([id,value])=>({kind:'graph',id,value})),...extra]);emit('activity-changed',{});}
export function browserEvents(){const unsubscribers=[];return {close:()=>unsubscribers.splice(0).forEach(fn=>fn()),onOpen:callback=>queueMicrotask(callback),onEvent:(name,callback)=>{unsubscribers.push(subscribe(event=>{if(event.type===name)callback(JSON.stringify(event));}));}};}
export async function resolveDocument(path){const docs=await allMetadata('document-meta',1000);let selected=docs.filter(d=>d.id===path||d.path===path);if(!selected.length)selected=docs.filter(d=>d.name===path||d.name===String(path).split('/').at(-1));if(selected.length!==1)throw new Error('Document is missing or ambiguous. Use its exact imported books/<id> path.');return {meta:await db.get('document-meta',selected[0].id),blob:await db.get('document',selected[0].id)};}
export async function importFile(file,relative=file.name){
 safeImportName(relative);if(file.size>32*1048576)throw new Error('Document limit is 32 MiB.');
 const name=relative.split('/').at(-1);
 if(/\.(pdf|txt|md|markdown)$/i.test(name)&&!relative.includes('prompts/')){
  if(!/\.pdf$/i.test(name)&&file.size>8*1048576)throw new Error('Text document memory limit is 8 MiB.');
  if((await allMetadata('document-meta',1001)).length>=1000)throw new Error('Document count limit reached.');
  const id=crypto.randomUUID(),meta={id,name,path:'books/'+id,title:name,type:file.type||(/\.pdf$/i.test(name)?'application/pdf':'text/plain'),size:file.size,createdAt:timestamp()};
  await db.batch([{kind:'document',id,value:file},{kind:'document-meta',id,value:meta}]);return meta.path;
 }
 if(/\.jsonl$/i.test(name)){
  if(file.size>8*1048576)throw new Error('Ledger text import limit is 8 MiB.');const raw=await file.text(),rows=[];
  for(const line of raw.split('\n'))if(line.trim())rows.push(JSON.parse(line));
  const kind={ 'nodes.jsonl':'nodes','chains.jsonl':'chains','coverage.jsonl':'coverage','sessions.jsonl':'checkpoints'}[name];if(!kind)throw new Error('Unknown graph ledger file.');const state=await graphState();state[kind]=rows;await flushGraph(state);return name;
 }
 if(/\.json$/i.test(name)){
  const value=await readJSONFile(file);if(Array.isArray(value?.messages)&&value?.id){await saveChat(validateChat(value));emit('chats-changed',{});return value.id;}
  if(name==='settings.json'){const sanitized=sanitizeUserSettings(value);if(!sanitized)throw new Error('Invalid/newer settings schema.');await db.put('settings','record',sanitized);return name;}
  const graphName={'positions.json':'positions','sources.json':'sources','render-settings.json':'render-settings','format.json':'format'}[name];
  if(graphName){await db.put('graph',graphName,value);return name;}
  if(value?.kind&&value?.chatId&&value?.id){await db.put('job',value.id,value);return value.id;}
  throw new Error('Unrecognised LearnHarness JSON file; no data was replaced.');
 }
 throw new Error('Choose original session/settings/graph JSON, JSONL, PDF, Markdown or text.');
}
if(db.channel)db.channel.onmessage=event=>{emit('record-changed',{chatId:event.data?.id||''});emit('chats-changed',{});emit('activity-changed',{});};
