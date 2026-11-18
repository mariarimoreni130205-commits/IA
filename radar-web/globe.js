// Load the 3D engine only when the section approaches the viewport.
const section = document.getElementById('mundo');
const stage = document.getElementById('world-stage');
let started = false;
async function start() {
  if (started) return;
  started = true;
  try {
    const {mountWorld} = await import('./globe-scene.js');
    await mountWorld(section, stage);
  } catch (error) {
    stage.dataset.state = 'error';
    stage.setAttribute('aria-busy', 'false');
    document.getElementById('world-loading').hidden = false;
    document.getElementById('world-loading').textContent = 'No pudimos abrir la vista 3D en este navegador. Podés seguir explorando tus vuelos.';
    console.warn('Radar: vista 3D no disponible.', error);
  }
}
if (section && stage) {
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); start(); }
    }, {rootMargin:'300px'});
    observer.observe(section);
  } else start();
}
