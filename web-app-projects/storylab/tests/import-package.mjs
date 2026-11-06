// Exercise the real importer against a local document-service fixture; no device writes.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {importProjectZip} from '../../apps/project-import.mjs';
import {ensureManagedBuild} from '../../apps/managed-build.mjs';
const bytes=await fs.readFile(process.argv[2]);
const version=createHash('sha256').update(bytes).digest('hex');
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'storylab-import-test-'));
const api={services:{async invoke(service,method,args={}){
 assert.equal(service,'documents');
 if(method==='chooseFile')return {uri:'fixture://project.zip'};
 if(method==='stat')return {exists:true,directory:false,bytes:bytes.length,version};
 if(method==='read')return {base64:bytes.subarray(args.offset,args.offset+args.limit).toString('base64')};
 throw Error('Unexpected document operation '+method);
}}};
try{
 let published=false;
 const projects={root:async()=>{},async publish(app){assert.equal(app.definition.id,'aether-storylab');await fs.cp(app.directory,directory,{recursive:true,filter:source=>!source.endsWith('/pwa/dist')});published=true;return {...app,directory};}};
 const app=await importProjectZip(api,projects);assert(published);
 const before=await fs.readFile(directory+'/pwa/dist/BUILD.json','utf8');
 await ensureManagedBuild(app);
 assert.equal(await fs.readFile(directory+'/pwa/dist/BUILD.json','utf8'),before,'import preserves reusable prebuilt assets');
 for(const name of ['dev-server.mjs','pi-api.mjs','data','tests','verification'])assert.equal(await fs.stat(directory+'/'+name).then(()=>true,()=>false),false);
 console.log('Actual Aether ZIP importer, manifest, asset integrity and reusable source hashes passed.');
}finally{await fs.rm(directory,{recursive:true,force:true});}
