/* R55 · Scene layers: stable, read-only filtering and safe movement eligibility. */
(function(root){'use strict';
function ordered(items){
 if(!Array.isArray(items))return [];
 return items.map((item,index)=>({item,index})).sort((a,b)=>(Number(b.item.z_index)||0)-(Number(a.item.z_index)||0)||b.index-a.index).map(entry=>entry.item);
}
function matches(item,widget,query){
 const needle=String(query||'').trim().toLocaleLowerCase('de');
 if(!needle)return true;
 return [widget?.name,widget?.widget_type,item?.id].some(value=>String(value||'').toLocaleLowerCase('de').includes(needle));
}
function canMove(items,id,direction){
 if(direction!==1&&direction!==-1)return false;
 const list=ordered(items),index=list.findIndex(item=>String(item.id)===String(id));
 if(index<0||list[index].locked===true)return false;
 const neighbor=list[index-(direction===1?1:-1)];
 return Boolean(neighbor&&!neighbor.locked);
}
root.CFSR55SceneLayers=Object.freeze({ordered,matches,canMove});
})(typeof window!=='undefined'?window:globalThis);
