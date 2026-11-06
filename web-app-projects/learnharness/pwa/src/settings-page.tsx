import {useAiSelection} from './ai-selection';
import React,{useEffect,useRef,useState} from 'react';
import {useAppearance} from '../../components/settings/appearance';
import {notifySettingsSaved} from '../../components/settings-signal';
import {FACTORY_SETTINGS,type UserSettings,type AppearanceSettings,type GraphSettings} from '../../src/core';
import {Link} from './navigation';
import {download} from './db.mjs';
import {transport} from './connection.mjs';
import {applyTheme} from './theme.mjs';
const tabs=[['appearance','Appearance'],['ai','AI'],['graph','Graph'],['about','About']] as const;
function tab(value='appearance'){return value==='keys'||value==='agent'?'ai':value==='general'?'about':tabs.some(([key])=>key===value)?value:'appearance';}
export default function SettingsPage({initialSection,onClose}:{initialSection?:string;onClose:()=>void}){
 const [section,setSection]=useState(tab(initialSection)),[record,setRecord]=useState<UserSettings|null>(null),[error,setError]=useState(''),[status,setStatus]=useState(''),[saving,setSaving]=useState(false),[theme,setTheme]=useState(()=>localStorage.getItem('aether-pwa-theme')||'system');
 const {value:model,busy:modelBusy,error:modelError,configure,refresh}=useAiSelection();
 const busy=useRef(false),alive=useRef(true),{onAppearanceChange,appearance:resolvedAppearance}=useAppearance();
 async function load(){setError('');try{const response=await fetch('/api/settings'),body=await response.json();if(!response.ok)throw new Error(body.error||'Settings could not load.');if(alive.current)setRecord(body.settings||{version:1});}catch(e:any){if(alive.current)setError(e.message);}}
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;};},[]);
 useEffect(()=>{setSection(tab(initialSection));},[initialSection]);
 useEffect(()=>{const back=(event:Event)=>{event.preventDefault();if(!busy.current)onClose();};window.addEventListener('aether:back',back);return()=>window.removeEventListener('aether:back',back);},[onClose]);
 async function save(key:'appearance'|'graph',value:AppearanceSettings|GraphSettings){
  if(busy.current)return;busy.current=true;setSaving(true);setStatus('Saving…');setError('');
  try{const response=await fetch('/api/settings/'+key,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)}),body=await response.json();if(!response.ok||!body.settings)throw new Error(body.error||'Settings could not save.');if(alive.current){setRecord(body.settings);if(key==='appearance')onAppearanceChange(body.settings.appearance);notifySettingsSaved(key);setStatus('Saved');}}
  catch(e:any){if(alive.current){setError(e.message);setStatus('');}}finally{busy.current=false;if(alive.current)setSaving(false);}
 }
 const appearance=record?.appearance,graph=record?.graph;
 const setAppearance=(value:Partial<AppearanceSettings>)=>void save('appearance',{...appearance,...value});
 return <section className="lh-settings-page" data-testid="settings-dialog">
  <header className="lh-settings-header"><button type="button" aria-label="Close settings" disabled={saving} onClick={onClose}>←</button><h1>Settings</h1><span role="status" aria-live="polite">{status}</span></header>
  <nav className="lh-settings-tabs" aria-label="Settings sections">{tabs.map(([key,label])=><button type="button" key={key} aria-current={section===key?'page':undefined} disabled={saving} onClick={()=>setSection(key)}>{label}</button>)}</nav>
  <div className="lh-settings-content">
   {error&&<div role="alert" className="lh-settings-error">{error}{!record&&<button onClick={()=>void load()}>Retry</button>}</div>}
   {!record&&!error&&<p role="status">Loading settings…</p>}
   {section==='appearance'&&record&&<fieldset disabled={saving}><legend>Reading & appearance</legend>
    <label className="lh-settings-row"><span>Colour theme</span><select aria-label="Colour theme" value={theme} onChange={event=>{try{const value=event.target.value;localStorage.setItem('aether-pwa-theme',value);applyTheme(value);setTheme(value);}catch(e:any){setError(e.message);}}}><option value="system">Follow Aether</option><option value="light">Light</option><option value="dark">Dark</option>{theme==='eink'&&<option value="eink">Existing high-contrast preference</option>}</select></label>
    <label className="lh-settings-row"><span>Reading size <small>{appearance?.proseFontSize??FACTORY_SETTINGS.appearance.proseFontSize} px</small></span><select aria-label="Reading size" value={appearance?.proseFontSize??16} onChange={e=>setAppearance({proseFontSize:Number(e.target.value)})}>{Array.from({length:13},(_,i)=>i+12).map(size=><option key={size} value={size}>{size} px</option>)}</select></label>
    <label className="lh-settings-row"><span>Reading font</span><select aria-label="Reading font" value={appearance?.fontFamily||''} onChange={e=>setAppearance({fontFamily:e.target.value||null})}><option value="">Default</option><option value="Roboto">Roboto</option><option value="system-ui">System</option><option value="Georgia">Serif</option>{appearance?.fontFamily&&!['Roboto','system-ui','Georgia'].includes(appearance.fontFamily)&&<option value={appearance.fontFamily}>{appearance.fontFamily}</option>}</select></label>
    <label className="lh-settings-row"><span>Serif session titles</span><input aria-label="Serif session titles" type="checkbox" checked={appearance?.sessionNameSerif??resolvedAppearance.sessionNameSerif} onChange={e=>setAppearance({sessionNameSerif:e.target.checked})}/></label>
    <label className="lh-settings-row"><span>Heading weight</span><select aria-label="Heading weight" value={appearance?.mdRendering?.headingWeight??900} onChange={e=>setAppearance({mdRendering:{...appearance?.mdRendering,headingWeight:Number(e.target.value)}})}>{[...new Set([100,200,300,400,500,600,700,800,900,appearance?.mdRendering?.headingWeight??900])].sort((a,b)=>a-b).map(weight=><option key={weight} value={weight}>{weight}</option>)}</select></label>
   </fieldset>}
   {section==='ai'&&<><h2>Aether model</h2><p>Uses this app’s selection in Aether, including its existing authentication. No additional login or provider key is needed.</p>{modelBusy&&<p role="status">Reading current selection…</p>}{modelError&&<p role="alert">{modelError}</p>}{model&&<dl><dt>Model</dt><dd>{model.model.name||model.model.id}</dd><dt>Provider</dt><dd>{model.model.provider}</dd><dt>Thinking level</dt><dd>{model.thinkingLevel||'Default'}</dd></dl>}<div className="lh-ai-actions"><button disabled={modelBusy} onClick={()=>void configure("thinking")}>Change thinking level</button><button disabled={modelBusy} onClick={()=>void configure("model")}>Change model</button><button disabled={modelBusy} onClick={()=>void refresh()}>Refresh selection</button></div><p>Changes apply only to LearnHarness. Choose Follow Aether to use its current selection.</p><p className="lh-settings-hint">Checking the selection does not generate an AI response. Only relevant session content and explicitly supported app tools are sent when you submit.</p></>}
   {section==='graph'&&record&&<fieldset disabled={saving}><legend>Knowledge graph</legend><label className="lh-settings-row"><span>Enable knowledge graph</span><input aria-label="Enable knowledge graph" type="checkbox" checked={graph?.enabled??true} onChange={e=>void save('graph',{...graph,enabled:e.target.checked})}/></label><label className="lh-settings-row"><span>Render graph</span><input aria-label="Render graph" type="checkbox" checked={graph?.rendering??true} onChange={e=>void save('graph',{...graph,rendering:e.target.checked})}/></label><p>These preferences use the existing graph settings format. Full extraction, audit and merge workflows still require further validation.</p></fieldset>}
   {section==='about'&&<><h2>LearnHarness</h2><p>Your sessions, documents and settings are saved in this app’s shared project folder.</p><p><Link href="/files" onClick={onClose}>Files & backups</Link></p><h2>Licence & source</h2><p>LearnHarness is licensed under AGPL-3.0. Its licence, notices and matching corresponding source are included.</p><button disabled={saving} onClick={async()=>{if(busy.current)return;busy.current=true;setSaving(true);try{const response=await fetch('/learnharness-corresponding-source.zip');if(!response.ok)throw new Error('Source archive unavailable.');await download('learnharness-corresponding-source.zip',await response.blob(),'application/zip');setStatus('Source export requested');}catch(e:any){setError(e.message);}finally{busy.current=false;setSaving(false);}}}>Export AGPL source</button><p className="lh-settings-hint">Background research, demo/visual generation, durable wake, native dictation and full compaction remain incomplete in this adaptation.</p></>}
  </div>
 </section>;
}
