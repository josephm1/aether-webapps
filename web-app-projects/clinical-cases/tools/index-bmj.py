#!/usr/bin/env python3
"""Private, loss-aware EPUB text index. Originals remain untouched; no inference."""
from pathlib import Path,PurePosixPath
import argparse,zipfile,xml.etree.ElementTree as E,hashlib,json,re,gzip,shutil

def sha(data):return hashlib.sha256(data).hexdigest()
def local(tag):return tag.rsplit('}',1)[-1]
def text(el):return re.sub(r'\s+',' ',''.join(el.itertext())).strip()
def extract(file,relative):
 raw=file.read_bytes();blocks=[];skipped=[];images=[];modified='';updated='';title=file.stem
 with zipfile.ZipFile(file) as z:
  if sum(i.file_size for i in z.infolist())>180*1048576:raise ValueError('Expanded EPUB budget exceeded')
  container=E.fromstring(z.read('META-INF/container.xml'));opf=container.find('.//{*}rootfile').get('full-path');base=PurePosixPath(opf).parent;package=E.fromstring(z.read(opf));metadata=package.find('{*}metadata')
  if metadata is not None:
   title=metadata.findtext('{*}title') or title
   modified=next((el.text for el in metadata if el.get('property')=='dcterms:modified'),'')
  manifest={el.get('id'):el.get('href') for el in package.findall('{*}manifest/{*}item')};page=None;heading=[];ordinal=0
  for ref in package.findall('{*}spine/{*}itemref'):
   name=str(base/manifest[ref.get('idref')]);root=E.fromstring(z.read(name));body=root.find('{*}body')
   if body is None:continue
   for el in body:
    tag=local(el.tag);anchor=el.get('id','')
    if anchor.startswith('pdf-page-'):
     try:page=int(anchor.rsplit('-',1)[1])
     except ValueError:pass
     continue
    value=text(el)
    if 'Last updated:' in value and not updated:updated=value.split('Last updated:',1)[1].strip()[:100]
    if tag in ['h1','h2','h3','h4','h5','h6']:
     level=int(tag[1]);heading=heading[:level-1]+[value]
    for img in el.iter('{http://www.w3.org/1999/xhtml}img'):
     images.append({'href':str(PurePosixPath(name).parent/img.get('src','')),'page':page,'alt':img.get('alt',''),'heading':' / '.join(heading)})
    if not value:continue
    is_table=tag=='table' or el.find('.//{*}table') is not None
    if is_table:
     rows=[' | '.join(text(cell) for cell in row if local(cell.tag) in ['th','td']) for row in el.iter('{http://www.w3.org/1999/xhtml}tr')];value='\n'.join(row for row in rows if row) or value
    excluded=page in [1,2] or any(h.lower() in ['references','disclaimer','images','table of contents','acknowledgements','acknowledgments'] for h in heading) or bool(re.match(r'^(This PDF of the BMJ|BMJ Best Practice topics are regularly|Use of this content is subject)',value))
    record={'id':'b'+str(ordinal),'text':value,'page':page,'heading':' / '.join(heading),'epubHref':name+('#'+anchor if anchor else ''),'kind':'table' if is_table else 'heading' if tag.startswith('h') and len(tag)==2 else 'text'};ordinal+=1
    (skipped if excluded else blocks).append(record)
  # Stable bounded chunks retain exact text plus page/EPUB locators.
  chunks=[];pending=[];size=0
  def flush():
   nonlocal pending,size
   if not pending:return
   value='\n\n'.join(b['text'] for b in pending)
   chunks.append({'id':'s'+str(len(chunks)+1),'heading':pending[0]['heading'] or title,'text':value,'blocks':pending,'pages':sorted({b['page'] for b in pending if b['page']})});pending=[];size=0
  for block in blocks:
   pieces=[block['text'][i:i+3800] for i in range(0,len(block['text']),3800)] or ['']
   for part,piece in enumerate(pieces):
    if size+len(piece)>5000 or (pending and block['kind']=='heading' and len(piece)<120 and size>1800):flush()
    pending.append({**block,'id':block['id']+(('-'+str(part)) if len(pieces)>1 else ''),'text':piece});size+=len(piece)+2
  flush()
  payload={'version':1,'id':sha(relative.encode())[:24],'title':title,'category':str(PurePosixPath(relative).parent),'source':{'publisher':'BMJ Best Practice','epub':relative,'epubSha256':sha(raw),'conversionModified':modified,'sourceUpdated':updated,'pdf':str(PurePosixPath(relative).with_suffix('.pdf')),'rights':'BMJ source content retains its original copyright and licence; personal study resource, not licensed as application code.'},'chunks':chunks,'excludedBlocks':skipped,'figures':images,'quality':{'textBlocks':len(blocks),'figures':len(images),'tables':sum(b['kind']=='table' for b in blocks),'pageAnchors':bool(any(b['page'] for b in blocks)),'unreviewedFigures':True,'completeSemanticExtractionVerified':False}}
 return payload

def main():
 p=argparse.ArgumentParser();p.add_argument('--epubs',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--limit',type=int);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True);catalog=[];errors=[];total=0
 for i,file in enumerate(sorted(a.epubs.rglob('*.epub'))):
  if a.limit and i>=a.limit:break
  relative=file.relative_to(a.epubs).as_posix()
  try:
   topic=extract(file,relative);data=json.dumps(topic,ensure_ascii=False,separators=(',',':')).encode();compressed=gzip.compress(data,mtime=0);name=str(PurePosixPath(relative).with_suffix('')/'topic.json.gz');target=a.output/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(compressed);total+=len(compressed)
   catalog.append({'id':topic['id'],'title':topic['title'],'category':topic['category'],'sourceUpdated':topic['source']['sourceUpdated'],'sections':len(topic['chunks']),'figures':len(topic['figures']),'file':name,'sha256':sha(compressed),'bytes':len(compressed)})
  except Exception as e:errors.append({'file':relative,'error':str(e)})
  if (i+1)%200==0:print('Indexed',i+1,'compressed MiB',round(total/1048576,1),flush=True)
 catalog.sort(key=lambda t:(t['title'].casefold(),t['category']));manifest={'version':1,'topics':catalog,'failures':errors,'sourceCount':len(catalog)+len(errors),'indexedCount':len(catalog),'totalCompressedBytes':total,'generatedFrom':'User-supplied converted EPUBs; original PDFs retained at source location','clinicalCurrencyVerified':False}
 (a.output/'catalog.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':')));print(json.dumps({'indexed':len(catalog),'errors':len(errors),'compressedMiB':round(total/1048576,2)}))
if __name__=='__main__':main()
