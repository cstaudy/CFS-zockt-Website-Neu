/* R28: one active task in Widget Studio; no server calls and no auto-publication. */
(() => {
  'use strict';
  const root = document.querySelector('.ws-create-view[data-view="create"]');
  const tabs = document.querySelector('#cfsR28FlowTabs');
  if (!root || !tabs) return;
  const modes = new Set(['widget', 'converter', 'panels']);
  const titles = { widget: 'Neues Widget', converter: 'Bild umwandeln', panels: 'Panels erstellen' };
  const params = new URLSearchParams(location.search);
  const panelRoute = params.has('panel_set') || ['#panel-sets', '#wsPanelSets'].includes(location.hash);
  const initial = panelRoute ? 'panels' : params.get('open') === 'converter' ? 'converter' : 'widget';
  let active = initial;

  const setFlow = (next, { focus = false } = {}) => {
    if (!modes.has(next)) return;
    active = next;
    document.body.dataset.cfsR28Flow = active;
    for (const button of tabs.querySelectorAll('button[data-cfs-r28-flow]')) {
      const selected = button.dataset.cfsR28Flow === active;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    }
    const heading = root.querySelector('.ws-create-headline h2');
    if (heading) heading.textContent = titles[active];
    if (active === 'panels' && panelRoute) {
      const savedSets = document.querySelector('#cfsR28PanelSetsDetails');
      if (savedSets) savedSets.open = true;
    }
    if (focus) {
      const target = active === 'converter' ? document.querySelector('#wsWidgetConverter')
        : active === 'panels' ? document.querySelector('#wsPanelConverter')
        : root.querySelector('.ws-platform-picker');
      target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }
  };
  for (const button of tabs.querySelectorAll('button[data-cfs-r28-flow]')) {
    button.addEventListener('click', () => setFlow(button.dataset.cfsR28Flow, { focus: true }));
  }
  // Library -> Converter is a local UI handoff. No URLs or permissions are changed.
  window.addEventListener('cfs-r28-set-flow', event => {
    if (modes.has(event?.detail?.mode)) setFlow(event.detail.mode, { focus: true });
  });
  // Existing scripts already set data-ws-view. Keep the last chosen task when returning.
  new MutationObserver(() => {
    if (document.body.dataset.wsView === 'create') setFlow(active);
  }).observe(document.body, { attributes: true, attributeFilter: ['data-ws-view'] });
  setFlow(initial);
})();
