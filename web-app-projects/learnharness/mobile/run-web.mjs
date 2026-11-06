/** Bundled Node entry: use the same runtime, executable aliases and Codex home. */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {localCodexEnvironment} from './codex-config.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.env.LH_LOCAL_PROFILE=path.join(root,'mobile/profile');
const env=await localCodexEnvironment();
const cwd=path.join(root,'runtime');
const child=spawn(process.execPath,[path.join(cwd,'server.js')],{cwd,env:{...env,HOSTNAME:'127.0.0.1',PORT:process.env.LH_MOBILE_BACKEND_PORT||'8796',NODE_ENV:'production',LH_APP_ROOT:cwd,LH_MOBILE_WEB:'1'},stdio:'inherit'});
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));
child.on('error',()=>process.exit(1));
