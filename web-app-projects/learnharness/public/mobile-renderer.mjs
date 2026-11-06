/** Browser-only PDF/SVG rendering, using WebView canvas and bundled PDF.js. */
function canvas(width,height){if(width*height>4_000_000||width<1||height<1)throw Error('Image dimensions exceed the mobile rendering limit.');const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,width,height);return{c,ctx};}
export async function render(input){
 if(input.kind==='svg'){
  const {c,ctx}=canvas(input.width,input.height),url=URL.createObjectURL(new Blob([input.svg],{type:'image/svg+xml'}));
  try{const image=new Image();image.src=url;await image.decode();ctx.drawImage(image,0,0,c.width,c.height);return[{page:0,png:c.toDataURL('image/png').split(',')[1]}];}finally{URL.revokeObjectURL(url);}
 }
 const pdfjs=await import('/mobile-pdf/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/mobile-pdf/pdf.worker.mjs';
 const data=Uint8Array.from(atob(input.data),c=>c.charCodeAt(0));
 const task=pdfjs.getDocument({data,standardFontDataUrl:'/mobile-pdf/standard_fonts/',verbosity:0});
 try{
  const doc=await task.promise,out=[];
  for(const number of input.pages){
   if(number<1||number>doc.numPages)continue;
   const page=await doc.getPage(number),base=page.getViewport({scale:1});
   const scale=Math.min(input.dpi/72,Math.sqrt(4_000_000/(base.width*base.height))*.999);
   const vp=page.getViewport({scale});const {c,ctx}=canvas(Math.ceil(vp.width),Math.ceil(vp.height));
   await page.render({canvasContext:ctx,canvas:c,viewport:vp}).promise;
   out.push({page:number,png:c.toDataURL('image/png').split(',')[1]});page.cleanup();c.width=0;c.height=0;
  }
  return out;
 }finally{await task.destroy();}
}
