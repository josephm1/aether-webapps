#!/usr/bin/env python3
"""Keep original raster bytes; deduplicate by SHA256. Private resource output only."""
import argparse,json,gzip,zipfile,hashlib
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--epubs',type=Path,required=True);p.add_argument('--library',type=Path,required=True);a=p.parse_args()
h=lambda b:hashlib.sha256(b).hexdigest()
c=json.loads((a.library/'catalog.json').read_text());out=a.library;out.mkdir(exist_ok=True);unique=set();missing=0;total=0
for i,t in enumerate(c['topics']):
 f=a.library/t['file'];d=json.loads(gzip.decompress(f.read_bytes()))
 original=a.epubs/d['source']['epub']
 if h(original.read_bytes())!=d['source']['epubSha256']:raise ValueError('Original EPUB changed since indexing')
 with zipfile.ZipFile(original) as z:
  for figure in d['figures']:
   try:
    b=z.read(figure['href'])
    if len(b)>8*1048576:raise ValueError('Figure exceeds 8 MiB viewer budget')
    ext='png' if b.startswith(b'\x89PNG\r\n\x1a\n') else 'jpg' if b.startswith(b'\xff\xd8\xff') else 'webp' if b[:4]==b'RIFF' and b[8:12]==b'WEBP' else None
    if not ext:raise ValueError('Not a supported raster image')
    digest=h(b);relative=Path(d['source']['epub']).with_suffix('')/figure['href']
    if relative.is_absolute() or any(part in ['.','..'] for part in relative.parts):raise ValueError('Unsafe image resource path')
    name=str(relative)
    if name not in unique:
     target=out/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b);unique.add(name);total+=len(b)
    figure.update(resource='bmj/'+name,sha256=digest,bytes=len(b),mime='image/jpeg' if ext=='jpg' else 'image/'+ext)
   except Exception as e:figure['unavailable']=str(e);missing+=1
 b=gzip.compress(json.dumps(d,ensure_ascii=False,separators=(',',':')).encode(),mtime=0);f.write_bytes(b);t.update(sha256=h(b),bytes=len(b))
 if (i+1)%300==0:print(i+1,len(unique),round(total/1048576),flush=True)
c['totalCompressedBytes']=sum(t['bytes'] for t in c['topics']);c['figurePack']={'files':len(unique),'bytes':total,'unavailableReferences':missing,'unchangedRasterBytes':True};(a.library/'catalog.json').write_text(json.dumps(c,ensure_ascii=False,separators=(',',':')));print(json.dumps(c['figurePack']))
