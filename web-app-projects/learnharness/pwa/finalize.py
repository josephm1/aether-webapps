from pathlib import Path
import importlib.util
import json
import os
root = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('pwa_finalize', root / 'common/finalize.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
print(json.dumps(module.finalize(Path(os.environ.get('AETHER_BUILD_OUTPUT', str(root / 'dist'))), 'aether-learnharness', 'LearnHarness', [{'src': '/icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': '/icon-512.png', 'sizes': '512x512', 'type': 'image/png'}]), indent=2))
