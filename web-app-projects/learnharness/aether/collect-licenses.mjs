/** Build-time notice copying only; never imports dependencies or starts an app. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function collectLicenses(runtime){
 const copied=[];
 const copy=(source,destination)=>{
  fs.mkdirSync(path.dirname(destination),{recursive:true});fs.cpSync(source,destination,{recursive:true});
  copied.push(path.relative(runtime,destination));
 };
 const inspectPackage=(relative)=>{
  const source=path.join(root,relative),dest=path.join(runtime,relative);
  if(!fs.existsSync(source))return;
  for(const entry of fs.readdirSync(source,{withFileTypes:true})){
   if(/^(licen[cs]e|notice|copying|copyright)([._-]|$)/i.test(entry.name))copy(path.join(source,entry.name),path.join(dest,entry.name));
  }
  const nested=path.join(dest,'node_modules');if(fs.existsSync(nested))walkModules(path.relative(runtime,nested));
 };
 const walkModules=(relative)=>{
  for(const entry of fs.readdirSync(path.join(runtime,relative),{withFileTypes:true})){
   if(!entry.isDirectory()||entry.name.startsWith('.'))continue;
   if(entry.name.startsWith('@')){
    for(const pkg of fs.readdirSync(path.join(runtime,relative,entry.name),{withFileTypes:true}))if(pkg.isDirectory())inspectPackage(path.join(relative,entry.name,pkg.name));
   }else inspectPackage(path.join(relative,entry.name));
  }
 };
 const modules=path.join(runtime,'node_modules');if(fs.existsSync(modules))walkModules('node_modules');
 // Next bundles third-party code under dist/compiled; keep those notices too.
 const compiled=path.join(root,'node_modules/next/dist/compiled');
 if(fs.existsSync(compiled))for(const name of fs.readdirSync(compiled)){
  const dir=path.join(compiled,name);if(!fs.statSync(dir).isDirectory())continue;
  for(const file of fs.readdirSync(dir))if(/^(licen[cs]e|notice|copying)([._-]|$)/i.test(file))copy(path.join(dir,file),path.join(runtime,'THIRD-PARTY-NOTICES/next-compiled',name,file));
 }
 copy(path.join(root,'LICENSE'),path.join(runtime,'LICENSE'));
 fs.writeFileSync(path.join(runtime,'THIRD-PARTY-NOTICES.json'),JSON.stringify(copied.sort(),null,2)+'\n');
 return copied.length;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(`Copied ${collectLicenses(path.join(root,'build/runtime'))} notices to adapted runtime.`);
