import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=process.env.AETHER_BUILD_OUTPUT||path.join(root,'pwa/dist');
const hash=b=>createHash('sha256').update(b).digest('hex');
await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
await fs.cp(root+'/pwa/src',out,{recursive:true});await fs.cp(root+'/pwa/common',out+'/common',{recursive:true});await fs.copyFile(root+'/examiner.md',out+'/examiner.md');
const topics=[];
async function walk(dir,relative=''){
 for(const entry of await fs.readdir(dir,{withFileTypes:true})){
  if(entry.name.startsWith('.')||entry.isSymbolicLink())continue;
  const id=relative?relative+'/'+entry.name:entry.name,file=path.join(dir,entry.name);
  if(entry.isDirectory())await walk(file,id);
  else if(entry.isFile()&&/\.(md|markdown)$/i.test(entry.name)){
   const bytes=await fs.readFile(file);if(bytes.length>262144||topics.length>=10000)throw new Error('Reference library exceeds its budget.');
   const sha256=hash(bytes),asset='/references/'+sha256+'.md';
   await fs.mkdir(out+'/references',{recursive:true});await fs.writeFile(out+asset,bytes);
   topics.push({id,title:entry.name.replace(/\.(md|markdown)$/i,''),category:path.posix.dirname(id)==='.'?'General':path.posix.dirname(id),asset,sha256});
  }
 }
}
await fs.mkdir(root+'/references/Zero to Finals',{recursive:true});
await walk(root+'/references/Zero to Finals');topics.sort((a,b)=>a.category.localeCompare(b.category)||a.title.localeCompare(b.title));
await fs.writeFile(out+'/catalog.json',JSON.stringify(topics));
const files={};async function inventory(dir,rel=''){for(const e of await fs.readdir(dir,{withFileTypes:true})){const n=rel?rel+'/'+e.name:e.name;if(e.isDirectory())await inventory(dir+'/'+e.name,n);else files[n]=hash(await fs.readFile(dir+'/'+e.name));}}
await inventory(out);await fs.writeFile(out+'/BUILD.json',JSON.stringify({app_id:'aether-osce-practice',hosted_protocol:1,version:hash(JSON.stringify(files)).slice(0,16),files},null,2));
console.log('Built OSCE with '+topics.length+' indexed references; article bodies load on station demand.');
