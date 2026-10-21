/* R33: Ein einheitlicher Fokusmodus für drei bestehende Creator-Studios.
   Keine Daten, keine Projektänderung, kein Speichern und keine Netzwerkzugriffe. */
(() => {
  'use strict';
  const targets = Object.freeze({
    '/pages/scene-studio.html': '#sceneWorkspace',
    '/pages/stream-maker.html': '#editorView',
    '/pages/cut-studio.html': '#cutApp'
  });
  function init() {
    const target = targets[location.pathname];
    if (!target) return;
    const control = document.getElementById('cfsR33Focus');
    const workspace = document.querySelector(target);
    if (!control || !workspace || control.dataset.cfsR33Bound === '1') return;
    control.dataset.cfsR33Bound = '1';
    let focused = false;
    function render() {
      document.body.classList.toggle('cfs-r33-focused', focused);
      control.setAttribute('aria-pressed', String(focused));
      control.textContent = focused ? 'Werkzeuge einblenden' : 'Arbeitsfläche vergrößern';
      control.title = focused ? 'Projekt- und Werkzeuglisten wieder einblenden' : 'Seitliche Listen vorübergehend ausblenden';
      // Canvas- und Stagegrößen werden in den bestehenden Studios bei Resize neu berechnet.
      if (typeof window.dispatchEvent === 'function' && typeof Event === 'function') {
        window.dispatchEvent(new Event('resize'));
      }
    }
    control.addEventListener('click', () => { focused = !focused; render(); });
    // Beim Laden bleiben alle Werkzeuge sichtbar. Kein dauerhafter Fokuszustand.
    control.setAttribute('aria-pressed', 'false');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
