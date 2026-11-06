#!/usr/bin/env python3
"""Validate all private topic hashes, image references, and actual raster hashes."""
import argparse,json,hashlib,gzip
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('library',type=Path);a=p.parse_args();root=a.library;c=json.loads((root/'catalog.json').read_text());images={};sections=0;blocks=0;unanchored=0;excluded=0
h=lambda b:hashlib.sha256(b).hexdigest()
for t in c['topics']:
 b=(root/t['file']).read_bytes();assert len(b)==t['bytes'] and h(b)==t['sha256'],t['id'];d=json.loads(gzip.decompress(b));assert d['id']==t['id'] and len(d['chunks'])==t['sections'] and d['chunks'],t['id'];sections+=len(d['chunks']);excluded+=len(d['excludedBlocks'])
 ids=set()
 for chunk in d['chunks']:
  assert chunk['id'] not in ids;ids.add(chunk['id']);assert chunk['blocks']
  for block in chunk['blocks']:blocks+=1;unanchored+=block['page'] is None
 for f in d['figures']:
  if f.get('resource'):images[f['resource']]=(f['sha256'],f['bytes'])
for name,(digest,size) in images.items():
 b=(root.parent/name).read_bytes();assert len(b)==size and h(b)==digest,name
max_bucket=max(len(list(d.iterdir())) for d in root.rglob('*') if d.is_dir())
assert max_bucket<8192
result={'indexedTopics':len(c['topics']),'failedTopics':len(c['failures']),'sections':sections,'sourceBlocks':blocks,'unanchoredIncludedBlocks':unanchored,'excludedButReadableBlocks':excluded,'uniqueImagesVerified':len(images),'figureBytes':sum(size for _,size in images.values()),'largestBucketEntries':max_bucket,'allContentHashesVerified':True,'semanticAndClinicalAccuracyVerified':False}
print(json.dumps(result,indent=2))
