/* R88 · Originaldesign visibility, independent from private archive access.
 * Fail closed. Only the server grants ZIPs; frontend never changes beta permissions.
 */
(function(){'use strict';
 const info=document.getElementById('r88OriginalAvailability');
 if(!info)return;
 let downloadsAvailable=false;
 const originalText='Original-ZIP herunterladen ↓';
 const zipButton=document.getElementById('shopDownloadAction');
 const zipLinks=()=>document.querySelectorAll('#originalDesignGrid a[href*="/api/original-designs/package/"], #originalDesignGrid a[data-r88-zip-url], #detailDownload');
 function decorate(){
  for(const a of zipLinks()){
   if(!a.dataset.r88ZipUrl && a.getAttribute('href')?.startsWith('/api/original-designs/package/'))a.dataset.r88ZipUrl=a.getAttribute('href');
   if(downloadsAvailable && a.dataset.r88ZipUrl){
    if(a.getAttribute('href')!==a.dataset.r88ZipUrl)a.setAttribute('href',a.dataset.r88ZipUrl);
    if(a.textContent!==originalText)a.textContent=originalText;a.removeAttribute('aria-disabled');a.removeAttribute('tabindex');a.classList.remove('r88-zip-locked');
   } else {
    if(a.hasAttribute('href'))a.removeAttribute('href');
    if(a.getAttribute('aria-disabled')!=='true')a.setAttribute('aria-disabled','true');
    if(a.getAttribute('tabindex')!=='-1')a.setAttribute('tabindex','-1');
    if(a.textContent!=='Original-ZIP gesperrt')a.textContent='Original-ZIP gesperrt';
    a.classList.add('r88-zip-locked');
   }
  }
  if(zipButton){
   zipButton.disabled=!downloadsAvailable;
   zipButton.textContent=downloadsAvailable?'Paket herunterladen ↓':'Original-ZIP gesperrt';
   zipButton.title=downloadsAvailable?'Originaldesignpaket anfordern':'Bis zur ausdrücklich freigegebenen Beta gesperrt';
  }
 }
 function setStatus(available){
  downloadsAvailable=available===true;
  info.dataset.r88Ready=String(downloadsAvailable);
  info.textContent=downloadsAvailable?
   '31 Designwelten · 496 Farbvarianten als Vorschau. Original-ZIPs nur mit angemeldetem, berechtigtem Creator-Konto.':
   '31 Designwelten · 496 Farbvarianten als Vorschau. Original-ZIP-Downloads sind noch gesperrt.';
  decorate();
 }
 // The generated cards arrive after asynchronous catalog loading and regenerate on color changes.
 const observer=new MutationObserver(()=>decorate());
 const grid=document.getElementById('originalDesignGrid');
 if(grid)observer.observe(grid,{subtree:true,childList:true,attributes:true,attributeFilter:['href']});
 const detail=document.getElementById('detailDownload');
 if(detail)observer.observe(detail,{attributes:true,attributeFilter:['href']});
 document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[data-r88-zip-url],#detailDownload');
  if(link&&!downloadsAvailable){event.preventDefault();event.stopImmediatePropagation();}
 },true);
 // Directly visible color selector complements the existing accessible dropdown.
 const swatches=document.getElementById('r88ColorSwatches');
 const select=document.getElementById('originalDesignColor')||document.getElementById('detailColorSelect');
 if(swatches && select){
  fetch('/assets/data/original-design-catalog-v32065.json',{credentials:'same-origin',cache:'no-store'})
   .then(r=>{if(!r.ok)throw Error('catalog not available');return r.json();})
   .then(catalog=>{
    if(!Array.isArray(catalog.colors)||catalog.colors.length!==16)return;
    for(const color of catalog.colors){
     if(!/^#[0-9a-fA-F]{6}$/.test(color.accent)||!/^[a-z0-9-]+$/.test(color.id))continue;
     const button=document.createElement('button');button.type='button';button.className='r88-color-swatch';
     button.style.setProperty('--r88-color',color.accent);button.title=color.name;
     button.setAttribute('aria-label',`Farbvariante ${color.name}`);button.dataset.r88Color=color.id;
     button.onclick=()=>{if(![...select.options].some(o=>o.value===color.id))return;select.value=color.id;select.dispatchEvent(new Event('change',{bubbles:true}));};
     swatches.append(button);
    }
    const update=()=>{for(const el of swatches.children)el.setAttribute('aria-pressed',String(el.dataset.r88Color===select.value));};
    select.addEventListener('change',update);
    new MutationObserver(update).observe(select,{childList:true});update();
   }).catch(()=>{}); // Dropdown remains usable if catalog cannot be loaded.
 }
 setStatus(false);
 fetch('/api/original-designs/status' ,{credentials:'same-origin',cache:'no-store'})
  .then(response=>{if(!response.ok)throw Error('status unavailable');return response.json();})
  .then(data=>setStatus(data?.ok===true && data?.downloadsAvailable===true))
  .catch(()=>setStatus(false));
})();
