"""Build-only static PWA manifest/SW generation. Never starts or requests an app."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parent


def finalize(dist, app_id, title, icons):
    dist = Path(dist)
    manifest = {'id': '/', 'name': title, 'short_name': title[:24], 'start_url': '/',
                'scope': '/', 'display': 'standalone', 'background_color': '#fffbfe',
                'theme_color': '#6750a4', 'icons': icons}
    (dist / 'manifest.webmanifest').write_text(json.dumps(manifest, indent=2) + '\n')
    files = sorted(p for p in dist.rglob('*') if p.is_file() and p.name not in {'sw.js', 'BUILD.json'})
    total = sum(p.stat().st_size for p in files)
    if total > 32 * 1024 * 1024 or any(p.stat().st_size > 12 * 1024 * 1024 for p in files):
        raise ValueError('Offline shell exceeds 32 MiB total / 12 MiB per-asset safety limits; split/reduce it before shipping.')
    hashes = {p.relative_to(dist).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
    version = hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest()[:16]
    script = (ROOT / 'sw-template.js').read_text().replace('__PREFIX__', json.dumps(app_id + '-shell-')).replace('__CACHE__', json.dumps(app_id + '-shell-' + version)).replace('__ASSETS__', json.dumps(['/' + name for name in hashes]))
    (dist / 'sw.js').write_text(script)
    project = dist.parent.parent
    source_hashes = {}
    for directory in ['pwa/src', 'pwa/common', 'pwa/vendor', 'src', 'components', 'lib', 'public']:
        for file in (project / directory).rglob('*'):
            if file.is_file() and '__pycache__' not in file.parts and not file.is_symlink():
                source_hashes[file.relative_to(project).as_posix()] = hashlib.sha256(file.read_bytes()).hexdigest()
    for name in ['pwa/build.py', 'pwa/build.mjs', 'pwa/finalize.py', 'pwa/source-offer.py', 'app/globals.css', 'config.ts', 'package.json', 'package-lock.json', 'local-food/food.py', 'local-food/schemas.py', 'menu-pilot/planner.py', 'local-food/data/recipes.json', 'local-food/data/ingredient-mappings.json', 'local-food/data/barcode-mappings.json', 'Lid test/data/tallaght.json']:
        file = project / name
        if file.is_file(): source_hashes[name] = hashlib.sha256(file.read_bytes()).hexdigest()
    (dist / 'BUILD.json').write_text(json.dumps({'app_id': app_id, 'version': version, 'shell_bytes': total,
                                              'kind': 'offline-first-browser-pwa', 'hosted_protocol': 1, 'files': hashes, 'source_hashes': source_hashes}, indent=2) + '\n')
    return {'app_id': app_id, 'version': version, 'files': len(files), 'bytes': total}
