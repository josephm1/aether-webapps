import React,{useEffect,useState} from 'react';
import {transport,acceptSelection} from './connection.mjs';
import {hostedRequest} from './hosted-client.mjs';
let selected:any=null,inflight:Promise<any>|null=null,lastRead=0;
const listeners=new Set<(value:any)=>void>();
async function read(){if(!inflight)inflight=transport.capabilities().then(value=>{selected=value;lastRead=Date.now();listeners.forEach(listener=>listener(value));return value;}).finally(()=>{inflight=null;});return inflight;}
export function useAiSelection(){
 const [value,setValue]=useState(selected),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{listeners.add(setValue);if(!selected||Date.now()-lastRead>15000)void read();return()=>{listeners.delete(setValue);};},[]);
 async function configure(kind='thinking'){
  if(busy)return;setBusy(true);setError('');
  try{const result=await hostedRequest('ai.configure',{kind});if(!result.supported)throw new Error(result.reason||'Model unavailable.');const changed=selected?.selectionId!==result.selectionId;selected=result;listeners.forEach(listener=>listener(result));if(changed)await acceptSelection(result);}
  catch(e:any){setError(e.message);}finally{setBusy(false);}
 }
 return {value,busy,error,configure,refresh:read};
}
export function ThinkingControl(){
 const {value,busy,error,configure}=useAiSelection();
 return <span className="lh-thinking-control"><button type="button" className="lh-ai-settings-button" aria-label="Change thinking level" disabled={busy} onClick={()=>void configure()}>{value?.supported&&<span className="lh-current-model">{value.model.name||value.model.id}</span>}<span>{busy?'Opening…':value?.supported?`Thinking: ${value.thinkingLevel||'default'} ▾`:value?'AI unavailable':'AI settings…'}</span></button>{error&&<span role="alert" className="lh-inline-error">{error}</span>}</span>;
}
