import {download,readJSONFile} from '../common/db.mjs';
import {request,db,importStation} from './service.mjs';
'use strict';
const $=id=>document.getElementById(id);
let topics=[], station=null, working=false, voice=null, reviewing=false;
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
const reviewKey=()=>`osce-reviewed:${station.id}`;
const draftKey=()=>station ? `osce-answer:${station.id}:${station.answers.length}` : '';
function message(text='') {$('notice').textContent=text;$('notice').hidden=!text;}
function busy(value,text='') {working=value;for(const id of ['start','submit','back','another','dictate','next-question'])$(id).disabled=value; $('next-question').disabled=value || !station || (station.answers.length===station.total && !reviewing);message(text);}
async function api(url,data) {await flushUI();return request(url,data);}
const uiValues=await db.get('state','view')||{};
let saveTimer,saveChain=Promise.resolve(),uiDirty=false;
const localStorage={getItem:key=>uiValues[key]??null,setItem(key,value){uiValues[key]=String(value);scheduleUI();},removeItem(key){delete uiValues[key];scheduleUI();}};
function scheduleUI(){uiDirty=true;clearTimeout(saveTimer);saveTimer=setTimeout(()=>{void flushUI().catch(error=>message('Draft save failed: '+error.message));},350);}
async function flushUI(){clearTimeout(saveTimer);if(uiDirty){uiDirty=false;const snapshot=structuredClone(uiValues);saveChain=saveChain.catch(()=>{}).then(()=>db.put('state','view',snapshot)).catch(error=>{uiDirty=true;throw error;});}await saveChain;}
document.addEventListener('visibilitychange',()=>{if(document.hidden)void flushUI().catch(error=>message(error.message));});
function filterTopics() {
  const category=$('category').value, previous=$('topic').value;
  $('topic').replaceChildren(new Option(category ? 'Random topic in this category' : 'Random topic across all categories',''));
  for(const topic of topics.filter(t=>!category || t.category===category)) $('topic').add(new Option(topic.title,topic.id));
  if([...$('topic').options].some(o=>o.value===previous)) $('topic').value=previous;
}
async function loadSetup() {
  const [catalog,saved]=await Promise.all([api('/api/catalog'),api('/api/stations')]);
  topics=catalog.topics;
  const previous=$('category').value;
  $('category').replaceChildren(new Option('All categories',''));
  for(const category of [...new Set(topics.map(t=>t.category))]) $('category').add(new Option(category.replaceAll('/',' / '),category));
  $('category').value=[...$('category').options].some(o=>o.value===previous)?previous:'';
  filterTopics();
  $('source-count').textContent=`${topics.length} Markdown topics · Aether uses only the selected article`;
  $('source-count').append(document.createTextNode(' · model/effort: Apps → Advanced'));
  $('start').disabled=!topics.length;
  $('saved-list').replaceChildren();
  for(const savedStation of saved.stations.slice(0,20)) {
    const button=node('button',undefined,'saved-card');button.type='button';
    const label=node('span',savedStation.title);label.append(node('small',`${savedStation.category.replaceAll('/',' / ')} · ${savedStation.answered}/${savedStation.total} answered`));
    button.append(label,node('span',savedStation.complete?'Review →':'Continue →'));
    button.addEventListener('click',()=>openStation(savedStation.id));$('saved-list').append(button);
  }
  if(!saved.stations.length)$('saved-list').append(node('p','Your paused and completed stations will appear here.','hint'));
}
async function home() {
  if(working)return;
  voice?.cancel();voice=null;station=null;setExpanded(false);
  localStorage.removeItem('osce-current');$('station').hidden=true;$('setup').hidden=false;message();
  try{await loadSetup();}catch(error){message(error.message);}
  window.scrollTo(0,0);
}
async function openStation(id) {
  if(working)return;
  try{station=await api('/api/station/'+encodeURIComponent(id));render();message();}catch(error){message(error.message);}
}
function render() {
  const complete=station.answers.length===station.total, turn=station.turns.at(-1);
  reviewing=station.answers.length>(Number(localStorage.getItem(reviewKey())) || 0);
  $('station').classList.toggle('reviewing',reviewing);
  localStorage.setItem('osce-current',station.id);
  $('setup').hidden=true;$('station').hidden=false;
  $('station-title').textContent=station.blind && (!complete || reviewing) ? 'Clinical station' : station.source.title;
  $('station-category').textContent=station.source.category.replaceAll('/',' / ');
  $('progress').textContent=reviewing ? `Feedback ${station.answers.length} of ${station.total}` : complete ? `${station.total} questions complete` : `Question ${station.answers.length+1} of ${station.total}`;
  $('progress-fill').style.width=`${station.answers.length/station.total*100}%`;
  $('feedback').hidden=!reviewing;
  $('review-question').textContent=reviewing ? station.turns[station.answers.length-1].question : '';
  $('review-answer').textContent=reviewing ? station.answers.at(-1) : '';
  $('feedback-list').replaceChildren(...turn.feedback.map(text=>node('li',text)));
  $('case').hidden=reviewing || !turn.caseUpdate;$('case-text').textContent=turn.caseUpdate;
  const updates=station.turns.slice(0,reviewing ? -1 : station.turns.length).map((turn,index)=>({text:turn.caseUpdate,number:index+1})).filter(update=>update.text.trim());
  $('case-so-far').hidden=updates.length<2;
  $('case-so-far').open=false;
  $('case-timeline').replaceChildren();
  for(const update of updates) {
    const entry=node('section',undefined,'case-entry');
    entry.append(node('h3',`Question ${update.number}`),node('p',update.text));
    $('case-timeline').append(entry);
  }
  $('next-question').disabled=(complete && !reviewing) || working;
  const nextLabel=reviewing ? (complete ? 'Finish station' : 'Next question') : 'Submit answer for feedback';
  $('next-question').setAttribute('aria-label',nextLabel);$('next-question').title=nextLabel;
  $('answer-form').hidden=complete || reviewing;$('completion').hidden=!complete || reviewing;
  $('question').textContent=turn.question;
  setAnswerExpanded(false);
  $('answer').value=localStorage.getItem(draftKey()) || '';
  $('evidence').open=false;
  const date=station.source.downloaded ? station.source.downloaded.slice(0,10) : 'date not recorded';
  $('provenance').textContent=`${station.source.file} · snapshot ${date}. These notes have not been checked against current local guidance.`;
  $('citation-list').replaceChildren();
  for(const citation of turn.citations) {
    const section=station.source.sections.find(s=>s.id===citation.section);
    if(citation.quote) {
      const paragraph=section.text.slice(0,section.text.indexOf(citation.quote)).split(/\n\s*\n/).length;
      $('citation-list').append(node('h3',`${section.heading} · paragraph ${paragraph}`),node('blockquote',citation.quote));
    } else {
      $('citation-list').append(node('h3',section.heading));
      section.text.split(/\n\s*\n/).forEach((text,index)=>{
        $('citation-list').append(node('p',`Paragraph ${index+1}`,'hint'),node('blockquote',text));
      });
    }
  }
  $('source-text').replaceChildren();
  for(const section of station.source.sections) {const div=node('section',undefined,'source-section');div.append(node('h3',section.heading),node('p',section.text));$('source-text').append(div);}
  $('history-list').replaceChildren();$('history').hidden=!station.answers.length;
  station.answers.forEach((answer,i)=>{
    const turn=station.turns[i],after=station.turns[i+1],entry=node('section',undefined,'history-entry');
    if(turn.caseUpdate)entry.append(node('p',turn.caseUpdate));
    entry.append(node('h3',`${i+1}. ${turn.question}`),node('p',`Your answer: ${answer}`));
    const list=node('ul');for(const text of after.feedback)list.append(node('li',text));entry.append(list);$('history-list').append(entry);
  });
}
function setExpanded(expanded) {
  document.body.classList.toggle('expanded',expanded);
  $('expand').setAttribute('aria-pressed',String(expanded));
  $('expand').setAttribute('aria-label',expanded ? 'Restore normal view' : 'Expand reading area');
  $('expand').title=expanded ? 'Restore normal view' : 'Expand reading area';
  $('expand').querySelector('use').setAttribute('href',expanded ? '#icon-collapse' : '#icon-expand');
}
function setAnswerExpanded(expanded) {
  $('written-answer').classList.toggle('answer-expanded',expanded);
  $('expand-answer').setAttribute('aria-pressed',String(expanded));
  const label=expanded ? 'Collapse answer text' : 'Expand answer text';
  $('expand-answer').setAttribute('aria-label',label);$('expand-answer').title=label;
  $('expand-answer').querySelector('use').setAttribute('href',expanded ? '#icon-collapse' : '#icon-expand');
}
$('expand-answer').addEventListener('click',()=>{
  const expanded=!$('written-answer').classList.contains('answer-expanded');
  setAnswerExpanded(expanded);
  if(expanded) {
    $('answer').scrollTop=0;
    $('written-answer').scrollIntoView({block:'start',behavior:'instant'});
  }
});
$('expand').addEventListener('click',()=>setExpanded(!document.body.classList.contains('expanded')));
document.addEventListener('keydown',event=>{
  if(event.key==='Escape' && $('written-answer').classList.contains('answer-expanded')) {setAnswerExpanded(false);$('expand-answer').focus();}
  else if(event.key==='Escape' && document.body.classList.contains('expanded')) {setExpanded(false);$('expand').focus();}
});
for(const [id,direction] of [['page-up',-1],['page-down',1]]) $(id).addEventListener('click',()=>{
  const height=window.visualViewport?.height || window.innerHeight;
  window.scrollBy({top:direction*Math.max(48,height-$('reading-controls').getBoundingClientRect().height-48),behavior:'instant'});
});
$('category').addEventListener('change',filterTopics);
$('setup-form').addEventListener('submit',async event=>{
  event.preventDefault();if(working)return;
  const id=crypto.randomUUID();busy(true,'Preparing your case…');
  try{station=await api('/api/start',{id,total:Number($('total').value),category:$('category').value,topicId:$('topic').value});render();window.scrollTo(0,0);message();}
  catch(error){message(error.message);}finally{busy(false,$('notice').textContent);}
});
$('answer').addEventListener('input',()=>{try{localStorage.setItem(draftKey(),$('answer').value);}catch{message('Your answer draft could not be saved. Keep a copy before leaving.');}});
$('answer-form').addEventListener('submit',async event=>{
  event.preventDefault();if(working || voice)return;
  const answer=$('answer').value.trim();
  if(!answer){message('Give your answer before continuing.');$('answer').focus();return;}
  const key=draftKey();busy(true,'The examiner is considering your answer…');
  try {station=await api('/api/answer',{id:station.id,version:station.answers.length,answer});localStorage.removeItem(key);render();$('feedback').focus({preventScroll:true});window.scrollTo(0,0);message();}
  catch(error){message(error.message);}finally{busy(false,$('notice').textContent);}
});
$('next-question').addEventListener('click',()=>{
  if(working || !station)return;
  if(!reviewing){$('answer-form').requestSubmit();return;}
  try{localStorage.setItem(reviewKey(),String(station.answers.length));}
  catch{message('Your review position could not be saved. Try again before continuing.');return;}
  render();void flushUI().catch(error=>message(error.message));
  if(station.answers.length<station.total)$('question').focus({preventScroll:true});
  window.scrollTo(0,0);
});
$('back').addEventListener('click',home);$('another').addEventListener('click',home);
(async()=>{
  try{await loadSetup();const saved=localStorage.getItem('osce-current');if(saved)await openStation(saved);}
  catch(error){message(error.message);}
})();

$('export-station').addEventListener('click',async()=>{if(working||!station)return;try{await flushUI();await download('osce-station-'+station.id+'.json',station);message('Station export requested.');}catch(e){message(e.message);}});
$('import-station').addEventListener('change',async event=>{const file=event.target.files[0];if(!file||working)return;try{await importStation(await readJSONFile(file));await loadSetup();message('Station imported.');}catch(e){message(e.message);}finally{event.target.value='';}});

window.addEventListener('aether:back',event=>{
 if(working){event.preventDefault();message('Please wait for the current action to finish.');return;}
 if(station){event.preventDefault();void flushUI().then(home).catch(error=>message(error.message));}
});
