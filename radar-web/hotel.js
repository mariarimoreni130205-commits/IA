import { mirrorTime, progress } from './hotel-playback.js';
import { WIDTH, rooms, rectangle, cssMatrix, homography, overviewMatrix, entryMatrix, ease } from './hotel-motion.js';

const section = document.getElementById('hotel');
if (section) {
  const $ = id => document.getElementById(`hotel-${id}`);
  const stage = $('stage'), world = $('world'), portal = $('portal'), video = $('video');
  const hold = $('hold'), overlay = $('hotspots'), picker = $('floor-picker'), roomPicker = $('room-picker');
  const primary = $('primary'), pause = $('pause'), back = $('back'), status = $('status');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(hover: none)');
  const listeners = new AbortController();
  const on = (el, type, fn, options = {}) => el.addEventListener(type, fn, { ...options, signal: listeners.signal });
  let phase = 'overview', selected = rooms.find(room => room.id === 502), activeFloor = 5;
  let config, configPromise, mediaPromise, ready = false, disposed = false;
  let width = 1, height = 1, focus = 0, entry = 0, animation = null, raf = 0;
  let paused = false, videoVisible = false, seeking = false, operation = 0;
  const announce = text => { status.textContent = text; };

  function svg(tag, attrs) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }
  function draw() {
    world.style.transform = cssMatrix(entry > 0 ? entryMatrix(selected, width, height, entry) : overviewMatrix(width, height, focus));
    portal.style.opacity = String(Math.min(1, entry * 12));
    world.hidden = videoVisible;
    video.hidden = !videoVisible;
  }
  function preparePortal() {
    // Share the video crop; compute this only on room or viewport changes.
    const portalHeight = WIDTH * height / width;
    portal.style.height = `${portalHeight}px`;
    portal.style.transform = cssMatrix(homography(rectangle(WIDTH, portalHeight), selected.points));
  }
  function highlight(floor, id) {
    overlay.querySelectorAll('[data-room]').forEach(node => {
      node.classList.toggle('is-active', Number(node.dataset.floor) === floor);
      node.classList.toggle('is-selected', Number(node.dataset.room) === id);
    });
  }
  function rebuildHotspots() {
    overlay.replaceChildren();
    if (phase === 'overview') {
      const outline = svg('polygon', { points: '560,89 1048,37 1175,174 1175,863 560,861', class: 'hotel-outline' });
      on(outline, 'pointerenter', () => { if (!coarse.matches && !reduced.matches) approach(); });
      on(outline, 'click', approach);
      overlay.append(outline);
    } else if (phase === 'floors') {
      for (const room of rooms) {
        const node = svg('polygon', { points: room.points.map(p => p.join(',')).join(' '),
          class: 'hotel-window', 'data-room': room.id, 'data-floor': room.floor,
          tabindex: '0', role: 'button', 'aria-label': `Entrar a habitación ${room.id}, piso ${room.floor}` });
        on(node, 'pointerenter', () => highlight(room.floor, room.id));
        on(node, 'pointerleave', () => highlight(activeFloor));
        on(node, 'focus', () => highlight(room.floor, room.id));
        on(node, 'click', () => enterRoom(room));
        on(node, 'keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); enterRoom(room); }
        });
        overlay.append(node);
      }
      highlight(activeFloor);
    }
  }
  function chooseFloor(floor) {
    if (phase !== 'floors') return;
    activeFloor = floor;
    picker.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.floor) === floor)));
    roomPicker.replaceChildren();
    const label = document.createElement('span'); label.textContent = `Piso ${floor} · Elegí una habitación`; roomPicker.append(label);
    rooms.filter(room => room.floor === floor).forEach(room => {
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = `${room.id} ↗`; button.setAttribute('aria-label', `Entrar a habitación ${room.id}`);
      on(button, 'pointerenter', () => highlight(floor, room.id));
      on(button, 'focus', () => highlight(floor, room.id));
      on(button, 'click', () => enterRoom(room)); roomPicker.append(button);
    });
    highlight(floor);
  }
  for (let floor = 1; floor <= 9; floor++) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.floor = floor;
    button.textContent = floor; button.setAttribute('aria-label', `Elegir piso ${floor}`);
    on(button, 'click', () => chooseFloor(floor)); picker.append(button);
  }
  function syncPause() {
    pause.textContent = paused ? '▶' : 'Ⅱ';
    pause.setAttribute('aria-label', paused ? 'Reanudar recorrido' : 'Pausar recorrido');
    pause.setAttribute('aria-pressed', String(paused));
  }
  function state(next) {
    phase = next; stage.dataset.state = next; stage.dataset.room = String(selected.id);
    const moving = ['approaching', 'entering', 'tour', 'returning'].includes(next);
    pause.hidden = !moving; back.hidden = ['overview', 'error'].includes(next);
    back.disabled = ['approaching', 'returning'].includes(next) || seeking;
    back.textContent = next === 'floors' ? 'Vista general ↗' : 'Volver al hotel ↗';
    primary.hidden = !['overview', 'error'].includes(next); primary.disabled = false;
    picker.hidden = roomPicker.hidden = ['overview', 'approaching', 'error'].includes(next);
    for (const button of [...picker.querySelectorAll('button'), ...roomPicker.querySelectorAll('button')]) button.disabled = next !== 'floors';
    const content = {
      overview: ['01 / LA CIUDAD', 'Tu próxima estadía, de cerca.', (coarse.matches || matchMedia('(max-width:700px)').matches) ? 'Tocá el hotel para acercarte.' : 'Pasá el mouse sobre el hotel para acercarte.'],
      approaching: ['02 / EL HOTEL', 'Un lugar entre mil destinos.', 'Acercándonos a Torre Urbana…'],
      floors: ['02 / ELEGÍ TU VENTANA', 'Una ventana a tu próximo viaje.', 'Tocá una ventana o elegí una habitación abajo.'],
      entering: [`03 / HABITACIÓN ${selected.id}`, 'La ciudad queda del otro lado.', 'Entrando a tu habitación…'],
      tour: [`04 / SUITE ${selected.id}`, 'Imaginá despertar acá.', 'Luz natural. Madera cálida. La ciudad a tus pies.'],
      inside: [`04 / SUITE ${selected.id}`, 'Ahora sí, ya te imaginás acá.', 'Volvé al hotel y descubrí otra ventana.'],
      returning: [`DE VUELTA · HABITACIÓN ${selected.id}`, 'Todavía queda mucho por descubrir.', 'Volvemos por la ventana que elegiste.'],
      error: ['EL HOTEL', 'No pudimos cargar el recorrido.', 'Volvé a intentarlo cuando tengas conexión.'],
    }[next];
    [$('step'), $('caption-title'), $('caption-description')].forEach((node, i) => { node.textContent = content[i]; });
    primary.textContent = next === 'error' ? 'Reintentar' : 'Conocer el hotel ↗';
    if (next === 'overview' || next === 'floors') $('progress-fill').style.width = '0%';
    rebuildHotspots();
    if (next === 'floors') chooseFloor(activeFloor);
    syncPause();
  }
  async function loadConfig() {
    if (!configPromise) configPromise = fetch('./assets/hotel/tour.json').then(response => {
      if (!response.ok) throw new Error('Hotel manifest unavailable'); return response.json();
    }).then(data => { config = data; return data; }).catch(error => { configPromise = null; throw error; });
    return configPromise;
  }
  async function prepareMedia() {
    if (mediaPromise) return mediaPromise;
    mediaPromise = (async () => {
      await loadConfig();
      video.src = matchMedia('(max-width:700px)').matches ? config.mobileVideo : config.video;
      video.load();
      await new Promise((resolve, reject) => {
        const finish = error => { clearTimeout(timer); video.removeEventListener('loadeddata', loaded); video.removeEventListener('error', failed); error ? reject(error) : resolve(); };
        const loaded = () => finish(), failed = () => finish(new Error('Hotel media unavailable'));
        const timer = setTimeout(() => finish(new Error('Hotel media timed out')), 30000);
        video.addEventListener('loadeddata', loaded); video.addEventListener('error', failed);
      });
      await portal.querySelector('img').decode(); ready = true;
    })().catch(error => { mediaPromise = null; ready = false; throw error; });
    return mediaPromise;
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  function start() { if (!raf && !paused && !disposed) raf = requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    if (disposed || paused) return;
    if (animation) {
      if (animation.last !== null) animation.elapsed += Math.min(now - animation.last, 100);
      animation.last = now;
      const t = Math.min(1, animation.elapsed / animation.duration);
      const value = animation.from + (animation.to - animation.from) * (animation.kind === 'focus' ? ease(t) : t);
      if (animation.kind === 'focus') focus = value; else entry = value;
      draw();
      if (t === 1) { const done = animation.done; animation = null; done(); }
    }
    if (videoVisible && !video.paused && !seeking) {
      const t = video.currentTime;
      $('progress-fill').style.width = `${100 * progress(phase === 'returning' ? mirrorTime(t, config.forwardEnd, config.fps) : t, 0, config.forwardEnd)}%`;
      if (phase === 'tour' && t >= config.forwardEnd - 1 / config.fps) {
        video.pause(); video.currentTime = config.forwardEnd - 1 / config.fps; state('inside'); announce(`Recorrido de la habitación ${selected.id} completo.`);
      } else if (phase === 'returning' && t >= config.totalEnd - .02) finishVideoReturn();
    }
    if (animation || (videoVisible && !video.paused)) start();
  }
  function animate(kind, to, duration, done) {
    animation = { kind, from: kind === 'focus' ? focus : entry, to, duration: reduced.matches ? 200 : Math.max(250, duration), elapsed: 0, last: null, done };
    paused = false; syncPause(); start();
  }
  function fail(error) {
    operation++; animation = null; stop(); video.pause(); videoVisible = false; hold.hidden = true;
    entry = focus = 0; state('error'); draw(); stage.setAttribute('aria-busy', 'false');
    announce('No pudimos cargar el recorrido. Podés reintentar.'); console.warn('Radar hotel:', error.message);
  }
  function approach() {
    if (phase !== 'overview') return;
    state('approaching'); prepareMedia().catch(error => { if (phase === 'entering') fail(error); });
    animate('focus', 1, 1300, () => { state('floors'); announce('Elegí uno de los nueve pisos y una de sus tres habitaciones.'); });
  }
  async function enterRoom(room) {
    if (phase !== 'floors') return;
    selected = room; chooseFloor(room.floor); const token = ++operation;
    const bounds = stage.getBoundingClientRect();
    if (bounds.top < 0 || bounds.bottom > innerHeight) stage.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'center' });
    preparePortal(); state('entering'); draw(); announce(`Entrando por la ventana de la habitación ${room.id}, piso ${room.floor}.`);
    const media = prepareMedia(); media.catch(() => {});
    animate('entry', 1, 4400, async () => {
      stage.setAttribute('aria-busy', String(!ready));
      if (!ready) announce('Preparando el recorrido de la habitación…');
      try {
        await media; if (token !== operation || disposed) return;
        await seek(0); if (token !== operation || disposed) return;
        videoVisible = true; state('tour'); draw(); stage.setAttribute('aria-busy', 'false');
        if (!paused) await play();
      } catch (error) { if (token === operation) fail(error); }
    });
  }
  async function play() {
    try { await video.play(); paused = false; syncPause(); start(); }
    catch { paused = true; syncPause(); announce('Tocá Reanudar para continuar.'); }
  }
  async function seek(time) {
    if (Math.abs(video.currentTime - time) < .005) return;
    seeking = true; video.pause();
    if (videoVisible && video.readyState >= 2) {
      hold.width = video.videoWidth; hold.height = video.videoHeight;
      hold.getContext('2d').drawImage(video, 0, 0); hold.hidden = false;
    }
    try {
      await new Promise((resolve, reject) => {
        const finish = error => { clearTimeout(timer); video.removeEventListener('seeked', done); error ? reject(error) : resolve(); };
        const done = () => finish(); const timer = setTimeout(() => finish(new Error('Hotel seek timed out')), 15000);
        video.addEventListener('seeked', done); video.currentTime = time;
      });
    } finally { seeking = false; hold.hidden = true; }
  }
  function finishVideoReturn() {
    video.pause(); videoVisible = false; entry = 1; draw();
    animate('entry', 0, 3900, () => { state('floors'); announce(`De vuelta en la ventana de la habitación ${selected.id}.`); });
  }
  async function goBack() {
    if (seeking || ['overview', 'error', 'approaching', 'returning'].includes(phase)) return;
    operation++; stage.setAttribute('aria-busy', 'false');
    if (phase === 'floors') {
      state('returning'); animate('focus', 0, 1200, () => state('overview')); return;
    }
    state('returning');
    if (!videoVisible) { animate('entry', 0, 3900 * entry, () => state('floors')); return; }
    const matching = mirrorTime(Math.min(video.currentTime, config.forwardEnd - 1 / config.fps), config.forwardEnd, config.fps);
    try { await seek(matching); await play(); } catch (error) { fail(error); }
  }
  function setPaused(value) {
    paused = value; syncPause();
    if (paused) { stop(); video.pause(); if (animation) animation.last = null; }
    else if (animation) start();
    else if (videoVisible && ['tour', 'returning'].includes(phase)) play();
  }
  on(primary, 'click', () => { if (phase === 'error') { mediaPromise = null; state('overview'); } approach(); });
  on(back, 'click', goBack);
  on(pause, 'click', () => setPaused(!paused));
  on(section, 'keydown', event => { if (event.key === 'Escape' && !back.hidden && !back.disabled) goBack(); });
  on(video, 'ended', () => { if (phase === 'returning' && videoVisible) finishVideoReturn(); });
  on(video, 'error', () => { if (videoVisible) fail(new Error('Video playback interrupted')); });
  on(document, 'visibilitychange', () => { if (document.hidden && (animation || !video.paused)) setPaused(true); });
  const resizeObserver = new ResizeObserver(entries => {
    width = entries[0].contentRect.width; height = entries[0].contentRect.height;
    if (width > 0 && height > 0) { preparePortal(); draw(); }
  }); resizeObserver.observe(stage);
  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) loadConfig().catch(() => {});
    else if (animation || !video.paused) setPaused(true);
  }, { threshold: .01 }); observer.observe(stage);
  on(window, 'pagehide', event => {
    setPaused(true); if (event.persisted) return;
    disposed = true; operation++; observer.disconnect(); resizeObserver.disconnect(); listeners.abort();
  });
  stage.setAttribute('aria-busy', 'false'); state('overview');
}
