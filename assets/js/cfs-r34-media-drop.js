/* R34 – Präziser lokaler Bildimport in bestehende Creator-Bereiche.
   Client-Validierung ergänzt Serverprüfung, sie ersetzt keine Backend-Sicherheitschecks. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CFSR34MediaDrop=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  const TYPES=Object.freeze(['image/png','image/jpeg','image/webp']);
  const MAX_BYTES=20*1024*1024; // vom geschützten Upload-Endpunkt; Server bleibt maßgeblich
  function validate(files){
    const list=Array.from(files||[]);
    if(list.length!==1)throw new Error(list.length?'Bitte genau ein Bild ablegen. Mehrere Dateien gehören in die Medienbibliothek.':'Bitte eine Bilddatei auswählen.');
    const file=list[0],type=String(file?.type||'').toLowerCase();
    if(!TYPES.includes(type))throw new Error('Nur PNG, JPG oder WebP. SVG, GIF und andere Dateien werden hier nicht übernommen.');
    if(!Number.isFinite(file?.size)||file.size<=0)throw new Error('Die Bilddatei ist leer oder beschädigt.');
    if(file.size>MAX_BYTES)throw new Error('Das Bild darf höchstens 20 MB groß sein.');
    return file;
  }
  function hasFiles(event){return Array.from(event?.dataTransfer?.types||[]).includes('Files');}
  function bind(zone,{receive,onError}={}){
    if(!zone||typeof zone.addEventListener!=='function')return()=>{};
    let depth=0;
    const active=value=>{zone.classList.toggle('dragging',value);zone.setAttribute('data-cfs-r34-drag',value?'1':'0')};
    const reset=()=>{depth=0;active(false)};
    const handlers={
      dragenter(event){if(!hasFiles(event))return;event.preventDefault();event.stopPropagation();depth++;active(true)},
      dragover(event){if(!hasFiles(event))return;event.preventDefault();event.stopPropagation();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';active(true)},
      dragleave(event){if(!hasFiles(event)&&!depth)return;event.preventDefault();event.stopPropagation();depth=Math.max(0,depth-1);if(!depth)active(false)},
      drop(event){if(!hasFiles(event))return;event.preventDefault();event.stopPropagation();reset();try{const file=validate(event.dataTransfer?.files);if(typeof receive==='function')Promise.resolve().then(()=>receive(file)).catch(error=>{onError?.(error)})}catch(error){onError?.(error)}},
      dragend(){reset()}
    };
    for(const [name,fn] of Object.entries(handlers))zone.addEventListener(name,fn);
    return()=>{for(const [name,fn] of Object.entries(handlers))zone.removeEventListener(name,fn);reset()};
  }
  return Object.freeze({validate,hasFiles,bind,MAX_BYTES,TYPES});
});
