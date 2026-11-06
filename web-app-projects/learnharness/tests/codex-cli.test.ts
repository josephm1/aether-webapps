import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "typebox";
import { normalizeContext } from "@earendil-works/pi-ai/utils/transcript";
import type { Model, Api } from "@earendil-works/pi-ai";
import { createCodexStream, codexHistory } from "../src/agent/codex-cli/stream.ts";
const fixture = fileURLToPath(new URL("./fixtures/codex-cli/fake-codex.mjs", import.meta.url));
const model = { id: "fixture", name: "Fixture", api: "codex-app-server", provider: "codex-cli" } as Model<Api>;
const context = (text:string) => normalizeContext({ systemPrompt:"Teach with the supplied tools", messages:[{role:"user",content:text,timestamp:1}], tools:[{name:"record_choice",description:"Record choice",parameters:Type.Object({choice:Type.String()})}] });
async function harness(mode:string,run:(stream:ReturnType<typeof createCodexStream>,record:()=>Promise<Record<string,unknown>[]>,children:ChildProcessWithoutNullStreams[])=>Promise<void>){
 const directory=await mkdtemp(join(tmpdir(),"lh-codex-test-")), path=join(directory,"requests.jsonl"), children:ChildProcessWithoutNullStreams[]=[];
 try{const stream=createCodexStream(()=>{const child=spawn(process.execPath,[fixture],{env:{...process.env,LH_FAKE_MODE:mode,LH_FAKE_RECORD:path},stdio:["pipe","pipe","pipe"]});children.push(child);return child;});await run(stream,async()=> (await readFile(path,"utf8")).trim().split("\n").map(line=>JSON.parse(line) as Record<string,unknown>),children);}
 finally{for(const child of children)if(child.exitCode===null&&child.signalCode===null){const closed=new Promise(resolve=>child.once("exit",resolve));child.kill("SIGKILL");await closed;}await rm(directory,{recursive:true,force:true});}
}
test("local Codex text streams with role-safe history and disables unrelated MCP servers",async()=>harness("text",async(stream,record)=>{
 const events=stream(model,context("hello"),{});const seen=[];for await(const event of events)seen.push(event.type);
 const result=await events.result();assert.equal(result.stopReason,"stop");assert.equal(result.usage.input,7);assert.equal(result.usage.cacheRead,3);assert.equal(result.content[0]!.type,"text");assert.equal(seen[0],"start");assert.equal(seen.at(-1),"done");
 const requests=await record();const started=requests.find(r=>r.method==="thread/start")!.params as Record<string,unknown>;assert.equal((started.config as Record<string,unknown>)["mcp_servers.external.enabled"],false);assert.equal(started.ephemeral,true);assert.equal(started.sandbox,"read-only");
}));
test("tool requests return to LearnHarness and answers replay as actual tool outputs",async()=>harness("tool",async(stream,record)=>{
 const initial=context("callmock");const reply=await stream(model,initial,{}).result();assert.equal(reply.stopReason,"toolUse");const call=reply.content.find(b=>b.type==="toolCall");assert(call);assert.equal(call.arguments.choice,"dinner");
 const continued=normalizeContext({messages:[...initial.messages,reply,{role:"toolResult",toolCallId:call.id,toolName:call.name,content:[{type:"text",text:"choice saved"}],isError:false,timestamp:2}]});
 const final=await stream(model,continued,{}).result();assert.equal(final.stopReason,"stop");
 const injection=(await record()).find(r=>r.method==="thread/inject_items")!.params as {items:Record<string,unknown>[]};
 assert(injection.items.some(i=>i.type==="function_call"&&i.call_id==="call-test"));assert(injection.items.some(i=>i.type==="function_call_output"&&i.call_id==="call-test"));
}));
test("API-key mode is refused without starting an inference turn",async()=>harness("api-key",async(stream,record)=>{
 const result=await stream(model,context("hello"),{}).result();assert.equal(result.stopReason,"error");assert.match(result.errorMessage??"",/not signed in with ChatGPT/);assert(!(await record()).some(r=>r.method==="turn/start"));
}));
test("cancelling a request terminates its Codex child",async()=>harness("wait",async(stream,_record,children)=>{
 const controller=new AbortController();const response=stream(model,context("hello"),{signal:controller.signal});
 await new Promise(resolve=>setTimeout(resolve,150));controller.abort();const result=await response.result();assert.equal(result.stopReason,"aborted");
 const child=children[0];assert(child);if(child.exitCode===null&&child.signalCode===null)await new Promise(resolve=>child.once("exit",resolve));assert(child.exitCode!==null||child.signalCode!==null);
}));
test("oversized input fails before spawning a Codex process",async()=>{
 const stream=createCodexStream(()=>{assert.fail("must not spawn");});const result=await stream(model,context("a".repeat(5*1024*1024)),{}).result();assert.equal(result.stopReason,"error");assert.match(result.errorMessage??"",/4 MiB/);
});
test("system instructions are not downgraded into user text",()=>assert.deepEqual(codexHistory(context("hello").messages),[{type:"message",role:"user",content:[{type:"input_text",text:"hello"}]}]));
