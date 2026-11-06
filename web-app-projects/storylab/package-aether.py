#!/usr/bin/env python3
"""Prepare a self-contained Aether project ZIP without desktop runtime or personal data."""
from pathlib import Path
import argparse,hashlib,json,shutil,subprocess,tempfile,zipfile
ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('--output',required=True,type=Path)
args=parser.parse_args();out=args.output.resolve();out.mkdir(parents=True,exist_ok=False)
with tempfile.TemporaryDirectory(prefix='storylab-aether-') as temporary:
 stage=Path(temporary)/'project';stage.mkdir()
 for name in ['web-app.json','LICENSE']:
  shutil.copy2(ROOT/name,stage/name)
 for name in ['pwa/src','pwa/common','vendor']:
  shutil.copytree(ROOT/name,stage/name)
 shutil.copy2(ROOT/'pwa/build.mjs',stage/'pwa/build.mjs')
 (stage/'README.md').write_text('''# StoryLab for Aether\n\nImport this project ZIP through Aether → Apps → Import project. Review storage and AI access, then grant access and open. No desktop server, Pi installation, browser installation or separate model login is needed. Use AI settings to select an existing Aether model and thinking level.\n\nAdd an EPUB, TXT or Markdown source (up to 16 MiB), describe a topic and start an adventure. Selected passages are retrieved locally as needed. MCQ answers, feedback and progress are saved in this app’s shared project data. Only explicit question generation uses AI.\n\nThe 4,000-unit input guard is a conservative UTF-8 byte estimate plus framing reserve, not a provider-specific token count. Model usage is shown separately when reported. Exact citation matching checks provenance, not answer correctness. Paste a link to add a source. English Wikipedia sections load on demand after granting its network origin. Other website links can be saved as references, with optional pasted article text for study. No handwriting, PDF/OCR, external research or cross-app library in this version. EPUB sections containing visual/structured content are excluded from generation.\n\nThis ZIP contains editable source, licences and verified prebuilt assets, with no personal books, progress, credentials or desktop test server. Existing projects with the same ID are not overwritten by Aether’s importer. Android and iOS native integration still require device validation.\n''')
 # Use Aether's own build manager to produce verified assets and exact source hashes.
 script="""import fs from 'node:fs/promises';import {ensureManagedBuild} from './web-app-projects/apps/managed-build.mjs';import {verifyAssets} from './web-app-projects/apps/managed-files.mjs';import {validateDefinition} from './web-app-projects/apps/project-definition.mjs';const directory=process.argv[1];const definition=validateDefinition(JSON.parse(await fs.readFile(directory+'/web-app.json','utf8')));await ensureManagedBuild({directory,definition});const b=await verifyAssets(directory+'/pwa/dist',definition.id);if(!Object.keys(b.source_hashes||{}).length)throw Error('Missing source hashes');await ensureManagedBuild({directory,definition});console.log('Aether build, asset integrity and unchanged-source reuse verified.');"""
 subprocess.run(['node','--input-type=module','-e',script,str(stage)],cwd=ROOT.parent.parent,check=True)
 archive=out/'aether-storylab-project.zip'
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for file in sorted(stage.rglob('*')):
   if not file.is_file():continue
   rel=file.relative_to(stage)
   if any(x.startswith('.') for x in rel.parts):continue
   z.write(file,rel.as_posix())
 with zipfile.ZipFile(archive) as z:
  assert z.testzip() is None
  assert z.namelist().count('web-app.json')==1
  assert not any('dev-server' in n or 'pi-api' in n or n.startswith(('data/','tests/','verification/')) for n in z.namelist())
 checksum=hashlib.sha256(archive.read_bytes()).hexdigest()
 (out/'SHA256SUMS').write_text(checksum+'  '+archive.name+'\n')
 (out/'INSTALL.txt').write_text('In Aether, open Apps → Import project and select aether-storylab-project.zip. Review storage and AI permissions, then grant access and open. No separate APK or extension update is required. Device validation results, when available, accompany the release.\n')
 (out/'ARTIFACTS.json').write_text(json.dumps({'app_id':'aether-storylab','archive':archive.name,'sha256':checksum,'bytes':archive.stat().st_size,'checks':['Aether managed build','prebuilt asset hashes','unchanged-source build reuse','ZIP integrity'],'device_installed':False},indent=2)+'\n')
 print(archive)
