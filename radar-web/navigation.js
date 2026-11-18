/* A mobile disclosure menu; desktop navigation remains directly visible. */
(() => {
  const header = document.querySelector('.site-header');
  const nav = document.getElementById('site-navigation');
  const toggle = document.getElementById('nav-toggle');
  const compact = matchMedia('(max-width: 650px)');
  let open = false;

  function render() {
    header.dataset.mobileNav = String(compact.matches);
    toggle.hidden = !compact.matches;
    nav.hidden = compact.matches && !open;
    toggle.setAttribute('aria-expanded', String(compact.matches && open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }

  function close(returnFocus = false) {
    open = false;
    render();
    if (returnFocus && compact.matches) toggle.focus({preventScroll: true});
  }

  toggle.addEventListener('click', () => { open = !open; render(); });
  nav.addEventListener('click', event => { if (event.target.closest('a')) close(); });
  document.addEventListener('click', event => { if (open && !header.contains(event.target)) close(); });
  document.addEventListener('keydown', event => { if (open && event.key === 'Escape') close(true); });
  window.addEventListener('hashchange', () => close());
  compact.addEventListener('change', () => close());
  render();
})();
