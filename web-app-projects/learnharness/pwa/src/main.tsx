import {SessionOpening} from './session-opening';
import React,{useEffect,useState,useRef,Suspense,lazy} from 'react';
import {createRoot} from 'react-dom/client';
const Home=lazy(()=>import('./material-pages').then(m=>({default:m.MaterialHome})));
const Sessions=lazy(()=>import('./material-pages').then(m=>({default:m.MaterialSessions})));
const Graph=lazy(()=>import('./graph-page'));
const Chat=lazy(()=>import('../../components/chat').then(m=>({default:m.Chat})));
const FilesPage=lazy(()=>import('./files-page'));

import {AppShell,SidebarProvider,useSidebar} from '../../components/sidebar';
import {ActivityProvider} from '../../components/activity-dock';
import {AppearanceProvider} from '../../components/settings/appearance';
import {ServerEventsProvider} from '../../components/server-events';
import {usePathname,Link,navigate} from './navigation';
import {installOfflineAPI} from './api.mjs';
import {browserEvents,db,getChat} from './store.mjs';

import {StandaloneSettings} from './settings-browser';
import {applyTheme} from './theme.mjs';


installOfflineAPI();
applyTheme(localStorage.getItem('aether-pwa-theme')||'system');
function Route(){const path=usePathname(),[chat,setChat]=useState<any>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;setError('');setChat(null);if(path.startsWith('/chat/')&&path!=='/chat/new')getChat(decodeURIComponent(path.split('/')[2])).then(value=>{if(!active)return;if(!value)setError('Local session not found. Import its JSON in Files first.');else setChat(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[path]);
 if(path==='/files')return <FilesPage/>;
 if(path==='/sessions')return <Sessions/>;
 if(path==='/graph')return <Graph/>;
 if(path==='/settings')return <StandaloneSettings/>;
 if(error)return <div className="pwa-page"><h1>Session unavailable</h1><p>{error}</p><Link href="/files">Files & backups</Link></div>;
 if(path.startsWith('/chat/')&&path!=='/chat/new')return chat?<Chat key={chat.id} chatId={chat.id} title={chat.title} kind={chat.kind||'teach'} initialMessages={chat.messages} initialPrompt={new URLSearchParams(location.search).get('prompt')||undefined} initialConfigured={false} initiallyInFlight={false}/>:<SessionOpening/>;
 return <Home/>;
}
class AppErrorBoundary extends React.Component<{children:React.ReactNode},{error:string}>{
 state={error:''};static getDerivedStateFromError(error:Error){return {error:error.message};}
 render(){return this.state.error?<main className="pwa-page"><h1>LearnHarness could not display this view</h1><p role="alert">{this.state.error}</p><p>Saved data has been retained.</p><a href="/">Reopen home</a> · <a href="/files">Files and backups</a></main>:this.props.children;}
}
function NativeBackNavigation(){
 const {open,toggle}=useSidebar();
 useEffect(()=>{const back=(event:Event)=>{
  const dialog=document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]');
  if(dialog){event.preventDefault();dialog.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return;}
  if(open){event.preventDefault();toggle();}
 };window.addEventListener('aether:back',back);return()=>window.removeEventListener('aether:back',back);},[open,toggle]);
 return null;
}
function RouteFallback(){const path=usePathname();return path.startsWith('/chat/')?<SessionOpening/>:<div className="pwa-page" role="status">Opening LearnHarness…</div>;}
function App(){return <ServerEventsProvider connect={browserEvents}><AppearanceProvider><SidebarProvider><NativeBackNavigation/><ActivityProvider><AppShell><div style={{display:'flex',flexDirection:'column',height:'100%',minHeight:0}}><div style={{flex:1,minHeight:0,overflow:'hidden'}}><Suspense fallback={<RouteFallback/>}><Route/></Suspense></div></div></AppShell></ActivityProvider></SidebarProvider></AppearanceProvider></ServerEventsProvider>;}
createRoot(document.getElementById('root')!).render(<AppErrorBoundary><App/></AppErrorBoundary>);

window.addEventListener('pagehide',()=>{ /* No background keep-alive. Browser/runtime lifecycle may cancel pending requests. */ });
