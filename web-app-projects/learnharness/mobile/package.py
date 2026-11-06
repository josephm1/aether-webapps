#!/usr/bin/env python3
"""Bundle portable web output + editable source; reuse Mobile Codex's runtimes."""
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path
import zipfile
ROOT=Path(__file__).resolve().parent.parent
OUTPUT=ROOT/'artifacts/learnharness.mcwebapp'
SKIP_DIRS={'.git','.next','node_modules','dist','artifacts','data','__pycache__','profile','books','runtime','.venv'}
SKIP_FILES={'auth.json','runtime.json','build-ready','codex-config.mjs'}
SOURCE_DIRS={'app','bin','components','docs','electron','lib','mobile','public','scripts','skills','src','tests'}
SOURCE_FILES={'AGENTS.md','LICENSE','README.md','.gitignore','components.json','config.ts','eslint.config.mjs','next-env.d.ts','next.config.ts','package.json','package-lock.json','postcss.config.mjs','proxy.ts','tsconfig.json'}
def source_files():
    # Explicit project roots: never sweep ignored/private working folders.
    for name in sorted(SOURCE_FILES):
        path=ROOT/name
        if path.is_file() and not path.is_symlink():yield name,path
    for source in sorted(SOURCE_DIRS):
        for directory,dirs,names in os.walk(ROOT/source):
            dirs[:]=[d for d in dirs if d not in SKIP_DIRS and not d.startswith('.runtime-') and not (Path(directory)/d).is_symlink()]
            for name in names:
                path=Path(directory)/name
                if path.is_symlink() or name in SKIP_FILES or name.startswith('.env') or 'credentials.json' in name or name.endswith(('.log','.tsbuildinfo')):continue
                yield path.relative_to(ROOT).as_posix(),path

def package(output=OUTPUT):
    standalone=ROOT/'.next/standalone'
    if not (standalone/'server.js').is_file():raise ValueError('Run node mobile/build.mjs first.')
    config=ROOT/'dist/mobile/codex-config.mjs'
    if not config.is_file():raise ValueError('The bundled Codex configuration helper is missing.')
    files=dict(source_files())
    for directory,dirs,names in os.walk(standalone,followlinks=True):
        # Desktop binaries/renderers cannot be used by Android's bundled Node.
        for directory_name in dirs:
            if not (Path(directory)/directory_name).resolve().is_relative_to(standalone.resolve()):raise ValueError('External dependency directory')
        dirs[:]=[d for d in dirs if not d.startswith(('canvas-linux-','resvg-js-linux-','sharp-linux-','sharp-libvips-')) and d not in {'electron','@napi-rs','@resvg','@img'}]
        for name in names:
            path=Path(directory)/name
            if path.is_symlink():
                if not path.resolve().is_relative_to(standalone.resolve()):raise ValueError('External dependency symlink')
            if name.endswith(('.node','.so','.map')) or '.so.' in name:continue
            relative=path.relative_to(standalone).as_posix()
            if relative.startswith(('mobile/profile/','mobile/books/')) or relative=='mobile/runtime.json':raise ValueError('Private state in runtime payload')
            files['runtime/'+relative]=path
    files['mobile/codex-config.mjs']=config
    size=sum(p.stat().st_size for p in files.values())
    if len(files)>16383 or size>256*1024*1024:raise ValueError('Portable bundle exceeds framework limits.')
    output=Path(output);output.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('web-app.json',(ROOT/'mobile/web-app.json').read_bytes())
        for name,path in sorted(files.items()):archive.write(path,'files/'+name)
    return {'output':str(output),'files':len(files),'expanded_bytes':size,'bundle_bytes':output.stat().st_size}
def apply_runtime():
    # package() validates and creates the exact portable payload; deploy only its
    # generated runtime entries. Profile/books/source are deliberately untouched.
    result=package()
    stage=Path(tempfile.mkdtemp(prefix='.runtime-stage-',dir=ROOT))
    try:
        with zipfile.ZipFile(OUTPUT) as archive:
            for name in archive.namelist():
                if not name.startswith('files/runtime/'):continue
                relative=Path(name[len('files/runtime/'):])
                target=stage/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(archive.read(name))
            config=archive.read('files/mobile/codex-config.mjs')
        old=ROOT/'.runtime-previous'
        if old.exists():raise ValueError('An earlier runtime backup exists; inspect it before applying another build.')
        current=ROOT/'runtime'
        if current.exists():current.rename(old)
        stage.rename(current)
        (ROOT/'mobile/codex-config.mjs').write_bytes(config)
        if old.exists():shutil.rmtree(old)
        return result
    finally:
        if stage.exists():shutil.rmtree(stage)
if __name__=='__main__':print(json.dumps(apply_runtime() if '--apply-runtime' in sys.argv else package(),indent=2))
