// Measure the actual app context before transport. Store counts only, never prompt text.
const encoder=new TextEncoder();
const bytes=value=>encoder.encode(typeof value==='string'?value:JSON.stringify(value??null)).byteLength;
export const CONTEXT_CATEGORIES=[['user','Your message'],['history','Earlier messages'],['prompts','Prompts & format'],['definitions','Tool definitions'],['toolData','Tool calls & results'],['resources','Documents & data']];
export function measureRequestContext(context={}){
 const sizes=Object.fromEntries(CONTEXT_CATEGORIES.map(([key])=>[key,0]));
 sizes.prompts=bytes(context.systemPrompt||'');
 const definitions=(context.tools||[]).map(tool=>({name:tool.name,description:tool.description,parameters:tool.parameters}));
 sizes.definitions=definitions.length?bytes(definitions):0;
 const messages=context.messages||[],lastUser=messages.findLastIndex(message=>message.role==='user');
 let toolCalls=0,toolResults=0,images=0;
 for(const [index,message]of messages.entries()){
  sizes.prompts+=bytes({role:message.role});
  const parts=typeof message.content==='string'?[{type:'text',text:message.content}]:message.content||[];
  for(const part of parts){
   if(part.type==='image'){images++;continue;}
   if(part.type==='toolCall'){sizes.toolData+=bytes({name:part.name,arguments:part.arguments});toolCalls++;continue;}
   let category=message.role==='user'?(index===lastUser?'user':'history'):message.role==='system'?'prompts':'history';
   if(message.role==='toolResult')category=/^(read|pdf|grep|find|project_read)$/.test(message.toolName||'')?'resources':'toolData';
   sizes[category]+=bytes(part.text??part.thinking??part);
  }
  if(message.role==='toolResult')toolResults++;
 }
 return {version:1,method:'utf8-bytes-divided-by-4',bytes:sizes,definitions:definitions.length,toolCalls,toolResults,images};
}
export function summarizeContextBreakdown(turns=[]){
 const totals=Object.fromEntries(CONTEXT_CATEGORIES.map(([key])=>[key,0]));let recorded=0,missing=0,images=0,definitions=0,toolCalls=0,toolResults=0;
 for(const turn of turns)for(const step of turn.steps||[]){const audit=step.contextBreakdown;if(audit?.version!==1||audit.method!=='utf8-bytes-divided-by-4'){missing++;continue;}recorded++;for(const key of Object.keys(totals))totals[key]+=Number.isFinite(audit.bytes?.[key])&&audit.bytes[key]>=0?audit.bytes[key]:0;images+=audit.images||0;definitions+=audit.definitions||0;toolCalls+=audit.toolCalls||0;toolResults+=audit.toolResults||0;}
 const estimated=Object.fromEntries(Object.entries(totals).map(([key,value])=>[key,Math.ceil(value/4)]));
 return {estimated,total:recorded?Object.values(estimated).reduce((a,b)=>a+b,0):null,recorded,missing,images,definitions,toolCalls,toolResults};
}
