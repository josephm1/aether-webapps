import {SidebarHistory} from './sidebar-history';
import React,{createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {BookOpen,FolderOpen,Menu,Settings,Waypoints,X} from 'lucide-react';
import {Link,usePathname} from './navigation';
import {FilePathDropZone} from '../../components/file-path-drop-zone';
import {SettingsDialogProvider,useSettingsDialog} from './settings-browser';
const Context=createContext({open:false,toggle:()=>{},close:()=>{}});
export function useSidebar(){return useContext(Context);}
export function SidebarProvider({children}:{children:React.ReactNode}){
 const [open,setOpen]=useState(false),toggle=useCallback(()=>setOpen(value=>!value),[]),close=useCallback(()=>setOpen(false),[]);
 return <Context.Provider value={{open,toggle,close}}><div className="lh-app-layout">{children}</div></Context.Provider>;
}
export function SidebarToggle(){const {open,toggle}=useSidebar();return <button type="button" className="lh-icon-button" aria-label={open?'Close sidebar':'Open sidebar'} aria-expanded={open} onClick={toggle}>{open?<X aria-hidden="true"/>:<Menu aria-hidden="true"/>}</button>;}
export function timeAgo(value:string,now=new Date()){
 const seconds=Math.max(0,(now.getTime()-new Date(value).getTime())/1000);if(!Number.isFinite(seconds))return '';
 if(seconds<60)return 'Just now';if(seconds<3600)return `${Math.floor(seconds/60)}m ago`;if(seconds<86400)return `${Math.floor(seconds/3600)}h ago`;return `${Math.floor(seconds/86400)}d ago`;
}
const items=[{href:'/',label:'Learn',icon:BookOpen},{href:'/graph',label:'Graph',icon:Waypoints},{href:'/files',label:'Files',icon:FolderOpen}];
function MaterialShell({children}:{children:React.ReactNode}){
 const path=usePathname(),{open,close}=useSidebar(),settings=useSettingsDialog(),dialog=useRef<HTMLDialogElement>(null),inChat=path.startsWith('/chat/'),standaloneSettings=path==='/settings';
 useEffect(()=>{close();},[path,close]);
 useEffect(()=>{const element=dialog.current;if(!element)return;if(open&&!element.open)element.showModal();else if(!open&&element.open)element.close();},[open]);
 useEffect(()=>{const shortcut=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key===','){event.preventDefault();settings.open();}};window.addEventListener('keydown',shortcut);return()=>window.removeEventListener('keydown',shortcut);},[settings.open]);
 const active=(href:string)=>href==='/'?path==='/'||path==='/index.html':path.startsWith(href);
 const title=items.find(item=>active(item.href))?.label||'Learn';
 return <>
  <dialog ref={dialog} className="lh-navigation-drawer" aria-label="Navigation" onCancel={close} onClose={close} onClick={event=>{if(event.target===event.currentTarget)close();}}>
   <div className="lh-drawer-header"><span>LearnHarness</span><button className="lh-icon-button" aria-label="Close sidebar" onClick={close}><X aria-hidden="true"/></button></div>
   {open&&<SidebarHistory/>}
   <nav aria-label="Main navigation">{items.map(({href,label,icon:Icon})=><Link key={href} href={href} aria-current={active(href)?'page':undefined}><Icon aria-hidden="true"/><span>{label==='Files'?'Files & backups':label}</span></Link>)}<button type="button" data-testid="settings-entry" onClick={()=>{close();settings.open();}}><Settings aria-hidden="true"/>Settings</button></nav>
  </dialog>
  <div className={'lh-material-shell'+(inChat?' lh-session-shell':'')}>
   {!standaloneSettings&&<header className="lh-app-bar"><SidebarToggle/><h1>{title==='Graph'?'Knowledge graph':title==='Files'?'Files & backups':title}</h1><button type="button" className="lh-icon-button" aria-label="Settings" data-testid="settings-shortcut" onClick={()=>settings.open()}><Settings aria-hidden="true"/></button></header>}
   <FilePathDropZone className="lh-app-content">{children}</FilePathDropZone>

  </div>
 </>;
}
export function AppShell({children}:{children:React.ReactNode}){return <SettingsDialogProvider><MaterialShell>{children}</MaterialShell></SettingsDialogProvider>;}
