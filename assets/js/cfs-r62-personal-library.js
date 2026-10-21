/* R62 - deterministic merge for personal templates including deletion markers. */
(function(root,factory){"use strict";const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;if(root)root.CFSR62PersonalLibrary=api})(typeof globalThis!=="undefined"?globalThis:this,function(){"use strict";
 const stamp=item=>{const n=Date.parse(item?.deletedAt||item?.updatedAt||item?.createdAt||"");return Number.isFinite(n)?n:0};
 const validId=id=>typeof id==="string"&&/^[a-zA-Z0-9_-]{1,80}$/.test(id);
 function reconcile(local,remote,localDeleted,remoteDeleted,limit=16){
  const tombstones=new Map();for(const item of [...(Array.isArray(remoteDeleted)?remoteDeleted:[]),...(Array.isArray(localDeleted)?localDeleted:[])]){
   if(!item||!validId(item.id)||!item.deletedAt||!stamp(item))continue;
   const previous=tombstones.get(item.id);if(!previous||stamp(item)>stamp(previous))tombstones.set(item.id,{id:item.id,deletedAt:item.deletedAt});
  }
  const map=new Map();for(const item of [...(Array.isArray(remote)?remote:[]),...(Array.isArray(local)?local:[])]){
   if(!item||!validId(item.id)||!item.design||!item.widgetType)continue;
   const previous=map.get(item.id);if(!previous||stamp(item)>=stamp(previous))map.set(item.id,item);
  }
  for(const [id,item] of map){if(stamp(tombstones.get(id))>=stamp(item)&&tombstones.has(id))map.delete(id)}
  const designs=[...map.values()].sort((a,b)=>stamp(b)-stamp(a)).slice(0,limit);
  const active=new Map(designs.map(item=>[item.id,item]));
  const deleted=[...tombstones.values()].filter(item=>!active.has(item.id)||stamp(item)>=stamp(active.get(item.id))).sort((a,b)=>stamp(b)-stamp(a)).slice(0,64);
  return {designs,deleted};
 }
 function rename(list,id,name,now){const entry=(Array.isArray(list)?list:[]).find(item=>item?.id===id);if(!entry)throw Error("Vorlage nicht gefunden.");const value=String(name||"").replace(/[\u0000-\u001f\u007f<>]/g,"").replace(/\s+/g," ").trim().slice(0,50);if(!value)throw Error("Bitte einen Namen eingeben.");if(list.some(item=>item.id!==id&&item.widgetType===entry.widgetType&&String(item.name).toLocaleLowerCase("de-DE")===value.toLocaleLowerCase("de-DE")))throw Error("Dieser Vorlagenname ist bereits vergeben.");return list.map(item=>item.id===id?{...item,name:value,design:{...item.design,name:value},updatedAt:now}:item)}
 return Object.freeze({reconcile,rename,stamp});
});
