/** Optional native window; the MCP entry opens the same UI in a browser panel. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { lockLocalProfile } from "./local-profile-lock.ts";
import { localCodexEnvironment } from "./local-codex-config.ts";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const binary=path.join(root,"dist/linux-unpacked/learnharness");
const lock=lockLocalProfile();
try{
 const env=await localCodexEnvironment();
 if(!fs.existsSync(binary))throw new Error("Desktop build is missing. See docs/local-codex.md.");
 const app=spawn(binary,[],{cwd:root,detached:true,stdio:"ignore",env});
 await new Promise<void>((resolve,reject)=>{app.once("spawn",resolve);app.once("error",reject);});lock.transfer(app.pid!);app.unref();
 console.log("LearnHarness opened using the existing Codex ChatGPT connection.");
}catch(error){lock.release();console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
