import {mirrorTime,forwardTime,progress} from './hotel-playback.js';

const section=document.getElementById('hotel');
if(section){
 const stage=document.getElementById('hotel-stage');
 const video=document.getElementById('hotel-video');
 const poster=document.getElementById('hotel-poster');
 const hold=document.getElementById('hotel-hold');
 const overlay=document.getElementById('hotel-hotspots');
 const floorPicker=document.getElementById('hotel-floor-picker');
 const primary=document.getElementById('hotel-primary');
 const pause=document.getElementById('hotel-pause');
 const back=document.getElementById('hotel-back');
 const title=document.getElementById('hotel-caption-title');
 const description=document.getElementById('hotel-caption-description');
 const step=document.getElementById('hotel-step');
 const status=document.getElementById('hotel-status');
 const bar=document.getElementById('hotel-progress-fill');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const coarse=matchMedia('(hover: none)');
 const listeners=new AbortController();
 const listen=(el,type,fn,options={})=>el.addEventListener(type,fn,{...options,signal:listeners.signal});
 const ns='http://www.w3.org/2000/svg';
 let config,loading,phase='overview',selected=5,frameId=0,stopAt=0,onStop=null,seeking=false,disposed=false;
 let lastFrameTime=0;
 let activeFloor=null;

 function svg(tag,attrs){const node=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);return node;}
 function announce(text){status.textContent=text;}
 function highlight(floor){
  activeFloor=floor;
  overlay.querySelectorAll('[data-floor]').forEach(el=>el.classList.toggle('is-active',Number(el.dataset.floor)===floor));
  floorPicker.querySelectorAll('button').forEach(el=>el.classList.toggle('is-active',Number(el.dataset.floor)===floor));
 }
 function hotspots(){
  overlay.replaceChildren();if(!config)return;
  overlay.setAttribute('viewBox',`0 0 ${config.width} ${config.height}`);
  if(phase==='overview'){
   const shape=svg('polygon',{points:config.outline.map(p=>p.join(',')).join(' '),'aria-hidden':'true'});
   listen(shape,'pointerenter',()=>{if(!coarse.matches&&!reduced.matches)approach();});
   listen(shape,'click',approach);overlay.append(shape);
  }else if(phase==='floors'){
   for(const floor of config.floors){
    const shape=svg('polygon',{points:floor.points.map(p=>p.join(',')).join(' '),class:'hotel-floor-hit','data-floor':floor.floor,tabindex:'0',role:'button','aria-label':`Piso ${floor.floor}. Entrar a la suite modelo`});
    listen(shape,'pointerenter',()=>highlight(floor.floor));listen(shape,'focus',()=>highlight(floor.floor));
    listen(shape,'click',()=>enter(floor.floor));listen(shape,'keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();enter(floor.floor);}});
    overlay.append(shape);
    const x=Math.max(58,floor.points[0][0]-72),y=Math.max(24,Math.min(config.height-24,(floor.points[0][1]+floor.points[1][1])/2));
    overlay.append(svg('rect',{x:x-7,y:y-13,width:65,height:26,rx:13,class:'hotel-floor-label'}));
    const label=svg('text',{x,y:y+5});label.textContent=`Piso ${floor.floor}`;overlay.append(label);
   }
  }
 }
 function state(next){
  phase=next;stage.dataset.state=next;hotspots();
  const touring=['entering','tour','returning'].includes(next);
  floorPicker.hidden=['overview','approaching','error'].includes(next);primary.hidden=next!=='overview';
  floorPicker.querySelectorAll('button').forEach(button=>{button.disabled=next!=='floors';button.setAttribute('aria-pressed',String(Number(button.dataset.floor)===selected&&next!=='floors'));});
  back.hidden=['overview','loading','error'].includes(next);back.disabled=next==='approaching'||next==='returning';
  back.textContent=next==='floors'?'Vista general ↗':'Volver al hotel ↗';
  pause.hidden=!touring&&next!=='approaching';
  if(next==='overview'){step.textContent='01 / LA CIUDAD';title.textContent='Tu próxima estadía, de cerca.';description.textContent=(coarse.matches||matchMedia('(max-width:700px)').matches)?'Tocá el hotel para acercarte.':'Pasá el mouse sobre el hotel para acercarte.';primary.textContent='Conocer el hotel ↗';bar.style.width='0%';}
  if(next==='approaching'){step.textContent='02 / EL HOTEL';title.textContent='Un lugar entre mil destinos.';description.textContent='Acercándonos a Torre Urbana…';}
  if(next==='floors'){step.textContent='02 / ELEGÍ UN PISO';title.textContent='Una ventana a tu próximo viaje.';description.textContent='Elegí un piso para recorrer la suite.';bar.style.width='0%';announce('Hotel listo. Elegí cualquiera de los diez pisos para entrar a la suite modelo.');}
  if(next==='entering'){step.textContent=`03 / PISO ${selected}`;title.textContent='Bienvenido a tu próxima pausa.';description.textContent='La ciudad queda del otro lado.';announce(`Piso ${selected}. Iniciando el recorrido de la suite modelo.`);}
  if(next==='tour'){step.textContent='04 / LA SUITE';title.textContent='Imaginá despertar acá.';description.textContent='Luz natural. Madera cálida. La ciudad a tus pies.';}
  if(next==='inside'){step.textContent='04 / LA SUITE';title.textContent='Ahora sí, ya te imaginás acá.';description.textContent='Volvé al hotel cuando quieras explorar otra vez.';announce('Recorrido completo. Podés volver al hotel.');}
  if(next==='returning'){step.textContent='DE VUELTA AL HOTEL';title.textContent='Todavía queda mucho por descubrir.';description.textContent='Volvemos por el mismo camino.';}
  syncPause();
 }
 function syncPause(){pause.textContent=video.paused?'▶':'Ⅱ';pause.setAttribute('aria-label',video.paused?'Reanudar recorrido':'Pausar recorrido');pause.setAttribute('aria-pressed',String(video.paused));}
 function fail(){video.pause();poster.hidden=false;hold.hidden=true;state('error');title.textContent='El recorrido no pudo cargarse.';description.textContent='Podés volver a intentarlo.';primary.hidden=false;primary.textContent='Reintentar';primary.disabled=false;stage.setAttribute('aria-busy','false');announce(title.textContent);}
 async function load(){
  if(loading)return loading;
  loading=(async()=>{
   const response=await fetch('./assets/hotel/tour.json');if(!response.ok)throw Error('Hotel manifest unavailable');config=await response.json();
   video.src=matchMedia('(max-width:700px)').matches?config.mobileVideo:config.video;
   video.load();
   await new Promise((resolve,reject)=>{video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',reject,{once:true});});
   if(disposed)return;stage.setAttribute('aria-busy','false');primary.disabled=false;state('overview');
   floorPicker.replaceChildren();const label=document.createElement('span');label.textContent='Elegí tu piso';floorPicker.append(label);
   for(let floor=1;floor<=config.floorCount;floor++){const button=document.createElement('button');button.type='button';button.dataset.floor=floor;button.textContent=floor;button.setAttribute('aria-label',`Piso ${floor}. Recorrer la suite modelo`);listen(button,'click',()=>enter(floor));listen(button,'pointerenter',()=>highlight(floor));listen(button,'focus',()=>highlight(floor));floorPicker.append(button);}
  })().catch(error=>{loading=null;fail();console.warn('Radar: recorrido de hotel no disponible.',error);throw error;});
  return loading;
 }
 function cancelTick(){if(video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(frameId);else cancelAnimationFrame(frameId);frameId=0;}
 function tick(now,metadata){
  frameId=0;
  if(disposed||video.paused)return;
  lastFrameTime=metadata?.mediaTime??Math.floor(video.currentTime*(config?.fps||24))/(config?.fps||24);
  const t=video.currentTime;
  if(phase==='entering'&&t>config.hoverTime+8.5)state('tour');
  if(['entering','tour','returning'].includes(phase))bar.style.width=`${100*progress(forwardTime(t,config.forwardEnd,config.fps),config.hoverTime,config.forwardEnd)}%`;
  if(t>=stopAt-1/config.fps*.45){video.pause();video.currentTime=stopAt;const fn=onStop;onStop=null;fn?.();syncPause();return;}
  frameId=video.requestVideoFrameCallback?video.requestVideoFrameCallback(tick):requestAnimationFrame(tick);
 }
 async function playUntil(time,callback){
  cancelTick();
  stopAt=time;onStop=callback;poster.hidden=true;
  try{await video.play();syncPause();tick();}catch{syncPause();announce('Tocá Reanudar para continuar el recorrido.');}
 }
 async function seekMatching(time){
  if(Math.abs(video.currentTime-time)<.02)return;
  seeking=true;video.pause();cancelTick();
  hold.width=video.videoWidth;hold.height=video.videoHeight;
  const context=hold.getContext('2d');context.drawImage(video,0,0);hold.hidden=false;
  await new Promise(resolve=>{video.addEventListener('seeked',resolve,{once:true});video.currentTime=time;});
  hold.hidden=true;seeking=false;
 }
 async function approach(){
  if(phase!=='overview'||seeking)return;
  try{await load();if(phase!=='overview')return;state('approaching');await seekMatching(0);playUntil(config.hoverTime,()=>state('floors'));}catch{/* load reports failure */}
 }
 async function enter(floor){
  if(phase!=='floors'||seeking)return;
  selected=floor;highlight(floor);state('entering');await seekMatching(config.hoverTime);playUntil(config.forwardEnd,()=>state('inside'));
 }
 async function goBack(){
  if(!config||seeking||['overview','approaching','returning'].includes(phase))return;
  const toOverview=phase==='floors';const current=(phase==='floors'||phase==='inside')?video.currentTime:lastFrameTime;
  state('returning');await seekMatching(current>config.forwardEnd?current:mirrorTime(current,config.forwardEnd,config.fps));
  const end=toOverview?config.totalEnd:mirrorTime(config.hoverTime,config.forwardEnd,config.fps);
  playUntil(end,async()=>{if(toOverview){await seekMatching(0);state('overview');}else state('floors');});
 }
 listen(primary,'click',async()=>{if(phase==='error'){phase='overview';primary.disabled=true;try{await load();}catch{}return;}approach();});
 listen(pause,'click',()=>{if(video.paused)playUntil(stopAt,onStop);else{video.pause();cancelTick();syncPause();}});
 listen(back,'click',goBack);
 listen(section,'keydown',event=>{if(event.key==='Escape'&&!back.hidden&&!back.disabled)goBack();});
 listen(document,'visibilitychange',()=>{if(document.hidden&&!video.paused){video.pause();cancelTick();syncPause();}});
 const observer=new IntersectionObserver(entries=>{if(entries[0].isIntersecting){if(!config)load().catch(()=>{});}else if(!video.paused){video.pause();cancelTick();syncPause();}},{rootMargin:'250px'});
 observer.observe(section);
 listen(window,'pagehide',event=>{video.pause();if(event.persisted)return;disposed=true;observer.disconnect();listeners.abort();if(video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(frameId);else cancelAnimationFrame(frameId);});
 state('overview');
}
