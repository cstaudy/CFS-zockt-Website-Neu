/* R57: Precise collective transformations, no DOM or server dependencies. */
(function(root){'use strict';
 const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
 const number=v=>Number.isFinite(Number(v))?Number(v):0;
 const coordinate=(element,axis)=>number(element.position?.[axis]);
 const size=(element,axis)=>Math.max(1,number(element.size?.[axis]));
 const editable=items=>Array.isArray(items)?items.filter(item=>item&&!item.locked&&item.position&&item.size&&Number.isFinite(Number(item.size.width))&&Number.isFinite(Number(item.size.height))):[];
 const bounds=items=>({left:Math.min(...items.map(e=>coordinate(e,'x'))),top:Math.min(...items.map(e=>coordinate(e,'y'))),right:Math.max(...items.map(e=>coordinate(e,'x')+size(e,'width'))),bottom:Math.max(...items.map(e=>coordinate(e,'y')+size(e,'height')))});
 const set=(object,key,value)=>{const v=Math.round(value);if(number(object[key])===v)return false;object[key]=v;return true};
 function align(items,mode){
  const list=editable(items);if(list.length<2)return false;
  const box=bounds(list);let changed=false;
  list.forEach(e=>{
   let axis,value;
   switch(mode){
    case 'left':axis='x';value=box.left;break;
    case 'right':axis='x';value=box.right-size(e,'width');break;
    case 'center-x':axis='x';value=(box.left+box.right-size(e,'width'))/2;break;
    case 'top':axis='y';value=box.top;break;
    case 'bottom':axis='y';value=box.bottom-size(e,'height');break;
    case 'center-y':axis='y';value=(box.top+box.bottom-size(e,'height'))/2;break;
    default:return;
   }
   if(value< -2000||value>4000)return;
   changed=set(e.position,axis,value)||changed;
  });
  return changed;
 }
 function distribute(items,axis){
  const list=editable(items);if(list.length<3||!['x','y'].includes(axis))return false;
  const dimension=axis==='x'?'width':'height';
  const sorted=[...list].sort((a,b)=>coordinate(a,axis)-coordinate(b,axis)||String(a.id||'').localeCompare(String(b.id||'')));
  const start=coordinate(sorted[0],axis),end=coordinate(sorted.at(-1),axis)+size(sorted.at(-1),dimension);
  const occupied=sorted.reduce((sum,e)=>sum+size(e,dimension),0),gap=(end-start-occupied)/(sorted.length-1);
  if(gap<0)return false; // No surprise overlaps when there is insufficient room.
  let offset=start,changed=false;
  sorted.forEach((e,i)=>{if(i>0&&i<sorted.length-1)changed=set(e.position,axis,offset)||changed;offset+=size(e,dimension)+gap});
  return changed;
 }
 function match(items,dimension,anchorId){
  if(!['width','height'].includes(dimension)||!Array.isArray(items))return false;
  const list=editable(items);if(list.length<2)return false;
  const anchor=items.find(e=>e&&e.id===anchorId&&e.size)||list[0];
  const target=clamp(Math.round(size(anchor,dimension)),1,4000);let changed=false;
  list.forEach(e=>{changed=set(e.size,dimension,target)||changed});return changed;
 }
 function scale(items,factor){
  const list=editable(items);if(list.length<2||![.9,1.1].includes(factor))return false;
  const box=bounds(list),cx=(box.left+box.right)/2,cy=(box.top+box.bottom)/2;
  const updates=list.map(e=>({element:e,
    x:Math.round(cx+(coordinate(e,'x')-cx)*factor),
    y:Math.round(cy+(coordinate(e,'y')-cy)*factor),
    width:Math.round(size(e,'width')*factor),
    height:Math.round(size(e,'height')*factor)}));
  // Reject the whole operation when any item would violate editor/server limits.
  if(updates.some(u=>u.width<1||u.height<1||u.width>4000||u.height>4000||u.x< -2000||u.y< -2000||u.x>4000||u.y>4000))return false;
  let changed=false;updates.forEach(u=>{
   for(const prop of ['x','y'])changed=set(u.element.position,prop,u[prop])||changed;
   for(const prop of ['width','height'])changed=set(u.element.size,prop,u[prop])||changed;
  });return changed;
 }
 function apply(items,action,anchorId){
  if(String(action).startsWith('align-'))return align(items,String(action).slice(6));
  if(action==='distribute-x'||action==='distribute-y')return distribute(items,action.at(-1));
  if(action==='match-width'||action==='match-height')return match(items,action.slice(6),anchorId);
  if(action==='scale-up')return scale(items,1.1);
  if(action==='scale-down')return scale(items,.9);
  return false;
 }
 root.CFSR57Geometry=Object.freeze({align,distribute,match,scale,apply});
})(typeof window!=='undefined'?window:globalThis);
