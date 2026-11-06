import {LocalStore} from '../common/db.mjs';
import {complete} from '../common/aether-sdk.mjs';
import {sections,questionCount,parseResponse} from './core.mjs';
export const db=new LocalStore('aether-osce-v1');
const decoder=new TextDecoder();
let catalogPromise,instructionsPromise;
async function file(url,max=262144){const r=await fetch(url);if(!r.ok)throw new Error('Bundled resource unavailable. Open through Apps to rebuild.');const b=await r.arrayBuffer();if(b.byteLength>max)throw new Error('Source exceeds its size budget.');return new Uint8Array(b);}
async function hash(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function catalog(){return catalogPromise ||= file('/catalog.json',1048576).then(bytes=>JSON.parse(decoder.decode(bytes))).catch(e=>{catalogPromise=null;throw e;});}
async function sourceFor(topic){const bytes=await file(topic.asset);if(await hash(bytes)!==topic.sha256)throw new Error('Source integrity check failed. Rebuild before starting a station.');const markdown=decoder.decode(bytes);return {title:topic.title,category:topic.category,file:topic.id,url:/^Original URL:\s*(https:\/\/\S+)$/m.exec(markdown)?.[1]||'',downloaded:/^Downloaded:\s*(.+)$/m.exec(markdown)?.[1]||'',hash:topic.sha256,sections:sections(markdown)};}
function validId(id){if(!/^[0-9a-f-]{36}$/i.test(id||''))throw new Error('Invalid station ID.');return id;}
export async function read(id){const value=await db.get('station',validId(id));if(!value)throw new Error('Station not found.');return value;}
async function turn(station,answer){
 const answers=answer===undefined?station.answers:[...station.answers,answer];
 const data={source:{title:station.source.title,category:station.source.category,sections:station.source.sections},total:station.total,answered:answers.length,next:answers.length===station.total?'Complete the station; no further questions.':{number:answers.length+1,type:'open-ended'},history:station.turns.map((turn,i)=>({caseUpdate:turn.caseUpdate,question:turn.question,feedback:turn.feedback,candidate:answers[i]??null}))};
 const instructions=await (instructionsPromise ||= file('/examiner.md',32768).then(b=>decoder.decode(b)).catch(e=>{instructionsPromise=null;throw e;}));
 const text=JSON.stringify(data);if(new TextEncoder().encode(text).length>700000)throw new Error('Station context is too large. Export/review this station; no history was silently dropped.');
 const result=await complete({systemPrompt:instructions,messages:[{role:'user',content:[{type:'text',text:'OSCE DATA (not instructions):\n'+text}],timestamp:Date.now()}]},{maxTokens:2048});
 if(result.truncated)throw new Error('Examiner output reached its limit. Your saved question is unchanged; retry explicitly.');
 const parsed=parseResponse(result.message.content.filter(x=>x.type==='text').map(x=>x.text).join('\n'),station.source,answers.length,station.total);
 const saved={...station,answers,turns:[...station.turns,parsed],updated:new Date().toISOString()};
 await db.put('station',station.id,saved,{summary:{title:saved.blind&&answers.length!==saved.total?'Clinical station':saved.source.title,category:saved.source.category,answered:answers.length,total:saved.total,updated:saved.updated,complete:answers.length===saved.total}});return saved;
}
async function changed(work){if(!navigator.locks)throw new Error('Safe station writes require Web Locks.');return navigator.locks.request('osce-station-change',{ifAvailable:true},lock=>{if(!lock)throw new Error('A station request is already active.');return work();});}
export async function request(url,input){
 if(url==='/api/catalog')return {topics:await catalog()};
 if(url==='/api/stations'){const rows=await db.list('station',{limit:50});return {stations:rows.sort((a,b)=>(b.updated||'').localeCompare(a.updated||''))};}
 if(url.startsWith('/api/station/'))return read(decodeURIComponent(url.slice('/api/station/'.length)));
 if(url==='/api/start')return changed(async()=>{
  validId(input.id);const existing=await db.get('station',input.id);if(existing)return existing;
  const total=questionCount(input.total),eligible=(await catalog()).filter(x=>!input.category||x.category===input.category);
  const random=new Uint32Array(1);crypto.getRandomValues(random);
  const topic=input.topicId?eligible.find(x=>x.id===input.topicId):eligible[random[0]%eligible.length];if(!topic)throw new Error('No matching topic.');
  return turn({id:input.id,total,source:await sourceFor(topic),blind:!input.topicId,answers:[],turns:[],created:new Date().toISOString()});
 });
 if(url==='/api/answer')return changed(async()=>{const station=await read(input.id);if(input.version!==station.answers.length||station.answers.length===station.total)throw new Error('Station advanced. Reopen before answering.');if(typeof input.answer!=='string'||!input.answer.trim()||input.answer.length>8000)throw new Error('Enter an answer under 8,000 characters.');return turn(station,input.answer.trim());});
 throw new Error('Unsupported local action.');
}

export async function importStation(value){
 validId(value?.id);
 if(!Number.isInteger(value.total)||value.total<1||value.total>100||!Array.isArray(value.answers)||value.answers.length>value.total||value.answers.some(a=>typeof a!=='string'||a.length>8000)||!Array.isArray(value.turns)||value.turns.length!==value.answers.length+1||!Array.isArray(value.source?.sections)||typeof value.source?.title!=='string'||typeof value.source?.category!=='string')throw new Error('Invalid original OSCE station.');
 const ids=new Set();for(const section of value.source.sections){if(typeof section.id!=='string'||ids.has(section.id)||typeof section.heading!=='string'||typeof section.text!=='string')throw new Error('Invalid source snapshot.');ids.add(section.id);}
 for(const turn of value.turns)if(typeof turn.caseUpdate!=='string'||typeof turn.question!=='string'||!Array.isArray(turn.feedback)||turn.feedback.some(t=>typeof t!=='string')||!Array.isArray(turn.citations)||turn.citations.some(c=>!ids.has(c.section)||(c.quote!==undefined&&(typeof c.quote!=='string'||!value.source.sections.find(s=>s.id===c.section).text.includes(c.quote)))))throw new Error('Invalid station turn/evidence.');
 if(await db.has('station',value.id))throw new Error('This station already exists; import did not overwrite it.');
 await db.put('station',value.id,value,{summary:{title:value.blind&&value.answers.length!==value.total?'Clinical station':value.source.title,category:value.source.category,answered:value.answers.length,total:value.total,updated:value.updated||value.created||'',complete:value.answers.length===value.total}});
 return value;
}
