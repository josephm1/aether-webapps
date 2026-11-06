export function sourceURL(value){let url;try{url=new URL(value);}catch{throw Error('Enter a full HTTPS webpage link.');}if(url.protocol!=='https:'||url.username||url.password||url.port)throw Error('Use an HTTPS link without a username, password or custom port.');return url;}
export function wikipediaTitle(value){const u=sourceURL(value);if(!['en.wikipedia.org','en.m.wikipedia.org'].includes(u.hostname))return null;let title;if(u.pathname.startsWith('/wiki/'))title=decodeURIComponent(u.pathname.slice(6));else if(u.pathname==='/w/index.php')title=u.searchParams.get('title');if(!title||title.length>240||title.includes(':'))throw Error('Choose an English Wikipedia article link.');return title.replaceAll('_',' ');}
export function wikiAPI(params){const u=new URL('https://en.wikipedia.org/w/api.php');u.search=new URLSearchParams({action:'parse',format:'json',formatversion:'2',origin:'*',...params});return u.href;}
export function plainHTML(html){
 // Remote markup is never inserted into the visible document.
 const safe=html.replace(/<(?:img|iframe|embed|object|link|source|video|audio)\b[^>]*>/gi,'');
 const d=new DOMParser().parseFromString(safe,'text/html');
 const hasVisuals=!!d.querySelector('math,svg');
 d.querySelectorAll('script,style,iframe,object,embed,link,table,nav,figure,.reference,.mw-editsection,.reflist,.navbox,.hatnote,math,svg').forEach(e=>e.remove());
 d.querySelectorAll('p,div,h1,h2,h3,h4,li,br').forEach(e=>e.append('\n'));
 return {text:d.body.textContent.replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n\n').trim(),hasVisuals};
}
export async function describeWikipedia(value,readJSON){
 const title=wikipediaTitle(value);if(!title)throw Error('Automatic section retrieval currently supports English Wikipedia. For other sites, paste the article text.');
 const response=await readJSON(wikiAPI({page:title,prop:'tocdata|revid',redirects:'1'}));
 const p=response.parse;if(response.error||!p||!Number.isSafeInteger(p.revid)||!p.title)throw Error('Wikipedia article was unavailable. Check the link or paste its text.');
 const toc=p.tocdata?.sections;if(!Array.isArray(toc)||toc.length>500)throw Error('Wikipedia returned an unsupported contents map.');
 // Leaf sections avoid fetching an entire large parent chapter for one subsection.
 const sections=[{id:'w0',index:'0',title:'Introduction'}];
 for(let i=0;i<toc.length;i++){const s=toc[i],next=toc[i+1];if(next&&next.tocLevel>s.tocLevel)continue;if(!/^\d+$/.test(String(s.index)))continue;sections.push({id:'w'+s.index,index:String(s.index),title:plainHTML(String(s.line)).text.slice(0,160)});}
 return {type:'wikipedia',title:p.title,revision:p.revid,url:'https://en.wikipedia.org/w/index.php?title='+encodeURIComponent(p.title)+'&oldid='+p.revid,sections,added:new Date().toISOString()};
}
export function openWikipedia(descriptor,readJSON){
 if(descriptor.type!=='wikipedia'||!Number.isSafeInteger(descriptor.revision)||!Array.isArray(descriptor.sections)||!descriptor.sections.length)throw Error('Saved Wikipedia reference is damaged.');
 const cache=new Map(),sections=descriptor.sections.map(s=>({...s}));
 return {name:descriptor.title,reference:descriptor.url,sections,cache,async read(id){if(cache.has(id))return cache.get(id);const s=sections.find(s=>s.id===id);if(!s||!/^\d+$/.test(s.index))throw Error('Unknown source section.');const response=await readJSON(wikiAPI({oldid:String(descriptor.revision),section:s.index,prop:'text',disableeditsection:'1',disabletoc:'1'}));const html=response.parse?.text;if(response.error||typeof html!=='string'||html.length>850000)throw Error('Wikipedia section could not be read within its size limit. Try another section.');const extracted=plainHTML(html);s.hasVisuals=extracted.hasVisuals;if(!extracted.text)throw Error('This section contains no readable text.');cache.set(id,extracted.text);if(cache.size>12)cache.delete(cache.keys().next().value);return extracted.text;}};
}
export function openLink(reference){return {name:reference.title,reference:reference.url,sections:[{id:'reference',title:'Webpage reference'}],cache:new Map(),async read(){throw Error('This link is saved as a reference. To study its content, paste the article text when adding the source.');}};}
