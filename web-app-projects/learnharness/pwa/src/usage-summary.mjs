const fields=['inputTokens','outputTokens','cacheReadTokens','cacheWriteTokens'];
export function summarizeUsage(turns=[]){
 const steps=turns.flatMap(turn=>turn.steps||[]),sum=key=>{const values=steps.map(step=>step[key]).filter(value=>Number.isFinite(value)&&value>=0);return values.length?values.reduce((a,b)=>a+b,0):null;};
 const buckets=Object.fromEntries([...fields,'reasoningTokens'].map(key=>[key,sum(key)]));
 const reported=fields.map(key=>buckets[key]).filter(value=>value!==null);
 return {...buckets,total:reported.length?reported.reduce((a,b)=>a+b,0):null,partial:steps.some(step=>fields.some(key=>!Number.isFinite(step[key])||step[key]<0)),calls:steps.length};
}
export function summarizeTools(messages=[]){
 const calls=new Map();let sequence=0;
 for(const message of messages)if(message.role==='assistant')for(const part of message.content||[]){if(part.type==='toolCall'&&part.name)calls.set(part.id||'anonymous-'+sequence++,part.name);}
 const counts=new Map();for(const name of calls.values())counts.set(name,(counts.get(name)||0)+1);
 return [...counts].sort(([a],[b])=>a.localeCompare(b)).map(([name,count])=>({name,count}));
}
