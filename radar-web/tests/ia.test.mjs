import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import handler from '../api/ia.js';

const response=()=>({statusCode:0,body:null,status(n){this.statusCode=n;return this;},json(body){this.body=body;},setHeader(){}});
function withKey(t){
  const previous=process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY='test-only';
  t.after(()=>{if(previous===undefined)delete process.env.OPENROUTER_API_KEY;else process.env.OPENROUTER_API_KEY=previous;});
}
const reply=content=>async()=>({ok:true,json:async()=>({choices:[{message:{content:typeof content==='string'?content:JSON.stringify(content)}}]})});

test('without a key the AI endpoint answers 503 so the app falls back to rules',async()=>{
  const previous=process.env.OPENROUTER_API_KEY;delete process.env.OPENROUTER_API_KEY;
  try{const res=response();await handler({method:'POST',body:{modo:'interpretar',texto:'Madrid en marzo'}},res);
    assert.equal(res.statusCode,503);assert.equal(res.body.error,'sin_clave');}
  finally{if(previous!==undefined)process.env.OPENROUTER_API_KEY=previous;}
});

test('interpretation output is validated against the catalog before it reaches the app',async t=>{
  withKey(t);
  const calls=[];
  t.mock.method(globalThis,'fetch',async(url,init)=>{calls.push({url,init});return reply('```json\n'+JSON.stringify({
    ciudades:['Madrid','Atlántida'],regiones:['europa','marte'],meses:[2,14,'x'],origenes:['ROS','XXX'],presupuesto:1500,
    diasMin:16,diasMax:12,maxEsc:0,sinAero:['LATAM','Aerolínea Falsa'],sugeridas:[],interes:null})+'\n```')();});
  const res=response();await handler({method:'POST',body:{modo:'interpretar',texto:'Madrid en marzo desde Rosario, 1500 dólares, sin escalas, sin LATAM'}},res);
  assert.equal(res.statusCode,200);
  const p=res.body.perfil;
  assert.deepEqual(p.ciudades,['Madrid']);assert.deepEqual(p.regiones,['europa']);assert.deepEqual(p.meses,[2]);
  assert.deepEqual(p.origenes,['ROS']);assert.equal(p.presupuesto,1500);assert.equal(p.diasMin,12);assert.equal(p.diasMax,16);
  assert.equal(p.maxEsc,0);assert.deepEqual(p.sinAero,['LATAM']);
  // The key travels only in the server request header, never in the body.
  assert.equal(calls[0].init.headers.Authorization,'Bearer test-only');assert.ok(!calls[0].init.body.includes('test-only'));
});

test('copilot replies and proposes a cleaned search change',async t=>{
  withKey(t);
  t.mock.method(globalThis,'fetch',reply({respuesta:'Cambio a vuelos directos.',nuevaBusqueda:{ciudades:['Lisboa'],maxEsc:0,meses:[1]}}));
  const res=response();
  await handler({method:'POST',body:{modo:'copiloto',resumen:'Lisboa en febrero',vuelos:[{destino:'Lisboa',precio:800,fuente:'real'}],
    mensajes:[{role:'assistant',text:'Hola'},{role:'user',text:'Quiero solo directos'}]}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.respuesta,'Cambio a vuelos directos.');
  assert.deepEqual(res.body.nuevaBusqueda.ciudades,['Lisboa']);assert.equal(res.body.nuevaBusqueda.maxEsc,0);
});

test('a model failure is reported as 502 instead of breaking the page',async t=>{
  withKey(t);
  t.mock.method(globalThis,'fetch',reply('esto no es JSON'));
  const res=response();await handler({method:'POST',body:{modo:'interpretar',texto:'playa'}},res);
  assert.equal(res.statusCode,502);
});

// Engine side: AI output merges with the rules and is re-validated locally.
const source=(await readFile(new URL('../airport-data.js',import.meta.url),'utf8'))+'\n'+await readFile(new URL('../engine.js',import.meta.url),'utf8');
function run(code,extra={}){
  const ctx=vm.createContext({Date,Math,console,URL,URLSearchParams,AbortSignal,setTimeout,location:{protocol:'http:'},...extra});
  vm.runInContext(source,ctx);return vm.runInContext(code,ctx);
}

test('AI interpretation fills what the rules miss and suggests destinations for open requests',async()=>{
  const fetch=async()=>({ok:true,json:async()=>({perfil:{ciudades:[],regiones:[],meses:[0,1],origenes:[],presupuesto:900,diasMin:6,diasMax:8,
    maxEsc:null,interes:'playa tranquila',sugeridas:['Florianópolis','Punta Cana','Ciudad Inventada'],excluir:[],sinAero:[]}})});
  const q=await run(`leerConIA('quiero algo de playa tranqui en el verano, no más de novecientos mangos verdes, una semanita')`,{fetch});
  assert.equal(q.ia,true);assert.equal(q.presupuesto,900);assert.deepEqual([...q.meses],[0,1]);
  assert.equal(q.interes.nombre,'playa tranquila');assert.deepEqual([...q.interes.ciudades],['Florianópolis','Punta Cana']);
});

test('if the AI is unavailable the rule engine result is used unchanged',async()=>{
  const fetch=async()=>({ok:false,json:async()=>({error:'sin_clave'})});
  const q=await run(`leerConIA('Lisboa en febrero hasta 1200 dólares')`,{fetch});
  assert.equal(q.ia,undefined);assert.deepEqual([...q.ciudades],['Lisboa']);assert.equal(q.presupuesto,1200);
});
