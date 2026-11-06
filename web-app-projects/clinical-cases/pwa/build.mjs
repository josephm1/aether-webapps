import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=process.env.AETHER_BUILD_OUTPUT||root+'/pwa/dist';
const hash=b=>createHash('sha256').update(b).digest('hex');
await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
await fs.cp(root+'/pwa/src',out,{recursive:true});await fs.cp(root+'/pwa/common',out+'/common',{recursive:true});
const files={};async function inventory(dir,rel=''){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(e.isSymbolicLink())throw new Error('No linked assets.');const n=rel?rel+'/'+e.name:e.name;if(e.isDirectory())await inventory(dir+'/'+e.name,n);else files[n]=hash(await fs.readFile(dir+'/'+e.name));}}
await inventory(out);await fs.writeFile(out+'/BUILD.json',JSON.stringify({app_id:'aether-clinical-cases',hosted_protocol:1,version:hash(JSON.stringify(files)).slice(0,16),files},null,2));console.log('Built Clinical Cases. Corpus and images remain separate read-only resources.');
