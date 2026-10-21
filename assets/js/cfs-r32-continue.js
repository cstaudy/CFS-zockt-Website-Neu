/* R32: Compact resume link; route-only local preference, no user data or API requests. */
(() => {
  'use strict';
  const root = document.querySelector('#cfsR21Suite');
  const resume = document.querySelector('#cfsR32Resume');
  const search = document.querySelector('#cfsR31ToolSearch');
  if (!root || !resume || !search) return;
  const links = Array.from(root.querySelectorAll('a.cfs-r20-studio-card[href], a#cfsStructurePrimary[href]'));
  const allowed = new Map(links.map(link => [link.getAttribute('href'), link]));
  const key = 'cfs-r32-last-studio-path';
  const read = () => {try {return window.localStorage.getItem(key) || '';}catch {return '';}};
  const write = value => {try {window.localStorage.setItem(key, value);}catch { /* private mode */ }};
  function refresh() {
    const path = read();
    const target = allowed.get(path);
    if (!target) {resume.hidden = true;resume.removeAttribute('href');return;}
    const title = target.querySelector('strong')?.textContent?.trim() || (path.includes('universal-builder') ? 'Universal Builder' : 'Studio');
    resume.textContent = `Weiterarbeiten: ${title}`;
    resume.setAttribute('href', path);
    resume.hidden = false;
  }
  links.forEach(link => {
    link.addEventListener('click', () => {
      const path = link.getAttribute('href');
      if (allowed.has(path)) write(path);
      refresh();
    });
  });
  // Keep the shortcut focused on a real, fixed route; never copy URL tokens.
  resume.addEventListener('click', () => {
    if (!allowed.has(resume.getAttribute('href'))) {resume.hidden = true;resume.removeAttribute('href');}
  });
  document.addEventListener('keydown', event => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    const target = event.target;
    if (target?.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(target?.tagName)) return;
    event.preventDefault();
    search.focus();
    search.select?.();
  });
  refresh();
})();
