import * as THREE from './assets/vendor/three.module.js';
import {OrbitControls} from './assets/vendor/OrbitControls.js';
import {AIRPORTS,AIRPORT_INFO,FLIGHT_ROUTES,latLonVector,routePoint,flightDuration,flightPhase,pointVisible} from './globe-routes.js';
import {aircraftGeometries} from './globe-aircraft.js';
import {createWorldUI} from './globe-ui.js';

export class FlightCurve extends THREE.Curve {
  constructor(from,to){super();this.from=from;this.to=to;this.arcLengthDivisions=400;}
  getPoint(t,target=new THREE.Vector3()){return target.set(...routePoint(this.from,this.to,t));}
}

export async function mountWorld(section,stage) {
  const loading=document.getElementById('world-loading');
  const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
  const listeners=[];
  const listen=(target,type,handler,options)=>{target.addEventListener(type,handler,options);listeners.push(()=>target.removeEventListener(type,handler,options));};
  let paused=motionPreference.matches,visible=false,lost=false,disposed=false,dirty=true;
  let elapsed=0,lastFrame=0,raf=0,interactionUntil=0,dragging=false,focus=null,hovered=null,labelFocused=false;
  let homeDistance=3.7,width=1,height=1,lastLabels=0;
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor(0,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
  const canvas=renderer.domElement;
  canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Mundo 3D interactivo con ciudades y vuelos simulados');canvas.setAttribute('aria-describedby','world-keyboard-help');stage.append(canvas);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,30);
  const initialDirection=new THREE.Vector3(...latLonVector(17,-32));camera.position.copy(initialDirection).multiplyScalar(homeDistance);scene.add(camera);
  scene.add(new THREE.AmbientLight(0xffffff,1.25));
  const sun=new THREE.DirectionalLight(0xfff9ee,1.8);sun.position.set(-3,4,5);camera.add(sun);
  const fill=new THREE.DirectionalLight(0xe8f4ff,.55);fill.position.set(3,-1,2);camera.add(fill);
  const controls=new OrbitControls(camera,canvas);
  controls.enablePan=false;controls.enableZoom=true;controls.enableDamping=true;controls.dampingFactor=.085;controls.rotateSpeed=.48;controls.zoomSpeed=.65;
  controls.autoRotateSpeed=.16;controls.minPolarAngle=.12;controls.maxPolarAngle=Math.PI-.12;
  controls.minDistance=2.35;controls.maxDistance=4.25;
  controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:null,RIGHT:null};controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
  // Pinch and +/- zoom. Ordinary wheel scrolling keeps moving the page.
  listen(canvas,'wheel',event=>event.stopImmediatePropagation(),{capture:true,passive:true});controls.update();
  const loader=new THREE.TextureLoader();let textures;
  try { textures=await Promise.all(['earth_day_4096.jpg','earth_surface_4096.jpg','earth_clouds_2048.jpg'].map(name=>loader.loadAsync(new URL(`./assets/earth/${name}`,import.meta.url).href))); }
  catch(error){controls.dispose();renderer.dispose();canvas.remove();listeners.forEach(remove=>remove());throw error;}
  const [day,surface,cloudMap]=textures;day.colorSpace=THREE.SRGBColorSpace;day.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
  const earth=new THREE.Mesh(new THREE.SphereGeometry(1,96,64),new THREE.MeshStandardMaterial({map:day,bumpMap:surface,bumpScale:.022,roughness:.85,metalness:0}));scene.add(earth);
  const clouds=new THREE.Mesh(new THREE.SphereGeometry(1.006,64,40),new THREE.MeshPhongMaterial({color:0xffffff,alphaMap:cloudMap,transparent:true,opacity:.5,alphaTest:.09,depthWrite:false,shininess:1}));scene.add(clouds);
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.015,64,40),new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    vertexShader:'varying vec3 n; varying vec3 p; void main(){vec4 v=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);p=v.xyz;gl_Position=projectionMatrix*v;}',
    fragmentShader:'varying vec3 n; varying vec3 p; void main(){float rim=pow(1.-max(0.,dot(normalize(n),normalize(-p))),4.);gl_FragColor=vec4(.35,.65,.9,rim*.24);}'
  })));
  const dotGeometry=new THREE.SphereGeometry(.007,10,8),dotMaterial=new THREE.MeshBasicMaterial({color:0xe2f5a1});
  const ringGeometry=new THREE.RingGeometry(.013,.016,32),ports=new Map();
  for(const [code,coordinates] of Object.entries(AIRPORTS)){
    const position=new THREE.Vector3(...latLonVector(...coordinates)).multiplyScalar(1.019);
    const dot=new THREE.Mesh(dotGeometry,dotMaterial);dot.position.copy(position);scene.add(dot);
    const pulse=new THREE.Mesh(ringGeometry,new THREE.MeshBasicMaterial({color:0xc6e56c,side:THREE.DoubleSide,transparent:true,depthWrite:false}));
    pulse.position.copy(position);pulse.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),position.clone().normalize());pulse.visible=false;scene.add(pulse);
    ports.set(code,{code,position,dot,pulse,pulseStart:-10,screen:null});
  }
  const routes=FLIGHT_ROUTES.map(([from,to],index)=>{
    const curve=new FlightCurve(AIRPORTS[from],AIRPORTS[to]);curve.updateArcLengths();
    const material=new THREE.MeshBasicMaterial({color:index%3===0?0xb8cf7e:0x91ad62,transparent:true,opacity:.65,depthWrite:false});
    const line=new THREE.Mesh(new THREE.TubeGeometry(curve,120,.0011,4,false),material);scene.add(line);
    const duration=flightDuration(curve.getLength(),index);
    return {from,to,curve,line,duration,offset:((index*.61803398875)%1)*(duration+7),position:new THREE.Vector3(),quaternion:new THREE.Quaternion(),phase:null,screen:null};
  });
  const geometries=aircraftGeometries();
  const materials={white:new THREE.MeshPhongMaterial({color:0xfffdf7,shininess:34}),livery:new THREE.MeshPhongMaterial({color:0x214c40,shininess:25}),glass:new THREE.MeshPhongMaterial({color:0x253d48,shininess:65}),accent:new THREE.MeshPhongMaterial({color:0xc5e56b,shininess:20})};
  const fleet=Object.entries(geometries).map(([key,geometry])=>{const mesh=new THREE.InstancedMesh(geometry,materials[key],routes.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;scene.add(mesh);return mesh;});
  const halo=new THREE.Mesh(new THREE.RingGeometry(.055,.058,48),new THREE.MeshBasicMaterial({color:0xcce77c,side:THREE.DoubleSide,transparent:true,opacity:.8,depthWrite:false}));halo.visible=false;scene.add(halo);
  const object=new THREE.Object3D(),forward=new THREE.Vector3(),radial=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3(),basis=new THREE.Matrix4(),orientation=new THREE.Quaternion();
  const projected=new THREE.Vector3(),cameraArray=[0,0,0];
  const ui=createWorldUI(section,{airport:selectAirport,flight:selectFlight,clear:clearSelection,zoom:zoom,pause:togglePause,reset});

  function flushDamping(){controls.autoRotate=false;const old=controls.enableDamping;controls.enableDamping=false;controls.update();controls.enableDamping=old;}
  function moveCamera(direction,distance=camera.position.length(),duration=800){
    flushDamping();interactionUntil=performance.now()+9000;
    const start=camera.position.clone().normalize(),end=direction.clone().normalize();
    const rotation=new THREE.Quaternion().setFromUnitVectors(start,end);
    const targetDistance=THREE.MathUtils.clamp(distance,controls.minDistance,controls.maxDistance);
    if(motionPreference.matches){camera.position.copy(end).multiplyScalar(targetDistance);controls.update();focus=null;}
    else focus={start,rotation,fromDistance:camera.position.length(),distance:targetDistance,startTime:performance.now(),duration};
    dirty=true;
  }
  function highlight(){
    const selection=ui.selection;
    routes.forEach((route,index)=>{
      const on=selection?.type==='flight'?selection.index===index:selection?.type==='airport'?(route.from===selection.code||route.to===selection.code):index<3;
      route.line.material.color.setHex(on?0xd7ee8b:index%3===0?0xb8cf7e:0x91ad62);route.line.material.opacity=on?.95:selection?.type==='flight'?.28:.6;
    });
    ports.forEach(port=>port.dot.scale.setScalar(selection?.type==='airport'&&port.code===selection.code?1.7:1));
    ui.featured(selection?.type==='flight'?selection.index:-1);dirty=true;
  }
  function selectAirport(code){
    if(!ports.has(code))return;ui.showAirport(code);highlight();moveCamera(ports.get(code).position,Math.min(camera.position.length(),homeDistance));
    ports.get(code).pulseStart=elapsed;ui.tooltip('');
  }
  function selectFlight(index){
    if(!routes[index])return;ui.showFlight(index);highlight();ui.updateFlight(routes[index].phase);
    moveCamera(routes[index].curve.getPointAt(.5),homeDistance);ui.tooltip('');
  }
  function clearSelection(returnFocus=false){ui.clear();highlight();halo.visible=false;interactionUntil=performance.now()+7000;if(returnFocus)canvas.focus({preventScroll:true});dirty=true;}
  function reset(){clearSelection();moveCamera(initialDirection,homeDistance,650);ui.announce('Vista inicial del mundo.');}
  function zoom(direction){moveCamera(camera.position,camera.position.length()*(direction<0?.82:1.22),400);}
  function togglePause(){paused=!paused;ui.pauseState(paused);dirty=true;ui.announce(paused?'Animación pausada. Podés seguir explorando ciudades y vuelos.':'Animación reanudada.');}

  function updateFlights(delta){
    routes.forEach((route,index)=>{
      const phase=flightPhase(elapsed,route.offset,route.duration),previous=route.phase;
      if(previous&&previous.cycle!==phase.cycle)ports.get(route.from).pulseStart=elapsed;
      if(previous?.airborne&&!phase.airborne)ports.get(route.to).pulseStart=elapsed;
      route.curve.getPointAt(phase.progress,route.position);route.curve.getTangentAt(phase.progress,forward);
      radial.copy(route.position).normalize();right.crossVectors(radial,forward).normalize();up.crossVectors(forward,right).normalize();basis.makeBasis(right,up,forward);orientation.setFromRotationMatrix(basis);
      // A stable local frame follows the tangent; damping removes numerical heading chatter.
      if(!previous||previous.cycle!==phase.cycle)route.quaternion.copy(orientation);
      else route.quaternion.slerp(orientation,1-Math.exp(-12*delta));
      object.position.copy(route.position);object.quaternion.copy(route.quaternion);object.scale.setScalar(phase.scale*.97);object.updateMatrix();fleet.forEach(mesh=>mesh.setMatrixAt(index,object.matrix));
      route.phase=phase;
    });
    fleet.forEach(mesh=>mesh.instanceMatrix.needsUpdate=true);clouds.rotation.y=elapsed*.001;
    ports.forEach(port=>{
      const age=elapsed-port.pulseStart;port.pulse.visible=age>=0&&age<2.7;
      if(port.pulse.visible){port.pulse.scale.setScalar(1+age*2.8);port.pulse.material.opacity=(1-age/2.7)*.9;}
    });
  }
  function screenPoint(position){
    if(!pointVisible(position.toArray(),cameraArray))return null;
    projected.copy(position).project(camera);
    if(projected.z>1||projected.x< -1.08||projected.x>1.08||projected.y< -1.08||projected.y>1.08)return null;
    return {x:(projected.x+1)*width/2,y:(1-projected.y)*height/2};
  }
  function updateProjection(now){
    camera.updateMatrixWorld();camera.position.toArray(cameraArray);
    ports.forEach(port=>port.screen=screenPoint(port.position));
    routes.forEach(route=>route.screen=route.phase.scale>.35?screenPoint(route.position):null);
    const selected=ui.selection;
    if(selected?.type==='flight'){
      const route=routes[selected.index];ui.updateFlight(route.phase);halo.visible=!!route.screen&&route.phase.airborne;
      if(halo.visible){halo.position.copy(route.position);halo.quaternion.copy(camera.quaternion);}
    }else halo.visible=false;
    if(now-lastLabels<80&&!dirty)return;lastLabels=now;
    const priority=selected?.type==='airport'?[selected.code]:selected?.type==='flight'?FLIGHT_ROUTES[selected.index]:['EZE','LIS','JFK','CPT','HND','SYD'];
    const ordered=[...ports.values()].sort((a,b)=>{
      const ai=priority.indexOf(a.code),bi=priority.indexOf(b.code);
      return (ai<0?100:ai)-(bi<0?100:bi)||Math.abs((a.screen?.x||0)-width/2)-Math.abs((b.screen?.x||0)-width/2);
    });
    const boxes=[],limit=width<430?4:camera.position.length()<3?9:6;
    const shown=new Set();
    for(const port of ordered){
      if(!port.screen||boxes.length>=limit)continue;
      const label=ui.labels.get(port.code);label.hidden=false;
      const w=label.offsetWidth,h=label.offsetHeight;
      let x=port.screen.x+10,y=port.screen.y-h/2;
      if(x+w>width-7)x=port.screen.x-w-10;
      if(x<6||y<6||y+h>height-6){label.hidden=true;continue;}
      if(boxes.some(b=>x<b.x+b.w+8&&x+w+8>b.x&&y<b.y+b.h+7&&y+h+7>b.y)){label.hidden=true;continue;}
      label.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;boxes.push({x,y,w,h});shown.add(port.code);
    }
    ui.labels.forEach((label,code)=>label.hidden=!shown.has(code));
  }
  function pick(x,y,touch=false){
    const candidates=[];
    routes.forEach((route,index)=>{if(route.screen){const distance=Math.hypot(x-route.screen.x,y-route.screen.y);if(distance<(touch?22:15))candidates.push({type:'flight',index,distance});}});
    ports.forEach(port=>{if(port.screen){const distance=Math.hypot(x-port.screen.x,y-port.screen.y);if(distance<(touch?20:12))candidates.push({type:'airport',code:port.code,distance});}});
    return candidates.sort((a,b)=>a.distance-b.distance)[0]||null;
  }
  const pointers=new Map();let gesture=false;
  listen(document.getElementById('world-labels'),'focusin',()=>labelFocused=true);
  listen(document.getElementById('world-labels'),'focusout',()=>labelFocused=false);
  listen(canvas,'pointerdown',event=>{pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size>1)gesture=true;ui.tooltip('');});
  listen(canvas,'pointermove',event=>{
    if(pointers.size||event.pointerType==='touch')return;
    const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;hovered=pick(x,y);
    canvas.dataset.hover=String(!!hovered);
    const text=hovered?.type==='airport'?`${AIRPORT_INFO[hovered.code].city} · ${hovered.code}`:hovered?.type==='flight'?`${AIRPORT_INFO[routes[hovered.index].from].city} → ${AIRPORT_INFO[routes[hovered.index].to].city} · Simulado`:'';
    ui.tooltip(text,Math.max(6,Math.min(x+12,width-235)),Math.max(6,Math.min(y+18,height-65)));
  });
  listen(canvas,'pointerup',event=>{
    const start=pointers.get(event.pointerId),single=pointers.size===1&&!gesture;pointers.delete(event.pointerId);
    if(single&&start&&Math.hypot(event.clientX-start.x,event.clientY-start.y)<7){
      const rect=canvas.getBoundingClientRect(),hit=pick(event.clientX-rect.left,event.clientY-rect.top,event.pointerType==='touch');
      if(hit?.type==='airport')selectAirport(hit.code);else if(hit?.type==='flight')selectFlight(hit.index);
    }
    if(!pointers.size)gesture=false;
  });
  listen(canvas,'pointercancel',event=>{pointers.delete(event.pointerId);if(!pointers.size)gesture=false;dragging=false;});
  listen(canvas,'pointerleave',()=>{hovered=null;ui.tooltip('');canvas.dataset.hover='false';});
  controls.addEventListener('start',()=>{dragging=true;focus=null;interactionUntil=performance.now()+9000;canvas.focus({preventScroll:true});});
  controls.addEventListener('end',()=>{dragging=false;interactionUntil=performance.now()+9000;});
  controls.addEventListener('change',()=>{dirty=true;});
  listen(canvas,'keydown',event=>{
    if(event.key===' '){event.preventDefault();togglePause();return;}
    if(event.key==='Home'){event.preventDefault();reset();return;}
    if(['+','=','-','_'].includes(event.key)){event.preventDefault();zoom(event.key==='-'||event.key==='_'?1:-1);return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();flushDamping();focus=null;interactionUntil=performance.now()+9000;
    const spherical=new THREE.Spherical().setFromVector3(camera.position);
    spherical.theta+=event.key==='ArrowLeft'?.12:event.key==='ArrowRight'?-.12:0;
    spherical.phi=THREE.MathUtils.clamp(spherical.phi+(event.key==='ArrowUp'?-.1:event.key==='ArrowDown'?.1:0),.12,Math.PI-.12);
    camera.position.setFromSpherical(spherical);controls.update();dirty=true;
  });
  function resize(){
    const rect=stage.getBoundingClientRect();if(rect.width<1||rect.height<1)return;width=rect.width;height=rect.height;
    const zoomRatio=camera.position.length()/homeDistance;camera.aspect=width/height;homeDistance=3.7/Math.min(1,camera.aspect);
    controls.minDistance=2.35;controls.maxDistance=homeDistance*1.15;
    camera.position.setLength(THREE.MathUtils.clamp(homeDistance*zoomRatio,controls.minDistance,controls.maxDistance));
    camera.updateProjectionMatrix();renderer.setSize(width,height,false);dirty=true;
  }
  function startLoop(){if(!raf&&visible&&!document.hidden&&!lost&&!disposed){lastFrame=0;raf=requestAnimationFrame(frame);}}
  function stopLoop(){cancelAnimationFrame(raf);raf=0;lastFrame=0;}
  function frame(now){
    raf=0;if(!visible||document.hidden||lost||disposed)return;
    const delta=lastFrame?Math.min((now-lastFrame)/1000,.07):0;lastFrame=now;
    if(!paused){elapsed+=delta;updateFlights(delta);}
    controls.autoRotate=!paused&&!dragging&&!focus&&!hovered&&!labelFocused&&!ui.selection&&now>interactionUntil;
    if(focus){
      const t=Math.min(1,(now-focus.startTime)/focus.duration),e=t*t*(3-2*t);
      const q=new THREE.Quaternion().slerp(focus.rotation,e);
      camera.position.copy(focus.start).applyQuaternion(q).multiplyScalar(THREE.MathUtils.lerp(focus.fromDistance,focus.distance,e));dirty=true;if(t===1)focus=null;
    }
    const changed=controls.update(delta);
    if(dirty||changed||!paused){updateProjection(now);ui.zoomState(camera.position.length(),controls.minDistance,controls.maxDistance);renderer.render(scene,camera);dirty=false;}
    raf=requestAnimationFrame(frame);
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);
  const visibilityObserver=new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);if(visible){resize();dirty=true;startLoop();}else stopLoop();},{threshold:.01});visibilityObserver.observe(stage);
  listen(document,'visibilitychange',()=>document.hidden?stopLoop():startLoop());
  listen(motionPreference,'change',()=>{paused=motionPreference.matches;ui.pauseState(paused);dirty=true;});
  listen(canvas,'webglcontextlost',event=>{event.preventDefault();lost=true;stopLoop();stage.dataset.state='error';loading.textContent='La vista 3D se está recuperando…';loading.hidden=false;ui.enable(false);ui.labels.forEach(label=>label.hidden=true);});
  listen(canvas,'webglcontextrestored',()=>{lost=false;stage.dataset.state='ready';loading.hidden=true;dirty=true;ui.enable(true);startLoop();});
  listen(window,'pagehide',event=>{
    stopLoop();if(event.persisted)return;disposed=true;controls.dispose();ui.dispose();resizeObserver.disconnect();visibilityObserver.disconnect();listeners.forEach(remove=>remove());
    const geometries=new Set(),materials=new Set();scene.traverse(item=>{if(item.geometry)geometries.add(item.geometry);if(item.material)materials.add(item.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();
  });
  listen(window,'pageshow',()=>{dirty=true;startLoop();});
  ui.enable(true);ui.pauseState(paused);resize();updateFlights(0);highlight();updateProjection(performance.now());renderer.render(scene,camera);
  loading.hidden=true;stage.dataset.state='ready';stage.setAttribute('aria-busy','false');startLoop();
}
