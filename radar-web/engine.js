/* =====================================================================
   Radar de Vuelos — agente inteligente basado en reglas y utilidad
   percibe (pedido + precios) → razona (reglas + puntaje) → actúa (recomienda, explica, alerta)
   ===================================================================== */

/* ============ 1. DATOS ============ */
const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DESTINOS=[
 {c:'Madrid',k:'MAD',r:'europa',base:780,h:13},{c:'Roma',k:'FCO',r:'europa',base:860,h:15},
 {c:'París',k:'CDG',r:'europa',base:820,h:14},{c:'Lisboa',k:'LIS',r:'europa',base:760,h:12},
 {c:'Barcelona',k:'BCN',r:'europa',base:800,h:13.5},{c:'Londres',k:'LHR',r:'europa',base:900,h:14},
 {c:'Miami',k:'MIA',r:'eeuu',base:650,h:9.5},{c:'Nueva York',k:'JFK',r:'eeuu',base:720,h:11},
 {c:'Río de Janeiro',k:'GIG',r:'brasil',base:380,h:3.5},{c:'Florianópolis',k:'FLN',r:'brasil',base:340,h:3},
 {c:'Punta Cana',k:'PUJ',r:'caribe',base:690,h:10},{c:'Cancún',k:'CUN',r:'caribe',base:740,h:11}];
const ORIGENES={EZE:'Buenos Aires',ROS:'Rosario'};
// The globe and search share the same destination catalog. Estimates below are
// used only to generate clearly labelled demo flights when no provider data exists.
Object.entries(globalThis.RADAR_AIRPORTS||{}).forEach(([code,airport])=>{
  if(DESTINOS.some(d=>d.k===code))return;
  const rad=Math.PI/180,lat=airport.lat*rad,lon=airport.lon*rad;
  const originLat=(code==='EZE'?-32.90:-34.82)*rad,originLon=(code==='EZE'?-60.78:-58.54)*rad;
  const km=6371*Math.acos(Math.max(-1,Math.min(1,Math.sin(lat)*Math.sin(originLat)+Math.cos(lat)*Math.cos(originLat)*Math.cos(lon-originLon))));
  DESTINOS.push({c:airport.city,k:code,r:airport.region,base:Math.round(170+km*.063),h:+Math.max(1.5,km/780+1).toFixed(1)});
});
const AEROS=['Iberia','Air Europa','LATAM','Aerolíneas Argentinas','Air France','TAP','KLM','Avianca','American','Copa'];
const REGION_NOMBRE={europa:'Europa',eeuu:'Estados Unidos',brasil:'Brasil',caribe:'el Caribe',sudamerica:'Sudamérica',norteamerica:'Norteamérica',asia:'Asia',oceania:'Oceanía',africa:'África',mediooriente:'Medio Oriente'};
const HOY=new Date();
const anioDe=mes=>mes>=HOY.getMonth()?HOY.getFullYear():HOY.getFullYear()+1;

// Vuelos simulados: respaldo cuando la API de precios reales no está disponible
function rng(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function generarVuelos(){
  const R=rng(2026),v=[];let id=1;
  DESTINOS.forEach(d=>Object.keys(ORIGENES).forEach(o=>{
    if(d.k===o)return;
    for(let k=0;k<4;k++){
      const mes=k==0?1:Math.floor(R()*12);
      let esc=o=='ROS'?(R()<.8?1:2):(R()<.4?0:(R()<.85?1:2));
      if(d.r=='brasil'&&o=='EZE')esc=R()<.7?0:1;
      const alta=[11,0,6].includes(mes)?1.25:1;
      const precio=Math.round(d.base*(o=='ROS'?1.05:1)*(1+(esc?-.12*esc:.08))*(.8+R()*.5)*alta);
      const dias=7+Math.floor(R()*12);
      v.push({id:'s'+id++,dest:d,origen:o,aero:AEROS[Math.floor(R()*AEROS.length)],esc,precio,base:precio,
        horas:+(d.h+esc*(2.5+R()*2)+(o=='ROS'?1.5:0)).toFixed(1),dias,mes,anio:anioDe(mes),dia:1+Math.floor(R()*27),fuente:'sim'});
    }}));
  return v;
}
const VUELOS_SIM=generarVuelos();
// Ejemplos del diseño: siguen pasando por la misma función de utilidad.
const VUELOS_PORTADA=[
  {k:'LIS',precio:780,esc:1,aero:'TAP',horas:15},
  {k:'MAD',precio:890,esc:0,aero:'Iberia',horas:12.5},
  {k:'FCO',precio:940,esc:1,aero:'ITA Airways',horas:16.5}
].map((v,i)=>({id:'demo-'+v.k,dest:DESTINOS.find(d=>d.k===v.k),origen:'EZE',
  aero:v.aero,esc:v.esc,precio:v.precio,base:v.precio,horas:v.horas,dias:14,
  mes:1,anio:anioDe(1),dia:10,fuente:'sim'}));
VUELOS_SIM.unshift(...VUELOS_PORTADA);

/* ============ 2. FUENTE DE DATOS: API de precios reales (con respaldo simulado) ============ */
const CACHE={};
function destinosDe(p){
  const fuera=p.excluir||[];
  return DESTINOS.filter(d=>!fuera.includes(d.c)&&(!p.regiones.length&&!p.ciudades.length||p.regiones.includes(d.r)||p.ciudades.includes(d.c)));
}
function desdeApi(v){
  const dest=DESTINOS.find(d=>d.k==v.destino);
  const [a,m,d]=String(v.fecha||'').split('-').map(Number);
  if(!dest||!ORIGENES[v.origen]||!a||!m||!(v.precio>0))return null;
  return {id:String(v.id),dest,origen:v.origen,aero:String(v.aero||'Aerolínea'),esc:Number(v.esc)||0,precio:v.precio,base:v.precio,
    horas:v.horas||+(dest.h+(v.esc||0)*3).toFixed(1),dias:v.dias||7,mes:m-1,anio:a,dia:d||1,
    link:/^https:\/\/www\.aviasales\.com\//.test(v.link||'')?v.link:null,fuente:'real'};
}
async function obtenerVuelos(p,forzar){
  const o=[...p.origenes].sort(),d=destinosDe(p).map(x=>x.k).sort(),m=[...p.meses].sort((a,b)=>a-b).slice(0,3);
  const key=[o,d,m].map(x=>x.join(',')).join('|');
  if(CACHE[key]&&!forzar)return CACHE[key];
  let res;
  try{
    if(location.protocol=='file:')throw {error:'local'};
    const r=await fetch(`/api/vuelos?origenes=${o}&destinos=${d}&meses=${m}`, {signal: AbortSignal.timeout(12000)});
    const j=await r.json().catch(()=>({error:'api_caida'}));
    if(!r.ok)throw j;
    const vuelos=(j.vuelos||[]).map(desdeApi).filter(Boolean);
    if(!vuelos.length)throw {error:'sin_resultados'};
    // La API trae pocos vuelos: se suman simulados aparte, sin mezclarlos con los reales.
    res={fuente:'real',vuelos,simulados:VUELOS_SIM};
  }catch(e){
    const c=e&&e.error;
    res={fuente:'sim',vuelos:VUELOS_SIM,motivo:
      c=='local'?'Abriste el archivo en tu compu: se usan vuelos simulados.':
      c=='sin_token'?'La API de vuelos todavía no está configurada: se usan vuelos simulados.':
      c=='sin_resultados'?'La API no tenía precios para esa búsqueda: se usan vuelos simulados.':
      'No se pudo conectar con la API de vuelos: se usan vuelos simulados.'};
  }
  CACHE[key]=res;
  return res;
}

/* ============ 3. PERCEPCIÓN: entender el lenguaje natural con reglas ============ */
const sin=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const PESOS0={precio:40,escalas:20,origen:10,viaje:15,vuelo:15,fecha:15};
const PAISES=[[/espana/,['Madrid','Barcelona']],[/italia/,['Roma']],[/francia/,['París']],[/portugal/,['Lisboa']],
  [/inglaterra|reino unido/,['Londres']],[/mexico/,['Cancún']],[/republica dominicana|dominicana/,['Punta Cana']],
  [/new york|\bnyc\b/,['Nueva York']],[/floripa/,['Florianópolis']],[/\brio\b/,['Río de Janeiro']]];
// Intereses: si el usuario no dice adónde pero sí qué quiere hacer, el agente infiere destinos
const INTERESES=[
  {re:/\bplaya|\bsol\b|calor|\bmar\b|arena|broncear|clima calido/,nombre:'playa',regiones:['brasil','caribe']},
  {re:/cultura|museo|historia|\barte\b|arquitectura|monumento/,nombre:'cultura e historia',ciudades:['Roma','París','Madrid','Londres']},
  {re:/compras|shopping|outlet|comprar (ropa|cosas|tecnologia)/,nombre:'compras',ciudades:['Miami','Nueva York']},
  {re:/romantic|luna de miel|aniversario|con mi (novia|novio|pareja|esposa|esposo|marido|mujer)/,nombre:'un viaje en pareja',ciudades:['París','Roma','Punta Cana','Lisboa']},
  {re:/fiesta|boliche|vida nocturna|salir de noche|\bjoda\b/,nombre:'salir de noche',ciudades:['Barcelona','Río de Janeiro','Cancún','Miami']},
  {re:/con (los |mis )?(chicos|hijos|nenes|ninos)|en familia|familiar|parques? (tematico|de diversiones)|disney/,nombre:'un viaje en familia',ciudades:['Miami','Cancún','Punta Cana']},
  {re:/naturaleza|tranquil|relaj|descansar|desconectar/,nombre:'descansar',ciudades:['Florianópolis','Punta Cana','Lisboa']},
  {re:/futbol|estadio/,nombre:'fútbol',ciudades:['Madrid','Barcelona','Londres','Río de Janeiro']},
];
const AEROLINEAS=['Iberia','Air Europa','LATAM','Aerolíneas Argentinas','Air France','TAP','KLM','Avianca','American','Copa','GOL','Azul',
  'United','Delta','Lufthansa','British Airways','ITA Airways','Ethiopian','Emirates','Qatar','Turkish','JetSMART','Flybondi','Vueling',
  'Swiss','World2Fly','Air Canada','Arajet','Aeroméxico','JetBlue'];
const NUM_DIAS='(?:dias|noches)';

// "mil quinientos" → 1500, "dos semanas" → 2 semanas ("un/una" solo cuenta delante de "mil")
const NUM_PAL={dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,
  dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20,veintiuno:21,veintidos:22,veinticinco:25,treinta:30,cuarenta:40,
  cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90,cien:100,ciento:100,doscientos:200,trescientos:300,cuatrocientos:400,
  quinientos:500,seiscientos:600,setecientos:700,ochocientos:800,novecientos:900,mil:1000};
function numerosEnPalabras(t){
  const pal=t.split(' '),out=[];
  for(let i=0;i<pal.length;i++){
    const w=pal[i];
    if(w=='mil'&&/^\d+$/.test(out[out.length-1]||'')){out[out.length-1]=String(+out[out.length-1]*1000);continue}
    const empieza=NUM_PAL[w]!=null||((w=='un'||w=='una'||w=='uno')&&pal[i+1]=='mil');
    if(!empieza){out.push(w);continue}
    let total=0,cur=0,j=i;
    for(;j<pal.length;j++){
      const x=pal[j];
      if(x=='y'&&NUM_PAL[pal[j+1]]!=null&&cur)continue;
      if((x=='un'||x=='una'||x=='uno')&&pal[j+1]=='mil'){cur+=1;continue}
      const v=NUM_PAL[x];if(v==null)break;
      if(v==1000){total+=(cur||1)*1000;cur=0}else cur+=v;
    }
    out.push(String(total+cur));i=j-1;
  }
  return out.join(' ');
}
// Corrige errores de tipeo en palabras clave del dominio ("escalsa" → "escalas", "barcelna" → "barcelona")
// Solo palabras largas: con las cortas se "corrigen" palabras válidas (entero → enero, buenas → buenos)
const VOCAB=['escalas','directo','directos','presupuesto','dolares','economico','europa','brasil','caribe','rosario','ezeiza',
  'madrid','barcelona','lisboa','londres','cancun','florianopolis','janeiro','semanas','quincena','febrero','septiembre',
  'octubre','noviembre','diciembre','vacaciones','invierno','aerolinea','recomendas','recomendarias'];
function distancia(a,b){
  const d=Array.from({length:a.length+1},(_,i)=>[i]);
  for(let j=1;j<=b.length;j++)d[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)
  {
    d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]==b[j-1]?0:1));
    if(i>1&&j>1&&a[i-1]==b[j-2]&&a[i-2]==b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
  }
  return d[a.length][b.length];
}
function corregir(t){
  return t.split(' ').map(w=>{
    if(w.length<5||/\d/.test(w)||VOCAB.includes(w))return w;
    const tol=w.length>=8?2:1;
    let mejor=null,dm=tol+1;
    for(const v of VOCAB){if(Math.abs(v.length-w.length)>tol)continue;const d=distancia(w,v);if(d<dm){dm=d;mejor=v}}
    return mejor||w;
  }).join(' ');
}
// ¿La palabra en la posición i está negada? ("no quiero ir a Madrid", "sin LATAM", "cualquiera menos Miami")
// Entre la negación y la palabra solo puede haber relleno: en "sin escalas a Madrid" Madrid NO está negada.
const NEGACION=/(?:\bno|\bsin|\bsaca(?:me|r)?|\bexcepto|\bmenos|\bevit\w*|\bodio|\bni|\btampoco|nada de|\bsalvo)\s+(?:(?:quiero|quisiera|me|gusta|gustaria|ir|irme|viajar|volar|vuelos?|con|a|al|en|de|para|por|la|el|los|las|tanto|mucho|tampoco|nada|que|sea|mas)\s+)*$/;
const negado=(t,i)=>NEGACION.test(t.slice(0,i));
const normalizar=texto=>' '+corregir(numerosEnPalabras(sin(texto).replace(/[¿?¡!]/g,' ').replace(/\s+/g,' ').trim()))+' ';

function leerMonto(n,suf){
  const v=suf?parseFloat(n.replace(',','.'))*1000:parseInt(n.replace(/[.,]/g,''),10);
  return v>=50&&v<=100000?Math.round(v):null;
}

// Lee un texto y devuelve SOLO lo que dice explícitamente (lo que no menciona queda vacío)
function leer(texto){
  const t=normalizar(texto);
  const q={regiones:[],ciudades:[],excluir:[],sinAero:[],meses:[],origenes:[],presupuesto:null,sinLimite:false,barato:false,
    precioDir:0,intensidad:.2,diasMin:null,diasMax:null,diasDir:0,maxEsc:null,escalasOk:false,menosEsc:false,maxHoras:null,
    corto:false,largoOk:false,mesDir:0,destinoAbierto:false,destOtro:false,cerca:false,lejos:false,origenAbierto:false,interes:null};
  let m;

  // Destino (con negaciones: "no quiero Europa", "cualquiera menos Miami")
  const REG=[[/europa/,'europa'],[/estados unidos|eeuu|ee\.uu|\busa\b|norteamerica|yanquilandia/,'eeuu'],[/brasil/,'brasil'],[/caribe/,'caribe'],[/sudamerica|sudamérica/,'sudamerica'],[/norteamerica/,'norteamerica'],[/\basia\b/,'asia'],[/oceania/,'oceania'],[/africa/,'africa'],[/medio oriente/,'mediooriente']];
  REG.forEach(([re,r])=>{const x=t.match(re);if(!x)return;
    if(negado(t,x.index))DESTINOS.filter(d=>d.r==r).forEach(d=>q.excluir.push(d.c));else q.regiones.push(r)});
  const ponCiudad=(c,i)=>{if(negado(t,i)){if(!q.excluir.includes(c))q.excluir.push(c)}else if(!q.ciudades.includes(c))q.ciudades.push(c)};
  DESTINOS.forEach(d=>{
    const x=t.match(new RegExp('\\b'+sin(d.c)+'\\b'));if(!x)return;
    if(/(?:desde|saliendo de|salir de|partiendo de|origen[: ]+)\s*$/.test(t.slice(0,x.index)))return;
    if(d.k==='EZE'&&!/(?:\ba |hacia |destino[: ]+)(?:buenos aires|ezeiza)/.test(t))return;
    ponCiudad(d.c,x.index);
  });
  PAISES.forEach(([re,cs])=>{const x=t.match(re);if(x&&(negado(t,x.index)||!q.ciudades.length))cs.forEach(c=>ponCiudad(c,x.index))});
  if(!q.regiones.length&&!q.ciudades.length){
    const it=INTERESES.find(x=>x.re.test(t));
    if(it)q.interes=it;
  }
  if(/no tengo destino|sin destino|cualquier (destino|lado|lugar)|donde sea|a donde sea|sorprendeme|me da igual (el destino|a donde)|no se (a )?donde/.test(t))q.destinoAbierto=true;
  if(/otro destino|otra ciudad|otros destinos|algo distinto|otro lugar|otra cosa|otras opciones/.test(t))q.destOtro=true;
  if(/mas cerca|algo cerca|no tan lejos|cerquita/.test(t))q.cerca=true;
  else if(/mas lejos|bien lejos|otro continente/.test(t))q.lejos=true;

  // Cuándo
  MESES.forEach((mm,i)=>{if(new RegExp('\\b'+mm+'\\b').test(t))q.meses.push(i)});
  if(/\bsetiembre\b/.test(t)&&!q.meses.includes(8))q.meses.push(8);
  if(!q.meses.length){
    if(/\bverano\b/.test(t))q.meses.push(0,1);
    else if(/vacaciones de invierno|\binvierno\b/.test(t))q.meses.push(6);
    else if(/fin de ano|navidad|las fiestas|ano nuevo/.test(t))q.meses.push(11);
    else if(/semana santa|pascuas?/.test(t))q.meses.push(2,3);
    else if(/primavera/.test(t))q.meses.push(9,10);
    else if(/\botono\b/.test(t))q.meses.push(3,4);
    else if(/proximo mes|mes que viene/.test(t))q.meses.push((HOY.getMonth()+1)%12);
  }
  if(/mas adelante|mas tarde|otro mes|mes siguiente|un mes despues|postergar|patear(lo)? para adelante/.test(t))q.mesDir=1;
  else if(/(salir|viajar|ir|irme) (un poco |bastante )?(mas )?antes|mas pronto|cuanto antes|lo antes posible|un mes antes|adelantar/.test(t))q.mesDir=-1;

  // Desde dónde
  const destinoBuenosAires=/(?:\ba |hacia |destino[: ]+)(?:buenos aires|ezeiza|eze\b)/.test(t);
  const salidaBuenosAires=/(?:desde |saliendo de |salir de |origen[: ]+)(?:buenos aires|ezeiza|eze\b)/.test(t);
  if(/buenos aires|ezeiza|\beze\b|aeroparque|baires|capital federal|\bcaba\b/.test(t)&&(!destinoBuenosAires||salidaBuenosAires))q.origenes.push('EZE');
  if(/rosario|\bros\b/.test(t))q.origenes.push('ROS');
  if(/cualquiera de (las|los) (dos|2)|desde cualquiera|de cualquiera de|me da igual desde|de (las|los) (dos|2) (ciudades|lados)/.test(t)){q.origenes=[];q.origenAbierto=true}

  // Presupuesto y dirección del precio
  m=t.match(/(?:usd|u\$s|us\$|u\$d|\$)\s*(\d[\d.,]*)\s*(k\b|mil\b)?/)||
    t.match(/(\d[\d.,]*)\s*(k\b|mil\b)?\s*(?:usd|u\$s|us\$|u\$d|dolares|dolar|verdes|\$)/)||
    t.match(/(?:hasta|maximo|presupuesto(?: de)?|tope(?: de)?|gastar|pagar|tengo)\s*(?:de\s*|unos\s*)?(\d[\d.,]*)\s*(k\b|mil\b)?(?!\s*(?:dias|noches|horas|hs|h\b|escalas?|semanas?|meses|personas|pasajeros))/);
  if(m)q.presupuesto=leerMonto(m[1],m[2]);
  if(/sin limite|no tengo limite|no importa (tanto )?el precio|sin tope|no tengo tope|la plata no es problema/.test(t))q.sinLimite=true;
  if(/barat|economic|ajustad|poca plata|ahorrar|low cost/.test(t))q.barato=true;
  if(/(pagar|gastar|plata|presupuesto|precio|costo|invertir)\s+(un poco |algo |bastante |mucho |un toque |apenas )?(menos|mas bajo)|mas barat|mas economic|bajar (el |la )?(precio|presupuesto|plata)|ahorrar|no tan car|menos plata|menos caro|me (parece|parecen|resulta) car|(esta|estan|es|son) (muy |medio |un poco )?car[oa]s?\b/.test(t))q.precioDir=-1;
  else if(/(pagar|gastar|invertir|poner)\s+(un poco |algo |bastante |mucho |un toque )?mas|subir (el )?presupuesto|(me )?da igual el precio|tengo mas plata|puedo gastar mas|mas caro (esta bien|no importa)/.test(t))q.precioDir=1;
  if(/un poco|algo|un toque|apenas|un cachito/.test(t))q.intensidad=.1;
  else if(/bastante|mucho|muchisimo|bien barat/.test(t))q.intensidad=.3;

  // Duración de la estadía
  if((m=t.match(new RegExp('entre (\\d+) y (\\d+) '+NUM_DIAS)))||(m=t.match(new RegExp('(\\d+) a (\\d+) '+NUM_DIAS)))){q.diasMin=+m[1];q.diasMax=+m[2]}
  else if((m=t.match(new RegExp('(\\d+) '+NUM_DIAS)))){q.diasMin=Math.max(1,+m[1]-2);q.diasMax=+m[1]+2}
  else if((m=t.match(/(\d+) semanas?/))){q.diasMin=+m[1]*7-2;q.diasMax=+m[1]*7+2}
  else if(/una semana/.test(t)){q.diasMin=6;q.diasMax=8}
  else if(/quincena/.test(t)){q.diasMin=13;q.diasMax=16}
  else if(/\bun mes\b(?! (antes|despues))/.test(t)){q.diasMin=26;q.diasMax=31}
  else if(/fin de semana largo|finde largo|finde/.test(t)){q.diasMin=3;q.diasMax=5}
  else if(/unos (pocos )?dias|escapada|escaparme|escapar/.test(t)){q.diasMin=4;q.diasMax=9}
  if(q.diasMin!=null&&q.diasMin>q.diasMax)[q.diasMin,q.diasMax]=[q.diasMax,q.diasMin];
  if(/mas dias|quedarme mas|quedarnos mas|estadia mas larga|mas tiempo (alla|ahi)|estirar/.test(t))q.diasDir=1;
  else if(/menos dias|quedarme menos|quedarnos menos|estadia mas corta|menos tiempo (alla|ahi)/.test(t))q.diasDir=-1;

  // Escalas
  if(/sin (hacer )?escalas?|directo|no (quiero |hacer |tener )?escalas|nada de escalas|ninguna escala|evitar (las )?escalas|odio las escalas/.test(t))q.maxEsc=0;
  else if(/(?:una|\b1) escala/.test(t)&&!/mas de (una|1) escala/.test(t))q.maxEsc=1;
  else if(/con escalas?|acepto (hacer )?escalas?|no me (importa|importan|molesta|molestan|jode)[^.,]{0,25}escala|escalas? (esta|estan|me parecen?) bien|puede tener escalas|aunque (tenga|haga) escalas|(dos|2) escalas|las escalas no (me )?importan/.test(t)){q.maxEsc=2;q.escalasOk=true}
  if(/menos escalas|menor cantidad de escalas|menos conexiones/.test(t))q.menosEsc=true;

  // Horas de vuelo
  if((m=t.match(/(?:maximo|hasta|menos de) (\d+) (?:horas|hs)/)))q.maxHoras=+m[1];
  if(/no (quiero |me gustan |hacer )?(viajes|vuelos) (demasiado |muy |tan )?largos|vuelos? cortos?|no muy largo|no tan largo|menos horas|poco tiempo de vuelo|mas corto|mas rapido|\brapido|menos tiempo (de vuelo|volando|en el avion)/.test(t))q.corto=true;
  else if(/no me (importa|molesta|jode)[^.,]{0,25}(largo|duracion|horas|cuanto dur)|vuelos? largos? (esta|estan) bien|no importa (lo que dure|la duracion|cuanto dure)/.test(t))q.largoOk=true;

  // Aerolíneas a evitar ("sin LATAM", "no quiero volar con Iberia")
  AEROLINEAS.forEach(a=>{const x=t.match(new RegExp('\\b'+sin(a)+'\\b'));if(x&&negado(t,x.index))q.sinAero.push(a)});
  return q;
}

/* ---- Interpretación con IA (OpenRouter, vía /api/ia). Las reglas de arriba quedan como respaldo. ---- */
async function pedirIA(cuerpo,ms){
  if(location.protocol=='file:')throw Error('local');
  const r=await fetch('/api/ia',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cuerpo),signal:AbortSignal.timeout(ms)});
  const j=await r.json().catch(()=>null);
  if(!r.ok||!j)throw Error((j&&j.error)||'ia_caida');
  return j;
}
// Mezcla lo que entendió la IA con lo que leyeron las reglas. Todo se vuelve a validar contra el catálogo local.
function combinarIA(q,ia){
  if(!ia||typeof ia!='object')return q;
  const nombres=DESTINOS.map(d=>d.c),valida=a=>Array.isArray(a)?a.filter(c=>nombres.includes(c)):[];
  const regs=Object.keys(REGION_NOMBRE),n={...q,ia:true};
  const ciudades=valida(ia.ciudades),regiones=Array.isArray(ia.regiones)?ia.regiones.filter(r=>regs.includes(r)):[];
  if(ciudades.length||regiones.length){n.ciudades=ciudades;n.regiones=regiones;n.interes=null}
  n.excluir=[...new Set([...q.excluir,...valida(ia.excluir)])];
  n.ciudades=n.ciudades.filter(c=>!n.excluir.includes(c));
  n.sinAero=[...new Set([...q.sinAero,...(Array.isArray(ia.sinAero)?ia.sinAero.filter(a=>AEROLINEAS.includes(a)):[])])];
  const meses=Array.isArray(ia.meses)?ia.meses.filter(m=>Number.isInteger(m)&&m>=0&&m<=11):[];
  if(meses.length)n.meses=[...new Set(meses)];
  const origenes=Array.isArray(ia.origenes)?ia.origenes.filter(o=>ORIGENES[o]):[];
  if(origenes.length)n.origenes=[...new Set(origenes)];
  if(ia.origenAbierto===true){n.origenes=[];n.origenAbierto=true}
  if(Number.isFinite(ia.presupuesto)&&ia.presupuesto>=50&&ia.presupuesto<=100000)n.presupuesto=Math.round(ia.presupuesto);
  if(Number.isFinite(ia.diasMin)&&Number.isFinite(ia.diasMax)&&ia.diasMin>=1&&ia.diasMax>=ia.diasMin){n.diasMin=ia.diasMin;n.diasMax=ia.diasMax}
  if([0,1,2].includes(ia.maxEsc))n.maxEsc=ia.maxEsc;
  if(Number.isFinite(ia.maxHoras)&&ia.maxHoras>=1&&ia.maxHoras<=48)n.maxHoras=ia.maxHoras;
  for(const k of ['sinLimite','barato','escalasOk','corto'])if(ia[k]===true)n[k]=true;
  // Si no nombró destino, la IA sugiere ciudades según lo que busca ("playa", "museos", "con chicos"…)
  const sugeridas=valida(ia.sugeridas).filter(c=>!n.excluir.includes(c));
  if(!n.ciudades.length&&!n.regiones.length&&sugeridas.length)
    n.interes={nombre:typeof ia.interes=='string'&&ia.interes?ia.interes.slice(0,40):'lo que buscás',ciudades:sugeridas};
  return n;
}
async function leerConIA(texto){
  const q=leer(texto);
  try{const {perfil}=await pedirIA({modo:'interpretar',texto:String(texto).slice(0,800)},12000);return combinarIA(q,perfil);}
  catch{return q;}
}

// Arma el perfil completo de búsqueda a partir de lo leído
function perfilDesde(q){
  const p={regiones:[...q.regiones],ciudades:[...q.ciudades],excluir:[...q.excluir],sinAero:[...q.sinAero],meses:q.meses,origenes:q.origenes,
    presupuesto:q.presupuesto,diasMin:q.diasMin,diasMax:q.diasMax,maxEsc:q.maxEsc??1,maxHoras:q.maxHoras,pesos:{...PESOS0},
    sinLimite:q.sinLimite,origenAbierto:q.origenAbierto,interes:null,destinoLibre:!q.ciudades.length,resumen:'',ia:!!q.ia};
  if(q.interes)aplicarInteres(p,q.interes);
  if(q.cerca&&!q.regiones.length&&!q.ciudades.length){p.regiones=['brasil'];p.ciudades=[];p.destinoLibre=true}
  if(q.barato)p.pesos.precio=60;
  if(q.sinLimite)p.pesos.precio=20;
  if(p.maxEsc==0)p.pesos.escalas=40;
  if(q.escalasOk)p.pesos.escalas=10;
  if(p.origenes.length)p.pesos.origen=15;
  if(q.corto){
    p.pesos.vuelo=30;
    if(p.maxHoras==null)p.maxHoras=12;
    // "no quiero viajes largos" puede ser el vuelo o la estadía: si no dijo días, se asume estadía corta
    if(p.diasMin==null){p.diasMin=5;p.diasMax=10}
  }
  if(q.largoOk)p.pesos.vuelo=5;
  p.resumen=resumir(p);
  return p;
}
function aplicarInteres(p,it){
  p.interes=it.nombre;
  p.regiones=it.regiones?[...it.regiones]:[];
  p.ciudades=(it.ciudades||[]).filter(c=>!(p.excluir||[]).includes(c));
  p.destinoLibre=true;
}
const juntar=a=>a.length<2?a.join(''):a.slice(0,-1).join(', ')+' y '+a[a.length-1];
function resumir(p){
  const dest=p.ciudades.length?juntar(p.ciudades):p.regiones.length?juntar(p.regiones.map(r=>REGION_NOMBRE[r]))+(p.destinoLibre&&!p.interes?' (sin ciudad definida)':''):'cualquier destino';
  const partes=[`Querés viajar ${dest.startsWith('el ')?'al '+dest.slice(3):'a '+dest}`+(p.interes?` (ideal para ${p.interes})`:'')];
  if(p.excluir&&p.excluir.length)partes.push('sin ir a '+juntar(p.excluir));
  if(p.meses.length)partes.push('en '+juntar(p.meses.map(m=>MESES[m])).replace(/ y /g,' o '));
  if(p.origenes.length)partes.push('saliendo de '+juntar(p.origenes.map(o=>ORIGENES[o])).replace(/ y /g,' o '));
  if(p.presupuesto)partes.push(`con hasta US$ ${p.presupuesto}`);
  if(p.diasMin!=null)partes.push(`por ${p.diasMin} a ${p.diasMax} días`);
  if(p.maxEsc==0)partes.push('sin escalas');else if(p.maxEsc==2&&p.pesos.escalas<=10)partes.push('aceptando escalas');
  if(p.maxHoras)partes.push(`con vuelos de hasta ${p.maxHoras} h`);
  if(p.sinAero&&p.sinAero.length)partes.push('evitando '+juntar(p.sinAero));
  return partes.join(', ')+'.';
}

// Si falta información importante, el agente pregunta (máximo 2 preguntas)
function preguntasPara(p){
  const qs=[];
  if(!p.presupuesto&&!p.sinLimite)qs.push({pregunta:'¿Cuánto querés gastar como máximo en el pasaje de ida y vuelta?',opciones:['Hasta US$ 500','Hasta US$ 900','Hasta US$ 1300','No tengo límite']});
  if(!p.origenes.length&&!p.origenAbierto)qs.push({pregunta:'¿Desde dónde salís?',opciones:['Buenos Aires','Rosario','Cualquiera de las dos']});
  if(!p.meses.length){const prox=[1,2,3].map(i=>MESES[(HOY.getMonth()+i)%12]);qs.push({pregunta:'¿Para qué mes?',opciones:[...prox.map(m=>m[0].toUpperCase()+m.slice(1)),'Cuando sea más barato']})}
  if(p.diasMin==null)qs.push({pregunta:'¿Cuántos días te querés quedar?',opciones:['Unos días','Una semana','Dos semanas','Un mes']});
  return qs.slice(0,2);
}

/* ============ 4. RAZONAMIENTO: puntaje de utilidad 0-100 ============ */
function evaluar(f,p){
  const W=Object.assign({},PESOS0,p.pesos||{}),razones=[],F={};
  if(p.presupuesto){
    const r=f.precio/p.presupuesto;
    F.precio=r<=.7?1:r<=1?1-(r-.7)/.3*.375:r<=1.15?.25:0;
    razones.push([r<=1,`US$ ${f.precio}: ${Math.round(Math.abs(1-r)*100)}% ${r<=1?'por debajo':'por encima'} de tu presupuesto`]);
  }else{F.precio=.6;razones.push([true,`US$ ${f.precio} (no indicaste presupuesto)`])}
  if(f.esc<=p.maxEsc){F.escalas=1-f.esc*.2;razones.push([true,f.esc==0?'Vuelo directo':`${f.esc} escala${f.esc>1?'s':''}, dentro de lo que aceptás`])}
  else{F.escalas=0;razones.push([false,`${f.esc} escala${f.esc>1?'s':''}: más de las que querés`])}
  if(!p.origenes.length||p.origenes.includes(f.origen)){F.origen=1;if(p.origenes.length)razones.push([true,`Sale de ${ORIGENES[f.origen]}, como pediste`])}
  else{F.origen=0;razones.push([false,`Sale de ${ORIGENES[f.origen]}, no estaba en tus opciones`])}
  if(p.diasMin!=null){
    const dif=f.dias<p.diasMin?p.diasMin-f.dias:f.dias>p.diasMax?f.dias-p.diasMax:0;
    F.viaje=Math.max(0,1-dif*.27);
    razones.push([dif==0,dif==0?`${nDias(f.dias)} de viaje, justo en tu rango`:`${nDias(f.dias)} de viaje, ${dif} fuera de tu rango`]);
  }else F.viaje=.67;
  if(p.maxHoras){
    const ok=f.horas<=p.maxHoras;F.vuelo=ok?1:Math.max(0,1-(f.horas-p.maxHoras)*.25);
    razones.push([ok,`${f.horas} h de vuelo${ok?'':`, más de tu límite de ${p.maxHoras} h`}`]);
  }else{F.vuelo=Math.max(0,Math.min(1,1-(f.horas-8)*.08));razones.push([f.horas<=14,`${f.horas} h de vuelo`])}
  if(p.meses.length){
    const d=Math.min(...p.meses.map(m=>{const x=Math.abs(m-f.mes);return Math.min(x,12-x)}));
    F.fecha=Math.max(0,1-d*.35);
    if(d)razones.push([false,`Sale en ${MESES[f.mes]}, no en ${juntar(p.meses.map(m=>MESES[m])).replace(/ y /g,' o ')}`]);
  }
  let tot=0,sw=0;for(const k in F){tot+=F[k]*W[k];sw+=W[k]}
  return {score:Math.max(0,Math.min(100,Math.round(sw?tot/sw*100:0))),razones};
}
// Si en los meses pedidos hay menos de 3 opciones, el agente relaja esa restricción
// y suma fechas cercanas (penalizadas en el puntaje). r.relajado avisa que lo hizo.
function buscarVuelos(p,vuelos){
  const base=vuelos.filter(f=>{
    if(new Date(f.anio,f.mes,f.dia,23,59,59)<HOY)return false;
    if(p.excluir&&p.excluir.includes(f.dest.c))return false;
    if(p.sinAero&&p.sinAero.includes(f.aero))return false;
    if(p.regiones.length||p.ciudades.length){if(!(p.regiones.includes(f.dest.r)||p.ciudades.includes(f.dest.c)))return false}
    if(p.origenes.length&&!p.origenes.includes(f.origen))return false;
    if(f.esc>p.maxEsc)return false;
    if(p.presupuesto&&f.precio>p.presupuesto*1.25)return false;
    return true;
  });
  const enMes=base.filter(f=>!p.meses.length||p.meses.includes(f.mes));
  const relajar=p.meses.length&&enMes.length<3&&base.length>enMes.length;
  const r=(relajar?base:enMes).map(f=>({f,...evaluar(f,p)})).sort((a,b)=>b.score-a.score||a.f.precio-b.f.precio);
  r.relajado=relajar?enMes.length:null;
  return r;
}

/* ============ 5. DECISIÓN Y EXPLICACIÓN ============ */
const enRango=(f,p)=>p.diasMin==null||(f.dias>=p.diasMin&&f.dias<=p.diasMax);
const nDias=n=>n==1?"1 día":n+" días";
const ruta=f=>`${ORIGENES[f.origen]} → ${f.dest.c}`;
const ord=i=>`${i+1}.ª`;

// Compara dos opciones dato por dato: en qué gana cada una
function comparar(a,b,p){
  const A=[],B=[];
  const dp=b.f.precio-a.f.precio;
  if(dp>0)A.push(`es US$ ${dp} más barata`);else if(dp<0)B.push(`es US$ ${-dp} más barata`);
  if(a.f.esc<b.f.esc)A.push(a.f.esc==0?'es directa':'tiene menos escalas');else if(b.f.esc<a.f.esc)B.push(b.f.esc==0?'es directa':'tiene menos escalas');
  const dh=+(b.f.horas-a.f.horas).toFixed(1);
  if(dh>=1)A.push(`tarda ${dh} h menos`);else if(dh<=-1)B.push(`tarda ${-dh} h menos`);
  if(enRango(a.f,p)&&!enRango(b.f,p))A.push('sus días entran en tu rango');else if(enRango(b.f,p)&&!enRango(a.f,p))B.push('sus días entran en tu rango');
  if(p.origenes.length){const oa=p.origenes.includes(a.f.origen),ob=p.origenes.includes(b.f.origen);if(oa&&!ob)A.push('sale de donde pediste');else if(ob&&!oa)B.push('sale de donde pediste')}
  return {A,B};
}
function explicar(x,i,lista,p,prom){
  const f=x.f,partes=[];
  if(p.presupuesto){const d=p.presupuesto-f.precio;partes.push(d>=0?`te sobran US$ ${d} del presupuesto`:`se pasa US$ ${-d} de tu presupuesto`)}
  const dp=Math.round((1-f.precio/prom)*100);
  if(dp>=10)partes.push(`cuesta ${dp}% menos que el promedio de lo que encontré`);
  if(f.esc==0)partes.push('es directo');
  if(p.maxHoras&&f.horas<=p.maxHoras)partes.push(`son ${f.horas} h de vuelo, dentro de tu límite`);
  if(p.diasMin!=null&&enRango(f,p))partes.push(`los ${nDias(f.dias)} entran en lo que buscás`);
  if(!partes.length)partes.push(`tiene el mejor equilibrio entre precio (US$ ${f.precio}), escalas y duración`);
  const ojo=p.origenes.length&&!p.origenes.includes(f.origen)?` Ojo: sale de ${ORIGENES[f.origen]}, no de ${juntar(p.origenes.map(o=>ORIGENES[o]))}, pero aun así es de lo que más te conviene.`:'';
  if(i==0)return `La pongo primera porque ${juntar(partes.slice(0,3))}.`+ojo;
  const {A,B}=comparar(x,lista[0],p);
  let txt=`Queda ${ord(i)}: ${juntar(partes.slice(0,2))}.`;
  if(A.length)txt+=` Frente a la 1.ª ${juntar(A)}`+(B.length?`, pero la 1.ª ${juntar(B)}.`:'.');
  else if(B.length)txt+=` La 1.ª le gana porque ${juntar(B)}.`;
  return txt+ojo;
}
// El agente elige hasta 6 opciones, variando destinos si el usuario no definió ciudad
function decidir(p,r){
  const lista=[],porDest={};
  for(const x of r){
    if(lista.length>=6)break;
    const k=x.f.dest.c;
    if(p.destinoLibre&&(porDest[k]||0)>=2)continue;
    porDest[k]=(porDest[k]||0)+1;lista.push(x);
  }
  const prom=r.reduce((s,x)=>s+x.f.precio,0)/r.length;
  lista.forEach((x,i)=>x.explicacion=explicar(x,i,lista,p,prom));
  const b=lista[0];
  let resumen=`Analicé ${r.length} vuelo${r.length>1?'s':''}. La mejor oportunidad es ${ruta(b.f)} por US$ ${b.f.precio} (${b.score}/100${b.score>=80?', una gran oportunidad':''}).`;
  if(p.presupuesto){const n=r.filter(x=>x.f.precio<=p.presupuesto).length;resumen+=` ${n} de ${r.length} entran en tu presupuesto.`}
  if(r.relajado!=null){const ms=juntar(p.meses.map(m=>MESES[m])).replace(/ y /g,' o ');resumen=(r.relajado?`Para ${ms} encontré solo ${r.relajado} precio${r.relajado>1?'s':''}, así que sumé fechas cercanas. `:`No encontré precios para ${ms}, así que te muestro las fechas más cercanas. `)+resumen}
  return {lista,resumen};
}


const azar=a=>a[Math.floor(Math.random()*a.length)];
const pausa=ms=>new Promise(r=>setTimeout(r,ms));
const escTxt=f=>f.esc==0?'directo':`${f.esc} escala${f.esc>1?'s':''}`;
const CAPACIDADES='Puedo buscar más barato o aceptar pagar más, evitar o aceptar escalas, priorizar vuelos cortos, cambiar los días de estadía, las fechas, la ciudad de salida o el destino, y sacar destinos o aerolíneas que no te gusten. También podés preguntarme cuál es la más barata, la más rápida, si hay directos o por qué elegí una opción.';

// Charla social: saludos, agradecimientos, ayuda
function charlaSocial(t){
  const corto=t.trim().split(' ').length<=6;
  if(corto&&/^ (hola|holis|buenas|buen dia|buenas tardes|buenas noches|hey|que tal|como va)\b/.test(t))
    return azar(['¡Hola! Ya tengo tus resultados arriba.','¡Hola! Estoy con tu búsqueda.'])+' Decime qué querés ajustar o preguntame por cualquier opción.';
  if(corto&&/^ (muchas )?(gracias|genial|perfecto|buenisimo|excelente|joya|barbaro|de una|ok|okey|listo|re bien|copado)\b/.test(t))
    return azar(['¡De nada! Si querés, puedo dejar esta búsqueda activa y avisarte cuando aparezca una oportunidad.','¡Me alegra! ¿Querés que ajuste algo más?','Cuando quieras. Si guardás la búsqueda, la sigo vigilando por vos.']);
  if(/^ (chau|adios|nos vemos|hasta luego)\b/.test(t))return '¡Buen viaje! La búsqueda queda acá por si querés retomarla.';
  if(/que (podes|sabes|puedes) hacer|\bayuda\b|como funciona|como te uso|que te puedo (pedir|preguntar)/.test(t))return CAPACIDADES;
  if(/quien sos|que sos|sos (un |una )?(bot|robot|ia|inteligencia|humano|persona|maquina)/.test(t))
    return 'Soy el agente del Radar de Vuelos. Interpreto lo que me pedís, comparo los precios de vuelos y te explico por qué recomiendo cada opción.';
  return null;
}
const esPregunta=(t,m)=>/\?/.test(m)||/^ (y )?(cual|cuales|que|cuanto|cuantos|cuando|donde|como|hay|por que|porque|me (decis|explicas|recomendas|recomendarias)|conviene|es mejor|tenes|existe)\b/.test(t);

// Opciones que el usuario menciona: "la segunda", "la 3.ª", "opción 2", o una ciudad del ranking
function mencionadas(m,lista){
  const raw=m.toLowerCase(),t=sin(m),idx=[];
  const ORD={primera:0,primer:0,primero:0,segunda:1,segundo:1,tercera:2,tercero:2,cuarta:3,cuarto:3,quinta:4,quinto:4,sexta:5,sexto:5,ultima:-1,ultimo:-1};
  for(const [w,i] of Object.entries(ORD))if(new RegExp('\\b'+w+'\\b').test(t))idx.push(i<0?lista.length-1:i);
  for(const mm of raw.matchAll(/(\d)\s*(?:\.?\s*ª|ra|da|ta|°|º)|opci[oó]n\s*(\d)/g))idx.push(+(mm[1]||mm[2])-1);
  DESTINOS.forEach(d=>{if(new RegExp('\\b'+sin(d.c)+'\\b').test(t)){const i=lista.findIndex(x=>x.f.dest.c==d.c);if(i>=0)idx.push(i)}});
  return [...new Set(idx)].filter(i=>i>=0&&i<lista.length);
}
function detalle(x,i){
  const f=x.f;
  return `La ${ord(i)} es ${ruta(f)} con ${f.aero}: sale el ${fecha(f)}, ${nDias(f.dias)} de estadía, ${escTxt(f)} y ${f.horas} h de vuelo, por US$ ${f.precio} (${x.score}/100).`;
}
// Preguntas sobre los resultados. Devuelve null si no es una pregunta que sepa responder.
function consulta(m,{p,r,lista}){
  const t=normalizar(m),sel=mencionadas(m,lista);
  if(!lista.length)return null;
  const enRanking=x=>{const i=lista.findIndex(l=>l.f.id==x.f.id);return i>=0?`Está ${ord(i)} en mi ranking.`:`No la puse entre las recomendadas porque saca ${x.score}/100: ${x.razones.filter(z=>!z[0]).map(z=>z[1].toLowerCase()).slice(0,2).join(' y ')||'otras opciones le ganan en el total'}.`};
  if(/por ?que|compar|diferencia|explica|\bvs\b|versus|en que (gana|es mejor)/.test(t))return explicarPregunta(m,{p,r,lista});
  if(/mas barat|menor precio|mas economic|la barata|cuesta menos|sale menos/.test(t)){
    const x=[...r].sort((a,b)=>a.f.precio-b.f.precio)[0];
    return `La más barata que encontré es ${ruta(x.f)} por US$ ${x.f.precio} (${x.f.aero}, sale el ${fecha(x.f)}, ${escTxt(x.f)}). ${enRanking(x)}`;
  }
  if(/mas rapid|mas cort|menos horas|menor duracion|dura menos|menos tiempo/.test(t)){
    const x=[...r].sort((a,b)=>a.f.horas-b.f.horas)[0];
    return `La más rápida es ${ruta(x.f)}: ${x.f.horas} h de vuelo, ${escTxt(x.f)}, por US$ ${x.f.precio}. ${enRanking(x)}`;
  }
  if(/directo|sin escala/.test(t)){
    const d=r.filter(x=>x.f.esc==0);
    if(!d.length)return 'No encontré vuelos directos para esta búsqueda. Si querés, pruebo con otro destino o con otras fechas.';
    return `Sí, encontré ${d.length} directo${d.length>1?'s':''}. El mejor es ${ruta(d[0].f)} por US$ ${d[0].f.precio} (${d[0].score}/100). ${enRanking(d[0])}`;
  }
  if(/recomend|cual (es la |seria la )?mejor|cual elegis|cual elegirias|que harias|cual me conviene|que me conviene|cual agarro|cual tomo/.test(t))
    return `Yo iría por la 1.ª, ${ruta(lista[0].f)} por US$ ${lista[0].f.precio}. ${lista[0].explicacion}`;
  if(/cuant[ao]s? (vuelos|opciones|resultados)/.test(t))
    return `Analicé ${r.length} vuelos y te recomendé ${lista.length}. ${r.relajado!=null?'Tuve que sumar fechas cercanas porque en el mes pedido había pocos precios.':''}`.trim();
  if(/que entendiste|que (estas|estamos) buscando|mi busqueda|que busco|resumen|que tenes en cuenta/.test(t))return 'Estoy buscando esto: '+p.resumen;
  if(/aerolinea|cuando sale|que dia|fecha|cuanto (cuesta|sale|vale|esta)|precio de|detalle|contame|info|cuantas escalas|cuantas horas/.test(t)||sel.length){
    const i=sel.length?sel[0]:0;
    return detalle(lista[i],i)+(sel.length?' '+lista[i].explicacion:'');
  }
  return null;
}

// Aplica al perfil actual los cambios que pide el mensaje. Devuelve el perfil nuevo y qué cambió.
function ajustar(p,m,ctx){
  const q=leer(m),n=JSON.parse(JSON.stringify(p)),c=[];
  n.excluir=n.excluir||[];n.sinAero=n.sinAero||[];
  const sube=(k,d)=>{n.pesos[k]=Math.max(5,Math.min(80,(n.pesos[k]??PESOS0[k])+d))};
  const ref=n.presupuesto||(ctx&&ctx.lista[0]?ctx.lista[0].f.precio:null);
  // Precio
  if(q.presupuesto){n.presupuesto=q.presupuesto;n.sinLimite=false;c.push(`pongo el tope en US$ ${q.presupuesto}`)}
  else if(q.sinLimite){n.presupuesto=null;n.sinLimite=true;sube('precio',-20);c.push('dejo el presupuesto sin límite')}
  else if(q.precioDir<0){
    if(ref)n.presupuesto=Math.max(50,Math.round(ref*(1-q.intensidad)/10)*10);
    sube('precio',20);c.push(`busco opciones más baratas${ref?` (tope de US$ ${n.presupuesto})`:''}`);
  }else if(q.precioDir>0){
    if(ref)n.presupuesto=Math.round(ref*(1.05+q.intensidad)/10)*10;
    sube('precio',-15);c.push(`acepto pagar más${ref?` (hasta US$ ${n.presupuesto})`:''}`);
  }else if(q.barato){sube('precio',20);c.push('le doy más importancia al precio')}
  // Escalas
  if(q.maxEsc===0&&n.maxEsc!==0){n.maxEsc=0;sube('escalas',20);c.push('solo vuelos directos')}
  else if(q.escalasOk&&(n.maxEsc<2||n.pesos.escalas>10)){n.maxEsc=2;n.pesos.escalas=10;c.push('acepto vuelos con escalas')}
  else if(q.maxEsc===1&&n.maxEsc!==1){n.maxEsc=1;c.push('hasta 1 escala')}
  else if(q.menosEsc&&n.maxEsc>0){n.maxEsc--;sube('escalas',15);c.push(n.maxEsc?`como mucho ${n.maxEsc} escala`:'solo vuelos directos')}
  // Horas de vuelo
  if(q.maxHoras){n.maxHoras=q.maxHoras;c.push(`vuelos de hasta ${q.maxHoras} h`)}
  else if(q.corto){n.maxHoras=n.maxHoras?Math.max(4,n.maxHoras-2):12;sube('vuelo',15);c.push(`priorizo vuelos más cortos (hasta ${n.maxHoras} h)`)}
  else if(q.largoOk){n.maxHoras=null;n.pesos.vuelo=5;c.push('no me fijo tanto en la duración del vuelo')}
  // Estadía
  if(q.diasMin!=null&&(q.diasMin!==p.diasMin||q.diasMax!==p.diasMax)){n.diasMin=q.diasMin;n.diasMax=q.diasMax;c.push(`estadía de ${q.diasMin} a ${q.diasMax} días`)}
  else if(q.diasDir){
    const a=n.diasMin??6,b=n.diasMax??9;
    if(q.diasDir>0){n.diasMin=a+3;n.diasMax=b+4}else{n.diasMin=Math.max(1,a-3);n.diasMax=Math.max(n.diasMin+1,b-4)}
    sube('viaje',5);c.push(`estadía de ${n.diasMin} a ${n.diasMax} días`);
  }
  // Fechas
  if(q.meses.length){n.meses=q.meses;c.push('salida en '+juntar(q.meses.map(x=>MESES[x])).replace(/ y /g,' o '))}
  else if(q.mesDir){
    const base=n.meses.length?n.meses:[ctx&&ctx.lista[0]?ctx.lista[0].f.mes:HOY.getMonth()];
    n.meses=[...new Set(base.map(x=>(x+q.mesDir+12)%12))];
    c.push('salida en '+juntar(n.meses.map(x=>MESES[x])).replace(/ y /g,' o '));
  }
  // Salida
  if(q.origenes.length){n.origenes=q.origenes;n.pesos.origen=Math.max(n.pesos.origen,15);c.push('salida desde '+juntar(q.origenes.map(o=>ORIGENES[o])))}
  else if(q.origenAbierto){n.origenes=[];c.push('salida desde cualquiera de las dos ciudades')}
  // Destino
  if(q.excluir.length){
    n.excluir=[...new Set([...n.excluir,...q.excluir])];
    n.ciudades=n.ciudades.filter(x=>!q.excluir.includes(x));
    c.push('saco '+juntar(q.excluir));
  }
  if(q.ciudades.length||q.regiones.length){n.ciudades=q.ciudades;n.regiones=q.regiones;n.interes=null;n.excluir=n.excluir.filter(x=>!q.ciudades.includes(x));c.push('destino: '+juntar([...q.ciudades,...q.regiones.map(r=>REGION_NOMBRE[r])]))}
  else if(q.interes){aplicarInteres(n,q.interes);c.push(`busco destinos para ${q.interes.nombre}`)}
  else if(q.cerca){n.regiones=['brasil'];n.ciudades=[];n.interes=null;c.push('busco destinos más cerca (Brasil)')}
  else if(q.lejos){n.regiones=['europa'];n.ciudades=[];n.interes=null;c.push('busco destinos más lejos (Europa)')}
  else if(q.destOtro&&ctx){
    const vistos=[...new Set(ctx.lista.map(x=>x.f.dest.c))];
    n.excluir=[...new Set([...n.excluir,...vistos])];n.ciudades=n.ciudades.filter(x=>!vistos.includes(x));
    c.push('busco otros destinos (descarto '+juntar(vistos)+')');
  }else if(q.destinoAbierto){n.ciudades=[];n.regiones=[];n.interes=null;c.push('busco en cualquier destino')}
  // Aerolíneas
  if(q.sinAero.length){n.sinAero=[...new Set([...n.sinAero,...q.sinAero])];c.push('evito '+juntar(q.sinAero))}
  n.destinoLibre=!n.ciudades.length||!!n.interes;
  n.resumen=resumir(n);
  return {n,cambios:c};
}
// Responde "por qué" comparando opciones con datos concretos
function explicarPregunta(m,{p,r,lista}){
  const t=sin(m),sel=mencionadas(m,lista).map(i=>[i,lista[i]]);
  // Mencionó una ciudad que no está entre las recomendadas
  const ciudad=DESTINOS.find(d=>new RegExp('\\b'+sin(d.c)+'\\b').test(t));
  if(ciudad&&!lista.some(x=>x.f.dest.c==ciudad.c)){
    const x=r.find(y=>y.f.dest.c==ciudad.c);
    if(!x)return `No encontré vuelos a ${ciudad.c} con las condiciones de tu búsqueda, por eso no aparece. Si querés, te la busco aparte: decime «quiero ir a ${ciudad.c}».`;
    const {A,B}=comparar(lista[0],x,p);
    return `El mejor vuelo a ${ciudad.c} saca ${x.score}/100 (US$ ${x.f.precio}). La 1.ª (${ruta(lista[0].f)}) saca ${lista[0].score}/100${A.length?` porque ${juntar(A)}`:''}.${B.length?` A favor de ${ciudad.c}: ${juntar(B)}.`:''}`;
  }
  if(sel.length==1&&!/\by\b|\bno\b|vs|contra|que la|que el/.test(t.replace(/^.*?por que/,''))){
    const [i,x]=sel[0];return `${ord(i)} opción, ${ruta(x.f)} (${x.score}/100): ${x.explicacion}`;
  }
  const [ia,a]=sel[0]||[0,lista[0]],[ib,b]=sel[1]||(ia==0?[1,lista[1]]:[0,lista[0]]);
  if(!b)return `Es la única opción que encontré. ${a.explicacion}`;
  const [pi,P,si,S]=a.score>=b.score?[ia,a,ib,b]:[ib,b,ia,a];
  const {A,B}=comparar(P,S,p);
  let txt=`La ${ord(pi)} (${ruta(P.f)}, ${P.score}/100) le gana a la ${ord(si)} (${ruta(S.f)}, ${S.score}/100)`;
  txt+=A.length?` porque ${juntar(A)}.`:' por poco: en el puntaje total tiene un mejor equilibrio.';
  if(B.length)txt+=` A favor de la ${ord(si)}: ${juntar(B)}.`;
  const top=Object.entries(p.pesos).sort((x,y)=>y[1]-x[1])[0][0];
  return txt+` Para vos lo que más pesa es ${NOMP[top]}.`;
}
function noEntendi(m){
  return `No terminé de entender «${m.length>60?m.slice(0,57)+'…':m}». `+azar([
    '¿Querés que busque más barato, que acepte escalas o que cambie las fechas?',
    '¿Te referís al precio, a las escalas, a los días de estadía o al destino?',
    'Podés pedirme, por ejemplo, «algo más barato», «con escalas está bien» o «quedarme más días».'])+' También podés preguntarme cuál es la más barata o por qué elegí la primera.';
}
