/** Build-only entry: never starts a server, runs tests, or calls an AI provider. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {collectLicenses} from './collect-licenses.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
const resume=process.argv.includes('--resume-after-next');
if(!resume){
 const pdf=path.join(root,'public/mobile-pdf');fs.mkdirSync(pdf,{recursive:true});
 for(const file of ['pdf.mjs','pdf.worker.mjs'])fs.copyFileSync(path.join(root,'node_modules/pdfjs-dist/build',file),path.join(pdf,file));
 fs.cpSync(path.join(root,'node_modules/pdfjs-dist/standard_fonts'),path.join(pdf,'standard_fonts'),{recursive:true});
}
const env={...process.env,NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_LH_AETHER:'1',LH_AETHER:'1',NODE_OPTIONS:process.env.NODE_OPTIONS||'--max-old-space-size=2048',RAYON_NUM_THREADS:'2'};
if(resume){
 const marker=path.join(root,'.next/BUILD_ID');
 if(!fs.existsSync(marker)||!fs.existsSync(path.join(root,'.next/standalone/server.js')))throw new Error('A completed Next standalone build is required to resume.');
 const built=fs.statSync(marker).mtimeMs;
 const visit=(file)=>{
  const info=fs.statSync(file);
  if(info.isDirectory())for(const name of fs.readdirSync(file))visit(path.join(file,name));
  else if(info.mtimeMs>built)throw new Error(`Source changed after Next compilation; run a full build: ${file}`);
 };
 for(const name of ['app','components','src','lib','public','config.ts','proxy.ts','next.config.ts','package.json','package-lock.json'])visit(path.join(root,name));
 console.log('Resuming curation of the completed Next build; compiled app source is unchanged.');
}
for(const args of [...(resume?[]:[['node_modules/next/dist/bin/next','build','--webpack']]),['scripts/build-server.mjs']]){
 const result=spawnSync(process.execPath,args,{cwd:root,env,stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
}
const output=path.join(root,'build');fs.mkdirSync(output,{recursive:true});
const stage=path.join(output,`runtime-stage-${process.pid}`);fs.mkdirSync(stage);
const source=path.join(root,'.next/standalone');
const nativeDirs=new Set(['electron','@napi-rs','@resvg','@img']);
function copyTree(from,to){
 fs.mkdirSync(to,{recursive:true});
 for(const entry of fs.readdirSync(from,{withFileTypes:true})){
  const input=path.join(from,entry.name),dest=path.join(to,entry.name);
  const resolved=fs.realpathSync(input);
  if(!resolved.startsWith(source+path.sep))throw new Error(`Dependency escapes standalone: ${input}`);
  if(fs.statSync(input).isDirectory()){
   if(nativeDirs.has(entry.name)||/^(canvas-linux-|resvg-js-linux-|sharp-linux-|sharp-libvips-)/.test(entry.name))continue;
   copyTree(input,dest);
  }else{
   if(/\.(node|so|map)$|\.so\./.test(entry.name))continue;
   fs.copyFileSync(input,dest);
  }
 }
}
function hashSources(){
 const hashes={};
 const walk=(directory)=>{
  for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
   if(['node_modules','.next','build','artifacts','.git','runtime'].includes(entry.name))continue;
   const p=path.join(directory,entry.name);if(entry.isSymbolicLink())continue;
   if(entry.isDirectory())walk(p);
   else if(!/\.log$|\.tsbuildinfo$|^\.env|^auth\.json$/.test(entry.name))hashes[path.relative(root,p)]=createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  }
 };walk(root);return hashes;
}
try{
 copyTree(source,stage);
 collectLicenses(stage);
 fs.writeFileSync(path.join(stage,'aether-build.json'),JSON.stringify({adaptation:'aether-learnharness',builtAt:new Date().toISOString(),inference:'unsupported-public-api',node:process.version,sourceHashes:hashSources()},null,2));
 const current=path.join(output,'runtime'),previous=path.join(output,'runtime-previous');
 if(fs.existsSync(previous))throw new Error('Inspect/remove build/runtime-previous before another build.');
 if(fs.existsSync(current))fs.renameSync(current,previous);
 try{fs.renameSync(stage,current);}catch(error){if(fs.existsSync(previous))fs.renameSync(previous,current);throw error;}
 console.log('Adapted runtime ready in build/runtime. Previous output retained, if present. Stop the app before rebuilding. No runtime tests performed.');
}finally{if(fs.existsSync(stage))fs.rmSync(stage,{recursive:true,force:true});}
