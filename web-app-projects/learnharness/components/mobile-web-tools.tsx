"use client";
import {useEffect,useState} from "react";
/** Discover the local web host; normal desktop/browser deployments render nothing. */
export function MobileWebTools(){
 const [active,setActive]=useState(false);
 useEffect(()=>{let mounted=true;void fetch('/__aether_host__/status').then(r=>r.ok?r.json():null).then(s=>{if(mounted&&typeof s?.sourceDirectory==='string'){document.documentElement.dataset.mobileWeb='1';if(['light','dark','eink'].includes(s.theme))document.documentElement.dataset.theme=s.theme;setActive(true);}}).catch(()=>{});return()=>{mounted=false;};},[]);
 if(!active)return null;
 return <a href="/__aether_host__/manage" aria-label="Import books and manage this device’s web app" className="mx-3 mb-1 flex min-h-12 items-center rounded-md border px-3 text-xs uppercase tracking-wider">Files &amp; app</a>;
}
