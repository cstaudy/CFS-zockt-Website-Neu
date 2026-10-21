"use strict";
(async function(){
 const grid=document.getElementById('r13-grid'); const count=document.getElementById('r13-count'); const color=document.getElementById('r13-color'); const search=document.getElementById('r13-search'); const scenes=document.getElementById('r13-scenes');
 if(!grid||!count||!color||!search||!scenes)return;
 try{
  const response=await fetch('/assets/data/cfs-original-design-previews-r13.json',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw new Error('Katalog nicht erreichbar ('+response.status+')');
  const data=await response.json();
  if(!Array.isArray(data.designs)||!Array.isArray(data.colors))throw new Error('Katalogformat ungültig');
  color.replaceChildren(); for(const name of data.colors){const opt=document.createElement('option');opt.value=name;opt.textContent=name;color.append(opt);}color.value=data.colors.includes('Blau')?'Blau':data.colors[0];
  const render=()=>{
   const q=search.value.trim().toLocaleLowerCase('de'); const selected=color.value;
   const matches=data.designs.filter(d=>d.name.toLocaleLowerCase('de').includes(q)); const fragment=document.createDocumentFragment();
   for(const d of matches){const el=document.createElement('article');el.className='r13-card';const img=document.createElement('img');img.loading='lazy';img.alt='Vorschau '+d.name+', '+selected;img.src=d.previews[selected]||Object.values(d.previews)[0];img.addEventListener('error',()=>{img.alt='Bild aktuell nicht verfügbar: '+d.name;img.classList.add('r14-image-error');},{once:true});const body=document.createElement('div');body.className='r13-card-body';const title=document.createElement('h2');title.textContent=d.name;const subtitle=document.createElement('small');subtitle.textContent=selected+' · Originalarchiv · Vorschau';body.append(title,subtitle);el.append(img,body);fragment.append(el);}
   grid.replaceChildren(fragment);count.textContent=matches.length+' von '+data.designs.length+' Designwelten';
  };search.addEventListener('input',render);color.addEventListener('change',render);render();
  for(const item of data.additional_scenes||[]){const el=document.createElement('article');el.className='r13-card';const img=document.createElement('img');img.loading='lazy';img.alt=item.title;img.src=item.preview;const div=document.createElement('div');div.className='r13-card-body';const h=document.createElement('h2');h.textContent=item.title;div.append(h);el.append(img,div);scenes.append(el);}
 }catch(err){count.textContent='Katalog nicht geladen';const p=document.createElement('p');p.textContent=String(err.message||err);grid.replaceChildren(p);}
})();
