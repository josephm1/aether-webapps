import {inflateSync} from './vendor/fflate.mjs';
const utf8=new TextDecoder();
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(data){let n=0xffffffff;for(const b of data)n=crcTable[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
export const MAX_BOOK=16*1024*1024,MAX_CHAPTER=1024*1024;
export async function fingerprint(blob){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');}
function xml(s){const d=new DOMParser().parseFromString(s,'application/xml');if(d.querySelector('parsererror'))throw Error('Malformed EPUB XML.');return d;}
function normalize(base,href){const p=[];for(const s of (base+decodeURIComponent(href.split('#')[0])).split('/')){if(s==='..'){if(!p.length)throw Error('EPUB path escapes the book.');p.pop();}else if(s&&s!=='.')p.push(s);}return p.join('/');}
export class ZipBook {
 constructor(buffer){
  this.bytes=new Uint8Array(buffer);this.view=new DataView(buffer);this.entries=new Map();const n=this.bytes.length;
  let end=-1;for(let i=n-22;i>=Math.max(0,n-65557);i--)if(this.view.getUint32(i,true)===0x06054b50 && i+22+this.view.getUint16(i+20,true)===n){end=i;break;}
  if(end<0)throw Error('Not a readable EPUB/ZIP file.');
  const v=this.view,count=v.getUint16(end+10,true);let p=v.getUint32(end+16,true),expanded=0;
  if(count>8192||v.getUint16(end+4,true)||v.getUint16(end+6,true))throw Error('Unsupported multipart or oversized EPUB.');
  for(let i=0;i<count;i++){
   if(p+46>n||v.getUint32(p,true)!==0x02014b50)throw Error('Damaged EPUB directory.');
   const length=v.getUint16(p+28,true),extra=v.getUint16(p+30,true),comment=v.getUint16(p+32,true);
   if(p+46+length+extra+comment>n)throw Error('Damaged EPUB entry.');
   const name=utf8.decode(this.bytes.subarray(p+46,p+46+length)),size=v.getUint32(p+24,true);
   expanded+=size;if(expanded>128*1024*1024)throw Error('EPUB expanded size exceeds 128 MiB.');
   if(this.entries.has(name))throw Error('Duplicate EPUB entry.');
   this.entries.set(name,{name,size,crc:v.getUint32(p+16,true),packed:v.getUint32(p+20,true),method:v.getUint16(p+10,true),flags:v.getUint16(p+8,true),offset:v.getUint32(p+42,true)});
   p+=46+length+extra+comment;
  }
 }
 read(name){const e=this.entries.get(name);if(!e)throw Error('Missing EPUB section: '+name);
  if(e.size>MAX_CHAPTER)throw Error('Section exceeds the 1 MiB reading limit.');
  if(e.flags&1)throw Error('Encrypted EPUBs are unsupported.');
  const v=this.view,p=e.offset;if(p+30>this.bytes.length||v.getUint32(p,true)!==0x04034b50)throw Error('Damaged EPUB section.');
  const start=p+30+v.getUint16(p+26,true)+v.getUint16(p+28,true);
  if(start+e.packed>this.bytes.length)throw Error('Truncated EPUB section.');
  const data=this.bytes.subarray(start,start+e.packed);
  const result=e.method===0?data:e.method===8?inflateSync(data,{out:new Uint8Array(e.size)}):null;
  if(!result||result.length!==e.size||crc32(result)!==e.crc)throw Error('Unsupported or damaged EPUB compression.');
  return utf8.decode(result);
 }
}
export async function openBook(blob,name){
 if(!blob.size||blob.size>MAX_BOOK)throw Error('Choose a non-empty EPUB, TXT or Markdown file up to 16 MiB.');
 const cache=new Map();let sections,read;
 if(/\.epub$/i.test(name)){
  const zip=new ZipBook(await blob.arrayBuffer());
  if(zip.entries.has('META-INF/encryption.xml'))throw Error('Encrypted EPUB resources are unsupported. Use a readable text export.');
  const container=xml(zip.read('META-INF/container.xml'));
  const opfPath=container.getElementsByTagName('rootfile')[0]?.getAttribute('full-path');if(!opfPath)throw Error('EPUB has no package document.');
  const opf=xml(zip.read(opfPath)),base=opfPath.slice(0,opfPath.lastIndexOf('/')+1);
  const items=new Map([...opf.getElementsByTagName('item')].map(e=>[e.getAttribute('id'),e]));
  sections=[...opf.getElementsByTagName('itemref')].map((e,i)=>{const item=items.get(e.getAttribute('idref'));if(!item)return null;return {id:'s'+i,title:item.getAttribute('id')||'Section '+(i+1),path:normalize(base,item.getAttribute('href')||'')};}).filter(Boolean);
  if(!sections.length)throw Error('EPUB has no readable spine.');
  // Read the existing navigation, never all chapter bodies at import.
  const nav=[...items.values()].find(e=>(e.getAttribute('properties')||'').split(/\s+/).includes('nav'));
  const ncx=[...items.values()].find(e=>e.getAttribute('media-type')==='application/x-dtbncx+xml');
  if(nav||ncx){const item=nav||ncx,np=normalize(base,item.getAttribute('href')),nb=np.slice(0,np.lastIndexOf('/')+1),d=xml(zip.read(np));
   if(nav){for(const a of d.getElementsByTagName('a')){const p=normalize(nb,a.getAttribute('href')||'');const s=sections.find(s=>s.path===p);if(s)s.title=a.textContent.trim().slice(0,160);}}
   else for(const point of d.getElementsByTagName('navPoint')){const content=point.getElementsByTagName('content')[0],label=point.getElementsByTagName('text')[0];if(content&&label){const s=sections.find(s=>s.path===normalize(nb,content.getAttribute('src')||''));if(s)s.title=label.textContent.trim().slice(0,160);}}
  }
  read=async s=>{const d=new DOMParser().parseFromString(zip.read(s.path),'text/html');d.querySelectorAll('script,style,nav').forEach(e=>e.remove());if(d.querySelector('math,svg,table,img'))s.hasVisuals=true;
   d.querySelectorAll('p,div,h1,h2,h3,h4,li,br,tr').forEach(e=>e.append('\n'));return d.body.textContent.replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n\n').trim();};
 }else{
  if(!/\.(txt|md|markdown)$/i.test(name))throw Error('Supported formats: EPUB, TXT and Markdown.');
  const text=await blob.text();const starts=[0];const re=/^(?:#{1,6}\s+.+|(?:chapter|part|section)\s+[^\n]+)$/gim;let m;
  while((m=re.exec(text)))if(m.index>starts.at(-1))starts.push(m.index);
  // Split unusually long sections locally; no AI preprocessing.
  const points=[];for(let i=0;i<starts.length;i++)for(let p=starts[i];p<(starts[i+1]??text.length);p+=24000)points.push(p);
  sections=points.map((start,i)=>({id:'s'+i,title:text.slice(start,text.indexOf('\n',start)>start?text.indexOf('\n',start):start+90).trim().slice(0,160)||'Section '+(i+1),start,end:points[i+1]??text.length}));
  read=async s=>text.slice(s.start,s.end);
 }
 return {name,sections,cache,async read(id){if(cache.has(id))return cache.get(id);const s=sections.find(s=>s.id===id);if(!s)throw Error('Unknown section.');const text=await read(s);cache.set(id,text);if(cache.size>12)cache.delete(cache.keys().next().value);return text;}};
}
export function broadObjective(q){return /\b(entire|whole|biography|overview|life story|from (?:the )?(?:start|beginning)|all (?:of )?(?:his|her|their) life)\b/i.test(q);}
export function words(q){return [...new Set(q.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[])].filter(w=>!['the','and','for','with','what','this','that','from','about','learn'].includes(w));}
function passageText(text,start,length){
 // Exclude partial sentences at window edges without changing source wording.
 let body=text.slice(start,start+length);
 if(start>0&&!/[.!?]\s*$/.test(text.slice(Math.max(0,start-3),start))){const first=body.search(/[.!?]\s+/);if(first>=0)body=body.slice(first+1);}
 if(start+length<text.length){const ends=[...body.matchAll(/[.!?](?:\s|$)/g)];if(ends.length)body=body.slice(0,ends.at(-1).index+1);}
 return body.trim();
}
export function passages(text,section,query){
 const terms=words(query),out=[];for(let start=0;start<text.length;start+=650){const body=passageText(text,start,850);if(!body)continue;const lower=body.toLowerCase();const score=terms.reduce((n,t)=>n+(lower.includes(t)?1:0),0);out.push({id:section.id+':'+start,section:section.id,title:section.title,offset:start,text:body,score,hasVisuals:!!section.hasVisuals});}return out.sort((a,b)=>b.score-a.score);
}
export async function retrieve(book,query,{sectionId='',cursor=0,count=6,after=null,onProgress=()=>{}}={}){
 const chronological=broadObjective(query);
 const terms=words(query),ranked=[...book.sections].filter(s=>!chronological||! /^(historiography|notes|references|primary sources|secondary sources|further reading|external links|lists)$/i.test(s.title)).sort((a,b)=>chronological?0:terms.reduce((n,t)=>n+(b.title.toLowerCase().includes(t)?1:0)-(a.title.toLowerCase().includes(t)?1:0),0));
 const start=after?Math.max(0,ranked.findIndex(s=>s.id===after.sectionId)):cursor;const selected=sectionId?ranked.filter(s=>s.id===sectionId):ranked.slice(start,start+count);let hits=[];
 for(let i=0;i<selected.length;i++){const s=selected[i];const text=await book.read(s.id);if(chronological){const all=passages(text,s,'').filter(p=>!after||s.id!==after.sectionId||p.offset>after.offset);if(after){const action=all.find(p=>/\b(tam(?:ed|ing)|decid(?:ed|ing)|refused|regent|rebellion|revolt|defeated|led|marched|attacked)\b/i.test(p.text));if(action)hits.push({...action,score:100-ranked.indexOf(s)});}else{const intro=all.find(p=>p.offset===0);if(intro)hits.push({...intro,text:passageText(text,0,s.id===ranked[0]?.id?550:850),score:100-ranked.indexOf(s)});if(s!==ranked[0]){const decision=all.find(p=>/\b(tam(?:ed|ing)|decid(?:ed|ing)|chose|refused|appointed|regent|rebellion)\b/i.test(p.text));if(decision&&decision.offset>0)hits.push({...decision,score:100.5-ranked.indexOf(s)});}}}else hits.push(...passages(text,s,query));onProgress(i+1,selected.length);await new Promise(r=>setTimeout(r,0));}
 return {hits:hits.sort((a,b)=>b.score-a.score).slice(0,12),scanned:selected.length,total:book.sections.length,next:sectionId?null:cursor+selected.length<ranked.length?cursor+selected.length:null};
}
