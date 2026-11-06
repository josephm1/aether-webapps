/** Real MCP + HTTP lifecycle smoke. Temporary learning data; optional explicit live lesson gate. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const profile=await fs.mkdtemp(path.join(os.tmpdir(),"lh-mcp-smoke-"));
const client=new Client({name:"learnharness-smoke",version:"1"});
const transport=new StdioClientTransport({command:path.join(root,"bin/learnharness-mcp"),env:{...process.env,LH_LOCAL_PROFILE:profile} as Record<string,string>,stderr:"pipe"});
transport.stderr?.on("data",()=>{});
const tool=async(name:string)=>{const result=await client.callTool({name,arguments:{}});assert(!result.isError,JSON.stringify(result));return(result.content as {type:string;text:string}[])[0]!.text;};
try{
 await client.connect(transport);const list=await client.listTools();assert.equal(list.tools.length,3);
 assert.equal(JSON.parse(await tool("get_learning_dashboard")).running,false);
 const opened=JSON.parse(await tool("open_learning_ui"));const origin=new URL(opened.url).origin;
 assert.equal(new URL(opened.url).hostname,"127.0.0.1");
 const catalog=await(await fetch(origin+"/api/models")).json();
 assert(catalog.providers.some((p:{id:string;keyPresent:boolean})=>p.id==="codex-cli"&&p.keyPresent));
 assert.equal(catalog.slots.strong.model.provider,"codex-cli");
 assert.equal((await fetch(origin+"/manifest.webmanifest")).status,200);
 const settings=await fs.readFile(path.join(profile,"data/settings.json"),"utf8");
 for(const visible of [true,false])assert.equal((await fetch(origin+"/api/local-host/lease",{method:"POST",headers:{"Content-Type":"application/json",Origin:origin},body:JSON.stringify({id:"smoke-window",visible})})).status,204);
 const deadline=Date.now()+12_000;let stopped=false;
 while(Date.now()<deadline){try{await fetch(origin,{signal:AbortSignal.timeout(500)});}catch{stopped=true;break;}await new Promise(r=>setTimeout(r,300));}
 assert(stopped,"web server must release its port when the last UI window leaves");
 assert.equal(await fs.readFile(path.join(profile,"data/settings.json"),"utf8"),settings);
 await tool("open_learning_ui");assert((await fetch(origin)).ok);
 if(process.env.LH_LIVE_LESSON_SMOKE==="1"){
  const created=await(await fetch(origin+"/api/chats",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:"Synthetic connection smoke"})})).json();
  const turn=await fetch(origin+"/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId:created.id,input:{type:"text",text:"Teach me why one half equals two quarters. Ask one short multiple-choice question to check my starting understanding."}}),signal:AbortSignal.timeout(90_000)});
  assert.equal(turn.status,200);assert.equal((await turn.json()).ok,true);
  const attached=await fetch(origin+`/api/chats/${created.id}/stream`,{signal:AbortSignal.timeout(90_000)});const events=await attached.text();
  assert(!events.includes('"type":"error"'),events.slice(-2000));
  const saved=await(await fetch(origin+`/api/chats/${created.id}`)).json();
  assert(!saved.turnError,JSON.stringify(saved.turnError));
  assert(saved.messages.some((message:{role:string;content?:{type:string;name?:string}[]})=>message.role==="assistant"&&message.content?.some(block=>block.type==="toolCall"&&["probe","quiz","ask_user_question"].includes(block.name??""))),"expected a persisted interactive question");
  console.log("Live LearnHarness lesson smoke passed: persisted session, Codex model, interactive tool output.");
 }
 await tool("stop_learning_ui");console.log("MCP smoke passed: discovery, Codex catalog, no setup gate, PWA manifest, hidden-window shutdown, saved settings, cold restart.");
}finally{await client.close();await new Promise(r=>setTimeout(r,800));await fs.rm(profile,{recursive:true,force:true});}
