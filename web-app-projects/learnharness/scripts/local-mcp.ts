/** On-demand web window. The MCP exposes local state; Codex owns inference/auth. */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lockLocalProfile } from "./local-profile-lock.ts";
import { localCodexEnvironment, codexProfile } from "./local-codex-config.ts";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const port=8793,url=`http://127.0.0.1:${port}`;
let child:ChildProcess|undefined,starting:Promise<void>|undefined;
let profileLock:ReturnType<typeof lockLocalProfile>|undefined;
const leases=new Map<string,number>();let lastVisible=Date.now(),initialGrace=0;
function stop(){
 const old=child,lock=profileLock;child=undefined;profileLock=undefined;leases.clear();
 if(!old||old.exitCode!==null||old.signalCode!==null){lock?.release();return;}
 old.once("close",()=>lock?.release());old.kill("SIGTERM");
 const deadline=setTimeout(()=>{if(old.exitCode===null&&old.signalCode===null)old.kill("SIGKILL");},2000);deadline.unref();
}
function healthy(){return fetch(url+"/api/models",{signal:AbortSignal.timeout(800)}).then(r=>r.ok).catch(()=>false);}
async function start(){
 if(child&&child.exitCode===null&&child.signalCode===null&&await healthy())return;
 if(starting)return starting;
 starting=(async()=>{
  if(await healthy())throw new Error("Port 8793 is occupied by another server; it was left untouched.");
  profileLock=lockLocalProfile();
  const env=await localCodexEnvironment();
  const standalone=path.join(root,".next/standalone"),entry=path.join(standalone,"server.js");
  if(!fs.existsSync(entry))throw new Error("Production build is missing. See docs/local-codex.md.");
  initialGrace=Date.now()+90_000;lastVisible=Date.now();
  const server=spawn(process.execPath,[entry],{cwd:standalone,env:{...env,NODE_ENV:"production",LH_APP_ROOT:standalone,HOSTNAME:"127.0.0.1",PORT:String(port),LH_WEB_LEASE:"1"},stdio:["ignore","ignore","ignore","ipc"]});child=server;
  server.on("error",()=>stop());server.on("exit",()=>{if(child===server){child=undefined;profileLock?.release();profileLock=undefined;}});
  server.on("message",(message:unknown)=>{
   const value=message as {type?:string;id?:string;visible?:boolean};
   if(value.type!=="learnharness-visibility"||typeof value.id!=="string")return;
   initialGrace=0;
   if(value.visible){leases.set(value.id,Date.now()+15_000);lastVisible=Date.now();}else leases.delete(value.id);
  });
  for(let attempt=0;attempt<60;attempt++){
   if(server.exitCode!==null||server.signalCode!==null)throw new Error("LearnHarness server stopped during startup.");
   if(await healthy())return;
   await new Promise(resolve=>setTimeout(resolve,500));
  }
  stop();throw new Error("LearnHarness did not become ready within 30 seconds.");
 })().catch(error=>{stop();throw error;}).finally(()=>{starting=undefined;});return starting;
}
const idle=setInterval(()=>{
 if(!child||Date.now()<initialGrace)return;
 const now=Date.now();for(const[id,until]of leases)if(until<now)leases.delete(id);
 if(leases.size>0)lastVisible=now;else if(now-lastVisible>=5000)stop();
},1000);idle.unref();
const server=new McpServer({name:"learnharness-local",version:"1.0.0"});
server.registerTool("open_learning_ui",{description:"Open the local LearnHarness learning UI using the existing Codex login. Starts the backend on demand; open the returned URL in the Codex browser panel. Reopen with this tool after it has stopped."},async()=>{
 await start();return{content:[{type:"text",text:JSON.stringify({url:url+"/?lh_local=1",auth:"existing local Codex ChatGPT connection",lifetime:"Stops after all UI tabs are hidden/closed; heartbeat loss also expires."})}]};
});
server.registerTool("get_learning_dashboard",{description:"Read local LearnHarness session counts and saved model settings without starting a web server or model request."},async()=>{
 const data=path.join(codexProfile(),"data"),read=(file:string)=>{try{return JSON.parse(fs.readFileSync(path.join(data,file),"utf8"));}catch{return null;}};
 const chats=path.join(data,"chats");return{content:[{type:"text",text:JSON.stringify({dataDirectory:data,sessionCount:fs.existsSync(chats)?fs.readdirSync(chats).filter(n=>n.endsWith(".json")).length:0,settings:read("settings.json"),running:Boolean(child)})}]};
});
server.registerTool("stop_learning_ui",{description:"Stop this MCP's managed LearnHarness UI backend. Saved learning data is retained."},async()=>{stop();return{content:[{type:"text",text:"LearnHarness UI stopped; saved data retained."}]};});
const shutdown=()=>{clearInterval(idle);stop();};
process.once("exit",shutdown);process.once("SIGTERM",()=>{shutdown();process.exit(0);});process.once("SIGINT",()=>{shutdown();process.exit(0);});
const transport=new StdioServerTransport();await server.connect(transport);const priorClose=transport.onclose;transport.onclose=()=>{priorClose?.();shutdown();process.exit(0);};
