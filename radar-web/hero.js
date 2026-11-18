/* Layered render: scroll advances the aircraft toward the camera while the
   landscape recedes. Native scrolling and the search form stay independent. */
const hero = document.getElementById('flight-hero');

if (hero) {
  const stage = hero.querySelector('.flight-hero-stage');
  const aircraft = hero.querySelector('.flight-aircraft');
  const landscape = hero.querySelector('.flight-landscape');
  const shadow = hero.querySelector('.flight-aircraft-shadow');
  const clouds = hero.querySelector('.flight-clouds');
  const copy = hero.querySelector('.flight-hero-copy');
  const arrival = hero.querySelector('.flight-hero-arrival');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 901px)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const listeners = new AbortController();
  let visible = false;
  let frame = 0;
  let disposed = false;
  let progress = 0;
  let pointerX = 0, pointerY = 0, x = 0, y = 0;
  const clamp = n => Math.max(0, Math.min(1, n));
  const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };
  const listen = (target, event, handler, options = {}) => target.addEventListener(event, handler, {...options, signal: listeners.signal});

  function schedule() {
    if (!frame && !disposed && visible && !document.hidden && !reduce.matches) frame = requestAnimationFrame(draw);
  }

  function draw() {
    frame = 0;
    if (disposed || !visible || document.hidden || reduce.matches) return;
    const rect = hero.getBoundingClientRect();
    const runway = hero.offsetHeight - stage.offsetHeight;
    const target = desktop.matches ? clamp((12 - rect.top) / Math.max(1, runway)) : clamp(-rect.top / Math.max(1, rect.height));
    // A short settle smooths cursor input; scroll is
    // mapped directly so quick scrolling never leaves a stranded aircraft.
    progress = target;
    x += (pointerX - x) * .16;
    y += (pointerY - y) * .16;
    const p = desktop.matches ? smooth(progress) : progress * .12;
    const forward = p * p;
    aircraft.style.transform = `translate3d(${x * 9 - forward * stage.clientWidth * .67}px, ${y * 6 + p * stage.offsetHeight * .08}px, 0) rotate(${p * -7 + x * .35}deg) scale(${1 + forward * 1.25})`;
    aircraft.style.opacity = String(1 - smooth((p - .68) / .3));
    landscape.style.transform = `translate3d(${x * -3 - p * stage.clientWidth * .045}px, ${y * -2 + p * 16}px, 0) perspective(1500px) rotateY(${-7 * (1 - p)}deg) rotateZ(${-2 * (1 - p)}deg) scale(${1 + p * .95})`;
    const arriving = desktop.matches ? smooth((p - .48) / .4) : 0;
    landscape.style.setProperty('--arrival', arriving);
    arrival.style.opacity = String(arriving);
    arrival.style.transform = `translate3d(0, ${(1 - arriving) * 30}px, 0)`;
    shadow.style.transform = `translate3d(${-forward * 250}px, ${p * 35}px, 0) rotate(8deg) scale(${1 + p * .4})`;
    shadow.style.opacity = String(1 - p);
    copy.style.transform = `translate3d(0, ${p * -32}px, 0)`;
    copy.style.opacity = desktop.matches ? String(1 - smooth(p / .57)) : '1';
    clouds.style.transform = `translate3d(${-p * 40}px, ${(1 - p) * 35 - p * 19}%, 0) scale(${1.1 + p * .2})`;
    clouds.style.opacity = desktop.matches ? String(smooth((p - .12) / .4) * (1 - smooth((p - .78) / .22))) : '0';
    if (Math.abs(pointerX - x) + Math.abs(pointerY - y) > .008) schedule();
  }

  function configure() {
    hero.dataset.motion = reduce.matches ? 'off' : 'on';
    pointerX = pointerY = x = y = progress = 0;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    for (const layer of [aircraft, landscape, shadow, clouds, copy, arrival]) {
      layer.style.removeProperty('transform');
      layer.style.removeProperty('opacity');
    }
    landscape.style.removeProperty('--arrival');
    schedule();
  }

  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    hero.dataset.visible = String(visible);
    if (visible) schedule();
    else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  }, {rootMargin: '50px'});
  observer.observe(hero);
  const resize = new ResizeObserver(schedule);
  resize.observe(stage);
  listen(window, 'scroll', schedule, {passive: true});
  listen(window, 'resize', schedule, {passive: true});
  listen(document, 'visibilitychange', () => {
    if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; }
    else schedule();
  });
  listen(reduce, 'change', configure);
  listen(desktop, 'change', configure);
  listen(hero, 'pointermove', event => {
    if (!finePointer.matches || event.pointerType !== 'mouse' || reduce.matches || document.activeElement?.closest('.hero-search')) return;
    const r = stage.getBoundingClientRect();
    pointerX = Math.max(-1, Math.min(1, (event.clientX - r.left) / r.width * 2 - 1));
    pointerY = Math.max(-1, Math.min(1, (event.clientY - r.top) / r.height * 2 - 1));
    schedule();
  }, {passive: true});
  listen(hero, 'pointerleave', () => { pointerX = pointerY = 0; schedule(); });
  listen(hero.querySelector('.hero-search'), 'focusin', () => { pointerX = pointerY = 0; schedule(); });
  listen(document.getElementById('hero-explore'), 'click', () => {
    document.getElementById('recommendations').scrollIntoView({behavior: reduce.matches ? 'instant' : 'smooth', block: 'start'});
  });
  listen(window, 'pagehide', event => {
    if (event.persisted) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    resize.disconnect();
    listeners.abort();
  });
  configure();
}
