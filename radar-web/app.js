/* Radar de Vuelos — interfaz del diseño aprobado.
 * engine.js conserva la interpretación, utilidad y conversación del proyecto original.
 * Toda información demostrativa se identifica como simulada; nunca se alteran precios reales.
 */
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'US$ '+Math.round(n).toLocaleString('es-AR');
const fecha=f=>`${f.dia} ${MESES[f.mes].slice(0,3)} ${f.anio}`;
const NOMP={precio:'precio',escalas:'pocas escalas',origen:'ciudad de salida',viaje:'duración del viaje',vuelo:'vuelo corto',fecha:'fecha de salida'};
const COUNTRIES={...Object.fromEntries(Object.entries(globalThis.RADAR_AIRPORTS||{}).map(([code,a])=>[code,a.country])),LIS:'Portugal',MAD:'España',FCO:'Italia',CDG:'Francia',BCN:'España',LHR:'Reino Unido',MIA:'Estados Unidos',JFK:'Estados Unidos',GIG:'Brasil',FLN:'Brasil',PUJ:'Rep. Dominicana',CUN:'México'};
const PHOTOS={LIS:'lisboa.webp',MAD:'madrid.webp',FCO:'roma.webp',BCN:'barcelona.jpg',CDG:'paris.jpg',AMS:'amsterdam.jpg',MIA:'miami.png',IST:'estambul.png',KEF:'reikiavik.png',LHR:'londres.png'};
const DEMO_QUERY='Quiero ir a Europa en febrero, hasta US$ 1.200, por 14 días.';
const STORAGE_KEY='radar-vuelos-v2';
const ICON_PATHS={
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  'arrow-left':'<path d="M20 12H5m6-6-6 6 6 6"/>',
  external:'<path d="M6 18 18 6M7 6h11v11"/>',
  chevron:'<path d="m6 9 6 6 6-6"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4M12 2V1"/>',
  bookmark:'<path d="M6 3h12v18l-6-4-6 4V3Z"/>',
  sparkle:'<path d="M12 2c1.3 6.8 3.2 8.7 10 10-6.8 1.3-8.7 3.2-10 10C10.7 15.2 8.8 13.3 2 12c6.8-1.3 8.7-3.2 10-10Z"/>',
  sliders:'<path d="M3 6h5m4 0h9M3 12h11m4 0h3M3 18h3m4 0h11"/><circle cx="10" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  mic:'<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v4m-4 0h8"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5M5.2 7A8 8 0 0 1 19 7l1 5M4 12l1 5a8 8 0 0 0 13.8 0"/>',
  plane:'<path d="m3 11 7 2 4 8 3-18-14 8Zm7 2 7-10"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  minus:'<path d="M5 12h14"/>'
};
function icon(name){return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name]||ICON_PATHS.sparkle}</svg>`;}
function hydrateIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);el.removeAttribute('data-icon');});}
function photo(f,small=false){
  const slug=PHOTOS[f.dest.k];
  return slug?`<img src="assets/${slug}" alt="${esc(f.dest.c)}, ${esc(COUNTRIES[f.dest.k])}" loading="lazy" width="1536" height="1024">`:
    `<div class="destination-art" aria-label="Destino ${esc(f.dest.c)}"><strong>${esc(f.dest.k)}</strong>${small?'':`<small>${esc(f.dest.c)}</small>`}</div>`;
}
function toast(message){const el=document.createElement('div');el.className='toast';el.textContent=message;$('toasts').append(el);setTimeout(()=>el.remove(),4300);}
function emptyState(title,text,action='new-search',label='Explorar vuelos',symbol='plane'){
  return `<div class="empty-state"><span>${icon(symbol)}</span><h3>${esc(title)}</h3><p>${esc(text)}</p>${action?`<button class="button outline" data-action="${action}">${esc(label)}${icon('arrow')}</button>`:''}</div>`;
}
function loadState(){
  try{
    const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    if(stored)return {watches:Array.isArray(stored.watches)?stored.watches.filter(w=>w&&w.p&&Array.isArray(w.p.meses)):[],alerts:Array.isArray(stored.alerts)?stored.alerts:[],bookmarks:Array.isArray(stored.bookmarks)?stored.bookmarks.filter(x=>x?.f?.dest):[]};
    const old=JSON.parse(localStorage.getItem('rv')||'null');
    if(old)return {watches:(old.activas||[]).filter(w=>w?.p?.meses).map(w=>({...w,enabled:true,history:[],target:w.p.presupuesto||null,createdAt:Date.now(),source:'sim'})),alerts:(old.alertas||[]).map(a=>({...a,read:!!a.leida,body:a.msg,title:'Oportunidad encontrada',source:'sim',createdAt:Date.now()})),bookmarks:[]};
  }catch{}
  return {watches:[],alerts:[],bookmarks:[]};
}
const state=loadState();
let current=null,showAll=false,currentView='explorar',alertFilter='all',searchBusy=false,chatBusy=false,monitorBusy=false;
let messages=[],clarification=null,dialogFlight=null,watchDraft=null;
let storageWarningShown=false;
function saveState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{if(!storageWarningShown){storageWarningShown=true;toast('El navegador no permite guardar datos. Los cambios duran esta sesión.');}}}
function updateCounts(){
  const unread=state.alerts.filter(a=>!a.read).length;
  $('count-searches').textContent=state.watches.length;$('count-searches').hidden=!state.watches.length;
  $('count-alerts').textContent=unread;$('count-alerts').hidden=!unread;$('notification-dot').hidden=!unread;
}
function navigate(){
  const next=location.hash.slice(1);currentView=['explorar','busquedas','alertas'].includes(next)?next:'explorar';
  document.querySelectorAll('.view').forEach(el=>{el.hidden=el.id!=='view-'+currentView;});
  document.querySelectorAll('[data-nav]').forEach(el=>{const on=el.dataset.nav===currentView;el.classList.toggle('active',on);if(on)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  if(currentView==='busquedas')renderSaved();if(currentView==='alertas')renderAlerts();
  window.scrollTo({top:0,behavior:'instant'});
}
function setView(v){if(location.hash==='#'+v)navigate();else location.hash=v;}
function dateRange(f){
  const start=new Date(f.anio,f.mes,f.dia);const end=new Date(f.anio,f.mes,f.dia+f.dias);
  const left=start.getMonth()===end.getMonth()?String(start.getDate()):`${start.getDate()} ${MESES[start.getMonth()].slice(0,3).toUpperCase()}`;
  return `${left}–${end.getDate()} ${MESES[end.getMonth()].slice(0,3).toUpperCase()} · ${f.dias} días`;
}
function profileTags(p){
  const tags=[];
  if(p.ciudades.length)tags.push(...p.ciudades);else if(p.regiones.length)tags.push(...p.regiones.map(r=>REGION_NOMBRE[r]));else tags.push('Destino abierto');
  p.meses.forEach(m=>tags.push(`${MESES[m][0].toUpperCase()+MESES[m].slice(1)} ${anioDe(m)}`));
  tags.push(p.presupuesto?'Hasta '+money(p.presupuesto):'Sin tope de precio');
  if(p.diasMin!=null)tags.push(p.diasMin===p.diasMax?`${p.diasMin} días`:`${p.diasMin}–${p.diasMax} días`);
  tags.push(p.maxEsc===0?'Solo directos':`Máx. ${p.maxEsc} escala${p.maxEsc>1?'s':''}`);
  if(p.maxHoras)tags.push(`Hasta ${p.maxHoras} h de vuelo`);
  return tags;
}
function cardReason(x,p){
  if(x.f.esc===0&&p.maxEsc===0)return 'Volás directo, como querías';
  const saving=p.presupuesto-x.f.precio;
  if(p.presupuesto&&saving>0)return `${money(saving)} por debajo de tu presupuesto`;
  if(p.presupuesto&&saving<0)return `${money(-saving)} por encima de tu presupuesto`;
  return x.f.esc===0?'Llegás directo y aprovechás más el viaje':`${x.f.horas} h de vuelo · ${x.f.dias} días de viaje`;
}
function flightCard(x,p=current?.p){
  const {f,score}=x;const saved=state.bookmarks.some(b=>b.f.id===f.id);
  const label=score>=95?'Ideal para vos':score>=85?'Gran opción':score>=70?'Buena opción':'Alternativa';
  return `<article class="flight-card" data-flight-id="${esc(f.id)}">
    <div class="flight-visual">${photo(f)}<span class="source-badge ${f.fuente==='real'?'real':'sim'}">${f.fuente==='real'?'Vuelo real':'Simulado'}</span><span class="match-badge ${score<70?'fair':''}">${score}/100 · ${label}</span><button class="bookmark-button ${saved?'saved':''}" data-action="bookmark" data-id="${esc(f.id)}" aria-label="${saved?'Quitar':'Guardar'} vuelo a ${esc(f.dest.c)}" aria-pressed="${saved}">${icon('bookmark')}</button></div>
    <div class="flight-body"><h3>${esc(f.dest.c)}, ${esc(COUNTRIES[f.dest.k]||'')}</h3><div class="flight-information"><div><div class="flight-route">${esc(f.origen)} → ${esc(f.dest.k)}</div><div class="flight-meta">${dateRange(f)}<br>${escTxt(f)} · ${esc(f.aero)}</div></div><div class="flight-price"><strong>${money(f.precio)}</strong><span>ida y vuelta</span></div></div><div class="flight-reason">${icon('sparkle')}<span>${esc(cardReason(x,p||{presupuesto:null,maxEsc:1}))}</span></div><button class="button outline view-flight" data-action="flight" data-id="${esc(f.id)}">Ver vuelo${icon('arrow')}</button></div></article>`;
}
// Real provider flights plus the separately labelled simulated ones.
const poolDe=datos=>datos.simulados?[...datos.vuelos,...datos.simulados]:datos.vuelos;
function sortedFlights(fuente){
  const mode=$('sort').value;const all=current.r.filter(x=>!fuente||x.f.fuente===fuente);
  if(mode==='price')all.sort((a,b)=>a.f.precio-b.f.precio||b.score-a.score);
  else if(mode==='duration')all.sort((a,b)=>a.f.horas-b.f.horas||b.score-a.score);
  if(showAll)return all;
  if(mode!=='match')return all.slice(0,3);
  // Prefer three different destinations when the request is open.
  const ranked=[...current.lista.filter(x=>!fuente||x.f.fuente===fuente),...all];
  const varied=[];for(const x of ranked){if(!varied.some(v=>v.f.dest.k===x.f.dest.k))varied.push(x);if(varied.length===3)break;}
  if(varied.length<3)for(const x of ranked){if(!varied.includes(x))varied.push(x);if(varied.length===3)break;}
  return varied;
}
function flightGroups(p){
  const {datos,r}=current;
  if(current.preview||datos.fuente!=='real')return sortedFlights().map(x=>flightCard(x,p)).join('');
  const reales=sortedFlights('real'),simulados=sortedFlights('sim');
  const head=(title,note)=>`<div class="flight-group-head"><h3>${title}</h3><p>${note}</p></div>`;
  return head('Vuelos reales','Precios encontrados en Aviasales · sujetos a disponibilidad')+
    (reales.length?reales.map(x=>flightCard(x,p)).join(''):`<p class="flight-group-empty">La API no tiene vuelos reales que cumplan estas condiciones.</p>`)+
    (simulados.length?head('Vuelos simulados','Opciones ilustrativas para comparar · no se pueden reservar')+simulados.map(x=>flightCard(x,p)).join(''):'');
}
function renderResults(){
  if(!current)return;
  const {p,datos,r}=current;
  $('understood').innerHTML=`<span class="understood-label">${icon('sparkle')}Entendimos tu viaje:</span><div class="filter-tags">${profileTags(p).slice(0,7).map(t=>`<span class="filter-tag">${esc(t)}</span>`).join('')}</div><button class="text-link" data-action="edit-filters">Editar</button>`;
  $('flight-grid').setAttribute('aria-busy','false');
  $('flight-grid').innerHTML=r.length?flightGroups(p):emptyState('Probemos con un poco más de aire.','No encontramos vuelos con esas condiciones. Podés ampliar el presupuesto, aceptar una escala o cambiar de mes.','edit-filters','Ajustar búsqueda');
  const perGroup=datos.fuente==='real'&&!current.preview?Math.max(r.filter(x=>x.f.fuente==='real').length,r.filter(x=>x.f.fuente==='sim').length):r.length;
  $('show-all').hidden=perGroup<=3&&!current.preview;$('show-all').innerHTML=(showAll?'Ver menos opciones':'Ver todas las opciones')+icon('arrow');
  const real=datos.fuente==='real';
  $('data-source').textContent=real?'Precios reales de Aviasales · vuelos simulados identificados aparte':'Modo demo · Precios simulados';
  $('footer-source').textContent=real?'Precios de Aviasales · Imágenes con IA':'Modo demo · Precios ilustrativos';
  $('results-status').textContent=r.relajado!=null?current.resumen:(!current.preview&&datos.motivo?datos.motivo:'');
  $('assistant').hidden=!r.length;
}
function demoProfile(){
  const p=perfilDesde(leer(DEMO_QUERY+' Desde Buenos Aires.'));p.diasMin=14;p.diasMax=14;
  p.pesos={precio:65,escalas:8,origen:15,viaje:15,vuelo:4,fecha:15};
  p.resumen=resumir(p);return p;
}
function initPreview(){
  const p=demoProfile();const r=buscarVuelos(p,VUELOS_PORTADA);const result=decidir(p,r);
  current={p,r,...result,txt:DEMO_QUERY,datos:{fuente:'sim',vuelos:VUELOS_PORTADA},preview:true};
  renderResults();
}
// The AI reads the request first; the rule engine is the fallback when it is unavailable.
async function parseSearchIA(text){return parseSearch(text,await leerConIA(text));}
function parseSearch(text,q=leer(text)){
  const p=perfilDesde(q);
  // An explicit origin in the sentence wins over the default selector.
  if(!q.origenes.length&&!q.origenAbierto){p.origenes=$('origin').value?[$('origin').value]:[];p.origenAbierto=!$('origin').value;}
  else if(q.origenes.length===1)$('origin').value=q.origenes[0];
  if($('month').value!=='')p.meses=[Number($('month').value)];
  p.resumen=resumir(p);return p;
}
async function executeSearch(p,text,{ask=false,resetChat=true}={}){
  if(searchBusy||chatBusy)return;
  if(ask){const qs=preguntasPara(p);if(qs.length){showClarifications(p,text,qs);return;}}
  $('clarifications').hidden=true;$('filters-form').hidden=true;$('search-error').hidden=true;
  searchBusy=true;$('search-button').disabled=true;$('search-button').innerHTML='<span class="processing">Buscando vuelos</span>';
  $('flight-grid').setAttribute('aria-busy','true');$('results-status').textContent='Comparando vuelos con tus preferencias…';
  $('flight-grid').innerHTML=Array.from({length:3},()=>'<div class="skeleton-card" aria-hidden="true"><div class="skeleton-image"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div><div class="skeleton-line"></div></div>').join('');
  try{
    const datos=await obtenerVuelos(p,true);await pausa(250);
    const r=buscarVuelos(p,poolDe(datos));const result=r.length?decidir(p,r):{lista:[],resumen:''};
    current={p,r,...result,datos,txt:text,preview:false};showAll=false;
    if(resetChat){messages=[];renderChat();$('chat-panel').hidden=true;$('toggle-chat').setAttribute('aria-expanded','false');}
    renderResults();
  }catch{
    $('flight-grid').innerHTML=emptyState('No pudimos completar la búsqueda.','Probá nuevamente en un momento. Tus búsquedas guardadas siguen acá.','retry','Volver a intentar');
    $('results-status').textContent='La búsqueda se interrumpió.';
  }finally{
    searchBusy=false;$('search-button').disabled=false;$('search-button').innerHTML='<span>Encontrar vuelos</span>'+icon('arrow');$('flight-grid').setAttribute('aria-busy','false');
  }
}
function showClarifications(p,text,qs){
  clarification={p,text,qs};
  $('clarifications').innerHTML=`<h2>Antes de despegar, un detalle.</h2><p>${esc(p.resumen)}</p><form id="clarification-form">${qs.map((q,i)=>`<div class="clarification-question"><label for="answer-${i}">${esc(q.pregunta)}</label><div class="suggestions">${q.opciones.map(o=>`<button type="button" data-answer="${i}" data-value="${esc(o)}">${esc(o)}</button>`).join('')}</div><input id="answer-${i}" name="answer-${i}" placeholder="O escribí tu respuesta" maxlength="200"></div>`).join('')}<div class="clarification-actions"><button type="submit" class="button primary">Continuar${icon('arrow')}</button><button type="button" class="button outline" data-action="skip-questions">Buscar con lo que tenemos</button></div></form>`;
  $('clarifications').hidden=false;$('clarifications').scrollIntoView({behavior:'smooth',block:'center'});
}
function openFilters(){
  if(!current)return;setView('explorar');
  $('filters-form').hidden=false;$('filter-budget').value=current.p.presupuesto||'';
  $('filter-days').value=current.p.diasMin!=null?Math.round((current.p.diasMin+current.p.diasMax)/2):'';
  $('filter-stops').value=current.p.maxEsc;
  setTimeout(()=>$('filters-form').scrollIntoView({behavior:'smooth',block:'center'}),0);
}
function renderChat(pending=false){
  $('chat-messages').innerHTML=messages.map(m=>`<div class="chat-message ${m.role==='user'?'user':''}">${esc(m.text)}</div>`).join('')+(pending?'<div class="chat-message"><span class="processing">Comparando tus opciones…</span></div>':'');
  $('chat-messages').scrollTop=$('chat-messages').scrollHeight;
}
function openChat(){if(!current?.r.length)return;$('chat-panel').hidden=false;$('toggle-chat').setAttribute('aria-expanded','true');if(!messages.length){messages.push({role:'assistant',text:'¡Hola! Soy tu copiloto. Puedo comparar estos vuelos, contarte sobre los destinos o cambiar la búsqueda. ¿Qué querés saber?'});renderChat();}}
// Compact list of the current results that the copilot is allowed to talk about.
function flightContext(){
  return [...current.r].sort((a,b)=>b.score-a.score).slice(0,24).map(({f,score})=>({destino:f.dest.c,pais:COUNTRIES[f.dest.k]||'',origen:ORIGENES[f.origen],
    aerolinea:f.aero,precio:f.precio,escalas:f.esc,horas:f.horas,dias:f.dias,fecha:`${f.anio}-${String(f.mes+1).padStart(2,'0')}-${String(f.dia).padStart(2,'0')}`,fuente:f.fuente,puntaje:score}));
}
// Returns the copilot's reply, or null when the AI is unavailable (then the rule engine answers).
async function copilotReply(){
  let res;
  try{res=await pedirIA({modo:'copiloto',mensajes:messages.slice(-12),resumen:current.p.resumen,vuelos:flightContext()},30000);}catch{return null;}
  let text=res.respuesta;
  if(res.nuevaBusqueda){
    const n=perfilDesde(combinarIA(leer(''),res.nuevaBusqueda));
    if(!n.origenes.length&&!n.origenAbierto){n.origenes=[...current.p.origenes];n.origenAbierto=current.p.origenAbierto;}
    n.resumen=resumir(n);
    const datos=await obtenerVuelos(n);const r=buscarVuelos(n,poolDe(datos));
    if(!r.length)text+=' Con esos cambios no encontré vuelos, así que mantuve la búsqueda anterior. Probemos con otras fechas o un presupuesto más amplio.';
    else{
      const result=decidir(n,r);current={p:n,r,...result,datos,txt:current.txt,preview:false};showAll=false;renderResults();
      const best=result.lista[0].f;text+=` La mejor opción ahora es ${ruta(best)} por ${money(best.precio)}${best.fuente==='real'?'':' (vuelo simulado)'}.`;
    }
  }
  return text;
}
async function sendChat(text){
  if(!text.trim()||chatBusy||searchBusy||!current?.r.length)return;
  openChat();chatBusy=true;$('chat-send').disabled=true;$('chat-input').value='';
  messages.push({role:'user',text:text.trim()});renderChat(true);
  try{
    // The AI copilot answers first; the rule-based assistant takes over if it is unavailable.
    let response=await copilotReply();
    if(response===null){
    const t=normalizar(text);const question=esPregunta(t,text);
    response=charlaSocial(t);if(!response&&question)response=consulta(text,current);
    if(!response){
      const {n,cambios}=ajustar(current.p,text,current);
      if(cambios.length){
        const datos=await obtenerVuelos(n);const r=buscarVuelos(n,poolDe(datos));
        if(!r.length)response=`Con ese cambio (${juntar(cambios)}) no encontré vuelos. Mantuve tu búsqueda anterior. Probemos con otras fechas o un presupuesto más amplio.`;
        else{
          const result=decidir(n,r);current={p:n,r,...result,datos,txt:current.txt+'\n'+text,preview:false};showAll=false;
          renderResults();response=`Listo: ${juntar(cambios)}. La mejor opción es ${ruta(result.lista[0].f)} por ${money(result.lista[0].f.precio)}.`;
        }
      }else response=question?explicarPregunta(text,current):noEntendi(text);
    }
    }
    await pausa(350);messages.push({role:'assistant',text:response});
  }catch{messages.push({role:'assistant',text:'No pude procesar ese ajuste. Probá indicando el destino, el presupuesto o las escalas que preferís.'});}
  finally{chatBusy=false;$('chat-send').disabled=false;renderChat();}
}
function findFlight(id){return current?.r.find(x=>String(x.f.id)===id)||state.bookmarks.find(x=>String(x.f.id)===id)||state.alerts.find(a=>String(a.flight?.f.id)===id)?.flight;}
function showDialog(html){$('dialog-content').innerHTML=html;if(!$('detail-dialog').open)$('detail-dialog').showModal();}
function closeDialog(){$('detail-dialog').close();dialogFlight=null;watchDraft=null;}
function showFlight(id,selected=null){
  const x=selected||findFlight(id);if(!x)return;dialogFlight=x;
  const f=x.f;const safeLink=/^https:\/\/www\.aviasales\.com\//.test(f.link||'');
  const saved=state.bookmarks.some(b=>b.f.id===f.id);
  showDialog(`<div class="dialog-hero">${photo(f)}</div><div class="dialog-content"><p class="eyebrow">${f.fuente==='real'?'PRECIO ENCONTRADO EN AVIASALES':'VUELO DE DEMOSTRACIÓN'} · ${x.score}/100</p><h2>${esc(ORIGENES[f.origen])} → ${esc(f.dest.c)}</h2><p>${esc(x.explicacion||cardReason(x,current?.p||{}))}</p><dl class="dialog-details"><div><dt>Ida y vuelta</dt><dd>${money(f.precio)}</dd></div><div><dt>Salida</dt><dd>${fecha(f)}</dd></div><div><dt>Estadía</dt><dd>${f.dias} días</dd></div><div><dt>Duración de la ida</dt><dd>${f.horas} h · ${escTxt(f)}</dd></div><div><dt>Aerolínea</dt><dd>${esc(f.aero)}</dd></div><div><dt>Ruta</dt><dd>${esc(f.origen)} → ${esc(f.dest.k)}</dd></div></dl><ul class="reasons-list">${(x.razones||[]).map(([ok,t])=>`<li class="${ok?'':'negative'}">${icon(ok?'check':'minus')}<span>${esc(t)}</span></li>`).join('')}</ul><p class="dialog-note">${f.fuente==='real'?'Es un precio encontrado previamente, sujeto a cambios. Confirmá disponibilidad, equipaje y condiciones en Aviasales.':'Este vuelo y su precio son simulados para la demo de la facultad. No se pueden reservar.'}</p><div class="dialog-actions">${safeLink?`<a class="button primary" href="${esc(f.link)}" target="_blank" rel="noopener noreferrer">Consultar en Aviasales${icon('external')}</a>`:''}<button class="button ${safeLink?'outline':'primary'}" data-action="bookmark" data-id="${esc(f.id)}">${saved?'Quitar de guardados':'Guardar vuelo'}${icon('bookmark')}</button><button class="button outline" data-action="watch-flight" data-id="${esc(f.id)}">Crear alerta${icon('bell')}</button></div></div>`);
}
function toggleBookmark(id){
  const x=dialogFlight&&String(dialogFlight.f.id)===id?dialogFlight:findFlight(id);if(!x)return;const index=state.bookmarks.findIndex(b=>String(b.f.id)===id);
  if(index>=0){state.bookmarks.splice(index,1);toast('Vuelo quitado de tus guardados.');}else{state.bookmarks.unshift(JSON.parse(JSON.stringify(x)));toast('Vuelo guardado en Mis búsquedas.');}
  saveState();renderResults();renderSaved();if($('detail-dialog').open&&dialogFlight)showFlight(id,dialogFlight);
}
function watchName(w){const dest=w.p.ciudades?.length?juntar(w.p.ciudades):w.p.regiones?.length?juntar(w.p.regiones.map(r=>REGION_NOMBRE[r])):'Cualquier destino';const origin=w.p.origenes?.length?juntar(w.p.origenes.map(o=>ORIGENES[o])):'Cualquier salida';return `${origin} → ${dest}`;}
function watchSubtitle(w){const month=w.p.meses.length?w.p.meses.map(m=>MESES[m][0].toUpperCase()+MESES[m].slice(1)).join(' / '):'Fechas flexibles';return month+(w.target?' · Hasta '+money(w.target):' · Mejor oportunidad');}
function watchVisual(w){const city=w.p.ciudades?.[0];const f=w.best?.f||{dest:DESTINOS.find(d=>d.c===city)||DESTINOS[3]};return `<div class="watch-thumb">${photo(f,true)}</div>`;}
function sampleWatches(){return [{key:'LIS',price:850},{key:'MAD',price:900}].map(({key,price})=>{const p=demoProfile();p.ciudades=[DESTINOS.find(d=>d.k===key).c];p.regiones=[];return {id:'example-'+key,p,target:price,enabled:false,example:true};});}
function watchRow(w){
  return `<div class="watch-row">${watchVisual(w)}<div class="watch-copy"><h3>${esc(watchName(w))}</h3><p>${esc(watchSubtitle(w))}</p></div><span class="watch-status"><span class="status-dot ${!w.enabled?'paused':''}"></span>${w.example?'Ejemplo':w.enabled?'Siguiendo':'Pausada'}</span><button class="switch" role="switch" aria-checked="${!!w.enabled}" aria-label="${w.enabled?'Pausar':'Activar'} búsqueda ${esc(watchName(w))}" data-action="toggle-watch" data-id="${esc(w.id)}"></button></div>`;
}
function renderWatchPreview(){
  $('watch-preview').innerHTML=(state.watches.length?state.watches.slice(0,2):sampleWatches()).map(watchRow).join('');
  updateCounts();renderOpportunity();
}
function renderSaved(){
  $('saved-searches').innerHTML=state.watches.length?state.watches.map(w=>`<article class="saved-item"><div class="saved-item-top"><div><h3>${esc(watchName(w))}</h3><p>${esc(watchSubtitle(w))}</p></div><button class="switch" role="switch" aria-checked="${!!w.enabled}" aria-label="${w.enabled?'Pausar':'Activar'} búsqueda ${esc(watchName(w))}" data-action="toggle-watch" data-id="${esc(w.id)}"></button></div><div class="saved-meta"><span>${w.enabled?'Siguiendo en esta sesión':'Pausada'}</span><span>${w.source==='real'?'Precios de Aviasales':'Precios simulados'}</span>${w.best?`<span>Mejor ahora: ${money(w.best.f.precio)} · ${w.best.score}/100</span>`:''}</div><div class="saved-item-actions"><button class="button outline small" data-action="open-watch" data-id="${esc(w.id)}">Ver resultados${icon('arrow')}</button><button class="button outline small" data-action="refresh-watch" data-id="${esc(w.id)}">Revisar${icon('refresh')}</button><button class="text-link" data-action="remove-watch" data-id="${esc(w.id)}" aria-label="Eliminar búsqueda ${esc(watchName(w))}">Eliminar</button></div></article>`).join(''):emptyState('El próximo viaje empieza acá.','Guardá una búsqueda para comparar oportunidades y recibir alertas mientras usás la app.');
  $('bookmarks-grid').innerHTML=state.bookmarks.length?state.bookmarks.map(x=>flightCard(x)).join(''):emptyState('Todavía no guardaste vuelos.','Tocá el marcador de una opción que te guste. La vas a encontrar acá.',null,'','bookmark');
}
function openWatchDialog(x=null,preset=null){
  if(!current)return;
  const p=JSON.parse(JSON.stringify(preset||current.p));
  if(x){p.ciudades=[x.f.dest.c];p.regiones=[];p.origenes=[x.f.origen];p.meses=[x.f.mes];p.destinoLibre=false;}
  p.resumen=resumir(p);watchDraft={p,txt:current.txt,source:current.datos.fuente};dialogFlight=null;
  showDialog(`<div class="dialog-content"><p class="eyebrow">QUE NO SE TE ESCAPE</p><h2>Creá tu alerta.</h2><p class="watch-dialog-copy">${esc(watchName({p}))}</p><form class="dialog-form" id="watch-form"><label for="watch-target">Avisame cuando el precio sea de hasta (USD)<input id="watch-target" type="number" min="50" max="100000" step="1" value="${x?.f.precio||p.presupuesto||1000}" required></label><p class="dialog-note">La búsqueda se guarda en este navegador y se revisa mientras tenés la app abierta. En modo demo, los precios son simulados.</p><button class="button primary" type="submit">Activar mi radar${icon('bell')}</button></form></div>`);
}
async function createWatch(p,target,txt,source){
  const duplicate=state.watches.find(w=>JSON.stringify(w.p)===JSON.stringify(p)&&w.target===target);
  if(duplicate){duplicate.enabled=true;saveState();renderWatchPreview();renderSaved();toast('Esta búsqueda ya estaba guardada. El radar está activo.');return;}
  const w={id:crypto.randomUUID?.()||String(Date.now()),p:JSON.parse(JSON.stringify(p)),target,txt,source,enabled:true,history:[],createdAt:Date.now(),seen:[]};
  state.watches.unshift(w);saveState();renderWatchPreview();renderSaved();toast('Tu radar está activo. Te avisamos acá cuando aparezca una oportunidad.');
  await checkWatch(w,false);saveState();renderWatchPreview();renderSaved();
}
async function checkWatch(w,force=false){
  if(!w.enabled)return;
  const datos=await obtenerVuelos(w.p,force);const r=buscarVuelos(w.p,datos.vuelos);const best=r[0];
  w.source=datos.fuente;w.checkedAt=Date.now();
  if(!best){w.best=null;return;}
  const previous=w.best;
  w.history=(w.history||[]).filter(h=>h.source===datos.fuente&&h.id===best.f.id);
  if(!w.history.length||w.history.at(-1).price!==best.f.precio)w.history.push({price:best.f.precio,at:Date.now(),id:best.f.id,source:datos.fuente});
  w.history=w.history.slice(-24);w.best=JSON.parse(JSON.stringify(best));
  const qualifies=w.target?best.f.precio<=w.target:best.score>=80;
  const key=`${datos.fuente}:${best.f.id}:${best.f.precio}`;
  if(qualifies&&!(w.seen||[]).includes(key)){
    w.seen=[...(w.seen||[]),key].slice(-80);
    const previousPrice=previous?.f.id===best.f.id&&previous.f.fuente===best.f.fuente?previous.f.precio:null;
    const drop=previousPrice&&previousPrice>best.f.precio?previousPrice-best.f.precio:0;
    const alert={id:crypto.randomUUID?.()||String(Date.now()+Math.random()),watchId:w.id,title:drop?`${best.f.dest.c} bajó de precio.`:`Una oportunidad para ${best.f.dest.c}.`,body:`${ruta(best.f)} por ${money(best.f.precio)}. ${escTxt(best.f)}, ${best.f.dias} días de viaje y ${best.score}/100 de compatibilidad.`,flight:JSON.parse(JSON.stringify(best)),previousPrice:drop?previousPrice:null,source:datos.fuente,read:false,createdAt:Date.now(),history:[...w.history]};
    state.alerts.unshift(alert);state.alerts=state.alerts.slice(0,100);toast((datos.fuente==='sim'?'Demo: ':'')+alert.title);
  }
}
async function refreshWatches(ids=null,simulate=false){
  if(monitorBusy)return;monitorBusy=true;$('refresh-all').disabled=true;$('simulate').disabled=true;
  try{
    if(simulate){const pools=new Set([VUELOS_SIM,...Object.values(CACHE).filter(c=>c.fuente==='sim').map(c=>c.vuelos)]);const seen=new Set();for(const pool of pools)for(const f of pool){if(f.fuente!=='sim'||seen.has(f))continue;seen.add(f);if(Math.random()<.55)f.precio=Math.max(Math.round(f.base*.55),Math.round(f.precio*(.88+Math.random()*.19)));}}
    const watches=state.watches.filter(w=>w.enabled&&(!ids||ids.includes(String(w.id))));
    for(const w of watches){if(simulate&&w.source==='real')continue;await checkWatch(w,!simulate);}
    saveState();renderWatchPreview();renderSaved();renderAlerts();
    if(simulate){toast('Simulación actualizada. Los precios reales no se modificaron.');if(current?.datos.fuente==="sim"||current?.datos.simulados){const r=buscarVuelos(current.p,poolDe(current.datos));if(r.length)current={...current,r,...decidir(current.p,r)};renderResults();}}
    else if(ids)toast('Búsqueda revisada.');
  }catch{toast('No pudimos revisar el radar. Volvé a intentar en un momento.');}
  finally{monitorBusy=false;$('refresh-all').disabled=false;$('simulate').disabled=false;}
}
function priceChart(history){
  if(history.length<2)return '<div class="chart-empty">La evolución del precio aparecerá después de las próximas revisiones.</div>';
  const prices=history.map(h=>h.price);const max=Math.max(...prices);const min=Math.min(...prices);const range=Math.max(20,max-min);
  const pts=prices.map((p,i)=>[47+i*290/(prices.length-1),9+(max-p)*66/range]);
  const line=pts.map(([x,y])=>`${x},${y}`).join(' ');const last=pts.at(-1);
  const grid=[0,.5,1].map(r=>{const y=9+r*66;return `<text x="0" y="${y+3}" fill="#d5e3cf" font-size="9">${money(max-r*range)}</text><path d="M47 ${y}H337" stroke="#b7ccaa" stroke-opacity=".35" stroke-dasharray="2 4"/>`;}).join('');
  return `<div class="price-chart"><svg viewBox="0 0 344 86" role="img" aria-label="Evolución del precio: de ${money(prices[0])} a ${money(prices.at(-1))}">${grid}<polygon points="47,82 ${line} 337,82" fill="#d9f594" fill-opacity=".09"/><polyline points="${line}" fill="none" stroke="#d9f594" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${last[0]}" cy="${last[1]}" r="4.5" fill="#d9f594"/></svg></div>`;
}
function renderOpportunity(){
  const a=state.alerts.find(x=>x.flight);const f=a?.flight.f||VUELOS_PORTADA[0];
  const previous=a?a.previousPrice:920;const history=a?a.history||[]:[920,912,885,892,868,872,849,839,820,801,780].map(price=>({price}));
  $('opportunity').innerHTML=`<div class="opportunity-label">${icon('bell')}${a?(a.source==='sim'?'OPORTUNIDAD · DEMO':'NUEVA OPORTUNIDAD'):'EJEMPLO DE ALERTA'}</div><h3>${esc(a?.title||'Lisboa bajó de precio.')}</h3><p>${esc(ruta(f))}</p><div class="opportunity-price">${previous?`<del>${money(previous)}</del>`:''}<strong>${money(f.precio)}</strong>${previous?`<span class="drop-badge">Bajó ${money(previous-f.precio)}</span>`:''}</div>${priceChart(history)}<button class="text-link" data-action="${a?'alert-detail':'example-alert'}" ${a?`data-id="${esc(a.id)}"`:''}>${a?'Ver oportunidad':'Ver cómo funciona'}${icon('external')}</button>`;
}
function renderAlerts(){
  const alerts=state.alerts.filter(a=>alertFilter!=='unread'||!a.read);
  $('alerts-list').innerHTML=alerts.length?alerts.map(a=>`<article class="alert-item ${a.read?'':'unread'}"><span class="alert-icon">${icon('bell')}</span><div><h3>${esc(a.title||'Oportunidad encontrada')}</h3><p>${esc(a.body||a.msg||'')}</p><time datetime="${new Date(a.createdAt).toISOString()}">${new Date(a.createdAt).toLocaleString('es-AR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} · ${a.source==='real'?'Precios de Aviasales':'Precios simulados'}</time><button class="text-link" data-action="alert-detail" data-id="${esc(a.id)}">${a.flight?'Ver oportunidad':'Marcar como leída'}${icon('arrow')}</button></div></article>`).join(''):emptyState(alertFilter==='unread'?'Estás al día.':'Tu próxima oportunidad está en camino.',alertFilter==='unread'?'No tenés alertas sin leer.':'Activá una búsqueda. Te avisaremos acá cuando un vuelo alcance el precio que elegiste.','go-watches','Ver mis búsquedas','bell');
  updateCounts();
}
function infoDialog(kind){
  const pages={
    help:['Un radar para tu próximo viaje.','Escribí dónde te gustaría viajar, en qué mes, por cuántos días y cuánto querés gastar. Radar compara las opciones según precio, escalas y duración.','Podés ajustar la búsqueda desde el asistente, guardar vuelos con el marcador o crear una alerta con tu precio objetivo.','Esta es una aplicación académica con un agente basado en reglas y utilidad. Cuando no hay una fuente de precios disponible, usa vuelos de demostración. Las imágenes de destinos fueron generadas con IA.'],
    privacy:['Tus viajes, en tu navegador.','Las búsquedas, los vuelos guardados y las alertas se almacenan localmente en este navegador. No necesitás una cuenta.','Al consultar precios, se envían al servidor los códigos de origen, destino y mes. La clave del proveedor permanece en el servidor. Las tipografías se cargan desde Google Fonts.','Podés quitar una búsqueda desde Mis búsquedas o eliminar todos los datos locales desde este panel.'],
    profile:['Tu espacio personal.','Tus búsquedas, tus vuelos favoritos y tus alertas quedan guardados en este navegador.','No hace falta crear una cuenta para usar la demo. El seguimiento funciona mientras la página permanece abierta.'],
    example:['Así funciona tu radar.','El panel muestra una alerta ilustrativa: un vuelo a Lisboa pasa de US$ 920 a US$ 780. Es un ejemplo de demostración.','Creá una alerta con tu precio máximo. Las alertas de tus propias búsquedas aparecerán cuando el precio quede dentro de ese límite.','En Mis búsquedas podés revisar los precios o simular cambios para probar el funcionamiento del trabajo práctico.']
  };
  const content=pages[kind]||pages.help;
  showDialog(`<div class="dialog-content"><p class="eyebrow">RADAR DE VUELOS</p><h2>${content[0]}</h2>${content.slice(1).map(p=>`<p>${p}</p>`).join('')}${kind==='privacy'?'<div class="dialog-actions"><button class="button outline danger" data-action="confirm-clear">Eliminar mis datos locales</button></div>':''}</div>`);
}
function resizeQuery(){$('query').style.height='auto';$('query').style.height=Math.min($('query').scrollHeight,132)+'px';}
function startVoice(){
  const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Speech){toast('Tu navegador no ofrece dictado. Podés escribir el viaje en el buscador.');return;}
  const recognition=new Speech();recognition.lang='es-AR';recognition.interimResults=false;
  recognition.onresult=e=>{$('query').value=e.results[0][0].transcript;resizeQuery();};
  recognition.onerror=()=>toast('No se pudo usar el micrófono. Podés escribir tu viaje.');
  recognition.onend=()=>{$('voice-button').disabled=false;};
  try{recognition.start();$('voice-button').disabled=true;toast('Te escucho. Contame el viaje que tenés en mente.');}catch{toast('No se pudo iniciar el dictado.');}
}

// All interactive controls use one delegated handler, including newly rendered results.
document.addEventListener('click',async event=>{
  const nav=event.target.closest('a[href="#explorar"],a[href="#busquedas"],a[href="#alertas"]');if(nav){event.preventDefault();setView(nav.getAttribute('href').slice(1));return;}
  const prompt=event.target.closest('[data-prompt]');if(prompt){await sendChat(prompt.dataset.prompt);return;}
  const answer=event.target.closest('[data-answer]');if(answer){$('answer-'+answer.dataset.answer).value=answer.dataset.value;return;}
  const filter=event.target.closest('[data-alert-filter]');if(filter){alertFilter=filter.dataset.alertFilter;document.querySelectorAll('[data-alert-filter]').forEach(b=>{const on=b===filter;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});renderAlerts();return;}
  const button=event.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action,id=button.dataset.id;
  if(action==='flight')showFlight(id);
  else if(action==='bookmark')toggleBookmark(id);
  else if(action==='close-dialog')closeDialog();
  else if(action==='notifications')setView('alertas');
  else if(action==='go-watches')setView('busquedas');
  else if(action==='new-search'){setView('explorar');setTimeout(()=>{$('query').focus();$('query').select();},0);}
  else if(action==='profile'||action==='help'||action==='privacy')infoDialog(action);
  else if(action==='example-alert')infoDialog('example');
  else if(action==='show-all'){if(current.preview){await executeSearch(current.p,current.txt);showAll=true;}else showAll=!showAll;renderResults();}
  else if(action==='edit-filters')openFilters();
  else if(action==='close-filters')$('filters-form').hidden=true;
  else if(action==='retry')executeSearch(await parseSearchIA($('query').value),$('query').value);
  else if(action==='toggle-chat'){if($('chat-panel').hidden){openChat();$('chat-input').focus();}else{$('chat-panel').hidden=true;$('toggle-chat').setAttribute('aria-expanded','false');}}
  else if(action==='voice')startVoice();
  else if(action==='skip-questions'&&clarification){const c=clarification;clarification=null;await executeSearch(c.p,c.text);}
  else if(action==='create-watch')openWatchDialog();
  else if(action==='watch-flight')openWatchDialog(findFlight(id));
  else if(action==='toggle-watch'){
    if(id.startsWith('example-')){const w=sampleWatches().find(s=>s.id===id);openWatchDialog(null,w.p);$('watch-target').value=w.target;}
    else{const w=state.watches.find(s=>String(s.id)===id);if(w){w.enabled=!w.enabled;saveState();renderWatchPreview();renderSaved();toast(w.enabled?'Radar activado.':'Búsqueda pausada.');}}
  }else if(action==='open-watch'){
    const w=state.watches.find(s=>String(s.id)===id);if(w){setView('explorar');$('query').value=w.p.resumen||w.txt;resizeQuery();await executeSearch(JSON.parse(JSON.stringify(w.p)),w.txt);}
  }else if(action==='refresh-watch')await refreshWatches([id]);
  else if(action==='refresh-all')await refreshWatches();
  else if(action==='simulate')await refreshWatches(null,true);
  else if(action==='remove-watch'){
    const index=state.watches.findIndex(w=>String(w.id)===id);if(index>=0){state.watches.splice(index,1);saveState();renderWatchPreview();renderSaved();toast('Búsqueda eliminada.');}
  }else if(action==='read-all'){state.alerts.forEach(a=>a.read=true);saveState();renderAlerts();toast('Todas las alertas están marcadas como leídas.');}
  else if(action==='alert-detail'){
    const a=state.alerts.find(x=>String(x.id)===id);if(a){a.read=true;saveState();renderAlerts();if(a.flight)showFlight(String(a.flight.f.id),a.flight);}
  }else if(action==='confirm-clear'){
    showDialog('<div class="dialog-content"><h2>¿Borrar tus datos de este navegador?</h2><p>Se eliminarán tus búsquedas, vuelos guardados y alertas locales.</p><div class="dialog-actions"><button class="button outline" data-action="close-dialog">Conservar mis datos</button><button class="button outline danger" data-action="clear-data">Sí, borrar datos</button></div></div>');
  }else if(action==='clear-data'){state.watches=[];state.alerts=[];state.bookmarks=[];saveState();try{localStorage.removeItem('rv');}catch{}closeDialog();renderResults();renderWatchPreview();renderSaved();renderAlerts();toast('Datos locales eliminados.');}
});
document.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target;
  if(form.id==='search-form'){
    const text=$('query').value.trim();if(!text){$('search-error').textContent='Contanos primero qué viaje te gustaría hacer.';$('search-error').hidden=false;$('query').focus();return;}
    if(searchBusy||chatBusy)return;
    $('search-button').disabled=true;$('search-button').innerHTML='<span class="processing">Entendiendo tu viaje</span>';
    let p;try{p=await parseSearchIA(text);}finally{$('search-button').disabled=false;$('search-button').innerHTML='<span>Encontrar vuelos</span>'+icon('arrow');}
    await executeSearch(p,text,{ask:true});
    // Bring the search answer or clarification directly into view.
    const target=$('clarifications').hidden?$('recommendations'):$('clarifications');
    target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  }else if(form.id==='chat-form')await sendChat($('chat-input').value);
  else if(form.id==='filters-form'){
    if(!current)return;const p=JSON.parse(JSON.stringify(current.p));p.presupuesto=$('filter-budget').value?Number($('filter-budget').value):null;p.sinLimite=!p.presupuesto;
    p.diasMin=p.diasMax=$('filter-days').value?Number($('filter-days').value):null;p.maxEsc=Number($('filter-stops').value);p.resumen=resumir(p);
    await executeSearch(p,current.txt,{resetChat:false});
  }else if(form.id==='clarification-form'&&clarification){
    const c=clarification;const answers=c.qs.map((q,i)=>$('answer-'+i).value.trim()).filter(Boolean);
    if(!answers.length){toast('Elegí una respuesta o buscá con los datos que tenemos.');return;}
    const text=c.text+'\nAclaraciones: '+answers.join('. ')+'.';clarification=null;const p=await parseSearchIA(text);await executeSearch(p,text);
  }else if(form.id==='watch-form'&&watchDraft){
    const draft=watchDraft;const target=Number($('watch-target').value);if(target<50||target>100000)return;closeDialog();await createWatch(draft.p,target,draft.txt,draft.source);
  }
});
$('sort').addEventListener('change',()=>{showAll=false;renderResults();});
$('query').addEventListener('input',resizeQuery);
$('query').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();$('search-form').requestSubmit();}});
$('detail-dialog').addEventListener('click',event=>{if(event.target===$('detail-dialog')){const r=$('detail-dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog();}});
document.addEventListener('radar:destination',async event=>{
  const airport=globalThis.RADAR_AIRPORTS?.[event.detail?.code];
  if(!airport||searchBusy||chatBusy)return;
  const code=event.detail.code;
  const p=JSON.parse(JSON.stringify(current?.p||parseSearch($('query').value)));
  p.ciudades=[airport.city];p.regiones=[];p.excluir=(p.excluir||[]).filter(city=>city!==airport.city);p.interes=null;p.destinoLibre=false;
  // The origin remains the user's departure city, not the illustrative flight's origin.
  const chosenOrigin=$('origin').value;
  p.origenes=chosenOrigin?[chosenOrigin]:[];p.origenAbierto=!chosenOrigin;
  if(chosenOrigin===code){p.origenes=[code==='EZE'?'ROS':'EZE'];p.origenAbierto=false;}
  if($('month').value!=='')p.meses=[Number($('month').value)];
  if(p.origenes.length===1)$('origin').value=p.origenes[0];
  p.resumen=resumir(p);
  const parts=[`Quiero viajar a ${airport.city}`];
  if(p.origenes.length===1)parts.push(`desde ${ORIGENES[p.origenes[0]]}`);
  if(p.meses.length)parts.push(`en ${p.meses.map(m=>MESES[m]).join(' o ')}`);
  if(p.presupuesto)parts.push(`hasta US$ ${p.presupuesto}`);
  if(p.diasMin!=null)parts.push(p.diasMin===p.diasMax?`por ${p.diasMin} días`:`entre ${p.diasMin} y ${p.diasMax} días`);
  if(p.maxEsc===0)parts.push('sin escalas');
  const text=parts.join(', ')+'.';$('query').value=text;resizeQuery();
  setView('explorar');$('query').focus({preventScroll:true});
  await executeSearch(p,text);
  $('recommendations').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
});
window.addEventListener('hashchange',navigate);
window.addEventListener('resize',resizeQuery);
MESES.forEach((m,i)=>{const option=document.createElement('option');option.value=i;option.textContent=m[0].toUpperCase()+m.slice(1)+' '+anioDe(i);$('month').append(option);});
hydrateIcons();initPreview();renderWatchPreview();renderSaved();renderAlerts();navigate();resizeQuery();
// Session-only monitoring; no claim of background delivery after the browser closes.
setInterval(()=>{if(!document.hidden&&state.watches.some(w=>w.enabled))refreshWatches();},120000);
