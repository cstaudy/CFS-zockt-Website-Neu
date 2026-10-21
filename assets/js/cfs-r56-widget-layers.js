/* R56 · Widget layers: stable ordering, filtering, range selection and batch edits. */
(function(root){'use strict';
 function ordered(items){
  if(!Array.isArray(items))return [];
  return items.map((item,index)=>({item,index})).sort((a,b)=>(Number(b.item.zIndex)||0)-(Number(a.item.zIndex)||0)||b.index-a.index).map(entry=>entry.item);
 }
 function filtered(items,query){
  const needle=String(query||'').trim().toLocaleLowerCase('de');
  if(!needle)return [...items];
  return items.filter(item=>[item?.name,item?.type,item?.id].some(value=>String(value||'').toLocaleLowerCase('de').includes(needle)));
 }
 function range(ids,anchor,id){
  const a=ids.indexOf(anchor),b=ids.indexOf(id);
  return a<0||b<0?ids.includes(id)?[id]:[]:ids.slice(Math.min(a,b),Math.max(a,b)+1);
 }
 function batch(items,mode){
  const property=mode==='show'||mode==='hide'?'visible':mode==='lock'||mode==='unlock'?'locked':null;
  if(!property)return false;
  const target=mode==='show'||mode==='lock';let changed=false;
  items.forEach(item=>{if(Boolean(item[property]??(property==='visible'))!==target){item[property]=target;changed=true}});
  return changed;
 }
 root.CFSR56WidgetLayers=Object.freeze({ordered,filtered,range,batch});
})(typeof window!=='undefined'?window:globalThis);
