/** Static install/update bootstrap ONLY. All normal app work runs in the browser.
 * Apps owns this process. Never starts Python, Next, agents, scripts or other servers.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'dist');
const port=Number(process.argv[2]);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Explicit loopback port required.');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.wasm':'application/wasm','.txt':'text/plain; charset=utf-8'};
const server=http.createServer((req,res)=>{
 if(req.headers.host!==`127.0.0.1:${port}`||!['GET','HEAD'].includes(req.method)){res.writeHead(403);return res.end('Static loopback bootstrap only.');}
 let url;try{url=new URL(req.url,`http://127.0.0.1:${port}`);}catch{res.writeHead(400);return res.end();}
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/__aether_host__/')){res.writeHead(503,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Browser adapter is not loaded. This bootstrap has no app/inference backend.'}));}
 let name;try{name=decodeURIComponent(url.pathname);}catch{res.writeHead(400);return res.end();}
 if(name.split('/').includes('..')||name.includes('\\')||name.includes('\0')){res.writeHead(403);return res.end();}
 let file=path.resolve(root,'.'+name);
 if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}
 if(file===root||name==='/index.html'||name.startsWith('/chat/')||name==='/settings'||name==='/files')file=path.join(root,'index.html');
 let stat;try{stat=fs.statSync(file);if(!stat.isFile())throw new Error();}catch{res.writeHead(404);return res.end('Not in this static app build.');}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Service-Worker-Allowed':'/','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https: http://127.0.0.1:*; worker-src 'self' blob:; frame-src 'self' data: blob:; frame-ancestors http://127.0.0.1:* http://localhost:*; object-src 'none'; base-uri 'self'"});
 if(req.method==='HEAD')return res.end();const input=fs.createReadStream(file);input.on('error',()=>res.destroy());res.on('close',()=>input.destroy());input.pipe(res);
});
server.listen(port,'127.0.0.1',()=>console.log(`Static PWA bootstrap: http://127.0.0.1:${port}/ — install/update only; browser calculations and data do not use this server.`));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{server.close();server.closeAllConnections();});
