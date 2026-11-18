import {AIRPORT_INFO,FLIGHT_ROUTES} from './globe-routes.js';

export function createWorldUI(section,actions) {
  const $=id=>document.getElementById(id),detail=$('world-detail'),labels=new Map();
  const featured=section.querySelector('.world-routes');
  let selection=null,lastPercent=-1,lastSecond=-1;
  for(const [code,airport] of Object.entries(AIRPORT_INFO).sort((a,b)=>a[1].city.localeCompare(b[1].city,'es'))){
    const option=new Option(`${airport.city} · ${code}`,code);$('world-city-select').add(option);
    const label=document.createElement('button');label.type='button';label.className='world-city-label';label.hidden=true;
    label.setAttribute('aria-label',`Ver aeropuerto de ${airport.city}, ${code}`);label.setAttribute('aria-pressed','false');label.dataset.airport=code;
    const name=document.createElement('span');name.textContent=airport.city;const iata=document.createElement('small');iata.textContent=code;label.append(name,iata);
    label.addEventListener('click',()=>actions.airport(code));$('world-labels').append(label);labels.set(code,label);
  }
  FLIGHT_ROUTES.forEach(([from,to],index)=>$('world-flight-select').add(new Option(`${AIRPORT_INFO[from].city} → ${AIRPORT_INFO[to].city} · RD${String(index+1).padStart(2,'0')}`,String(index))));
  $('world-city-select').addEventListener('change',event=>{if(event.target.value)actions.airport(event.target.value);});
  $('world-flight-select').addEventListener('change',event=>{if(event.target.value!=='')actions.flight(Number(event.target.value));});
  section.querySelectorAll('[data-world-route]').forEach(button=>button.addEventListener('click',()=>actions.flight(Number(button.dataset.worldRoute))));
  $('world-detail-close').addEventListener('click',()=>actions.clear(true));
  $('world-flight-origin').addEventListener('click',()=>{if(selection?.type==='flight')actions.airport(FLIGHT_ROUTES[selection.index][0]);});
  $('world-flight-destination').addEventListener('click',()=>{if(selection?.type==='flight')actions.airport(FLIGHT_ROUTES[selection.index][1]);});
  $('world-search').addEventListener('click',()=>{
    const code=selection?.type==='airport'?selection.code:selection?.type==='flight'?FLIGHT_ROUTES[selection.index][1]:null;
    if(code){actions.clear();document.dispatchEvent(new CustomEvent('radar:destination',{detail:{code}}));}
  });
  $('world-pause').addEventListener('click',actions.pause);$('world-reset').addEventListener('click',actions.reset);
  $('world-zoom-in').addEventListener('click',()=>actions.zoom(-1));$('world-zoom-out').addEventListener('click',()=>actions.zoom(1));
  section.addEventListener('keydown',event=>{if(event.key==='Escape'&&selection){event.preventDefault();actions.clear(true);}});
  function open(type,title) {
    detail.hidden=false;featured.hidden=true;$('world-detail-title').textContent=title;
    $('world-airport-info').hidden=type!=='airport';$('world-flight-info').hidden=type!=='flight';
    $('world-detail-title').focus({preventScroll:true});
  }
  function syncLabels(){labels.forEach((element,code)=>element.setAttribute('aria-pressed',String(selection?.type==='airport'&&selection.code===code)));}
  return {
    labels,
    get selection(){return selection;},
    announce(text){$('world-announcement').textContent=text;},
    enable(enabled){section.querySelectorAll('[data-world-route],.world-controls button,#world-city-select,#world-flight-select').forEach(el=>el.disabled=!enabled);},
    showAirport(code){
      const airport=AIRPORT_INFO[code];selection={type:'airport',code};
      open('airport',airport.city);$('world-detail-kind').textContent='AEROPUERTO';
      $('world-airport-name').textContent=airport.airport;$('world-airport-country').textContent=airport.country;$('world-airport-code').textContent=code;
      $('world-city-select').value=code;$('world-flight-select').value='';syncLabels();
      $('world-search').setAttribute('aria-label',`Buscar vuelos a ${airport.city}`);this.announce(`${airport.city}, ${airport.country}. ${airport.airport}. Código ${code}.`);
    },
    showFlight(index){
      const [from,to]=FLIGHT_ROUTES[index];selection={type:'flight',index};lastPercent=-1;lastSecond=-1;
      open('flight',`${AIRPORT_INFO[from].city} → ${AIRPORT_INFO[to].city}`);$('world-detail-kind').textContent=`VUELO SIMULADO · RD${String(index+1).padStart(2,'0')}`;
      $('world-flight-origin').textContent=from;$('world-flight-origin').setAttribute('aria-label',`Ver aeropuerto de salida: ${AIRPORT_INFO[from].city}, ${from}`);
      $('world-flight-destination').textContent=to;$('world-flight-destination').setAttribute('aria-label',`Ver aeropuerto de llegada: ${AIRPORT_INFO[to].city}, ${to}`);
      $('world-flight-select').value=String(index);$('world-city-select').value='';syncLabels();
      $('world-search').setAttribute('aria-label',`Buscar vuelos a ${AIRPORT_INFO[to].city}`);this.announce(`Vuelo simulado de ${AIRPORT_INFO[from].city} a ${AIRPORT_INFO[to].city}.`);
    },
    clear(){selection=null;detail.hidden=true;featured.hidden=false;$('world-city-select').value='';$('world-flight-select').value='';syncLabels();},
    updateFlight(phase){
      const percent=Math.floor(phase.progress*100),seconds=Math.ceil(phase.remaining);
      if(percent!==lastPercent){$('world-flight-percent').textContent=`${percent} %`;$('world-progress').setAttribute('aria-valuenow',String(percent));$('world-progress').firstElementChild.style.width=`${percent}%`;lastPercent=percent;}
      if(seconds!==lastSecond){$('world-flight-time').textContent=`${phase.airborne?'Animación · llegada en':'Animación · próxima salida en'} ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;lastSecond=seconds;}
      if($('world-flight-status').textContent!==phase.status)$('world-flight-status').textContent=phase.status;
    },
    pauseState(paused){$('world-pause').setAttribute('aria-pressed',String(paused));$('world-pause').setAttribute('aria-label',paused?'Reanudar animación':'Pausar animación');$('world-pause').title=paused?'Reanudar animación':'Pausar animación';section.dataset.motion=paused?'paused':'running';},
    zoomState(distance,min,max){$('world-zoom-in').disabled=distance<=min+.02;$('world-zoom-out').disabled=distance>=max-.02;},
    tooltip(text,x,y){const el=$('world-tooltip');el.hidden=!text;if(text){el.textContent=text;el.style.transform=`translate(${x}px,${y}px)`;}},
    featured(index){section.querySelectorAll('[data-world-route]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.worldRoute)===index)));}
  };
}
