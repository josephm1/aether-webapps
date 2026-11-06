import React,{useSyncExternalStore,useMemo} from 'react';
const subscribers=new Set<()=>void>();
const changed=()=>{for(const notify of subscribers)notify();};
window.addEventListener('popstate',changed);
function href(){return location.pathname+location.search;}
function subscribe(listener:()=>void){subscribers.add(listener);return()=>subscribers.delete(listener);}
export function navigate(url:string,replace=false){const target=new URL(url,location.origin);if(target.origin!==location.origin){location.assign(target.href);return;}history[replace?'replaceState':'pushState'](null,'',target.pathname+target.search);changed();}
export function usePathname(){return useSyncExternalStore(subscribe,href).split('?')[0];}
export function useSearchParams(){const value=useSyncExternalStore(subscribe,href);return useMemo(()=>new URLSearchParams(value.split('?')[1]||''),[value]);}
export function useParams(){const path=usePathname();return {id:decodeURIComponent(path.split('/')[2]||'')};}
export function useRouter(){return {push:(url:string)=>navigate(url),replace:(url:string)=>navigate(url,true),back:()=>history.back(),forward:()=>history.forward(),refresh:changed,prefetch:async()=>{}};}
export function redirect(url:string){navigate(url,true);}
export function notFound(){throw new Error('Local record not found.');}
export function Link({href:target,children,onClick,prefetch,replace,scroll,...props}:any){const url=typeof target==='string'?target:target?.pathname||'/';return <a {...props} href={url} onClick={event=>{onClick?.(event);if(!event.defaultPrevented&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&(!props.target||props.target==='_self')&&new URL(url,location.origin).origin===location.origin){event.preventDefault();navigate(url,!!replace);}}}>{children}</a>;}
export default Link;
