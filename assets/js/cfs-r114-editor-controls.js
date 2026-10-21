/* R114 · Universal Builder: accessible optional actions and preview focus.
   Does not replace, clone or rebind existing save/export buttons. */
(() => {
  'use strict';
  function init() {
    if (document.body?.dataset.cfsR109 !== 'compact') return;
    const editor = document.querySelector('#ub65Editor');
    const settings = editor?.querySelector('.ub65-settings');
    const work = editor?.querySelector('.ub65-work-area');
    const topline = work?.querySelector('.ub65-topline');
    const toolbar = work?.querySelector('.ub65-toolbar');
    const save = toolbar?.querySelector('#ub65Save');
    const exportButton = toolbar?.querySelector('#ub65Export');
    const restart = toolbar?.querySelector('#ub65Restart');
    const newDesign = toolbar?.querySelector('#ub65New');
    if (!settings || !topline || !toolbar || !save || !exportButton || !restart || !newDesign ||
        document.querySelector('#r114FocusPreview')) return;

    const focus = document.createElement('button');
    focus.id = 'r114FocusPreview';
    focus.type = 'button';
    focus.className = 'r114-editor-action';
    focus.textContent = 'Vorschau vergrößern';
    focus.setAttribute('aria-pressed','false');
    focus.setAttribute('aria-controls','r114BuilderSettings');
    settings.id ||= 'r114BuilderSettings';
    focus.setAttribute('aria-controls',settings.id);
    topline.append(focus);

    const more = document.createElement('details');
    more.className = 'r114-more-actions';
    more.innerHTML = '<summary>Weitere Aktionen</summary><div class="r114-more-content"></div>';
    const inner = more.querySelector('.r114-more-content');
    inner.append(restart,newDesign); // Native elements and event handlers retained.
    toolbar.append(more);

    function setFocus(enabled) {
      const active = Boolean(enabled);
      document.body.classList.toggle('r114-preview-focus',active);
      focus.setAttribute('aria-pressed',String(active));
      focus.textContent = active ? 'Einstellungen anzeigen' : 'Vorschau vergrößern';
      // Existing canvas/layout engines can respond to the regular resize signal.
      window.dispatchEvent(new Event('resize'));
    }
    focus.addEventListener('click',()=>setFocus(!document.body.classList.contains('r114-preview-focus')));
    document.addEventListener('keydown',event=>{
      if (event.key==='Escape' && document.body.classList.contains('r114-preview-focus')) {
        setFocus(false);focus.focus();
      }
    });
    // No JS means the old, fully visible controls remain unchanged.
    document.body.classList.add('r114-enhanced');
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
