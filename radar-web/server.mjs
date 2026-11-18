import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {parseByteRange} from './media-range.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import flights from './api/vuelos.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.mp4':'video/mp4','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = http.createServer(async (req,res)=>{
  const url=new URL(req.url,'http://localhost');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(url.pathname==='/api/vuelos'){
    req.query=Object.fromEntries(url.searchParams);
    res.status=n=>{res.statusCode=n;return res;};
    res.json=obj=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(obj));};
    try{await flights(req,res);}catch{res.status(502).json({error:'api_caida',mensaje:'No se pudo consultar la fuente de vuelos.'});}
    return;
  }
  try{
    const relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
    const resolved=path.resolve(root,'.'+relative);
    if(!resolved.startsWith(root+path.sep)||relative.split('/').some(x=>x.startsWith('.'))||relative.includes('engine-original')||!mime[path.extname(resolved)]){
      res.writeHead(404);res.end('No encontrado');return;
    }
    if(path.extname(resolved)==='.mp4'){
      const {size}=await stat(resolved);
      const range=parseByteRange(req.headers.range,size);
      res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Type','video/mp4');
      if(range===false){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}
      if(range){res.statusCode=206;res.setHeader('Content-Range',`bytes ${range.start}-${range.end}/${size}`);res.setHeader('Content-Length',range.end-range.start+1);}
      else res.setHeader('Content-Length',size);
      if(req.method==='HEAD'){res.end();return;}
      const stream=createReadStream(resolved,range||undefined);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);return;
    }
    const bytes=await readFile(resolved);
    res.setHeader('Content-Type',mime[path.extname(resolved)]);
    res.setHeader('Cache-Control','no-cache');
    res.end(bytes);
  }catch{res.writeHead(404);res.end('No encontrado');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Radar de Vuelos: http://127.0.0.1:${port}`));
