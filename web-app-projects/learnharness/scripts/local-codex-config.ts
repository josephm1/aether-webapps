import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { CodexRpc } from "../src/agent/codex-cli/rpc.ts";
export const codexProfile = () => path.join(process.env.LH_LOCAL_PROFILE || path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(),".config"),"LearnHarness-Codex"));
/** Discover public metadata using Codex itself. Never read or copy its token files. */
export async function localCodexEnvironment(): Promise<NodeJS.ProcessEnv> {
 const rpc=new CodexRpc();
 try {
  await rpc.initialize();
  const catalog=await rpc.request<{data:{model:string;displayName:string;inputModalities:("text"|"image")[];supportedReasoningEfforts:{reasoningEffort:string}[];hidden:boolean;isDefault:boolean}[]}>("model/list",{});
  const models=catalog.data.filter(m=>!m.hidden).sort((a,b)=>Number(b.isDefault)-Number(a.isDefault)).map(m=>({id:m.model,name:m.displayName,input:m.inputModalities,reasoning:m.supportedReasoningEfforts}));
  if(!models.length)throw new Error("The signed-in Codex returned no models.");
  const profile=codexProfile();fs.mkdirSync(path.join(profile,"data"),{recursive:true,mode:0o700});
  const settings=path.join(profile,"data/settings.json");
  if(!fs.existsSync(settings)){
   const slot={model:{provider:"codex-cli",id:models[0]!.id},thinkingLevel:"medium"};
   fs.writeFileSync(settings,JSON.stringify({version:1,models:{strong:slot,cheap:slot,vision:slot}},null,2),{mode:0o600,flag:"wx"});
  }
  return {...process.env,LH_CODEX_BRIDGE:"1",LH_CODEX_BINARY:process.env.LH_CODEX_BINARY||"codex",LH_CODEX_MODELS:JSON.stringify(models),LH_DATA_DIR:path.join(profile,"data"),LH_AUTH_FILE:path.join(profile,"auth.json")};
 }finally{rpc.close();}
}
