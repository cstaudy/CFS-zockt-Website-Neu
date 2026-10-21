/* R14: authenticated read-only aggregation of existing admin endpoints.
   Stripe financials require existing strong admin elevation. No secrets in DOM or storage. */
(()=>{'use strict';
 const by=id=>document.getElementById(id),put=(id,value)=>{const e=by(id);if(e)e.textContent=String(value)};
 const fmt=(minor,currency='EUR')=>new Intl.NumberFormat('de-DE',{style:'currency',currency}).format(Number(minor)/100);
 const request=async path=>{const r=await fetch(path,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});if(!r.ok){const e=new Error('HTTP '+r.status);e.code=r.status;throw e;}return r.json()};
 function financeReset(){for(const id of ['r14-gross','r14-refunds','r14-net','r14-invoices'])put(id,'–');by('r14-other-currencies')?.replaceChildren()}
 async function loadFinance(){financeReset();const month=by('r14-finance-month')?.value||'';if(!/^20\d\d-(0[1-9]|1[0-2])$/.test(month))return;
   try{const data=await request('/api/admin/creator-suite/finance-report?month='+encodeURIComponent(month));const report=data.report||{}, rows=report.currencies||[];
     const euro=rows.find(x=>String(x.currency).toUpperCase()==='EUR');
     // A missing EUR row is not a confirmed zero, even if other currencies exist.
     if(euro){put('r14-gross',fmt(euro.gross_minor));put('r14-refunds',fmt(euro.refund_minor));put('r14-net',fmt(euro.net_before_fees_minor));}
     put('r14-invoices',report.invoice_count??'–');
     const other=by('r14-other-currencies');for(const x of rows.filter(x=>String(x.currency).toUpperCase()!=='EUR')){const p=document.createElement('p');p.className='r14-stat';p.textContent=String(x.currency).toUpperCase()+': '+fmt(x.gross_minor,x.currency)+' brutto · '+fmt(x.net_before_fees_minor,x.currency)+' vor Gebühren';other?.append(p)}
     put('r14-finance-state',(report.mode==='live'?'LIVE-Webhookdaten':'TESTMODUS · Keine echten Einnahmen')+' · Nur erfasste und zugeordnete Webhooks; keine vollständige Stripe-Historie, Steuern, Gebühren oder Auszahlungen.'+(report.truncated?' · Ereignisse abgeschnitten.':''));
   }catch(error){put('r14-finance-state',error.code===428?'GESCHÜTZT: Entsperre zuerst in Creator Control den Admin-Schutz und aktualisiere anschließend.':error.code===403?'Kein Zugriff auf vertrauliche Finanzdaten.':'Finanzdaten nicht verfügbar ('+String(error.message)+'). Es wird bewusst kein Umsatz geschätzt.');}
 }
 async function load(){const button=by('r14-refresh');if(button)button.disabled=true;
   put('r14-ops-state','Prüfe Eigentümer- und Adminberechtigung …');
   try{const me=await request('/api/account/me');if(!me?.authenticated||me?.admin!==true)throw Object.assign(new Error('Admin-Berechtigung fehlt'),{code:403});
     const summary=await request('/api/admin/control-center/summary');
     if(!summary?.ok)throw new Error('Kein bestätigter Adminstatus');
     put('r14-creators',summary.creators??'–');put('r14-products',summary.shop?.products??'–');put('r14-published',summary.shop?.published??'–');put('r14-drafts',summary.website?.dirty??'–');
     put('r14-ops-state','Berechtigt · Serverdaten '+(summary.generated_at?new Date(summary.generated_at).toLocaleString('de-DE'):'geladen'));
     // Deliberately independent: one offline subsystem must not blank others.
     const results=await Promise.allSettled([request('/api/creator/cfs-ai/status'),request('/api/creator/cfs-ai/bridge')]);
     if(results[0].status==='fulfilled') {const ai=results[0].value;put('r14-ai-gateway',ai.gateway?.enabled===true?'Konfiguriert / aktiv':'Deaktiviert');
       const service=ai.service?.ollama||ai.service;put('r14-ai-service',service?.online===true||service?.ok===true?'Online':'Nicht bestätigt');put('r14-transport',ai.gateway?.transport||'–');}
     else {put('r14-ai-gateway','Nicht erreichbar');put('r14-ai-service','Nicht bestätigt');}
     if(results[1].status==='fulfilled'){const d=results[1].value;const stamp=d.worker?.last_seen_at||d.worker?.updated_at;const fresh=stamp&&Date.now()-new Date(stamp).getTime()<45000&&Date.now()-new Date(stamp).getTime()>-120000;put('r14-bridge',fresh?'Online':'Nicht bestätigt');if(d.transport)put('r14-transport',d.transport)}
     else put('r14-bridge','Nicht erreichbar');
     await loadFinance();
   }catch(error){put('r14-ops-state',error.code===403?'Kein Admin-Zugriff. Zugang nur mit berechtigtem Account.':'Adminübersicht nicht erreichbar: '+error.message);}
   finally{if(button)button.disabled=false;}
 }
 document.addEventListener('DOMContentLoaded',()=>{if(!by('r14-ops'))return;by('r14-finance-month').value=new Date().toLocaleDateString('sv-SE').slice(0,7);by('r14-refresh').addEventListener('click',load);by('r14-finance-month').addEventListener('change',loadFinance);load();},{once:true});
})();
