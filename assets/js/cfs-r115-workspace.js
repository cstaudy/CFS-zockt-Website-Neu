/* R122 • Accessible view switch for Widget/Scene Studio.
   Keep existing editor DOM, event handlers, save and publish flows untouched.
   If JS is missing all panels remain visible. */
(() => {
  'use strict';
  const modes = [
    {id:'all', label:'Alle'},
    {id:'canvas', label:'Arbeitsfläche'},
    {id:'tools', label:'Werkzeuge / Scenes'},
    {id:'properties', label:'Eigenschaften'}
  ];
  function init() {
    const page = document.body?.dataset.cfsR108View;
    const widget = page === 'widget-studio';
    const scene = page === 'scene-studio';
    if (!widget && !scene) return;
    const root = document.querySelector(widget ? '.ws-view[data-view="editor"]' : '#sceneWorkspace');
    const layout = root?.querySelector(widget ? '.ws-editor-grid-v2' : '.scene-editor');
    const tools = document.querySelector(widget ? '.ws-view[data-view="editor"] .ws-editor-left-v2' : '.scene-sidebar');
    const properties = document.querySelector(widget ? '.ws-view[data-view="editor"] .ws-editor-right-v2' : '.scene-library');
    const canvas = document.querySelector(widget ? '.ws-view[data-view="editor"] .ws-canvas-column-v2' : '.scene-editor');
    if (!root || !layout || !tools || !properties || !canvas || document.querySelector('.r115-view-switch')) return;

    const group = document.createElement('nav');
    group.className = 'r115-view-switch';
    group.setAttribute('aria-label', 'Arbeitsansicht wechseln');
    const buttons = new Map();
    modes.forEach(({id,label}) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'r115-view-button';
      button.dataset.viewMode = id;
      button.textContent = label;
      button.setAttribute('aria-pressed', 'false');
      group.append(button);
      buttons.set(id,button);
    });
    const feedback = document.createElement('span');
    feedback.className = 'r122-view-feedback';
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    feedback.setAttribute('aria-atomic', 'true');
    group.append(feedback);
    if (widget) root.querySelector('.ws-editor-appbar')?.insertAdjacentElement('afterend', group);
    else root.insertAdjacentElement('beforebegin', group);

    let mode = 'all';
    let userSelected = false;
    function visiblePanel(next) {
      return next === 'tools' ? tools : next === 'properties' ? properties : canvas;
    }
    function hiddenBy(next, panel) {
      return next !== 'all' && panel !== visiblePanel(next);
    }
    function setMode(next, options={}) {
      if (!buttons.has(next)) return;
      const active = document.activeElement;
      const losingFocus = [canvas,tools,properties].some(panel => hiddenBy(next,panel) && panel.contains(active));
      // The older scene focus toggle and this view switch must not conceal
      // each other's tools. Only one presentation state can be active.
      if (scene && document.body.classList.contains('cfs-r33-focused')) {
        const legacyFocus = document.getElementById('cfsR33Focus');
        if (legacyFocus?.getAttribute('aria-pressed') === 'true') legacyFocus.click();
        // Also recover from old/stale focus state if its script is unavailable.
        document.body.classList.remove('cfs-r33-focused');
        if (legacyFocus) legacyFocus.setAttribute('aria-pressed','false');
      }
      mode = next;
      document.body.dataset.r115Mode = mode;
      for (const [key,btn] of buttons) btn.setAttribute('aria-pressed', String(key === mode));
      feedback.textContent = next === 'all' ? 'Alle Arbeitsbereiche sichtbar.' :
        `${modes.find(x=>x.id===next).label} ausgewählt. Andere Bereiche bleiben über die Ansichtswahl erreichbar.`;
      if (options.fromUser) userSelected = true;
      // Do not leave keyboard focus inside a panel hidden via display:none.
      if (losingFocus || options.focusButton) buttons.get(next).focus({preventScroll:true});
      if (widget) window.dispatchEvent(new Event('resize'));
    }
    document.addEventListener('cfs:studio-view-request', e => {
      if (!e.detail || !buttons.has(e.detail.mode)) return;
      // The workflow toolbar may sit outside the editor root. Preserve the
      // clicked toolbar button's focus unless it was inside a hidden column.
      setMode(e.detail.mode,{fromUser:true});
    });
    group.addEventListener('click', e => {
      const button = e.target.closest('button[data-view-mode]');
      if (button && group.contains(button)) setMode(button.dataset.viewMode,{fromUser:true});
    });
    group.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const button = e.target.closest('button[data-view-mode]');
      if (!button || !group.contains(button)) return;
      e.preventDefault();
      const ids = modes.map(x=>x.id);
      const next = ids[(ids.indexOf(button.dataset.viewMode) + (e.key==='ArrowRight'?1:ids.length-1))%ids.length];
      setMode(next,{fromUser:true,focusButton:true});
    });
    document.addEventListener('keydown', e => {
      if (e.key!=='Escape' || e.defaultPrevented || mode==='all') return;
      // Let dialogs, menus and overlays handle Escape first. Never take it globally.
      if (document.activeElement?.closest('dialog[open], [role="dialog"]:not([hidden]), [aria-modal="true"]')) return;
      if (!(group.contains(document.activeElement) || root.contains(document.activeElement))) return;
      setMode('all',{focusButton:true});
    });
    const media = window.matchMedia('(max-width:760px)');
    function syncViewport() {
      if (!userSelected) setMode(media.matches ? 'canvas' : 'all');
    }
    syncViewport();
    if (typeof media.addEventListener === 'function') media.addEventListener('change',syncViewport);
    document.body.classList.add('r115-panels-ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
