import React,{lazy,Suspense,useEffect,useState} from 'react';
import {useSettingsDialog} from './settings-browser';
const GraphHome=lazy(()=>import('../../components/home').then(module=>({default:module.Home})));
export default function GraphPage(){
 const [record,setRecord]=useState<any>(null),[error,setError]=useState(''),settings=useSettingsDialog();
 useEffect(()=>{let alive=true;const load=async()=>{try{const response=await fetch('/api/settings'),body=await response.json();if(!response.ok)throw new Error(body.error||'Graph preferences unavailable.');if(alive){setRecord(body.settings||{});setError('');}}catch(e:any){if(alive)setError(e.message);}};void load();window.addEventListener('lh:settings-saved',load);return()=>{alive=false;window.removeEventListener('lh:settings-saved',load);};},[]);
 if(error)return <main className="lh-material-page"><p role="alert">{error}</p><button onClick={()=>settings.open('graph')}>Graph settings</button></main>;
 if(!record)return <p className="lh-material-page" role="status">Opening your graph…</p>;
 if(record.graph?.enabled===false)return <main className="lh-material-page"><h2>Your graph is paused</h2><p>Your saved knowledge is retained. Enable the graph in Settings to explore it.</p><button className="lh-tonal-button" onClick={()=>settings.open('graph')}>Graph settings</button></main>;
 return <div className="lh-graph-page"><Suspense fallback={<p role="status">Opening your graph…</p>}><GraphHome initialConfigured={false} rendering={record.graph?.rendering!==false}/></Suspense></div>;
}
