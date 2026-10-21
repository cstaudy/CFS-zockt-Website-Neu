/* R15 · Owner dashboard. A hidden UI is not a security boundary; every server endpoint verifies identity and elevation. */
(()=>{"use strict";
 const el=id=>document.getElementById(id),status=(id,message)=>{const e=el(id);if(e)e.textContent=message};
 async function request(url,options={}){
  const headers={Accept:"application/json",...(options.headers||{})};
  if(options.method&&options.method!=="GET"){
   const token=typeof CFS!=="undefined"&&typeof CFS.csrfToken==="function"?CFS.csrfToken():"";
   if(token)headers["X-CSRF-Token"]=token;
   headers["Content-Type"]="application/json";
  }
  const r=await fetch(url,{credentials:"same-origin",cache:"no-store",...options,headers});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){const error=new Error(d.error||`HTTP ${r.status}`);error.code=r.status;throw error;}
  return d;
 }
 function notifyError(error){return error.code===428?"Bitte zuerst in Creator Control den starken Admin-Schutz entsperren und dann hier aktualisieren.":error.code===403?"Keine Berechtigung für diese Funktion.":error.message;}
 function makeButton(label,disabled,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;b.addEventListener('click',fn);return b;}
 async function loadList(){
  const target=el('r15-beta-list');target.replaceChildren();status('r15-beta-status','Lade die private Tester-Liste …');
  try{
   const data=await request('/api/admin/owner-beta/testers');
   const testers=Array.isArray(data.testers)?data.testers:[];
   status('r15-beta-status',`${testers.length} vorgemerkt · Öffentliche Beta bleibt unverändert · Freigabe nur pro bestätigtem Account.`);
   for(const t of testers){
    const row=document.createElement('div');row.className='r15-beta-row';row.dataset.betaEmail=t.email;
    const person=document.createElement('div');person.className='r15-beta-person';
    const name=document.createElement('strong');name.textContent=(t.label?`${t.label} · `:'')+t.email;
    const meta=document.createElement('small');meta.textContent=`Status: ${t.status==='active'?'Beta freigegeben':t.status==='paused'?'Pausiert':'Vorgemerkt'} · ${t.account_exists?(t.email_verified?'Account bestätigt':'E-Mail unbestätigt'):'Noch nicht registriert'}${t.notes?' · '+t.notes:''}`;
    person.append(name,meta);
    const actions=document.createElement('div');actions.className='r15-beta-actions';
    const action=async next=>{if(next==='active'&&!confirm('Beta ausschließlich für '+t.email+' freigeben?'))return;
     try{await request('/api/admin/owner-beta/testers/'+encodeURIComponent(t.email)+'/status',{method:'PUT',body:JSON.stringify({status:next})});await loadList();}
     catch(err){status('r15-beta-status',notifyError(err));}
    };
    actions.append(makeButton('Beta freigeben',t.status==='active'||!t.account_exists||!t.email_verified,()=>action('active')),
                   makeButton('Pausieren',t.status==='paused',()=>action('paused')),
                   makeButton('Vormerken',t.status==='planned',()=>action('planned')),
                   makeButton('Entfernen',false,async()=>{
                     if(!confirm('Tester '+t.email+' aus der privaten Liste entfernen? Eine aktive Beta-Freigabe wird dabei pausiert.'))return;
                     try{await request('/api/admin/owner-beta/testers/'+encodeURIComponent(t.email),{method:'DELETE'});await loadList();}
                     catch(err){status('r15-beta-status',notifyError(err));}
                   }));
    row.append(person,actions);target.append(row);
   }
   if(!testers.length){const e=document.createElement('p');e.textContent='Noch keine Tester vorgemerkt.';target.append(e)}
   document.dispatchEvent(new Event('cfs:beta-list-rendered'));
  }catch(err){status('r15-beta-status',notifyError(err));}
 }
 async function init(){
  const panel=el('r15-owner-console');if(!panel)return;
  try{
   const d=await request('/api/admin/desktop/availability');
   if(!d.ok)return; // Owner check is server-side, no private UI for other accounts.
   panel.hidden=false;
   const elevation=await request('/api/admin/creator-suite/elevation').catch(()=>({}));
   const ready=Boolean(d.available&&elevation.active);
   status('r15-download-status',!d.available?'Desktop-Paket auf Render derzeit nicht verfügbar.':!elevation.active?'Owner bestätigt. Bitte zuerst den Admin-Schutz entsperren.':d.type==='source_package'?'Bereit: Windows-Quellpaket zum lokalen Build (keine fertige EXE).':'Bereit: Privates Windows-Archiv.');
   el('r15-admin-download').hidden=!ready;
   if(ready)el('r15-admin-download').textContent=d.type==='source_package'?'Windows-Quellpaket herunterladen':'Admin-PC-Paket herunterladen';
   const form=el('r15-beta-form');form.addEventListener('submit',async ev=>{
     ev.preventDefault();const button=el('r15-beta-add');button.disabled=true;
     try{await request('/api/admin/owner-beta/testers',{method:'POST',body:JSON.stringify({email:el('r15-beta-email').value,label:el('r15-beta-label').value,notes:el('r15-beta-notes').value})});form.reset();await loadList();}
     catch(err){status('r15-beta-status',notifyError(err))}finally{button.disabled=false;}
   });
   el('r15-beta-refresh').addEventListener('click',loadList);await loadList();
  }catch{ /* Hide entire private panel for unauthorized or unconfigured accounts. */ }
 }
 document.addEventListener('DOMContentLoaded',init,{once:true});
})();
