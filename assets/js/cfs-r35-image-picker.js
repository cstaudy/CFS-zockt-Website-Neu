/* R35 – Kompakte Suche in eigenen Umwandler-Bildern; keine externen Daten. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CFSR35ImagePicker=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  function fold(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').toLocaleLowerCase('de').trim();}
  function search(images,query,selectedId){
    const list=Array.isArray(images)?images:[];
    const q=fold(query);
    const matching=q?list.filter(asset=>fold(`${asset.name||''} ${asset.original_name||''} ${asset.format||''}`).includes(q)):list.slice();
    const selected=list.find(asset=>String(asset.id)===String(selectedId)&&selectedId!=='' );
    // Never silently unselect a design just because the query changed.
    const selectedOutside=Boolean(selected&&!matching.some(item=>String(item.id)===String(selected.id)));
    return {items:selectedOutside?[selected,...matching]:matching,matches:matching.length,total:list.length,selectedOutside};
  }
  return Object.freeze({fold,search});
});
