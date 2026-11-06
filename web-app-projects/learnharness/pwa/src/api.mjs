/* Browser persistence/transport adapter. Existing React components keep their API shapes. */
import {db,getChat,saveChat,createChat,chatList,settings,graphState,graphView,memoryGraph,flushGraph,allMetadata,timestamp} from './store.mjs';
import {modelCatalog,transport} from './connection.mjs';
import {emit} from '../../src/core/events.ts';
import {sanitizeUserSettings} from '../../src/core/settings.ts';
import {sanitizeRenderSettings,DEFAULT_RENDER_SETTINGS} from '../../src/core/render-settings.ts';
import {coverageOf} from '../../src/core/coverage.ts';
import {deleteNodeTraces,deleteChatTraces} from '../../src/core/graph-deletion.ts';
import {deriveView,getGraph} from '../../src/core/graph.ts';
import {sessionMarkdown,setSteerUiInverted,chainsForSelection,formatChainLine,newGraphContextMessage,parseDismissInput,dismissAppends} from '../../src/core/index.ts';
import {settleGraphLayout} from '../../src/core/layout-settle.ts';
const originalFetch=globalThis.fetch.bind(globalThis);
export const activeTurns=new Map();
let graphRevision=0;
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const unsupported=reason=>json({code:'offline_capability_unavailable',error:reason,message:reason},503);
async function coverage(record){const rows=await db.get('graph','coverage')||[],cov=coverageOf(record.messages,rows,record.id);const own=rows.filter(x=>x.chatId===record.id);return {totalMessages:cov.slots.length,coveredCount:cov.coveredCount,uncoveredCount:cov.uncoveredCount,coveredTokens:cov.coveredTokens,uncoveredTokens:cov.uncoveredTokens,running:false,lastFoldedAt:own.map(x=>x.foldedAt).sort().at(-1)||null};}
async function bodyOf(input,init){if(init?.body instanceof FormData){const files=init.body.getAll('files');if(files.length>8||files.some(file=>!(file instanceof Blob)||file.size>2*1048576)||files.reduce((n,f)=>n+f.size,0)>8*1048576)throw new Error('Notes extraction accepts at most eight files, 2 MiB each / 8 MiB total.');return {files};}if(init?.body!==undefined){if(typeof init.body!=='string')throw new Error('Local API accepts JSON text.');if(init.body.length>8*1048576)throw new Error('Local request exceeds the 8 MiB JSON budget.');return JSON.parse(init.body||'{}');}if(input instanceof Request&&!['GET','HEAD'].includes(input.method)){const text=await input.text();if(text.length>8*1048576)throw new Error('Local request exceeds the JSON budget.');return JSON.parse(text||'{}');}return {};}
export function installOfflineAPI(){
 globalThis.fetch=async(input,init)=>{
  const raw=typeof input==='string'||input instanceof URL?String(input):input.url,url=new URL(raw,location.href);
  if(url.origin!==location.origin||(!url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/__aether_host__/')))return originalFetch(input,init);
  try{
   const method=init?.method||(input instanceof Request?input.method:'GET'),body=await bodyOf(input,init),signal=init?.signal||(input instanceof Request?input.signal:undefined);
   const execute=()=>route(url,method,body,signal);
   if(['GET','HEAD'].includes(method)||['/api/chat','/api/activity/abort','/api/graph/import','/api/graph/coverage/extract'].includes(url.pathname)||(url.pathname.endsWith('/dismiss')&&activeTurns.has(decodeURIComponent(url.pathname.split('/')[3]||''))))return await execute();
   if(!navigator.locks)return json({error:'Safe browser writes require Web Locks.'},503);
   const chatMatch=url.pathname.match(/^\/api\/chats\/([^/]+)/),lockName=chatMatch?'learnharness-chat-'+decodeURIComponent(chatMatch[1]):url.pathname.startsWith('/api/graph/')?'learnharness-graph-write':'learnharness-local-write';
   return await navigator.locks.request(lockName,{ifAvailable:true},lock=>lock?execute():json({error:'This record is active in another window/operation. No write was made.'},409));
  }
  catch(error){return json({error:error.message||String(error)},400);}
 };
}
async function route(url,method,body,signal){
 const p=url.pathname;
 if(p==='/__aether_host__/status')return json({sourceDirectory:'Shared WebApps project/source',dataDirectory:'Shared WebApps project/data',theme:document.documentElement.dataset.theme||'light',inference:'aether-app-selection'});
 if(p==='/api/models'&&method==='GET')return json(await modelCatalog());
 if(p==='/api/settings'&&method==='GET')return json({settings:await settings()});
 if(p.startsWith('/api/settings/')&&method==='PUT'){
  const section=p.split('/')[3];if(!['general','appearance','graph','agent','compaction','models'].includes(section))return unsupported('This setting belongs to an unavailable native/provider integration.');
  const value=body.input??body;
  if(section==='models'){
   const catalog=await modelCatalog();if(!catalog.models.length)return unsupported('Check this app’s AI permission and model selection in Apps → Advanced.');
   for(const slot of Object.values(value))if(slot?.model&&(slot.model.provider!==catalog.models[0].provider||slot.model.id!==catalog.models[0].id))return unsupported('Select this app’s model in Apps → Advanced. This PWA cannot substitute a different provider/model.');
  }
  const record=sanitizeUserSettings({...await settings(),version:1,[section]:value});if(!record)return json({error:'Invalid settings schema.'},400);await db.put('settings','record',record);return json({settings:record});
 }
 if(/^\/api\/(keys|custom-provider|subscriptions|claude-code|stt)(\/|$)/.test(p))return unsupported('This PWA uses Aether’s selected model, not additional provider credentials, native browser logins or cloud dictation.');
 if(p==='/api/search')return json({available:false,engine:null,reason:'No separate search provider is configured in this PWA.'});
 if(p==='/api/activity/abort'&&method==='POST'){if(body.kind==='turn'){const active=activeTurns.get(body.id);active?.abort();return json({ok:!!active});}return unsupported('This offline adapter has no detached native/background job to abort.');}
 if(p==='/api/activity')return json({jobs:[],extractions:[],graphRevision});
 if(p==='/api/jobs'){
  const chatId=url.searchParams.get('chatId'),metadata=await allMetadata('job',1000),jobs=[];
  for(const meta of metadata){const job=await db.get('job',meta.id);if(job?.chatId===chatId)jobs.push(job.status==='running'?{...job,status:'error',error:'Imported job is not running; no automatic paid resume was attempted.'}:job);}
  return json({jobs,turnInFlight:activeTurns.has(chatId),compacting:false});
 }
 if(p==='/api/graph'&&method==='GET')return json(await graphView());
 if(p==='/api/graph/status')return json({runs:[]});
 if(p==='/api/graph/costs')return unsupported('Historic graph prices are not inferred by this offline adapter. Imported usage records are preserved; no zero-cost claim is made.');
 if(p==='/api/graph/render-settings'){
  if(method==='PUT'){const value=sanitizeRenderSettings(body);await db.put('graph','render-settings',value);return json(value);}return json(sanitizeRenderSettings(await db.get('graph','render-settings')||DEFAULT_RENDER_SETTINGS));
 }
 if(p==='/api/graph/positions'&&method==='PUT'){
  const state=await graphState(),store=memoryGraph(state),known=new Set(deriveView(getGraph(store)).nodes.map(n=>n.id)),positions={};
  for(const [id,value]of Object.entries(body||{}))if(known.has(id)&&Number.isFinite(value?.x)&&Number.isFinite(value?.y))positions[id]={x:Math.max(-1e6,Math.min(1e6,value.x)),y:Math.max(-1e6,Math.min(1e6,value.y))};
  if(Object.keys(positions).length){store.writePositions(positions);if([...known].some(id=>!(id in positions)))settleGraphLayout(store);await flushGraph(state);graphRevision=Date.now();}return json({positions:state.positions});
 }
 if(p.startsWith('/api/graph/nodes/')&&method==='DELETE'){
  const state=await graphState(),stats=deleteNodeTraces(memoryGraph(state),decodeURIComponent(p.split('/').at(-1)));if(!stats)return json({error:'Not found'},404);await flushGraph(state);graphRevision=Date.now();return json({ok:true,stats,graphRevision});
 }
 if(p==='/api/graph/import'||p==='/api/graph/coverage/extract'){
  const module=await import('./learning.mjs');
  if(p==='/api/graph/import'&&body.files){const results=[];for(let i=0;i<body.files.length;i++){const file=body.files[i];try{const result=await module.extractRequest(p,{filePath:file.name,text:await file.text()});results.push({requestIndex:i,filePath:file.name,ok:true,outcome:'completed',stats:result.stats});}catch(error){results.push({requestIndex:i,filePath:file.name,ok:false,outcome:error.outcome||'failed',error:error.message,stats:error.partialStats});}}graphRevision=Date.now();return json({results});}
  const result=await module.extractRequest(p,body);graphRevision=Date.now();return json(result);
 }
 if(p==='/api/chats'){
  if(method==='GET')return json({chats:(await chatList()).map(c=>({...c,busy:activeTurns.has(c.id),compacting:false}))});
  if(method==='POST'){
   const info=await transport.capabilities();if(!info.supported)return unsupported(info.reason);
   const rawPicks=body.graphContext?.propositions,picks=Array.isArray(rawPicks)?rawPicks:[];if(picks.length>64||picks.some(p=>typeof p?.id!=='string'||typeof p.name!=='string'||typeof p.statement!=='string'))return json({error:'At most 64 valid graph picks are supported.'},400);
   let marker;if(picks.length){const state=await graphState(),byId=new Map(state.nodes.map(n=>[n.id,n])),picked=picks.map(p=>byId.get(p.id)).filter(Boolean);marker=newGraphContextMessage(picks,chainsForSelection(picked,state.chains).map(c=>formatChainLine(c,Object.fromEntries(byId))));}
   const record=await createChat(body.title,body.kind);record.settings={model:{provider:info.model.provider,id:info.model.id},thinkingLevel:info.thinkingLevel};if(marker)record.messages=[marker];
   await saveChat(record);return json({id:record.id,title:record.title},201);
  }
 }
 if(p==='/api/chat'&&method==='POST'){const module=await import('./learning.mjs');return module.chatRequest(body,signal);}
 const match=p.match(/^\/api\/chats\/([^/]+)(?:\/(.+))?$/);
 if(match){
  const id=decodeURIComponent(match[1]),action=match[2],record=await getChat(id);if(!record)return json({error:'Not found'},404);
  if(!action&&method==='GET')return json({...record,turnInFlight:activeTurns.has(id),compacting:false,coverage:await coverage(record)});
  if(!action&&method==='PUT'){if(typeof body.title!=='string'||!body.title.trim())return json({error:'Title required'},400);record.title=body.title.trim().slice(0,1000);await saveChat(record);emit('chats-changed',{});return json({title:record.title});}
  if(!action&&method==='DELETE'){
   if(activeTurns.has(id))return json({error:'Stop the active turn before deletion.'},409);
   const mode=url.searchParams.get('mode');if(!['preserve-graph','delete-nodes'].includes(mode))return json({error:'Explicit graph deletion mode is required.'},400);
   const state=await graphState(),stats=deleteChatTraces(memoryGraph(state),id,mode);await flushGraph(state,[{kind:'chat',id,delete:true}]);
   let removed=0;for(const meta of await allMetadata('job',1000)){const job=await db.get('job',meta.id);if(job?.chatId===id){await db.remove('job',meta.id);removed++;}}
   graphRevision=Date.now();emit('chats-changed',{});return json({ok:true,mode,stats,jobsRemoved:removed,graphRevision});
  }
  if(action==='dismiss'&&method==='POST'){
   const input=parseDismissInput(body.input);
   if(activeTurns.has(id)){activeTurns.get(id).parkDismissal(input);activeTurns.get(id).abort();return json({ok:true,parked:true},202);}
   record.messages=[...record.messages,...dismissAppends(record,input)];await saveChat(record);emit('record-changed',{chatId:id});return json({ok:true});
  }
  if(action==='settings'){
   if(method==='GET')return json(record.settings||{});
   const value=body.input??body,catalog=await modelCatalog(),selected=catalog.models[0];
   if(value.model&&(!selected||value.model.id!==selected.id||value.model.provider!==selected.provider))return unsupported('Choose this app’s model in Apps → Advanced. No model substitution.');
   if(value.thinkingLevel&&value.thinkingLevel!==catalog.defaults?.thinkingLevel)return unsupported('Choose this app’s thinking level in Apps → Advanced.');record.settings=value;await saveChat(record);return json({settings:value});
  }
  if(action==='stream')return activeTurns.get(id)?.response()||new Response('data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
  if(action==='stop'||action==='abort'){activeTurns.get(id)?.abort();return json({ok:true});}
  if(action==='artifact-ui'&&method==='POST'){
   const value=body.input;
   if(typeof value?.messageId!=='string'||typeof value?.inverted!=='boolean')return json({error:'input must contain messageId and inverted.'},400);
   const target=record.messages.find(message=>message.id===value.messageId);
   if(!['demo','visual'].includes(target?.details?.kind))return json({error:'No demo/figure steer with that message id.'},400);
   record.messages=setSteerUiInverted(record.messages,value.messageId,value.inverted);await saveChat(record);return json({ok:true});
  }
  if(action==='markdown'&&method==='GET'){
   const name=record.title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'session';
   return new Response(sessionMarkdown(record.messages,{title:record.title,anchors:false}),{headers:{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':`attachment; filename="${name}.md"`}});
  }
 }
 return unsupported('This server-dependent operation has no completed offline adapter. No network/AI call or fake success was returned.');
}
