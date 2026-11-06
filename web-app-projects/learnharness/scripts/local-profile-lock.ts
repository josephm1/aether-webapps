import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { codexProfile } from "./local-codex-config.ts";
/** Protect the file stores from simultaneous native/web writers. */
export function lockLocalProfile(){
 const profile=codexProfile();fs.mkdirSync(profile,{recursive:true,mode:0o700});
 const file=path.join(profile,"local-host.lock"),token=randomUUID();
 for(let attempt=0;attempt<2;attempt++){
  try{const descriptor=fs.openSync(file,"wx",0o600);fs.writeFileSync(descriptor,JSON.stringify({pid:process.pid,token}));fs.closeSync(descriptor);break;}
  catch(error){
   if((error as NodeJS.ErrnoException).code!=="EEXIST")throw error;
   let owner:{pid:number};try{owner=JSON.parse(fs.readFileSync(file,"utf8"));}catch{throw new Error("LearnHarness profile lock is unreadable; refusing another writer.");}
   if(!Number.isInteger(owner.pid)||owner.pid<=0)throw new Error("Invalid LearnHarness profile lock.");
   try{process.kill(owner.pid,0);throw new Error("LearnHarness is already open in another window mode. Close it before switching between MCP web and native desktop.");}
   catch(check){if((check as NodeJS.ErrnoException).code!=="ESRCH")throw check;fs.unlinkSync(file);}
   if(attempt===1)throw new Error("Could not acquire the LearnHarness profile lock.");
  }
 }
 return{
  transfer(pid:number){fs.writeFileSync(file,JSON.stringify({pid,token}),{mode:0o600});},
  release(){try{if(JSON.parse(fs.readFileSync(file,"utf8")).token===token)fs.unlinkSync(file);}catch{/* already released */}},
 };
}
