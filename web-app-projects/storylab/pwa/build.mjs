import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=process.env.AETHER_BUILD_OUTPUT||path.join(root,'pwa/dist');
const stage=out+'.stage';
await fs.rm(stage,{recursive:true,force:true});await fs.mkdir(stage,{recursive:true});
await fs.cp(root+'/pwa/src',stage,{recursive:true});
await fs.cp(root+'/pwa/common',stage+'/common',{recursive:true});
await fs.cp(root+'/vendor',stage+'/vendor',{recursive:true});
const files={};
async function walk(dir,rel=''){for(const e of await fs.readdir(dir,{withFileTypes:true})){const n=rel?rel+'/'+e.name:e.name;if(e.isDirectory())await walk(dir+'/'+e.name,n);else files[n]=createHash('sha256').update(await fs.readFile(dir+'/'+e.name)).digest('hex');}}
await walk(stage);await fs.writeFile(stage+'/BUILD.json',JSON.stringify({app_id:'aether-storylab',hosted_protocol:1,version:createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0,16),files},null,2));
await fs.rm(out,{recursive:true,force:true});await fs.rename(stage,out);console.log('Built StoryLab: '+Object.keys(files).length+' files.');
