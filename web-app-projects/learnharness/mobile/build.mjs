/** Build the portable web payload on desktop or with Mobile Codex's existing tools. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
const pdf=path.join(root,'public/mobile-pdf');fs.mkdirSync(pdf,{recursive:true});
for(const file of ['pdf.mjs','pdf.worker.mjs'])fs.copyFileSync(path.join(root,'node_modules/pdfjs-dist/build',file),path.join(pdf,file));
fs.cpSync(path.join(root,'node_modules/pdfjs-dist/standard_fonts'),path.join(pdf,'standard_fonts'),{recursive:true});
const env={...process.env,NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:process.env.NODE_OPTIONS||'--max-old-space-size=2048',RAYON_NUM_THREADS:'2'};
const next=path.join(root,'node_modules/next/dist/bin/next');
// One build path on both hosts; Android uses Next's SWC WASM fallback.
const result=spawnSync(process.execPath,[next,'build','--webpack'],{env,stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
const curated=spawnSync(process.execPath,['scripts/build-server.mjs'],{env,stdio:'inherit'});if(curated.status!==0)process.exit(curated.status||1);
await build({entryPoints:['scripts/local-codex-config.ts'],outfile:'dist/mobile/codex-config.mjs',bundle:true,platform:'node',format:'esm',target:'node22'});
console.log('Portable web payload is ready. Package with python3 mobile/package.py');
