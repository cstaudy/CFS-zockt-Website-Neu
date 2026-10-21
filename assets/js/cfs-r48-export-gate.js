/* R48 · Quality gate for editable widget JSON exports. Read-only and fail-closed. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CFSR48ExportGate=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const evidenceCodes=new Set(['image-limit','frame-alpha-unverified']);
function review(layout,media){
 if(!layout||!media||!Array.isArray(layout.errors)||!Array.isArray(media.errors)||!Array.isArray(media.findings))throw new Error('Qualitätsprüfung unvollständig');
 const errors=layout.errors.length+media.errors.length;
 const additional=media.findings.filter(f=>evidenceCodes.has(f.code));
 const warnings=layout.warnings.length+media.warnings.length+additional.length;
 const blocked=errors>0;
 const live=Number(media.skippedLive)||0;
 const summary=blocked?`${errors} kritische Fehler · ${warnings} Hinweise – Export angehalten`:
  warnings?`Keine kritischen Fehler · ${warnings} Hinweise – Export mit Hinweis möglich`:'Keine kritischen Fehler · Export bereit';
 return {status:blocked?'blocked':warnings?'warning':'ready',blocked,errors,warnings,live,summary,layout,media};
}
function populate(node,decision,{onSelect,onExportDraft}={}){
 if(!node||!decision)return;
 const doc=node.ownerDocument;node.replaceChildren();node.hidden=false;node.dataset.status=decision.status;
 const lead=doc.createElement('strong');lead.textContent=decision.summary;node.appendChild(lead);
 const note=doc.createElement('small');note.textContent='Layout und erreichbare Bilddateien geprüft. Keine endgültige OBS-, Druck- oder Live-Pixel-Freigabe.';node.appendChild(note);
 const errors=decision.media.findings.filter(f=>f.severity==='errors');
 for(const item of errors.slice(0,8)){
  const row=doc.createElement('div');row.className='cfs-r48-export-issue';
  const span=doc.createElement('span');span.textContent=item.text;row.appendChild(span);
  if(item.elementId!=null&&typeof onSelect==='function'){
   const btn=doc.createElement('button');btn.type='button';btn.textContent='AUSWÄHLEN';btn.addEventListener('click',()=>onSelect(item.elementId));row.appendChild(btn);
  }
  node.appendChild(row);
 }
 if(errors.length>8){const rest=doc.createElement('small');rest.textContent=`Weitere ${errors.length-8} Bildfehler gefunden.`;node.appendChild(rest);}
 if(decision.blocked&&typeof onExportDraft==='function'){
  const actions=doc.createElement('div');actions.className='cfs-r48-export-actions';
  const draft=doc.createElement('button');draft.type='button';draft.textContent='ENTWURF TROTZDEM HERUNTERLADEN';draft.addEventListener('click',onExportDraft);actions.appendChild(draft);node.appendChild(actions);
  const hint=doc.createElement('small');hint.textContent='Nur die bearbeitbare JSON-Datei wird heruntergeladen; keine Veröffentlichung und kein OBS-Export.';node.appendChild(hint);
 }
 if(decision.live){const info=doc.createElement('small');info.textContent=`${decision.live} Live-Bildquelle(n) konnten nicht offline geprüft werden.`;node.appendChild(info);}
}
function isUnchanged({widgetId,expectedId,before,current}){
 if(String(widgetId||'')!==String(expectedId||''))return false;
 try{return JSON.stringify(before)===JSON.stringify(current);}catch{return false;}
}
return {review,populate,isUnchanged};
});
