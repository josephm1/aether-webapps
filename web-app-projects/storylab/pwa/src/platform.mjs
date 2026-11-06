import {isHosted} from './common/hosted-client.mjs';
import {LocalStore} from './common/db.mjs';
import {complete,selection,configureAi,resource} from './common/aether-sdk.mjs';
export const hosted=isHosted();
let promise;
function localDb(){return promise ||= new Promise((resolve,reject)=>{const req=indexedDB.open('storylab-desktop-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('records');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function transaction(mode,work){const db=await localDb();return new Promise((resolve,reject)=>{const tx=db.transaction('records',mode);let value;work(tx.objectStore('records'),v=>value=v);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Save aborted.'));});}
export const db=hosted?new LocalStore('aether-storylab-v1'):{
 get:(kind,id)=>transaction('readonly',(s,done)=>{const q=s.get(kind+'/'+id);q.onsuccess=()=>done(q.result);}),
 put:(kind,id,value)=>transaction('readwrite',s=>s.put(value,kind+'/'+id)),
 batch:entries=>transaction('readwrite',s=>{for(const e of entries)s.put(e.value,e.kind+'/'+e.id);}),
};
export async function ai(context,signal){if(hosted)return complete(context,{maxTokens:2200,signal});const r=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({context}),signal});const value=await r.json();if(!r.ok)throw Error(value.error||'Pi request failed.');return value;}
export async function model(kind){if(hosted){if(kind)await configureAi(kind);const s=await selection();return [s.model?.name||s.model?.id,s.thinkingLevel].filter(Boolean).join(' · ');}const r=await fetch('/api/config');if(!r.ok)throw Error('Start the desktop preview server to use Pi.');const v=await r.json();return v.label;}
export async function locked(work){if(!navigator.locks)throw Error('This browser needs Web Locks for safe saves.');return navigator.locks.request('storylab-write',{ifAvailable:true},lock=>{if(!lock)throw Error('Another StoryLab window is updating progress. Try again.');return work();});}

export async function readWebJSON(url){
 const parsed=new URL(url);if(parsed.origin!=='https://en.wikipedia.org'||parsed.pathname!=='/w/api.php')throw Error('Only Wikipedia API requests are supported.');
 if(hosted)return (await resource(url)).payload;
 const response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Wikipedia could not be reached. Try again or paste the article text.');
 const reader=response.body.getReader();let total=0;const parts=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>1048576)throw Error('Wikipedia response exceeds 1 MiB.');parts.push(value);}}finally{await reader.cancel();}
 const bytes=new Uint8Array(total);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
