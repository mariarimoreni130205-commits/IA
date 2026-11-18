/* Only the aircraft and clouds move. The landscape, layout and native scroll
   stay fixed; CSS handles the gentle loops without a JavaScript render loop. */
const hero = document.getElementById('flight-hero');

if (hero) {
  const toggle = document.getElementById('hero-motion-toggle');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = new AbortController();
  let visible = false;
  let paused = false;
  const listen = (target, event, handler) => target.addEventListener(event, handler, {signal: listeners.signal});

  function syncMotion() {
    hero.dataset.motion = visible && !document.hidden && !paused && !reduce.matches ? 'on' : 'off';
    toggle.hidden = reduce.matches;
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', `${paused ? 'Reanudar' : 'Pausar'} movimiento del avión y las nubes`);
    toggle.title = `${paused ? 'Reanudar' : 'Pausar'} movimiento`;
  }

  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    syncMotion();
  });
  observer.observe(hero);
  listen(toggle, 'click', () => { paused = !paused; syncMotion(); });
  listen(reduce, 'change', syncMotion);
  listen(document, 'visibilitychange', syncMotion);
  listen(window, 'pageshow', syncMotion);
  listen(document.getElementById('hero-explore'), 'click', () => {
    document.getElementById('recommendations').scrollIntoView({behavior: reduce.matches ? 'instant' : 'smooth', block: 'start'});
  });
  listen(window, 'pagehide', event => {
    hero.dataset.motion = 'off';
    if (event.persisted) return;
    observer.disconnect();
    listeners.abort();
  });
  syncMotion();
}
