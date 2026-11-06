const status=document.querySelector('#result');
document.querySelector('#display-form').addEventListener('submit',async event=>{
 event.preventDefault();const output=document.querySelector('#display-result');
 try{const response=await fetch('/__aether_host__/appearance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({theme:document.querySelector('#display-theme').value})});const result=await response.json();output.textContent=response.ok?result.message:result.error;}
 catch(error){output.textContent=error.message;}
});
fetch('/__aether_host__/status').then(r=>r.json()).then(s=>{document.querySelector('#paths').textContent=`Editable source: ${s.sourceDirectory}\nPersistent data: ${s.dataDirectory}`;document.querySelector('#display-theme').value=s.theme||'dark';}).catch(()=>{status.textContent='Could not read project paths.';});
document.querySelector('#import').addEventListener('click',async()=>{
 const file=document.querySelector('#file').files[0];if(!file){status.textContent='Choose a document first.';return;}
 if(file.size>32*1024*1024){status.textContent='File limit is 32 MiB.';return;}
 const button=document.querySelector('#import');button.disabled=true;
 try{const response=await fetch('/__aether_host__/book?name='+encodeURIComponent(file.name),{method:'POST',body:file});const data=await response.json();status.textContent=response.ok?`Saved locally: ${data.path}`:data.error;}
 catch(error){status.textContent=`Import failed: ${error.message}`;}finally{button.disabled=false;}
});
