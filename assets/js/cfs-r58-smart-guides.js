/* R58: Deterministic canvas-pixel snapping; no dependencies or DOM access. */
(function(root){'use strict';
 const steps=Object.freeze([5,10,20,40]);
 const validStep=v=>steps.includes(Number(v))?Number(v):5;
 const finite=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
 const round=v=>Math.round(v);
 function alignAxis(position,size,canvas,step,threshold){
  const p=finite(position),s=Math.max(0,finite(size)),limit=Math.max(1,finite(canvas,1)),distance=Math.max(0,finite(threshold,6));
  const candidates=[
   {p:0,guide:0,type:'edge'},
   {p:limit*.05,guide:limit*.05,type:'safe'},
   {p:(limit-s)/2,guide:limit/2,type:'center'},
   {p:limit*.95-s,guide:limit*.95,type:'safe'},
   {p:limit-s,guide:limit,type:'edge'}
  ];
  let closest=null;
  for(const candidate of candidates){const delta=Math.abs(p-candidate.p);
   if(delta<=distance&&(!closest||delta<closest.delta)){closest={...candidate,delta}}}
  if(closest)return {value:round(closest.p),guide:closest.guide,type:closest.type};
  return {value:round(p/validStep(step))*validStep(step),guide:null,type:'grid'};
 }
 function move({startX=0,startY=0,dx=0,dy=0,width=0,height=0,canvasWidth=1,canvasHeight=1,step=5,enabled=true,threshold=6}={}){
  const wantedX=finite(startX)+finite(dx),wantedY=finite(startY)+finite(dy);
  if(!enabled)return {dx:round(dx),dy:round(dy),guideX:null,guideY:null};
  const x=alignAxis(wantedX,width,canvasWidth,step,threshold),y=alignAxis(wantedY,height,canvasHeight,step,threshold);
  return {dx:x.value-round(finite(startX)),dy:y.value-round(finite(startY)),guideX:x.guide,guideY:y.guide};
 }
 function resize(width,height,dx,dy,step=5,enabled=true){
  const size=(value,delta)=>Math.max(10,enabled?Math.round((finite(value)+finite(delta))/validStep(step))*validStep(step):round(finite(value)+finite(delta)));
  return {width:size(width,dx),height:size(height,dy)};
 }
 root.CFSR58SmartGuides=Object.freeze({steps,validStep,alignAxis,move,resize});
})(typeof window!=='undefined'?window:globalThis);
