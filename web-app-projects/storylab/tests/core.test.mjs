import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRequest,inputBound,validateActivity,responseText,INPUT_LIMIT} from '../pwa/dist/core.mjs';
import {ZipBook,passages,retrieve,openBook} from '../pwa/dist/books.mjs';
import {zipSync,strToU8} from '../vendor/fflate.mjs';
const hit={id:'s1:0',section:'s1',title:'Water',text:'Each of the 120 people needs 2 litres per day. Three days requires 720 litres. Each barrel holds 60 litres. Therefore twelve barrels are needed.'};
const request=()=>makeRequest({objective:'Calculate water reserves',level:'University',mode:'challenge',hits:[hit]});
const activity=()=>({title:'Water reserve',scene:'Plan a crossing.',question:'How many barrels?',options:['10','11','12','13'],correct:2,feedback:['Too few.','Too few.','720 / 60 = 12.','Too many.'],evidence:[{id:hit.id,quote:'Three days requires 720 litres.'}],certainty:'exercise',takeaway:'Track units.'});
test('budget includes system, state, evidence, JSON and framing reserve',()=>{const r=request();assert.equal(r.bound,inputBound(r.context));assert(r.bound<=4000);assert.equal(r.context.tools.length,0);assert.equal(r.context.messages.length,1);});
test('oversized and multilingual evidence cannot bypass input guard',()=>{for(const text of ['x'.repeat(10000),'三'.repeat(2000),'😀'.repeat(2000)])assert.throws(()=>makeRequest({objective:'Study',hits:[{...hit,text}]}),/fits the budget/);});
test('only three bounded passages, never irrelevant library content',()=>{const r=makeRequest({objective:'Study',hits:Array.from({length:50},(_,i)=>({...hit,id:'p'+i}))});assert(r.excerpts.length<=3);assert(r.bound<=INPUT_LIMIT);assert(!JSON.stringify(r).includes('unrelated chat'));});
test('exact source quotations and answer keys are validated',()=>{assert.equal(validateActivity(JSON.stringify(activity()),[hit]).correct,2);for(const change of [{correct:4},{correct:1.5},{options:['a','a','b','c']},{evidence:[{id:'invented',quote:'Three days requires 720 litres.'}]},{evidence:[{id:hit.id,quote:'Water is infinite and free.'}]}])assert.throws(()=>validateActivity(JSON.stringify({...activity(),...change}),[hit]));});
test('insufficient evidence and truncated responses retain no partial activity',()=>{assert.throws(()=>validateActivity('{"insufficient":"Need the definition"}',[hit]),/More evidence/);assert.throws(()=>responseText({truncated:true}),/truncated/);assert.throws(()=>responseText({message:{stopReason:'error',errorMessage:'No provider'}}),/No provider/);});
test('ZIP indexes without decompressing chapters and rejects bad archives',()=>{const z=zipSync({'a.txt':strToU8('hello'),'chapter.html':strToU8('x'.repeat(20000))});const book=new ZipBook(z.buffer);assert.equal(book.entries.size,2);assert.equal(book.read('a.txt'),'hello');assert.throws(()=>new ZipBook(new ArrayBuffer(40)),/readable/);assert.throws(()=>book.read('missing'),/Missing/);});
test('ZIP rejects large expanded chapters before inflation',()=>{const z=zipSync({'large':strToU8('x'.repeat(1024*1024+1))});assert.throws(()=>new ZipBook(z.buffer).read('large'),/limit/);});
test('plain text retrieval selects and expands source passages locally',async()=>{const book=await openBook(new Blob(['# Supply\nBarrels hold sixty litres.\n# Geometry\nTriangles have three sides.']),'book.md');const r=await retrieve(book,'triangles');assert(r.hits[0].text.includes('Triangles'));assert(r.hits[0].id.startsWith('s'));assert(book.cache.size>0);assert.equal(r.next,null);});
test('search is bounded and can continue across a whole book',async()=>{const sections=Array.from({length:15},(_,i)=>({id:'s'+i,title:'chapter '+i}));let reads=0;const book={sections,read:async()=>{reads++;return 'Useful content here.';}};const a=await retrieve(book,'content');assert.equal(reads,6);assert.equal(a.next,6);await retrieve(book,'content',{cursor:a.next});assert.equal(reads,12);});
test('original offsets support reproducible citations',()=>{const a=passages('river '.repeat(500),{id:'s0',title:'River'},'river');assert(a.every(p=>p.text.length<=850));assert(a.some(p=>p.offset>0));});
test('corrupted ZIP contents fail their CRC instead of becoming source evidence',()=>{const z=zipSync({'source':strToU8('A readable source passage.')},{level:0});const book=new ZipBook(z.buffer);const e=book.entries.get('source');z[e.offset+30+'source'.length]^=1;assert.throws(()=>book.read('source'),/damaged/);});
test('story opening requires role, setting, background, goal and stakes before a decision',()=>{
 const a={...activity(),scene:'You have to prepare water for the crossing.',question:'What do you do?',options:['I take ten barrels.','I take eleven barrels.','I take twelve barrels.','I take thirteen barrels.'],opening:{role:'You are the expedition quartermaster.',setting:'At a river camp before a crossing.',background:'120 people depend on the supplies you prepare.',goal:'Prepare drinking water for three days.',stakes:'Insufficient water puts the crossing at risk.'},continuity:{summary:'Twelve barrels meet the stated reserve.',nextFocus:'Check the assumptions behind the reserve.'}};
 assert.equal(validateActivity(JSON.stringify(a),[hit],{mode:'challenge',first:true}).opening.role,a.opening.role);
 for(const key of ['role','setting','background','goal','stakes']){const bad=structuredClone(a);delete bad.opening[key];assert.throws(()=>validateActivity(JSON.stringify(bad),[hit],{mode:'challenge',first:true}),/introduction/);}
 const bad={...a,scene:'You are preparing a narrative of an expedition.'};assert.throws(()=>validateActivity(JSON.stringify(bad),[hit],{mode:'challenge',first:true}),/recall quiz/);
});
test('request identifies opening vs continuation and keeps only compact current story state',()=>{
 const a={...activity(),answer:2,opening:{role:'Quartermaster',setting:'River camp',goal:'Prepare water'},continuity:{summary:'The reserve meets three days of demand.',nextFocus:'Assumptions'}};
 const first=request();const payload=JSON.parse(first.context.messages[0].content[0].text);assert.equal(payload.phase,'OPENING');
 const next=makeRequest({objective:'Water',sourceTitle:'Expedition',mode:'challenge',previous:[a,a,a,a],campaign:a.opening,hits:[hit]});const state=JSON.parse(next.context.messages[0].content[0].text);assert.equal(state.phase,'CONTINUE');assert.equal(state.source,'Expedition');assert.equal(state.previous.length,1);assert.equal(state.campaign.role,'Quartermaster');assert.equal(next.audit.tools,0);assert(next.bound<=4000);
});
test('whole-life retrieval begins with early context and excludes historiography',async()=>{
 const sections=[{id:'s0',title:'Introduction'},{id:'s1',title:'Childhood'},{id:'s2',title:'Education'},{id:'s3',title:'Historiography'}];const book={sections,read:async id=>id==='s3'?'His entire life is recorded in later accounts.':'Early context for '+id+'. He chose a course of action.'};const r=await retrieve(book,'His entire life');assert.equal(r.hits[0].section,'s0');assert(r.hits.some(h=>h.section==='s1'));assert(!r.hits.some(h=>h.section==='s3'));
});

test('retrieval omits clipped sentence fragments while retaining exact quotations',()=>{
 const text='First complete sentence. '+('A complete sentence with useful detail. '.repeat(80));
 const result=passages(text,{id:'s0',title:'Chapter'},'detail');
 assert(result.length>1);
 for(const p of result){assert(text.includes(p.text));assert(p.text.endsWith('.'));assert(/^(First|A) /.test(p.text));}
});

test('whole-life continuation moves beyond the previous passage to the next action',async()=>{
 const texts={child:'Alexander tamed a horse.',education:'Philip chose a teacher. Lessons included philosophy.',regency:'Alexander was appointed regent and defeated a revolt.'};
 const book={sections:Object.keys(texts).map(id=>({id,title:id})),read:async id=>texts[id]};
 const r=await retrieve(book,'His entire life',{after:{sectionId:'child',offset:0}});
 assert(!r.hits.some(p=>p.section==='child'));
 assert.equal(r.hits[0].section,'regency');
 assert(r.hits.every(p=>texts[p.section].includes(p.text)));
});
