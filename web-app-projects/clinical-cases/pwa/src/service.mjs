import {LocalStore} from '../common/db.mjs';
import {complete} from '../common/aether-sdk.mjs';
import {readResource} from '../common/project-resources.mjs';
import {parseBank,generationContext,responseText} from './domain.mjs';
export const db=new LocalStore('clinical-cases-v1');
export async function topicFor(entry,signal){
 const bytes=await readResource('bmj/'+entry.file,{sha256:entry.sha256,maximum:524288,signal});
 const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
 // Bound expanded bytes instead of allocating an unbounded decompression bomb.
 const reader=stream.getReader(),chunks=[];let length=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>8*1048576)throw new Error('Expanded topic exceeds its budget.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const topic=JSON.parse(await new Blob(chunks).text());
 if(topic.id!==entry.id||!Array.isArray(topic.chunks)||topic.chunks.length!==entry.sections)throw new Error('Topic does not match the title index.');
 return topic;
}
export function blankStudy(topic){return {id:topic.id,title:topic.title,sourceHash:topic.source.epubSha256,banks:{},updated:new Date().toISOString()};}
export async function loadStudy(topic){const study=await db.get('study',topic.id);if(study&&study.sourceHash!==topic.source.epubSha256)throw new Error('Source edition changed. Export saved progress before using a new edition.');return study||blankStudy(topic);}
export async function mutate(topic,change){
 if(!navigator.locks)throw new Error('This browser needs Web Locks for safe shared progress.');
 return navigator.locks.request('clinical-study-'+topic.id,{ifAvailable:true},async lock=>{
  if(!lock)throw new Error('This topic is being changed in another window.');
  const study=await loadStudy(topic);await change(study);study.updated=new Date().toISOString();
  await db.put('study',topic.id,study,{summary:{title:topic.title,updated:study.updated,topicId:topic.id}});return study;
 });
}
export async function generate(topic,chunk,signal){
 return mutate(topic,async study=>{
  const previous=(study.banks[chunk.id]||[]).flatMap(b=>b.questions.map(q=>q.objective));
  const result=await complete(generationContext(topic,chunk,previous),{maxTokens:6000,signal});
  if(result.truncated)throw new Error('AI output reached its limit. Nothing was saved; retry only when ready.');
  const bank=parseBank(responseText(result.message||result),chunk);
  bank.id=crypto.randomUUID();bank.answers={};bank.created=new Date().toISOString();bank.usage=result.usage||result.message?.usage||null;
  study.banks[chunk.id]=[...(study.banks[chunk.id]||[]),bank];
 });
}
export async function answer(topic,section,bankId,qid,choice,confidence){return mutate(topic,study=>{
 const bank=study.banks[section]?.find(b=>b.id===bankId),q=bank?.questions.find(q=>q.id===qid);
 if(!q||!Number.isInteger(choice)||choice<0||choice>=q.choices.length)throw new Error('Question changed. Reopen the saved section.');
 if(bank.answers[qid])throw new Error('This answer was already saved.');
 bank.answers[qid]={choice,correct:choice===q.correct,confidence,time:new Date().toISOString()};
});}
