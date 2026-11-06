/** Mobile-only web renderer. Jobs live with the on-demand server, never on disk. */
import {randomUUID} from 'node:crypto';
export type MobileRenderInput = {kind:'svg';svg:string;width:number;height:number}|{kind:'pdf';data:string;pages:number[];dpi:number};
export type MobileRenderResult = {page:number;png:string}[];
type Job={id:string;secret:string;input:MobileRenderInput;claimed:boolean;resolve:(value:MobileRenderResult)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>};
const key=Symbol.for('learnharness.mobileRender');
const shared=globalThis as typeof globalThis & {[key]?:Map<string,Job>};
const jobs=shared[key]??=new Map<string,Job>();
export function renderInWebView(input:MobileRenderInput):Promise<MobileRenderResult>{
 if(jobs.size>=2)return Promise.reject(Error('The web renderer is busy. Retry when the current page finishes.'));
 return new Promise((resolve,reject)=>{
  const id=randomUUID();const timer=setTimeout(()=>{jobs.delete(id);reject(Error('Rendering needs the learning app visible. Reopen it and retry.'));},90000);
  jobs.set(id,{id,secret:randomUUID(),input,claimed:false,resolve,reject,timer});
 });
}
export function nextRenderJob(){const job=[...jobs.values()].find(j=>!j.claimed);if(!job)return null;job.claimed=true;return{id:job.id,secret:job.secret,input:job.input};}
export function completeRenderJob(body:{id:string;secret:string;result?:MobileRenderResult;error?:string}):number{
 const job=jobs.get(body.id);if(!job||job.secret!==body.secret)return 404;
 if(body.error)job.reject(Error(body.error.slice(0,500)));
 else{
  if(!Array.isArray(body.result)||body.result.length>20||body.result.some(r=>!Number.isInteger(r.page)||typeof r.png!=='string'||!/^iVBORw0KGgo[A-Za-z0-9+/=]*$/.test(r.png)))return 400;
  job.resolve(body.result);
 }
 clearTimeout(job.timer);jobs.delete(job.id);return 204;
}
