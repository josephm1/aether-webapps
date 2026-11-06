import test from "node:test";
import assert from "node:assert/strict";
import { localHostLease } from "../src/server/local-host.ts";
test("local visibility reports require the managed web mode, same origin and a valid client",async()=>{
 const prior=process.env.LH_WEB_LEASE,send=process.send,messages:unknown[]=[];
 process.send=((message:unknown)=>{messages.push(message);return true;}) as typeof process.send;
 const request=(origin="http://127.0.0.1:8793",body:unknown={id:"window",visible:true})=>new Request("http://127.0.0.1:8793/api/local-host/lease",{method:"POST",headers:{origin,"Content-Type":"application/json"},body:JSON.stringify(body)});
 try{
  delete process.env.LH_WEB_LEASE;assert.equal((await localHostLease(request())).status,404);
  process.env.LH_WEB_LEASE="1";assert.equal((await localHostLease(request("https://other.example"))).status,403);
  assert.equal((await localHostLease(request(undefined,{id:"bad/path",visible:true}))).status,400);
  assert.equal((await localHostLease(request())).status,204);assert.deepEqual(messages,[{type:"learnharness-visibility",id:"window",visible:true}]);
 }finally{process.send=send;if(prior===undefined)delete process.env.LH_WEB_LEASE;else process.env.LH_WEB_LEASE=prior;}
});
