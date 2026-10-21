/* R80 · Existing beta feedback, permission refresh and secure session write. */
(()=>{"use strict";
 const $=id=>document.getElementById(id);
 async function api(url,options={}){
  const headers={Accept:"application/json",...(options.headers||{})};
  if(options.method&&options.method!=="GET"){
   const token=typeof CFS!=="undefined"&&typeof CFS.csrfToken==="function"?CFS.csrfToken():"";
   if(token)headers["X-CSRF-Token"]=token;
   headers["Content-Type"]="application/json";
  }
  const response=await fetch(url,{credentials:"same-origin",cache:"no-store",...options,headers});
  const body=await response.json().catch(()=>({}));
  if(!response.ok){const err=new Error(body.error||`HTTP ${response.status}`);err.status=response.status;throw err;}
  return body;
 }
 const line=(parent,tag,content,cls)=>{const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=String(content??"");parent.append(el);return el;};
 const date=x=>x?new Date(x).toLocaleString("de-DE"):"–";
 function initOwner(){
  if(!$('r15-owner-console')||!$('r77-feedback-list'))return;
  let reports=[];
  function render(){
   const list=$('r77-feedback-list');list.replaceChildren();const filter=$('r77-feedback-filter').value;
   const filtered=reports.filter(r=>filter==="all"||filter==="open"&&["new","reviewing"].includes(r.status)||filter==="critical"&&r.severity==="critical"||filter==="closed"&&["fixed","closed"].includes(r.status));
   if(!filtered.length){line(list,'p','Keine passenden Berichte.');return;}
   for(const r of filtered){
    const card=line(list,'article','','r77-report');
    line(card,'strong',r.title);line(card,'small',`${r.tester_name} · ${r.tester_email} · ${r.severity} · ${r.category} · ${r.status}`);
    line(card,'small',`Teststand: ${r.test_build||'nicht angegeben'} · ${date(r.created_at)}`);
    line(card,'p',r.description,'r77-report-description');
    const form=document.createElement('form');form.className='r77-report-edit';
    const select=document.createElement('select');select.setAttribute('aria-label',`Status: ${r.title}`);
    for(const [val,label] of [['new','Neu'],['reviewing','In Bearbeitung'],['fixed','Behoben'],['closed','Geschlossen']]){
     const opt=document.createElement('option');opt.value=val;opt.textContent=label;select.append(opt);
    }select.value=r.status;
    const notes=document.createElement('input');notes.maxLength=2000;notes.value=r.admin_notes||'';notes.placeholder='Interne Notiz (max. 2000 Zeichen)';notes.setAttribute('aria-label',`Notiz: ${r.title}`);
    const button=document.createElement('button');button.type='submit';button.textContent='Speichern';
    const msg=document.createElement('span');msg.setAttribute('role','status');
    $('r80-check-access')?.addEventListener('click',load);
  form.addEventListener('submit',async e=>{e.preventDefault();button.disabled=true;
     try{await api('/api/admin/owner-beta/feedback/'+encodeURIComponent(r.id),{method:'PUT',body:JSON.stringify({status:select.value,admin_notes:notes.value,updated_at:r.updated_at})});
      await load();}
     catch(error){msg.textContent=error.status===409?'Zwischenzeitlich geändert: bitte aktualisieren.':error.message;button.disabled=false;}
    });form.append(select,notes,button,msg);card.append(form);list.append(card);
   }
  }
  async function load(){try{const data=await api('/api/admin/owner-beta/feedback');reports=Array.isArray(data.reports)?data.reports:[];
   const counts=data.counts||{};$('r77-feedback-summary').textContent=`${Number(counts.new||0)+Number(counts.reviewing||0)} offen · ${Number(counts.fixed||0)+Number(counts.closed||0)} bearbeitet · ${reports.length} letzte Berichte`;
   render();}catch(error){reports=[];$('r77-feedback-list').replaceChildren();$('r77-feedback-summary').textContent=error.status===428?'Bitte zuerst Admin-Schutz entsperren.':error.message;}}
  $('r77-feedback-refresh').addEventListener('click',load);$('r77-feedback-filter').addEventListener('change',render);
  // R15 reveals the owner console only after server authentication.
  document.addEventListener("cfs:beta-list-rendered",load);
  if(!$('r15-owner-console').hidden)load();
 }
 function initTester(){
  const form=$('r77-feedback-form');if(!form)return;
  let items=[];
  function hidePrivateHistory(){items=[];form.hidden=true;$('r77-my-feedback').replaceChildren();}
  function render(){const host=$('r77-my-feedback');host.replaceChildren();
   if(!items.length){line(host,'p','Noch keine Meldung vorhanden.');return;}
   for(const item of items){const card=line(host,'article','','r77-report');line(card,'strong',item.title);line(card,'small',`${item.status} · ${item.test_build||''} · ${date(item.created_at)}`);line(card,'p',item.description);}
  }
  async function load(){try{const data=await api('/api/creator/beta-web-feedback');items=Array.isArray(data.feedback)?data.feedback:[];form.hidden=false;
   $('r77-web-access').textContent='Beta-Zugriff bestätigt. Deine Meldungen sind nicht öffentlich.';render();}
   catch(error){hidePrivateHistory();$('r77-web-access').textContent=error.status===403?'Nur für freigeschaltete Beta-Tester.':error.status===401?'Bitte zuerst anmelden.':error.message;}}
  $('r80-check-access')?.addEventListener('click',load);
  form.addEventListener('submit',async e=>{e.preventDefault();const b=$('r77-send-feedback');b.disabled=true;
   const payload=Object.fromEntries(new FormData(form));
   try{await api('/api/creator/beta-web-feedback',{method:'POST',body:JSON.stringify(payload)});
    form.elements.title.value='';form.elements.description.value='';await load();$('r77-web-access').textContent='Bericht gespeichert. Es wurde keine E-Mail verschickt.';}
   catch(error){if(error.status===401||error.status===403)hidePrivateHistory();$('r77-web-access').textContent=error.status===401?'Bitte zuerst anmelden.':error.status===403?'Zugriff oder Sicherheits-Token nicht mehr gültig. Bitte Seite neu laden.':error.message;}finally{b.disabled=false;}
  });load();
 }
 document.addEventListener('DOMContentLoaded',()=>{initOwner();initTester();},{once:true});
})();
