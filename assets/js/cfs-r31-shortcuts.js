/* R154: Search only relevant tools. Keep the existing nine studio destinations unchanged. */
(() => {
  'use strict';
  const root = document.querySelector('#cfsR21Suite');
  const input = document.querySelector('#cfsR31ToolSearch');
  if (!root || !input) return;
  const groups = [...root.querySelectorAll('.cfs-r20-suite-grid')];
  const items = groups.flatMap(group => [...group.querySelectorAll('a.cfs-r20-studio-card')]);
  const status = document.querySelector('#cfsR31SearchStatus');
  const empty = document.querySelector('#cfsR31NoTools');
  const primary = document.querySelector('.cfs-ux-primary');
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('de');
  function update() {
    const query = normalize(input.value);
    let visible = 0;
    const primaryMatch = !query || normalize(primary?.textContent).includes(query) || ['universal builder', 'design', 'vorlage', 'erstellen', 'meine designs'].some(word => normalize(word).includes(query));
    if (primary) primary.hidden = !primaryMatch;
    for (const card of items) {
      const match = !query || normalize(card.textContent).includes(query);
      card.hidden = !match;
      if (match) visible++;
    }
    for (const group of groups) {
      const hasMatch = [...group.querySelectorAll('a.cfs-r20-studio-card')].some(card => !card.hidden);
      group.hidden = !hasMatch;
      const heading = group.previousElementSibling;
      if (heading?.matches('.cfs-r20-suite-category')) heading.hidden = !hasMatch;
    }
    if (empty) empty.hidden = visible !== 0 || primaryMatch;
    if (status) status.textContent = query ? `${visible + Number(primaryMatch)} passende Bereiche gefunden` : '';
  }
  input.addEventListener('input', update);
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape' && input.value) {input.value = '';update();event.preventDefault();}
  });
  update();
})();
