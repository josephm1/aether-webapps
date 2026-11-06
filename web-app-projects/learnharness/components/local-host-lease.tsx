"use client";
import { useEffect } from "react";
/** The MCP web window opts in with ?lh_local=1. Ordinary deployments stay unchanged. */
export function LocalHostLease(){
 useEffect(()=>{
  if(new URLSearchParams(location.search).get("lh_local")==="1")sessionStorage.setItem("lh.local-host","1");
  if(sessionStorage.getItem("lh.local-host")!=="1")return;
  const id=crypto.randomUUID();let unavailable=false;
  const report=(visible:boolean)=>{
   if(unavailable)return;
   void fetch("/api/local-host/lease",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,visible}),keepalive:true}).then(r=>{if(r.status===404)unavailable=true;}).catch(()=>{});
  };
  const changed=()=>report(!document.hidden),leave=()=>report(false);
  changed();document.addEventListener("visibilitychange",changed);window.addEventListener("pagehide",leave);
  const timer=setInterval(()=>{if(!document.hidden)report(true);},5000);
  return()=>{clearInterval(timer);document.removeEventListener("visibilitychange",changed);window.removeEventListener("pagehide",leave);leave();};
 },[]);
 return null;
}
