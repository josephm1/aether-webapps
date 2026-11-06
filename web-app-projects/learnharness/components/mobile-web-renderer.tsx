"use client";
import {useEffect} from 'react';
/** Draw PDFs/SVGs with the already-running WebView; no native canvas or Chromium daemon. */
export function MobileWebRenderer(){
 useEffect(()=>{
  let stopped=false,busy=false;
  async function tick(){
   if(stopped||busy||document.hidden)return;busy=true;
   try{
    const response=await fetch('/api/mobile-render');
    if(response.status===404){stopped=true;return;}if(response.status===204)return;
    if(!response.ok)return;
    const job=await response.json();
    try{
     // The renderer is a same-origin web module, packaged with the app's assets.
     const rendererUrl="/mobile-renderer.mjs";
     const renderer=await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ rendererUrl);
     const result=await renderer.render(job.input);
     await fetch('/api/mobile-render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:job.id,secret:job.secret,result})});
    }catch(error){await fetch('/api/mobile-render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:job.id,secret:job.secret,error:error instanceof Error?error.message:String(error)})});}
   }catch{/* A stopped server restarts on the next foreground launch. */}finally{busy=false;}
  }
  const timer=setInterval(()=>{void tick();},500);void tick();
  return()=>{stopped=true;clearInterval(timer);};
 },[]);
 return null;
}
