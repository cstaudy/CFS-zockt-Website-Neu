import { writeFileSync } from 'node:fs';

const [url, output, width = '1440', height = '1080'] = process.argv.slice(2);
if (!url?.startsWith('http://127.0.0.1:') || !output) throw new Error('Use a local URL and output path.');
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const target = targets.find(item => item.type === 'page');
if (!target) throw new Error('No Edge page target found.');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0;
const pending = new Map();
socket.onmessage = event => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const handler = pending.get(message.id);
  if (!handler) return;
  pending.delete(message.id);
  message.error ? handler.reject(new Error(message.error.message)) : handler.resolve(message.result);
};
function call(method, params = {}) {
  const current = ++id;
  return new Promise((resolve, reject) => {
    pending.set(current, { resolve, reject });
    socket.send(JSON.stringify({ id: current, method, params }));
  });
}
try {
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: Number(width), height: Number(height), deviceScaleFactor: 1, mobile: Number(width) < 700 });
  await call('Page.navigate', { url });
  await new Promise(resolve => setTimeout(resolve, 1700));
  const dimensions = await call('Runtime.evaluate', { expression: "JSON.stringify({viewport:innerWidth,content:document.documentElement.scrollWidth,title:document.title,small:matchMedia('(max-width:760px)').matches,header:document.querySelector('body>header')?getComputedStyle(document.querySelector('body>header')).display:'none',menu:document.querySelector('.r104-toggle')?{display:getComputedStyle(document.querySelector('.r104-toggle')).display,matches:document.querySelector('.r104-toggle').matches('html body.public-home header.site-header .r104-header-actions button.r104-toggle'),visibility:getComputedStyle(document.querySelector('.r104-toggle')).visibility,style:document.querySelector('.r104-toggle').getAttribute('style'),x:document.querySelector('.r104-toggle').getBoundingClientRect().x}:null})", returnByValue: true });
  const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(output, Buffer.from(shot.data, 'base64'));
  console.log(dimensions.result.value);
  if (url.endsWith('/pages/login.html')) {
    const tabs = await call('Runtime.evaluate', { expression: "(() => { const a=document.getElementById('cfsLoginTab'),b=document.getElementById('cfsRegisterTab'),l=document.getElementById('loginPanel'),r=document.getElementById('registerPanel'); b.click(); const opened=r.hidden===false&&l.hidden===true&&b.getAttribute('aria-selected')==='true'; a.click(); return opened&&l.hidden===false&&r.hidden===true&&a.getAttribute('aria-selected')==='true'; })()", returnByValue: true });
    if (tabs.result.value !== true) throw new Error('Login/registration tabs failed.');
    console.log('Auth tabs: PASS');
  }
  if (new URL(url).pathname === '/' && Number(width) < 700) {
    const menu = await call('Runtime.evaluate', { expression: "(() => { const b=document.querySelector('.r104-toggle'),n=document.getElementById('r104MainNav'); if(!b||!n)return false; const closed=getComputedStyle(n).display==='none'; b.click(); return closed&&getComputedStyle(n).display!=='none'; })()", returnByValue: true });
    if (menu.result.value !== true) throw new Error('Mobile menu did not open.');
    console.log('Mobile menu: PASS');
  }
} finally {
  socket.close();
}
