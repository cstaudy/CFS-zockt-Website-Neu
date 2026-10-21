/* CFS R19 · Echte Navigation und Tastatur-Werkzeugwechsel. Keine Datenzugriffe außer bestehender Owner-Erkennung. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const pathname = location.pathname === '/index.html' ? '/' : location.pathname;
  const studios = new Map([
    ['/pages/widget-studio.html', ['Widget Studio (Altprojekte)', 'Nur für bestehende Deep Links', 'Legacy']],
    ['/pages/stream-maker.html', ['Stream Maker', 'Stream-Designs bearbeiten', 'Gestalten']],
    ['/pages/scene-studio.html', ['Scene Studio', 'Szenen gestalten', 'Gestalten']],
    ['/pages/editor.html', ['Creator Editor', 'Profil und Widgets bearbeiten', 'Gestalten']],
    ['/pages/universal-builder.html', ['Universal Builder', 'Designs und Widgets kombinieren', 'Gestalten']],
    ['/pages/stream-studio.html', ['Stream Studio', 'Szenen und Live-Kontrolle', 'Produzieren']],
    ['/pages/cut-studio.html', ['Cut Studio', 'Clips schneiden und exportieren', 'Produzieren']],
    ['/pages/audio-studio.html', ['Tonstudio', 'Audiodateien lokal bearbeiten', 'Produzieren']],
    ['/pages/launcher.html', ['Launcher', 'Desktop verbinden und prüfen', 'System']],
  ]);
  const allLinks = [
    ['/pages/dashboard.html', 'Übersicht', 'Creator-Dashboard', 'Start'],
    ['/pages/creator-suite.html', 'Alle Studios', 'Werkzeuge auswählen', 'Start'],
    ...Array.from(studios, ([href, [name, desc, group]]) => [href, name, desc, group]).filter(([href]) => href !== '/pages/widget-studio.html'),
    ['/pages/shop.html', 'Creator Shop', 'Designkatalog ansehen', 'Weitere'],
    ['/pages/account.html', 'Konto', 'Profil und Sicherheit', 'Weitere'],
    ['/pages/support.html', 'Hilfe', 'Fragen und Kontakt', 'Weitere']
  ];
  const isStudio = studios.has(pathname);
  const isCreator = isStudio || ['/pages/dashboard.html', '/pages/creator-suite.html'].includes(pathname);
  const el = (tag, className, text) => {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text) result.textContent = text;
    return result;
  };
  function setup() {
    document.documentElement.classList.add('cfs-r19');
    if (isStudio) document.documentElement.classList.add('cfs-r19-studio');
    if (pathname === '/pages/creator-suite.html') document.documentElement.classList.add('cfs-r19-suite');
    if (pathname === '/' ) document.documentElement.classList.add('cfs-r19-home');
    if (pathname === '/pages/shop.html') document.documentElement.classList.add('cfs-r19-shop');
    if (pathname === '/pages/admin.html') document.documentElement.classList.add('cfs-r19-admin');
    if (pathname === '/pages/dashboard.html') document.documentElement.classList.add('cfs-r19-dashboard');
    const main = $('main');
    if (main && !$('#cfsR19Skip')) {
      const skip = el('a', 'cfs-r19-skip', 'Direkt zum Inhalt');
      skip.id = 'cfsR19Skip'; skip.href = '#cfsR19Main';
      main.id ||= 'cfsR19Main'; main.tabIndex = -1;
      document.body.prepend(skip);
    }
    // Nur wirkliche Anwendungssseiten erhalten einen schnellen Werkzeugwechsel.
    if (isCreator) setupSwitcher();
    if (isStudio) setupStudioActions();
    if (pathname === '/pages/creator-suite.html') setupSuiteCards();
  }
  function setupStudioActions() {
    const flow = $('.cfs-r18-workflow');
    if (!flow) return;
    const heading = $('.cfs-r18-workflow-heading', flow);
    if (!heading) return;
    const trail = el('nav', 'cfs-r19-trail');
    trail.setAttribute('aria-label', 'Pfad');
    const back = el('a', '', 'Alle Studios'); back.href = '/pages/creator-suite.html';
    const sep = el('span', '', '/'); sep.setAttribute('aria-hidden', 'true');
    const current = el('span', '', studios.get(pathname)[0]); current.setAttribute('aria-current', 'page');
    trail.append(back, sep, current);
    heading.prepend(trail);
    const steps = $('.cfs-r18-steps', flow);
    if (steps) {
      const items = Array.from(steps.querySelectorAll('a[href]'));
      // Versteckte oder nicht existente Targets werden bereits in R18 ausgeschlossen.
      items.forEach((link, index) => {
        link.setAttribute('title', `Schritt ${index + 1}: ${link.textContent.trim()}`);
        if (index === 0) link.classList.add('cfs-r19-first-step');
      });
    }
  }
  function setupSuiteCards() {
    const cards = $('.cfs-r18-suite-cards');
    if (!cards) return;
    const labels = {
      'Widget Studio': 'Gestalten', 'Stream Maker': 'Gestalten',
      'Stream Studio': 'Live', 'Cut Studio': 'Video',
      'Tonstudio': 'Audio', 'Launcher': 'Desktop',
      'Bundle Builder': 'Gestalten', 'Creator Shop': 'Designs'
    };
    for (const card of cards.querySelectorAll('a')) {
      const name = $('strong', card)?.textContent || '';
      const category = el('small', 'cfs-r19-card-category', labels[name] || 'Werkzeug');
      card.prepend(category);
      const arrow = el('span', 'cfs-r19-card-arrow', '↗'); arrow.setAttribute('aria-hidden', 'true');
      card.append(arrow);
    }
  }
  function setupSwitcher() {
    if ($('#cfsR19Switch')) return;
    const header = $('.cfs-r14-top-inner') || $('.creator-site-header .header-inner') || $('.site-header .header-inner');
    if (!header) return;
    const button = el('button', 'cfs-r19-switch', 'Suchen');
    button.type = 'button'; button.id = 'cfsR19Switch';
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-controls', 'cfsR19Dialog');
    button.setAttribute('aria-label', 'Studios und Werkzeuge wechseln, Strg oder Command plus K');
    const kbd = el('kbd', '', '⌘ K'); kbd.setAttribute('aria-hidden', 'true'); button.append(kbd);
    const account = $('.cfs-r14-account', header);
    if (account) header.insertBefore(button, account);
    else header.append(button);
    const dialog = el('dialog', 'cfs-r19-dialog'); dialog.id = 'cfsR19Dialog';
    dialog.setAttribute('aria-label', 'Studio oder Werkzeug öffnen');
    const inner = el('div', 'cfs-r19-dialog-inner');
    const top = el('div', 'cfs-r19-dialog-top');
    const search = el('input', 'cfs-r19-search'); search.type = 'search';
    search.autocomplete = 'off'; search.placeholder = 'Studio oder Aufgabe suchen …';
    search.setAttribute('aria-label', 'Werkzeug suchen');
    const close = el('button', 'cfs-r19-close', 'Schließen'); close.type = 'button';
    close.setAttribute('aria-label', 'Werkzeugauswahl schließen');
    top.append(search, close);
    const results = el('div', 'cfs-r19-results'); results.id = 'cfsR19Results';
    results.setAttribute('aria-live', 'polite');
    const note = el('p', 'cfs-r19-note', 'Privat-Beta: Geschützte Werkzeuge erfordern deinen freigegebenen Account.');
    inner.append(top, results, note); dialog.append(inner); document.body.append(dialog);
    const entries = allLinks.slice();
    function render(value = '') {
      const query = value.toLocaleLowerCase('de').trim();
      results.replaceChildren();
      const matched = entries.filter(([href, name, desc, group]) => [name, desc, group].some(t => t.toLocaleLowerCase('de').includes(query)));
      if (!matched.length) { results.append(el('p', 'cfs-r19-empty', 'Kein passendes Werkzeug gefunden.')); return; }
      let lastGroup = '';
      for (const [href, name, desc, group] of matched) {
        if (group !== lastGroup) {
          results.append(el('div', 'cfs-r19-group', group)); lastGroup = group;
        }
        const link = el('a', 'cfs-r19-result'); link.href = href;
        if (href === pathname) { link.classList.add('is-current'); link.setAttribute('aria-current', 'page'); }
        const text = el('span', 'cfs-r19-result-text');
        text.append(el('strong', '', name), el('small', '', desc));
        const arrow = el('span', 'cfs-r19-result-arrow', href === pathname ? 'Aktuell' : '↗');
        link.append(text, arrow); results.append(link);
      }
    }
    function open() {
      if (dialog.open) return;
      search.value = ''; render(); dialog.showModal(); search.focus();
    }
    button.addEventListener('click', open);
    close.addEventListener('click', () => dialog.close());
    search.addEventListener('input', () => render(search.value));
    search.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      const first = $('a.cfs-r19-result', results);
      if (!first) return;
      event.preventDefault(); location.assign(first.href);
    });
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        const active = document.activeElement;
        // Textfelder und Rich-Text-Editoren behalten ihre eigenen Shortcuts.
        if (!dialog.open && active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return;
        event.preventDefault(); dialog.open ? dialog.close() : open();
      }
    });
    // Sichtbarkeit des Admin-Eintrags allein aufgrund serverseitig verifizierter Session.
    // Sicherheitsgrenze bleibt serverseitig, niemals in der Navigation.
    fetch('/api/account/me', {credentials: 'same-origin', cache: 'no-store', headers: {Accept: 'application/json'}})
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!data || data.admin !== true) return;
        entries.push(['/pages/admin.html', 'Admin Control', 'Einnahmen, Shop-Entwürfe und Freigaben', 'Weitere']);
        if (dialog.open) render(search.value);
      }).catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, {once: true});
  else setup();
})();
