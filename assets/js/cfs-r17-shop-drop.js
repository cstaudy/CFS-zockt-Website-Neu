/* R17 · Admin-only UI. Server is the security boundary, not this file. */
(()=>{'use strict';
const by=id=>document.getElementById(id);
const status=text=>{if(by('r17DropStatus'))by('r17DropStatus').textContent=text};
const allowed=new Set(['image/png','image/jpeg','image/webp']);
let busy=false;
async function request(url,options={}){
  if(!window.CFS?.json)throw new Error('Creator-Session nicht geladen. Bitte Seite aktualisieren.');
  return CFS.json(url,options);
}
function draw(items){const wrap=by('r17DropDrafts');if(!wrap)return;wrap.replaceChildren();
  if(!items.length){const p=document.createElement('p');p.textContent='Noch keine Bilder hochgeladen.';wrap.append(p);return;}
  for(const item of items){const card=document.createElement('article'),img=document.createElement('img'),title=document.createElement('strong'),meta=document.createElement('small');
    img.src=`/api/admin/store/shop-drops/${encodeURIComponent(item.asset_id)}/preview`;img.alt='Private Vorschau: '+item.title;img.loading='lazy';
    title.textContent=item.title;meta.textContent=`${item.status==='draft'?'Entwurf':'Status: '+item.status} · ${item.offer_enabled===false?'Verkauf aus':'Angebot aktiviert'} · Rechte: ${item.rights_status==='approved'?'freigegeben':item.rights_status==='pending'?'ausstehend':item.rights_status}`;
    card.append(img,title,meta);wrap.append(card);
  }
}
async function list(){try{const response=await request('/api/admin/store/shop-drops');if(response?.ok)draw(response.drafts||[]);}
  catch(error){status(error?.status===401||error?.status===403?'Kein Adminzugang. Bitte mit berechtigtem Konto anmelden.':'Entwürfe konnten nicht geladen werden: '+(error.message||'Unbekannter Fehler'));}}
async function send(files){if(busy)return;const selected=[...files];if(!selected.length)return;busy=true;
 const zone=by('r17DropZone');zone?.setAttribute('aria-busy','true');let saved=0;
 try{for(let i=0;i<selected.length;i++){const file=selected[i];
   if(!allowed.has(file.type)||!/^.+\.(png|jpe?g|webp)$/i.test(file.name)){status('Übersprungen: '+file.name+' (nur PNG/JPG/WebP).');continue;}
   if(file.size>20*1024*1024||file.size===0){status('Übersprungen: '+file.name+' (maximal 20 MB, nicht leer).');continue;}
   status(`Speichere ${i+1}/${selected.length}: ${file.name} …`);
   await request('/api/admin/store/shop-drop',{method:'POST',headers:{'Content-Type':file.type,'X-CFS-File-Name':encodeURIComponent(file.name)},body:file});saved++;
 }
 status(saved?`${saved} Bild(er) in PostgreSQL gespeichert, als private Entwürfe angelegt. Keine Veröffentlichung oder Freigabe.`:'Keine gültigen Bilder gespeichert.');
 await list();
 }catch(error){status(`${saved} gespeichert. Weiterer Upload fehlgeschlagen: ${error.message||'Verbindung nicht verfügbar'}`);await list();}
 finally{busy=false;zone?.removeAttribute('aria-busy');if(by('r17DropInput'))by('r17DropInput').value='';}}
document.addEventListener('DOMContentLoaded',()=>{
 const zone=by('r17DropZone'),input=by('r17DropInput');if(!zone||!input)return;
 input.addEventListener('change',()=>send(input.files));
 zone.addEventListener('dragover',e=>{e.preventDefault();if(!busy)zone.classList.add('is-dragging')});
 zone.addEventListener('dragleave',()=>zone.classList.remove('is-dragging'));
 zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('is-dragging');if(e.dataTransfer?.files)send(e.dataTransfer.files)});
 zone.addEventListener('keydown',e=>{if(e.target!==zone)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click();}});
 list();
},{once:true});
})();
