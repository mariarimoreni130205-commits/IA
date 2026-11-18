import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../airport-data.js',import.meta.url),'utf8'))+'\n'+await readFile(new URL('../engine.js',import.meta.url),'utf8');
function run(code,extra={}){
  const ctx=vm.createContext({Date,Math,console,URL,URLSearchParams,AbortSignal,setTimeout,location:{protocol:'file:'},...extra});
  vm.runInContext(source,ctx);return vm.runInContext(code,ctx);
}
test('extracts budget, destination, dates and origin from a natural request',()=>{
  const p=run(`perfilDesde(leer('Quiero viajar a Europa en febrero, hasta US$ 1.200, desde Rosario, entre 10 y 15 días, sin escalas.'))`);
  assert.equal(p.presupuesto,1200);assert.equal(p.regiones[0],'europa');assert.equal(p.meses[0],1);assert.equal(p.origenes[0],'ROS');assert.equal(p.maxEsc,0);assert.equal(p.diasMin,10);assert.equal(p.diasMax,15);
});
test('explicit direct flights and departure city are respected as hard constraints',()=>{
  const results=run(`buscarVuelos(perfilDesde(leer('Europa en febrero, desde Buenos Aires, hasta 2000 dólares, 14 días, sin escalas')),VUELOS_SIM)`);
  assert.ok(results.length>0);assert.ok(results.every(x=>x.f.esc===0&&x.f.origen==='EZE'));
});
test('negated destinations and airlines never return in results',()=>{
  const results=run(`buscarVuelos(perfilDesde(leer('Europa en febrero, hasta 2000 dólares, no quiero ir a Madrid, sin LATAM')),VUELOS_SIM)`);
  assert.ok(results.length>0);assert.ok(results.every(x=>x.f.dest.c!=='Madrid'&&x.f.aero!=='LATAM'));
});
test('conversation adjusts budget without losing destination and dates',()=>{
  const r=run(`ajustar(perfilDesde(leer('Europa en febrero, desde Buenos Aires, hasta US$ 1200, 14 días')), 'puedo gastar hasta 900 dólares', null)`);
  assert.equal(r.n.presupuesto,900);assert.equal(r.n.regiones[0],'europa');assert.equal(r.n.meses[0],1);assert.equal(r.n.origenes[0],'EZE');
});
test('scores stay within bounds and result ordering is meaningful',()=>{
  const r=run(`buscarVuelos(perfilDesde(leer('Europa en febrero hasta 1200 dólares, 14 días')),VUELOS_SIM)`);
  assert.ok(r.length>0);assert.ok(r.every(x=>x.score>=0&&x.score<=100));assert.ok(r.every((x,i)=>!i||r[i-1].score>=x.score));
});
test('file mode returns explicitly simulated flights',async()=>{
  const result=await run(`obtenerVuelos(perfilDesde(leer('Lisboa en febrero, desde Buenos Aires, hasta 1200 dólares')))`,{fetch:()=>{throw Error('must not fetch in file mode');}});
  assert.equal(result.fuente,'sim');assert.ok(result.vuelos.every(f=>f.fuente==='sim'));assert.match(result.motivo,/simulados/);
});
test('failed provider requests have a labelled fallback',async()=>{
  const result=await run(`obtenerVuelos(perfilDesde(leer('Lisboa en febrero hasta 1200 dólares')))`,{location:{protocol:'http:'},fetch:async()=>({ok:false,json:async()=>({error:'sin_token'})})});
  assert.equal(result.fuente,'sim');assert.match(result.motivo,/no está configurada/);
});
test('real response is retained as real without mixing in demo flights',async()=>{
  const year=new Date().getFullYear()+1;
  const flight={id:'provider-1',destino:'LIS',origen:'EZE',fecha:`${year}-02-10`,precio:810,esc:1,horas:15,dias:14,aero:'TAP',link:'https://www.aviasales.com/example'};
  const result=await run(`obtenerVuelos(perfilDesde(leer('Lisboa en febrero hasta 1200 dólares')))`,{location:{protocol:'http:'},fetch:async()=>({ok:true,json:async()=>({vuelos:[flight]})})});
  assert.equal(result.fuente,'real');assert.equal(result.vuelos.length,1);assert.equal(result.vuelos[0].precio,810);assert.equal(result.vuelos[0].fuente,'real');
});
test('provider links with an unrelated origin are discarded',()=>{
  const year=new Date().getFullYear()+1;
  const result=run(`desdeApi({id:'x',destino:'MAD',origen:'EZE',fecha:'${year}-02-10',precio:900,link:'https://other.example/booking'})`);
  assert.equal(result.link,null);
});
test('every globe city is searchable without silently widening the destination',()=>{
  const codes=run('Object.keys(RADAR_AIRPORTS)');
  for(const code of codes){
    const result=run(`(()=>{const a=RADAR_AIRPORTS[${JSON.stringify(code)}];const q=leer('Quiero viajar a '+a.city+' desde '+(${JSON.stringify(code)}==='EZE'?'Rosario':'Buenos Aires'));const p=perfilDesde(q);const result=buscarVuelos(p,VUELOS_SIM);return {q,result};})()`);
    assert.equal(result.q.ciudades.length,1,code);
    assert.ok(result.result.length>0,code);
    assert.ok(result.result.every(x=>x.f.dest.k===code),code);
  }
});
test('Buenos Aires can be a destination from Rosario, with no self flights',()=>{
  const r=run(`(()=>{const q=leer('Quiero viajar a Buenos Aires desde Rosario');return {q,r:buscarVuelos(perfilDesde(q),VUELOS_SIM),invalid:VUELOS_SIM.some(f=>f.origen===f.dest.k)};})()`);
  assert.deepEqual(Array.from(r.q.origenes),['ROS']);assert.equal(r.q.ciudades[0],'Buenos Aires');assert.equal(r.invalid,false);assert.ok(r.r.length>0);
});
