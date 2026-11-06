"""Bundle full app corresponding source for the AGPL source-download offer."""
from pathlib import Path
import os
import zipfile
root = Path(__file__).resolve().parent.parent
dist = Path(os.environ.get('AETHER_BUILD_OUTPUT', str(root / 'pwa/dist')))
skip = {'node_modules', '.git', '.next', 'build', 'dist', 'runtime', '__pycache__', '.cache', 'test-results', 'playwright-report', '.aether-hosted-backups'}
with zipfile.ZipFile(dist / 'learnharness-corresponding-source.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for file in sorted(root.rglob('*')):
        rel = file.relative_to(root)
        if any(part in skip or part.startswith(('.managed-build-', '.hosted-assets-stage-')) for part in rel.parts): continue
        if file.is_symlink(): raise ValueError('Source symlink needs review: ' + str(rel))
        if not file.is_file() or file.name in {'bundle-meta.json', '.DS_Store', 'local.properties', '.aether-dependencies', '.shared-source-hashes.json'}: continue
        if file.suffix in {'.jks', '.keystore'} or file.name in {'auth.json', 'credentials.json'} or (file.name.startswith('.env') and file.name != '.env.example'): raise ValueError('Private file in source offer: ' + str(rel))
        info = zipfile.ZipInfo(rel.as_posix(), (2026, 11, 2, 0, 0, 0)); info.compress_type = zipfile.ZIP_DEFLATED; info.external_attr = 0o100644 << 16
        archive.writestr(info, file.read_bytes())
