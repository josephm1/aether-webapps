/** Visibility lease for the optional local MCP launcher; no account/token operations. */
export async function localHostLease(request:Request):Promise<Response>{
 if(process.env.LH_WEB_LEASE!=="1"||!process.send)return new Response(null,{status:404});
 const url=new URL(request.url);
 const host=request.headers.get("host")??url.host;
 const origin=`${url.protocol}//${host}`;
 if(new URL(origin).hostname!=="127.0.0.1")return new Response(null,{status:403});
 if(request.headers.get("origin")!==origin||!request.headers.get("content-type")?.startsWith("application/json"))return new Response(null,{status:403});
 const text=await request.text();if(text.length>256)return new Response(null,{status:413});
 let body:{id?:unknown;visible?:unknown};try{body=JSON.parse(text);}catch{return new Response(null,{status:400});}
 if(typeof body.id!=="string"||!body.id.match(/^[a-zA-Z0-9-]{1,64}$/)||typeof body.visible!=="boolean")return new Response(null,{status:400});
 process.send({type:"learnharness-visibility",id:body.id,visible:body.visible});
 return new Response(null,{status:204});
}
