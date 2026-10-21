/* R106: shared five-destination navigation, no duplicated tool categories. */
(()=>{'use strict';
const sections=[
  {label:'Dashboard',href:'/pages/dashboard.html',paths:['dashboard.html']},
  {label:'Meine Tools',href:'/pages/creator-suite.html',paths:['creator-suite.html','universal-builder.html','widget-studio.html','stream-maker.html','scene-studio.html','editor.html','cut-studio.html','audio-studio.html','games.html','shop.html','shop-product.html','launcher.html','cfs-ai.html']},
  {label:'Streams & Content',href:'/pages/stream-studio.html',paths:['stream-studio.html','tiktok.html','integrations.html','obs-setup.html']},
  {label:'Community',href:'/#community',paths:[]},
  {label:'Account',href:'/pages/account.html',paths:['account.html','settings.html','setup.html','launcher-connect.html','technical-status.html']}
];
const page=(location.pathname.split('/').pop()||'').toLowerCase();
function organize(nav){
 if(nav.dataset.cfsR106Nav==='1')return;
 nav.dataset.cfsR106Nav='1';
 const existing=[...nav.querySelectorAll('a[href]')];
 const logout=nav.querySelector('[data-logout]');
 const oldDetails=[...nav.querySelectorAll('details')];
 const overflow=document.createElement('details');overflow.className='cfs-r106-more';
 const summary=document.createElement('summary');summary.textContent='Weitere';
 const menu=document.createElement('div');menu.className='cfs-r106-more-menu';
 overflow.append(summary,menu);
 const used=new Set();
 const primary=[];
 for(const item of sections){
   let a=existing.find(x=>x.getAttribute('href')===item.href && !used.has(x));
   if(!a){a=document.createElement('a');a.href=item.href;}
   used.add(a);
   a.textContent=item.label;
   a.removeAttribute('hidden');a.classList.remove('active');a.removeAttribute('aria-current');
   if(item.paths.includes(page)){a.classList.add('active');a.setAttribute('aria-current',item.href===location.pathname?'page':'location');}
   primary.push(a);
 }
 const extras=[
   ['/pages/universal-builder.html','Builder'],['/pages/stream-maker.html','Stream Maker'],
   ['/pages/shop.html','Shop & Vorlagen'],['/pages/launcher.html','Launcher'],
   ['/pages/integrations.html','Integrationen'],['/pages/settings.html','Einstellungen'],
   ['/pages/support.html','Hilfe']
 ];
 // Retain deep links, including admin-only links with their hidden state.
 const extraHrefs=new Set(extras.map(x=>x[0]));
 for(const [href,label] of extras){
   let a=existing.find(x=>x.getAttribute('href')===href&&!used.has(x));
   if(!a){a=document.createElement('a');a.href=href;}
   used.add(a);a.textContent=label;menu.append(a);
 }
 for(const a of existing){if(used.has(a)||a.hasAttribute('data-logout'))continue;
   const href=a.getAttribute('href');if(sections.some(x=>x.href===href)||extraHrefs.has(href))continue;
   menu.append(a);
 }
 for(const child of [...nav.children])if(child!==logout)child.remove();
 nav.append(...primary,overflow);
 if(logout)nav.append(logout);
 nav.classList.add('cfs-workspace-nav','cfs-r106-nav');
 overflow.addEventListener('click',event=>{if(event.target.closest('a'))overflow.open=false;});
 document.addEventListener('click',event=>{if(overflow.open&&!overflow.contains(event.target))overflow.open=false;});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&overflow.open){overflow.open=false;summary.focus();}});
}
function init(){document.querySelectorAll('.creator-nav,.sm-header nav').forEach(organize);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
