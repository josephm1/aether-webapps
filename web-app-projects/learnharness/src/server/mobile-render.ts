import {nextRenderJob,completeRenderJob,type MobileRenderResult} from '../agent/web-render';
export async function mobileRenderRequest(request:Request):Promise<Response>{
 if(process.env.LH_MOBILE_WEB!=='1')return new Response(null,{status:404});
 const origin=new URL(request.url).protocol+'//'+request.headers.get('host');
 if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))return new Response(null,{status:403});
 if(request.method==='GET'){
  const job=nextRenderJob();return job?Response.json(job,{headers:{'Cache-Control':'no-store'}}):new Response(null,{status:204});
 }
 if(request.headers.get('origin')!==origin)return new Response(null,{status:403});
 const reader=request.body?.getReader();if(!reader)return new Response(null,{status:400});
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>24*1024*1024){await reader.cancel();return new Response(null,{status:413});}chunks.push(value);}
 try{
  const body=JSON.parse(Buffer.concat(chunks).toString()) as {id:string;secret:string;result?:MobileRenderResult;error?:string};
  return new Response(null,{status:completeRenderJob(body)});
 }catch{return new Response(null,{status:400});}
}
