/* R113 · Native studio action links retained, compact disclosure only on small screens. */
(() => {
  'use strict';
  function init() {
    const body = document.body;
    if (!body || !body.hasAttribute('data-cfs-r113-studio')) return;
    const context = document.querySelector('main .r108-context');
    const actions = context?.querySelector('.r108-context-actions');
    if (!context || !actions || context.querySelector('.r113-studio-toggle')) return;
    const toggle = document.createElement('button');
    toggle.className = 'r113-studio-toggle';
    toggle.type = 'button';
    toggle.textContent = 'Seitenaktionen';
    toggle.setAttribute('aria-expanded','false');
    actions.id ||= 'r113-studio-actions';
    toggle.setAttribute('aria-controls', actions.id);
    context.insertBefore(toggle,actions);
    function setOpen(open, returnFocus = false) {
      const visible = Boolean(open);
      context.classList.toggle('r113-actions-open',visible);
      toggle.setAttribute('aria-expanded',String(visible));
      if (returnFocus) toggle.focus();
    }
    toggle.addEventListener('click',()=>setOpen(!context.classList.contains('r113-actions-open')));
    context.addEventListener('keydown',event => {
      if (event.key === 'Escape' && context.classList.contains('r113-actions-open')) {
        event.preventDefault(); setOpen(false,true);
      }
    });
    actions.addEventListener('click',event => {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('pointerdown',event=>{
      if (!context.contains(event.target) && context.classList.contains('r113-actions-open')) setOpen(false);
    });
    // ARIA changes do not conceal links unless the responsive CSS is active.
    body.classList.add('r113-studio-ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
