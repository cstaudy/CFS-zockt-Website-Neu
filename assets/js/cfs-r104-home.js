/* R104: accessibility improvement for existing public menu; no API or account state changes. */
(() => {
  'use strict';
  const menu = document.getElementById('r104MainNav');
  const trigger = document.querySelector('.r104-toggle');
  if (!menu || !trigger) return;
  const mobile = window.matchMedia('(max-width: 760px)');
  const sync = () => {
    const expanded = mobile.matches && menu.classList.contains('open');
    document.body.classList.toggle('r104-menu-open', expanded);
    if (!expanded) trigger.setAttribute('aria-expanded', 'false');
  };
  // app.js owns opening/closing and Escape. Observe its state for scroll lock and keyboard focus.
  new MutationObserver(sync).observe(menu, {attributes: true, attributeFilter: ['class']});
  mobile.addEventListener?.('change', sync);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || !mobile.matches || !menu.classList.contains('open')) return;
    const links = [...menu.querySelectorAll('a[href]:not([hidden])')].filter(el => el.getClientRects().length);
    if (!links.length) return;
    const active = document.activeElement;
    const first = links[0];
    const last = links[links.length - 1];
    let target = null;
    if (active === trigger) target = event.shiftKey ? last : first;
    else if (active === first && event.shiftKey) target = trigger;
    else if (active === last && !event.shiftKey) target = trigger;
    if (target) { event.preventDefault(); target.focus(); }
  });
  // Use the real current-year display, not a hard-coded release year.
  const year = document.querySelector('[data-cfs-current-year]');
  if (year) year.textContent = String(new Date().getFullYear());
  sync();
})();
