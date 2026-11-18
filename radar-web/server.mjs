import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import flights from './api/vuelos.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
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
    const bytes=await readFile(resolved);
    res.setHeader('Content-Type',mime[path.extname(resolved)]);
    res.setHeader('Cache-Control','no-cache');
    res.end(bytes);
  }catch{res.writeHead(404);res.end('No encontrado');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Radar de Vuelos: http://127.0.0.1:${port}`));
