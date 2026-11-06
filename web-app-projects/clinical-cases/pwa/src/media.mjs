import {readResource} from '../common/project-resources.mjs';
import {point,labAbnormal} from './domain.mjs';
export async function showFigure(figure,topic,{open,el,db,busy,caseId}){
 if(!figure.resource)throw new Error('This source figure is unavailable in the installed resource pack.');
 await busy('Loading this source image…',async()=>{
  const bytes=await readResource(figure.resource,{sha256:figure.sha256,maximum:8*1048576});
  const url=URL.createObjectURL(new Blob([bytes],{type:figure.mime}));let ro;document.querySelector('#dialog').addEventListener('close',()=>{ro?.disconnect();URL.revokeObjectURL(url);},{once:true});
  const body=open('Source image · page '+(figure.page||'?'));
  body.append(el('p',{class:'note'},figure.provenance?'Original teaching image from '+figure.provenance.title+'. No image has been sent to AI.':'Exact image extracted from '+topic.title+'. No image has been sent to AI. Labels or answers may be present in the source image.'));if(figure.provenance)body.append(el('p',{},figure.provenance.presentation),el('p',{},figure.provenance.licence),el('a',{href:figure.provenance.url,target:'_blank',rel:'noopener noreferrer'},'Original case'));
  const stage=el('div',{class:'media-stage'}),img=el('img',{src:url,alt:figure.alt||'Original document figure'}),canvas=el('canvas',{'aria-label':'Annotation canvas. Use pen or touch to mark the image.'});stage.append(img,canvas);body.append(stage);
  const key=(caseId||topic.id)+'-'+figure.sha256, saved=await db.get('annotation',key);
  let strokes=saved?.strokes||[],drawing=null,activePointer=null;
  const draw=()=>{const rect=stage.getBoundingClientRect();if(!rect.width||!rect.height)return;const dpr=Math.min(devicePixelRatio||1,3);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);const c=canvas.getContext('2d');c.scale(canvas.width,canvas.height);c.strokeStyle='#cc213b';c.lineWidth=3/rect.width;c.lineJoin='round';c.lineCap='round';for(const stroke of [...strokes,...(drawing?[drawing]:[])]){c.beginPath();stroke.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}};
  canvas.onpointerdown=e=>{if(activePointer!==null||e.button>0)return;e.preventDefault();activePointer=e.pointerId;canvas.setPointerCapture(e.pointerId);drawing=[point(e,canvas.getBoundingClientRect())];};
  canvas.onpointermove=e=>{if(e.pointerId!==activePointer||!drawing)return;const coalesced=e.getCoalescedEvents?.();for(const event of coalesced?.length?coalesced:[e])if(drawing.length<4000)drawing.push(point(event,canvas.getBoundingClientRect()));draw();};
  const finish=e=>{if(e.pointerId!==activePointer)return;if(drawing&&strokes.length<200)strokes.push(drawing);drawing=null;activePointer=null;draw();};canvas.onpointerup=finish;canvas.onpointercancel=finish;
  img.onload=draw;ro=new ResizeObserver(draw);ro.observe(stage);
  const actions=el('div',{class:'actions'});let ink=true;
  const mode=el('button',{class:'tonal',onclick:()=>{ink=!ink;canvas.classList.toggle('pan',!ink);mode.textContent=ink?'Pen enabled':'Scroll enabled';}},'Pen enabled');
  actions.append(mode,el('button',{onclick:()=>{strokes.pop();draw();}},'Undo'),el('button',{onclick:()=>{strokes=[];draw();}},'Clear'),el('button',{class:'primary',onclick:()=>busy('Saving annotation…',async()=>{await db.put('annotation',key,{topicId:topic.id,caseId:caseId||null,figureHash:figure.sha256,strokes,updated:new Date().toISOString()});})},'Save marks'));body.append(actions);
  body.append(el('p',{class:'notice'},'Your markings are saved separately from the original image. Automatic interpretation or clinical grading of image annotations is not implemented.'));
  body.append(el('details',{},el('summary',{},'Source and attribution'),el('p',{},topic.source.rights),el('p',{class:'footnote'},figure.href+' · EPUB SHA-256 '+topic.source.epubSha256)));

 });
}
export function showLabs(bank,{open,el}){
 const body=open('Lab results'),selected=new Set();if(bank.source)body.append(el('p',{},'Original case: '+bank.source.title+' · '+bank.source.caseId),el('p',{},bank.source.presentation),el('p',{class:'note'},bank.source.licence),el('a',{href:bank.source.url,target:'_blank',rel:'noopener noreferrer'},'Source case'));
 body.append(el('p',{class:'note'},'Mark results you think are abnormal, then reveal the reference-range check. '+(bank.source?'Values imported from the attached teaching case.':'Synthetic case values.')+' Reference intervals vary by laboratory and patient.'));
 const table=el('table',{class:'lab-list'}),head=el('tr',{});['Mark','Test','Result','Reference'].forEach(x=>head.append(el('th',{scope:'col'},x)));table.append(el('thead',{},head));const tbody=el('tbody',{});
 for(const lab of bank.labs){const row=el('tr',{}),input=el('input',{type:'checkbox','aria-label':'Mark '+lab.name+' abnormal',onchange:()=>{input.checked?selected.add(lab.id):selected.delete(lab.id);row.classList.toggle('marked',input.checked);}});row.append(el('td',{},input),el('td',{},lab.name),el('td',{},lab.value+' '+lab.unit),el('td',{},lab.low+'–'+lab.high+' '+lab.unit));tbody.append(row);}table.append(tbody);body.append(table);
 const feedback=el('div',{});body.append(el('button',{class:'primary',onclick:()=>{feedback.replaceChildren(...bank.labs.map(l=>el('p',{},(selected.has(l.id)===labAbnormal(l)?'✓ ':'Review: ')+l.name+' — '+(labAbnormal(l)?'outside':'within')+' the supplied interval. '+l.explanation)));}},'Check marked results'),feedback);
}
