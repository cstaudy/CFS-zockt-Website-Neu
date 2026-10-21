/* R22: One responsive navigation on the two main entry pages. No auth or data handling. */
(() => {
  'use strict';
  function init() {
    if (!document.body.matches('.cfs-r22-home,.cfs-r22-dashboard')) return;
    if (document.querySelector('.cfs-r23-top')) return;
    const shell = document.querySelector('.cfs-r14-top-inner');
    const nav = shell?.querySelector('.cfs-r14-links');
    if (!shell || !nav || shell.querySelector('.cfs-r22-mobile-menu')) return;
    const wrapper = document.createElement('details');
    wrapper.className = 'cfs-r22-mobile-menu';
    const summary = document.createElement('summary');
    summary.textContent = 'Menü';
    summary.setAttribute('aria-label', 'Navigation öffnen');
    const links = document.createElement('nav');
    links.setAttribute('aria-label', 'Mobile Hauptnavigation');
    for (const link of nav.querySelectorAll('a[href]')) {
      const copy = link.cloneNode(true);
      copy.addEventListener('click', () => { wrapper.open = false; });
      links.append(copy);
    }
    wrapper.append(summary, links);
    shell.insertBefore(wrapper, shell.querySelector('.cfs-r14-account'));
    document.addEventListener('pointerdown', event => {
      if (wrapper.open && !wrapper.contains(event.target)) wrapper.open = false;
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && wrapper.open) {
        wrapper.open = false;
        summary.focus();
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
