/* R30: organize the Widget Studio around real work, preserve existing controls and security. */
(() => {
  'use strict';
  const dashboard = document.querySelector('.ws-dashboard-v2[data-view="dashboard"]');
  const library = dashboard?.querySelector('.ws-library');
  const head = dashboard?.querySelector('.ws-dashboard-head');
  if (!dashboard || !library || !head) return;

  // Move existing sections without cloning, deleting or re-binding controls.
  // The library is the first task; the account and setup panels remain available.
  head.after(library);
  const more = document.createElement('details');
  more.className = 'cfs-r30-secondary';
  more.setAttribute('aria-label', 'Status und weitere Werkzeuge');
  const summary = document.createElement('summary');
  summary.textContent = 'Status und weitere Optionen';
  more.append(summary);
  // Keep the live status strip here even when R20 moves the old quickstart into help.
  const status = dashboard.querySelector('.ws-simple-start-hub .ws-simple-status-strip');
  if (status) more.append(status);
  for (const selector of ['.ws-simple-start-hub', '.ws-dashboard-overview', '.ws-dashboard-bottom']) {
    const existing = dashboard.querySelector(selector);
    if (existing) more.append(existing);
  }
  library.after(more);

  // The second set of Alle/Live/Entwürfe buttons duplicates the quick row.
  // Move the useful "Zuletzt" action into the existing optional filters.
  const options = library.querySelector('.ws-library-options-body');
  const recent = library.querySelector('.ws-library-quick-access [data-dashboard-filter="recent"]');
  if (options && recent) {
    recent.classList.add('cfs-r30-recent');
    options.append(recent);
  }
  const duplicateFilters = library.querySelector('.ws-library-options .ws-filter-tabs');
  if (duplicateFilters) duplicateFilters.hidden = true;

  const convert = dashboard.querySelector('#cfsR30StartConverter');
  const create = dashboard.querySelector('.ws-dashboard-create[data-action="open-create"]');
  convert?.addEventListener('click', () => {
    if (!create) return;
    create.click(); // Original Widget Studio handler selects the "create" view.
    window.dispatchEvent(new CustomEvent('cfs-r28-set-flow', { detail: {mode:'converter'} }));
  });

  const moreActions = dashboard.querySelector('.cfs-r30-more-actions');
  moreActions?.addEventListener('click', event => {
    if (event.target.closest('button')) moreActions.open = false;
  });
})();
