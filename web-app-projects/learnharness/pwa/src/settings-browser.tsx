import React,{createContext,lazy,Suspense,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {navigate} from './navigation';
const SettingsBody=lazy(()=>import('./settings-page'));
const Context=createContext<{open:(section?:string,row?:string)=>void}>({open:()=>{}});
export function useSettingsDialog(){return useContext(Context);}
export function SettingsDialogProvider({children}:{children:React.ReactNode}){
 const [section,setSection]=useState<string|null>(null),dialog=useRef<HTMLDialogElement>(null);
 const open=useCallback((value='appearance')=>setSection(value),[]);
 useEffect(()=>{if(section!==null&&!dialog.current?.open)dialog.current?.showModal();},[section]);
 return <Context.Provider value={{open}}>{children}{section!==null&&<dialog ref={dialog} className="lh-settings-dialog" aria-label="LearnHarness settings" onCancel={()=>setSection(null)} onClose={()=>setSection(null)}><Suspense fallback={<p role="status">Opening settings…</p>}><SettingsBody initialSection={section} onClose={()=>setSection(null)}/></Suspense></dialog>}</Context.Provider>;
}
export function StandaloneSettings(){return <Suspense fallback={<p role="status">Opening settings…</p>}><SettingsBody onClose={()=>navigate('/',true)}/></Suspense>;}
