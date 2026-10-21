/* R75 · No invitations without owner confirmation. Server gates are authoritative. */
(()=>{"use strict";
 const $=id=>document.getElementById(id),selected=new Set();let unlocked=false,mailReady=false,testers=[];
 const message=text=>{const e=$("r75-message");if(e)e.textContent=text;};
 async function api(url,options={}){
  const headers={Accept:"application/json",...(options.headers||{})};
  if(options.method&&options.method!=="GET"){
   const token=typeof CFS!=="undefined"&&typeof CFS.csrfToken==="function"?CFS.csrfToken():"";
   if(token)headers["X-CSRF-Token"]=token;
   headers["Content-Type"]="application/json";
  }
  const r=await fetch(url,{credentials:"same-origin",cache:"no-store",...options,headers});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);
  return data;
 }
 const authNotice=e=>e.message?.includes("428")?"Admin-Schutz erneut entsperren.":e.message||"Unbekannter Fehler";
 function renderControls(){
  $("r75-gate-label").textContent=unlocked?"Private Einladungen freigegeben":"Einladungen gesperrt";
  $("r75-gate-label").classList.toggle("is-open",unlocked);
  $("r75-launch-toggle").textContent=unlocked?"Neue Einladungen wieder sperren":"Beta-Einladungen freigeben";
  $("r75-launch-help").textContent=unlocked?
   "Freigabe aktiv. Nur einzeln ausgewählte und ausdrücklich bestätigte E-Mails werden in die Versandwarteschlange eingestellt. Tester-Zugang bleibt separat zu genehmigen.":
   "Noch nicht gestartet. Vormerken, auswählen und E-Mail-Vorschauen sind möglich; Versand und neue Beta-Freigaben bleiben gesperrt.";
  $("r75-selected-count").textContent=`${selected.size} Tester ausgewählt`;
  const counts={pending:0,sending:0,sent:0,dead:0,cancelled:0};
  for(const t of testers){const state=t.invitation_delivery_status;if(Object.hasOwn(counts,state))counts[state]++;if(t.invitation_cancelled)counts.cancelled++;}
  const summary=$("r76-delivery-summary");if(summary)summary.textContent=
   `Einladungen: ${counts.pending} wartend · ${counts.sending} in Bearbeitung · ${counts.sent} an Maildienst übergeben · ${counts.cancelled} abgebrochen · ${counts.dead-counts.cancelled} fehlgeschlagen. Eine Übergabe ist keine Zustellbestätigung.`;
  $("r75-preview-button").disabled=selected.size!==1;
  $("r75-send-button").disabled=!unlocked||!mailReady||selected.size===0||selected.size>10;
  if(!mailReady)$("r75-launch-help").textContent+=" Der Mail-Webhook ist noch nicht konfiguriert; Versand bleibt deaktiviert.";
 }
 async function load(){
  const data=await api("/api/admin/owner-beta/testers");
  testers=Array.isArray(data.testers)?data.testers:[];
  const gate=data.invitation_gate||{};unlocked=gate.approved===true;mailReady=gate.mail_configured===true;
  const list=$("r15-beta-list");
  if(list){
   // R15 owns the list rendering. Insert independent selection controls into its rows
   // by reading the DOM text-free, stable server ordering returned above.
   [...list.querySelectorAll(".r75-tester-select,.r75-delivery-state,.r76-cancel-invite")].forEach(x=>x.remove());
   const byEmail=new Map(testers.map(t=>[t.email,t]));
   const rows=[...list.querySelectorAll(".r15-beta-row")];
   rows.forEach(row=>{
    const t=byEmail.get(row.dataset.betaEmail);if(!t)return;
    const wrap=document.createElement("label");wrap.className="r75-tester-select";
    const cb=document.createElement("input");cb.type="checkbox";cb.className="r75-tester-select";cb.checked=selected.has(t.email);cb.disabled=t.status!=="planned";
    cb.setAttribute("aria-label",`Einladung auswählen: ${t.email}`);
    cb.addEventListener("change",()=>{if(cb.checked)selected.add(t.email);else selected.delete(t.email);renderControls();});
    wrap.append(cb);row.prepend(wrap);
    const meta=row.querySelector(".r15-beta-person small");
    if(meta&&t.invitation_delivery_status!=="not_sent"){
     const short={pending:"Wartet auf Versand",sending:"Wird übertragen",sent:"An Maildienst übergeben",dead:t.invitation_cancelled?"Abgebrochen":"Versand fehlgeschlagen"};
     const label=document.createElement("span");label.className="r75-delivery-state";label.textContent=` · Einladung: ${short[t.invitation_delivery_status]||"Unbekannt"}`;meta.append(label);
    }
    if(t.invitation_delivery_status==="pending"){
     const actions=row.querySelector(".r15-beta-actions");
     if(actions){const cancel=document.createElement("button");cancel.type="button";cancel.className="r76-cancel-invite";cancel.textContent="Einladung abbrechen";
      cancel.addEventListener("click",async()=>{
       if(!confirm(`Wartende Einladung an ${t.email} abbrechen? Bereits gestartete E-Mails sind nicht rückrufbar.`))return;
       const confirmation=prompt("Zur Bestätigung EINLADUNG ABBRECHEN eingeben:");
       if(confirmation!=="EINLADUNG ABBRECHEN")return;
       cancel.disabled=true;
       try{await api("/api/admin/owner-beta/invitations/"+encodeURIComponent(t.email)+"/cancel",{method:"POST",body:JSON.stringify({confirmation})});
        await refreshAfterOldList();message("Wartende Einladung abgebrochen. Es wurden keine Beta-Rechte vergeben.");
       }catch(err){message(authNotice(err));cancel.disabled=false;}
      });actions.append(cancel);}
    }
   });
  }
  const known=new Set(testers.filter(t=>t.status==="planned").map(t=>t.email));
  for(const email of selected)if(!known.has(email))selected.delete(email);
  renderControls();
 }
 async function searchCandidates(){
  const target=$("r75-candidates"),q=$("r75-candidate-query").value.trim();target.replaceChildren();
  if(q.length<3){target.textContent="Mindestens drei Zeichen eingeben.";return;}
  try{
   const {creators=[]}=await api("/api/admin/owner-beta/candidates?q="+encodeURIComponent(q));
   if(!creators.length)target.textContent="Keine passenden, noch nicht vorgemerkten Creator gefunden.";
   for(const c of creators){
    const row=document.createElement("div");row.className="r75-candidate";
    const label=document.createElement("span");label.textContent=`${c.label||"Creator"} · ${c.email}${c.verified?" · bestätigt":" · noch unbestätigt"}`;
    const b=document.createElement("button");b.type="button";b.textContent="Vormerken";
    b.addEventListener("click",async()=>{b.disabled=true;
     try{await api("/api/admin/owner-beta/testers",{method:"POST",body:JSON.stringify({email:c.email,label:c.label})});
      target.replaceChildren();message("Creator vorgemerkt. Noch keine Einladung versandt.");await refreshAfterOldList();
     }catch(err){message(authNotice(err));b.disabled=false;}
    });row.append(label,b);target.append(row);
   }
  }catch(err){message(authNotice(err));}
 }
 async function refreshAfterOldList(){
  // A click on the pre-existing refresh button triggers R15, then R75 reloads.
  const rendered=new Promise(resolve=>{
   const done=()=>resolve();document.addEventListener("cfs:beta-list-rendered",done,{once:true});
   setTimeout(done,2000);
  });
  $("r15-beta-refresh").click();await rendered;await load();
 }
 async function init(){
  if(!$("r75-invitations-title"))return;
  // Owner panel stays hidden unless server proved ownership.
  $("r75-candidate-search").addEventListener("click",searchCandidates);
  $("r76-refresh-deliveries").addEventListener("click",async()=>{try{await refreshAfterOldList();message("Versandstatus aktualisiert.");}catch(err){message(authNotice(err));}});
  $("r75-candidate-query").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchCandidates();}});
  document.addEventListener("cfs:beta-list-rendered",()=>load().catch(err=>message(authNotice(err))));
  $("r75-launch-toggle").addEventListener("click",async()=>{
   const target=!unlocked,phrase=target?"BETA STARTEN":"BETA STOPPEN";
   if(target&&!confirm("Hast du die Website geprüft und willst du die private Einladungsphase ausdrücklich freigeben? Es werden noch keine E-Mails versandt."))return;
   const confirmation=prompt(`Zur Bestätigung ${phrase} genau eingeben:`);
   if(confirmation!==phrase){message("Abgebrochen. Keine Änderung vorgenommen.");return;}
   try{const result=await api("/api/admin/owner-beta/invitation-gate",{method:"PUT",body:JSON.stringify({approved:target,confirmation})});
    await refreshAfterOldList();message(target?"Einladungsphase freigegeben. Versand erfolgt erst nach separater Auswahl und Bestätigung.":
     `Einladungsphase gesperrt. ${result.cancelled_pending||0} wartende Aufträge abgebrochen. Bereits gestartete E-Mails können nicht zurückgerufen werden.`);
   }catch(err){message(authNotice(err));}
  });
  $("r75-preview-button").addEventListener("click",async()=>{
   if(selected.size!==1)return;const email=[...selected][0];
   try{const result=await api("/api/admin/owner-beta/invitation-preview?email="+encodeURIComponent(email));
    $("r75-preview-text").textContent=`An: ${result.to}\nBetreff: ${result.subject}\n\n${result.text}`;
    $("r75-preview").hidden=false;message("Nur Vorschau – nichts versandt.");
   }catch(err){message(authNotice(err));}
  });
  $("r75-send-button").addEventListener("click",async()=>{
   const emails=[...selected];if(!unlocked||!mailReady||!emails.length||emails.length>10)return;
   if(!confirm(`${emails.length} ausgewählte Tester per E-Mail einladen? Dies ist ein echter Versandauftrag.`))return;
   const confirmation=prompt("Zur Bestätigung EINLADUNGEN SENDEN eingeben:");
   if(confirmation!=="EINLADUNGEN SENDEN"){message("Versand abgebrochen.");return;}
   const b=$("r75-send-button");b.disabled=true;
   try{const result=await api("/api/admin/owner-beta/invitations",{method:"POST",body:JSON.stringify({emails,confirmation})});
    selected.clear();await refreshAfterOldList();message(`${result.queued} Einladungen in die Warteschlange gestellt. Zustellung gesondert prüfen.`);
   }catch(err){message(authNotice(err));}finally{renderControls();}
  });
  // R15 loads once on DOMContentLoaded. Let it populate the list; avoid rendering unauthorized data.
  try{await load();}catch(err){message(authNotice(err));}
 }
 document.addEventListener("DOMContentLoaded",()=>{setTimeout(init,100);},{once:true});
})();
