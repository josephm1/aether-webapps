/** Shared-project storage controls. No timers, AI calls or backend polling. */
import {isHosted,hostedRequest} from './hosted-client.mjs';
export function mountPWAControls({title='App',store,onStorage}={}){
  const bar=document.createElement('section');bar.className='pwa-controls';
 const text=document.createElement('span');text.textContent='Aether · source and data in shared project folder';
 const advanced=document.createElement('button');advanced.type='button';advanced.textContent='Backups';advanced.onclick=()=>onStorage?.();
 bar.append(text,advanced);document.body.append(bar);
 const measure=()=>document.documentElement.style.setProperty('--pwa-controls-height',bar.getBoundingClientRect().height+'px');
 if(typeof ResizeObserver==='function')new ResizeObserver(measure).observe(bar);measure();return bar;
}
export async function boundedJSON(url,options={},maximum=8*1024*1024){
 if(isHosted()&&new URL(url,location.href).origin!==location.origin){if(options.headers?.Authorization)throw new Error('Authenticated resource requests are not granted in hosted mode.');const result=await hostedRequest('resource.fetch',{url:new URL(url,location.href).href});return result.payload;}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{
  const response=await fetch(url,{...options,signal:controller.signal});if(!response.ok)throw new Error(`HTTP ${response.status}; previous data retained.`);
  if(Number(response.headers.get('Content-Length')||0)>maximum)throw new Error('Response exceeds the import budget.');
  const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,text='';
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maximum){await reader.cancel();throw new Error('Response exceeds the import budget.');}text+=decoder.decode(value,{stream:true});}
  return JSON.parse(text+decoder.decode());
 }catch(error){if(error instanceof TypeError)throw new Error('Network or browser CORS policy prevented this request. No proxy, credentials or replacement data were used.');throw error;}finally{clearTimeout(timer);}
}
