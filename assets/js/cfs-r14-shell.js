/* R23: One site navigation, one set of links. Role visibility is not authorization. */
(() => {
  'use strict';
  const path = location.pathname.toLowerCase();
  const supported = new Set([
    '/', '/index.html', '/pages/shop.html', '/pages/dashboard.html',
    '/pages/creator-suite.html','/pages/admin.html','/pages/design-vorschau.html',
    '/pages/admin-creators.html','/pages/widget-studio.html','/pages/stream-studio.html',
    '/pages/universal-builder.html','/pages/integrations.html','/pages/settings.html',
    '/pages/setup.html','/pages/cfs-ai.html','/pages/cut-studio.html',
    '/pages/launcher-download.html','/pages/merch.html','/pages/login.html',
    '/pages/account.html','/pages/support.html','/pages/games.html',
    '/pages/original-design.html','/pages/scene-studio.html','/pages/roadmap.html',
    '/pages/stream-maker.html','/pages/editor.html','/pages/launcher.html',
    '/pages/tiktok.html','/pages/launcher-connect.html','/pages/system-check.html',
    '/pages/obs-setup.html'
  ]);
  if (!supported.has(path)) return;
  // R27: only presentation styling. Existing navigation, auth and tool handlers stay intact.
  if (!document.querySelector('link[data-cfs-r27-compact]')) {
    const compact = document.createElement('link');
    compact.rel = 'stylesheet';
    compact.href = '/assets/css/cfs-r27-compact.css?v=R27';
    compact.setAttribute('data-cfs-r27-compact', '');
    document.head.append(compact);
  }

  // Shared presentation layer on every page using the public R23 navigation.
  if (!document.querySelector('link[data-cfs-r83-clarity]')) {
    const clarity = document.createElement('link');
    clarity.rel = 'stylesheet';
    clarity.href = '/assets/css/cfs-r83-brand-clarity.css?v=R83';
    clarity.setAttribute('data-cfs-r83-clarity', '');
    document.head.append(clarity);
  }

  const node = (tag, className, label) => {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (label) item.textContent = label;
    return item;
  };
  const header = node('header', 'cfs-r14-top cfs-r23-top');
  const inner = node('div', 'cfs-r14-top-inner');
  // R83 logo correction: the genuine CFS symbol is the only visible header brand.
  // Accessible naming stays on the link, not as extra visual text.
  const brand = node('a', 'r14-mark cfs-r83-logo-only');
  brand.href = '/';
  brand.setAttribute('aria-label', 'CFS Zockt – Startseite');
  const logo = document.createElement('img');
  logo.src = '/assets/img/brand/cfs-zockt-mark-clean.png';
  logo.alt = '';
  logo.width = 48;
  logo.height = 48;
  brand.append(logo);

  const menu = node('details', 'cfs-r23-menu');
  const summary = node('summary', '', 'Menü');
  summary.setAttribute('aria-label', 'Hauptnavigation öffnen');
  const links = node('nav','cfs-r14-links');
  links.setAttribute('aria-label','Hauptnavigation');
  const add = (label, href, extraClass = '') => {
    const a = node('a',extraClass,label);
    a.href = href;
    if (href === path || (href === '/' && path === '/index.html') ||
        (href === '/pages/creator-suite.html' && ['/pages/creator-suite.html','/pages/widget-studio.html',
        '/pages/stream-maker.html','/pages/scene-studio.html','/pages/cut-studio.html',
        '/pages/audio-studio.html','/pages/stream-studio.html','/pages/universal-builder.html',
        '/pages/editor.html','/pages/launcher.html'].includes(path))) {
      a.setAttribute('aria-current', href === path || path === '/index.html' ? 'page' : 'location');
    }
    links.append(a);
    return a;
  };
  add('Start', '/');
  add('Streams', '/#streams');
  add('Creator Suite', '/pages/creator-suite.html');
  const dashboard = add('Dashboard','/pages/dashboard.html','cfs-r23-private');
  dashboard.hidden = true;
  add('Shop','/pages/shop.html');
  add('Hilfe','/pages/support.html');
  const admin = add('Admin','/pages/admin.html','r14-admin cfs-r23-private');
  admin.setAttribute('aria-label','Privates Admin Control Center');
  admin.hidden = true;
  menu.append(summary, links);

  // Shared R66 UX layer: presentation-only and intentionally last in cascade.
  if (!document.querySelector('link[data-cfs-r66-compact]')) {
    const compactStructure = document.createElement('link');
    compactStructure.rel = 'stylesheet';
    compactStructure.href = '/assets/css/cfs-r66-compact-structure.css?v=R66-UX1';
    compactStructure.setAttribute('data-cfs-r66-compact', '');
    document.head.append(compactStructure);
  }
  const account = node('div','cfs-r14-account');
  const login = node('a','cfs-r23-login','Anmelden');
  login.href = '/pages/login.html';
  account.append(login);
  inner.append(brand, menu, account);
  header.append(inner);
  const breakpoint = window.matchMedia('(max-width: 760px)');
  const adapt = () => {
    menu.open = !breakpoint.matches;
    summary.setAttribute('aria-label', breakpoint.matches ? 'Hauptnavigation öffnen' : 'Hauptnavigation');
  };
  adapt();
  if (breakpoint.addEventListener) breakpoint.addEventListener('change',adapt);
  else breakpoint.addListener(adapt);
  document.addEventListener('pointerdown', event => {
    if (breakpoint.matches && menu.open && !menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && breakpoint.matches && menu.open) {
      menu.open = false;summary.focus();
    }
  });
  links.addEventListener('click', event => {
    if (breakpoint.matches && event.target.closest('a')) menu.open = false;
  });
  const mount = () => {
    if (document.querySelector('.cfs-r23-top')) return;
    document.body.classList.add('cfs-r14-clean','cfs-r23-clean');
    document.body.prepend(header);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();

  // Never treat displayed menu entries as a permission check.
  fetch('/api/account/me', {
    credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}
  }).then(response => response.ok ? response.json() : null).then(data => {
    if (!data?.authenticated) return;
    dashboard.hidden = false;
    login.href = '/pages/account.html';login.textContent = 'Konto';
    if (data.admin === true) admin.hidden = false;
  }).catch(() => {});
})();
