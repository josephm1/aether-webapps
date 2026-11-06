/** Static browser build only. No Next server, personal profile, tests, HTTP probe or inference. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
const pwa=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(pwa),source=path.join(pwa,'src'),dist=process.env.AETHER_BUILD_OUTPUT||path.join(pwa,'dist'),common=path.join(pwa,'common');
if(path.dirname(path.resolve(dist))!==pwa)throw new Error('Build output must be inside this project pwa directory.');
const require=createRequire(import.meta.url);
fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist,{recursive:true});

const promptRoot=path.join(root,'src/agent/prompts'),prompts={};
for(const kind of ['prober','teacher','practice']){
 const fragments=[];
 if(kind!=='practice')fragments.push({path:'system-prompt.md',sourceText:fs.readFileSync(path.join(root,'src/agent/system-prompt.md'),'utf8'),shared:true});
 for(const dir of [kind,'shared'])for(const name of fs.readdirSync(path.join(promptRoot,dir)).sort()){
  if(!/^\d+-[\w.-]+\.md$/.test(name))continue;
  if(kind==='practice'&&dir==='shared'&&!['10-voice.md','15-accuracy.md','16-mental-model.md','40-formatting.md'].includes(name))continue;
  fragments.push({path:dir+'/'+name,sourceText:fs.readFileSync(path.join(promptRoot,dir,name),'utf8'),shared:dir==='shared'});
 }prompts[kind]=fragments;
}
// Prompt assets are a virtual build module; canonical prompt source is never overwritten.
const mappings={
 'src/agent/models.ts':'models-browser.mjs','src/agent/prompt-segments.ts':'prompt-segments-browser.mjs',
 'src/agent/subagents/pi-run.ts':'pi-run-browser.mjs','src/agent/provider-events.ts':'provider-events-browser.mjs',
 'src/agent/tools/read.ts':'read-tools-browser.mjs','src/agent/tools/ls.ts':'read-tools-browser.mjs','src/agent/tools/find.ts':'read-tools-browser.mjs','src/agent/tools/grep.ts':'read-tools-browser.mjs',
 'src/agent/tools/jobs.ts':'jobs-browser.mjs','config.ts':'config-browser.mjs','components/setup-dialog.tsx':'setup.tsx',
 'components/settings/settings-dialog.tsx':'settings-browser.tsx',
 'components/sidebar.tsx':'sidebar-material.tsx','components/stats-bar.tsx':'stats-browser.tsx',
};
const aiModules={createInitialSystemMessage:'utils/transcript',getCurrentSystemMessage:'utils/transcript',getCurrentSystemPrompt:'utils/transcript',getCurrentTools:'utils/transcript',getToolStateChanges:'utils/transcript',normalizeContext:'utils/transcript',toToolDeclaration:'utils/transcript',mergeClientIdentity:'utils/identity',PI_ATTRIBUTION:'utils/identity',validateToolArguments:'utils/validation',createAssistantMessageEventStream:'utils/event-stream',EventStream:'utils/event-stream',parseStreamingJson:'utils/json-parse',getSupportedThinkingLevels:'models',clampThinkingLevel:'models'};
const plugin={name:'offline-browser-boundaries',setup(b){
 b.onResolve({filter:/^aether:prompt-assets$/},()=>({path:'prompts',namespace:'aether-prompts'}));
 b.onLoad({filter:/.*/,namespace:'aether-prompts'},()=>({contents:JSON.stringify(prompts),loader:'json'}));
 b.onResolve({filter:/^next\/(navigation|link|image|dynamic|head)$/},args=>['next/navigation','next/link'].includes(args.path)?{path:path.join(source,'navigation.tsx')}:{path:args.path,namespace:'next-browser'});
 b.onLoad({filter:/.*/,namespace:'next-browser'},args=>({contents:fs.readFileSync(path.join(source,'next-shims.tsx'),'utf8')+'\nexport default '+(args.path==='next/dynamic'?'dynamic':args.path==='next/head'?'Head':'Image')+';',loader:'tsx',resolveDir:source}));
 b.onResolve({filter:/^node:crypto$/},()=>({path:path.join(source,'crypto-browser.mjs')}));
 b.onResolve({filter:/^@earendil-works\/pi-ai$/},()=>({path:path.join(source,'pi-browser.mjs')}));
 b.onResolve({filter:/^@\//},args=>{const base=path.join(root,args.path.slice(2));for(const suffix of ['','.ts','.tsx','/index.ts','/index.tsx'])if(fs.existsSync(base+suffix)&&fs.statSync(base+suffix).isFile()){const relative=path.relative(root,base+suffix).split(path.sep).join('/');return {path:mappings[relative]?path.join(source,mappings[relative]):base+suffix};}});
 b.onResolve({filter:/^\./},args=>{
  const base=path.resolve(args.resolveDir,args.path);for(const suffix of ['','.ts','.tsx','/index.ts','/index.tsx'])if(fs.existsSync(base+suffix)&&fs.statSync(base+suffix).isFile()){const relative=path.relative(root,base+suffix).split(path.sep).join('/');if(mappings[relative])return {path:path.join(source,mappings[relative])};}
 });
 b.onLoad({filter:/\.([cm]?js|tsx?)$/},args=>{
  let text=fs.readFileSync(args.path,'utf8'),changed=false;
  if(args.path.endsWith('/pi-ai/dist/utils/validation.js')){
   text=text.replace('import { Compile } from "typebox/compile";','').replace('const validator = Compile(schema);','const validator = { Check: value => Value.Check(schema, value), Errors: value => [...Value.Errors(schema, value)] };');changed=true;
  }
  // The original app uses server-only subscription/auth state in its warning path;
  // its browser edition reports only the explicitly paired current selection.
  // Material browser defaults preserve explicit saved preferences and leave desktop source alone.
  if(args.path.endsWith('/components/settings/appearance.tsx')){
   text=text.replace('delta?.sessionNameSerif ?? f.sessionNameSerif','delta?.sessionNameSerif ?? false');
   text=text.replace('if (!a.sessionNameSerif) vars["--font-title"] = "var(--font-prose)";', `vars["--font-title"] = a.sessionNameSerif ? '"lh-cmu", Georgia, serif' : "var(--font-prose)";`);changed=true;
  }
  if(args.path.endsWith('/components/chat.tsx')){
   const adapter=path.join(source,'session-layout.tsx');
   text='import {SessionDock,SessionHeader} from '+JSON.stringify(adapter)+';\n'+text;
   const start=text.indexOf('function DockOverlay({');
   if(start<0||!text.slice(start).trimEnd().endsWith('}'))throw new Error('Chat dock boundary changed; review browser adapter.');
   text=text.slice(0,start)+'const DockOverlay = SessionDock;\n';
   text=text.replace('<TopBar','<SessionHeader').replace('</TopBar>','</SessionHeader>');
   text=text.replace('<DockOverlay\n','<DockOverlay\n nativeMessages={nativeMessages}\n');
   text=text.replace('{compacting && (','<div data-inline-question-slot="" />\n{compacting && (');
   text=text.replace('THINKING…','Preparing your teacher’s response…');
   text=text.replace('{kind !== "practice" && <CoverageRing chatId={chatId} refreshKey={coverageTick} />}','');
   changed=true;
  }
  if(args.path.endsWith('/components/question-dock.tsx')){
   text='import {writeQuestionUiDraft} from '+JSON.stringify(path.join(source,'question-draft.mjs'))+';\n'+text;
   text='import {QuestionFooter} from '+JSON.stringify(path.join(source,'session-layout.tsx'))+';\n'+text;
   text=text.replace('const selectMode: SelectMode =', 'useEffect(()=>{writeQuestionUiDraft(toolCallId,{selection:sel,thinking,other,text,confidenceIndex:confIdx});},[toolCallId,sel,thinking,other,text,confIdx]);\nconst selectMode: SelectMode =');
   text=text.replace('YOUR THINKING','Your thinking');
   const marker='\t\t\t<form\n\t\t\t\tclassName="border-t border-border/60 p-1.5"';
   if(!text.includes(marker))throw new Error('Question footer boundary changed; review browser adapter.');
   text=text.replace(marker,'\t\t\t<QuestionFooter>\n'+marker);
   const end=text.lastIndexOf('</form>');text=text.slice(0,end)+text.slice(end).replace('</form>','</form></QuestionFooter>');
   const tabStart=text.indexOf('if (e.key === "Tab" && !e.shiftKey && !modded)');
   const tabEnd=text.indexOf('// Keys from a typing surface',tabStart);
   if(tabStart<0||tabEnd<0)throw new Error('Question keyboard boundary changed.');
   text=text.slice(0,tabStart)+text.slice(tabEnd);
   text=text.replace('if (typing || modded) return;', 'if (typing || modded || t?.closest("button,a,select,dialog")) return;');
   changed=true;
  }
  if(args.path.endsWith('/components/setup-cta.tsx')){text=text.replace('Aether app inference is unavailable; no additional provider key is needed or requested.','Aether model access is unavailable. Check the host selection or this app’s Advanced AI permission; no additional provider login is needed.');changed=true;}

  if(text.includes('from "@earendil-works/pi-ai"')){
   text=text.replace(/import\s*\{([^}]+)\}\s*from\s*["']@earendil-works\/pi-ai["'];?/g,(full,names)=>{
    const byModule=new Map();for(const part of names.split(',')){const n=part.trim();if(!n||n.startsWith('type '))continue;const name=n.split(/\s+as\s+/)[0];if(!aiModules[name])throw new Error('Unreviewed browser pi-ai import: '+name+' in '+args.path);const spec=aiModules[name],arr=byModule.get(spec)||[];arr.push(n);byModule.set(spec,arr);}return [...byModule].map(([spec,parts])=>`import {${parts.join(',')}} from '@earendil-works/pi-ai/${spec}';`).join('\n');
   });changed=true;
  }
  if(changed)return {contents:text,loader:args.path.endsWith('.tsx')?'tsx':args.path.endsWith('.ts')?'ts':'js'};
 });
}};
await build({entryPoints:[path.join(source,'main.tsx')],bundle:true,splitting:true,format:'esm',platform:'browser',target:'es2022',minify:true,outdir:dist,entryNames:'main',chunkNames:'chunks/[name]-[hash]',assetNames:'assets/[name]-[hash]',plugins:[plugin],define:{'process.env':'{}','process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_LH_AETHER':'"1"','process.env.LH_AETHER':'"0"','process.env.LH_PROVIDER_EVENTS':'"0"','process.env.LH_VERSION':'"0.4.0-offline"','process.env.LH_HOMEPAGE':'"https://github.com/amosblomqvist/learnharness"'},jsx:'automatic',loader:{'.png':'file','.svg':'file','.woff2':'file','.woff':'file','.ttf':'file'},logLevel:'info',metafile:true}).then(result=>fs.writeFileSync(path.join(pwa,'bundle-meta.json'),JSON.stringify(result.metafile,null,2)));
fs.copyFileSync(path.join(source,'index.html'),path.join(dist,'index.html'));fs.copyFileSync(path.join(common,'material.css'),path.join(dist,'material.css'));
const css=await postcss([tailwind({base:root})]).process(fs.readFileSync(path.join(root,'app/globals.css'),'utf8'),{from:path.join(root,'app/globals.css'),to:path.join(dist,'baseline.css')});fs.writeFileSync(path.join(dist,'baseline.css'),css.css);
// Rebuild PDF assets from the locked dependency; no pre-existing desktop output.
const pdfSource=path.dirname(require.resolve('pdfjs-dist/package.json'));
const pdfOutput=path.join(dist,'pdf');fs.mkdirSync(pdfOutput,{recursive:true});
for(const name of ['pdf.mjs','pdf.worker.mjs'])fs.copyFileSync(path.join(pdfSource,'build',name),path.join(pdfOutput,name));
fs.copyFileSync(path.join(pdfSource,'LICENSE'),path.join(pdfOutput,'LICENSE'));
fs.cpSync(path.join(pdfSource,'standard_fonts'),path.join(pdfOutput,'standard_fonts'),{recursive:true});
fs.mkdirSync(path.join(dist,'fonts'),{recursive:true});fs.cpSync(path.join(root,'public/fonts'),path.join(dist,'fonts'),{recursive:true});fs.copyFileSync(path.join(root,'public/learnharness-icon.png'),path.join(dist,'icon-512.png'));
const photon=require('@silvia-odwyer/photon-node'),icon=photon.PhotonImage.new_from_byteslice(new Uint8Array(fs.readFileSync(path.join(root,'public/learnharness-icon.png')))),small=photon.resize(icon,192,192,1);fs.writeFileSync(path.join(dist,'icon-192.png'),small.get_bytes());small.free();icon.free();
fs.copyFileSync(path.join(root,'LICENSE'),path.join(dist,'LICENSE'));
const metadata=JSON.parse(fs.readFileSync(path.join(pwa,'bundle-meta.json'),'utf8')),packageRoots=new Set();
for(const input of Object.keys(metadata.inputs)){
 let directory=path.dirname(path.resolve(root,input));
 while(directory!==path.dirname(directory)&&directory!==root){
  if(fs.existsSync(path.join(directory,'package.json'))){if(directory.includes('node_modules'))packageRoots.add(directory);break;}directory=path.dirname(directory);
 }
}
const notices=path.join(dist,'THIRD-PARTY-NOTICES');fs.mkdirSync(notices,{recursive:true});
for(const directory of packageRoots){const pkg=JSON.parse(fs.readFileSync(path.join(directory,'package.json'),'utf8')),target=path.join(notices,String(pkg.name||path.basename(directory)).replace(/[^a-zA-Z0-9._-]/g,'_'));fs.mkdirSync(target,{recursive:true});fs.writeFileSync(path.join(target,'package.json'),JSON.stringify({name:pkg.name,version:pkg.version,license:pkg.license},null,2));for(const name of fs.readdirSync(directory))if(/^(licen[cs]e|copying|notice|copyright)([._-]|$)/i.test(name))fs.cpSync(path.join(directory,name),path.join(target,name),{recursive:true});}
const sourceOffer=spawnSync('python3',[path.join(pwa,'source-offer.py')],{stdio:'inherit'});if(sourceOffer.status!==0)process.exit(sourceOffer.status||1);
const finalized=spawnSync('python3',[path.join(pwa,'finalize.py')],{stdio:'inherit'});if(finalized.status!==0)process.exit(finalized.status||1);
