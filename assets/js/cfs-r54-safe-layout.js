/* R54 · Pure, side-effect-free safe-area geometry shared by creative editors. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CFSR54SafeLayout=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const valid=v=>Number.isFinite(Number(v));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function sceneGeometry(width,height,scale=1,angle=0){
  const w=Number(width),h=Number(height),s=Number(scale),rad=Number(angle)*Math.PI/180;
  if(![w,h,s,rad].every(Number.isFinite)||w<=0||h<=0||s<=0)return null;
  const c=Math.cos(rad)*s,t=Math.sin(rad)*s;
  const xx=[0,w*c,-h*t,w*c-h*t],yy=[0,w*t,h*c,w*t+h*c];
  const minX=Math.min(...xx),minY=Math.min(...yy),maxX=Math.max(...xx),maxY=Math.max(...yy);
  return {minX,minY,maxX,maxY,width:maxX-minX,height:maxY-minY};
}
function sceneBounds(x,y,width,height,scale=1,rotation=0){
 const g=sceneGeometry(width,height,scale,rotation);return g?{x:Number(x)+g.minX,y:Number(y)+g.minY,w:g.width,h:g.height}:null;
}
function fitScene(item,source,canvas,margins){
 if(!item||item.locked||!source||!canvas)return null;
 const w=Number(source.width),h=Number(source.height),cw=Number(canvas.width),ch=Number(canvas.height);
 const left=Number(margins?.left??0),right=Number(margins?.right??left),top=Number(margins?.top??0),bottom=Number(margins?.bottom??top);
 if(![w,h,cw,ch,left,right,top,bottom].every(Number.isFinite)||Math.min(w,h,cw,ch)<=0||Math.min(left,right,top,bottom)<0||cw<=left+right||ch<=top+bottom)return null;
 const angle=Number(item.rotation)||0;
 const base=sceneGeometry(w,h,1,angle);if(!base)return null;
 const initial=valid(item.scale)?clamp(Number(item.scale),.1,5):1;
 // Never upscale a source image merely to occupy the safety zone.
 const scale=clamp(Math.min(initial,(cw-left-right)/base.width,(ch-top-bottom)/base.height),.1,5);
 const g=sceneGeometry(w,h,scale,angle);
 if(g.width>cw-left-right+0.001||g.height>ch-top-bottom+0.001)return null; // server's minimum scale cannot fit
 const x=Math.round(left+(cw-left-right-g.width)/2-g.minX),y=Math.round(top+(ch-top-bottom-g.height)/2-g.minY);
 const next={x,y,scale:Math.round(scale*10000)/10000};
 // Rounding must not cause an overrun: lower scale very slightly when needed.
 const r=sceneBounds(next.x,next.y,w,h,next.scale,angle);
 if(r.x<left-1||r.y<top-1||r.x+r.w>cw-right+1||r.y+r.h>ch-bottom+1)return null;
 return next;
}
function safeBox(box,inset=5){
 if(!box||typeof box!=='object')return null;
 const raw=[box.x,box.y,box.w,box.h];if(!raw.every(valid))return null;
 const margin=clamp(Number(inset),0,25),max=100-2*margin;
 const w=clamp(Number(box.w),5,max),h=clamp(Number(box.h),5,max);
 return {x:clamp(Number(box.x),margin,100-margin-w),y:clamp(Number(box.y),margin,100-margin-h),w,h};
}
function boxPixelSize(box,width,height){
 if(!box||![width,height,box.w,box.h].every(valid))return null;
 return {width:Math.round(Number(box.w)*Number(width)/100),height:Math.round(Number(box.h)*Number(height)/100)};
}
return Object.freeze({sceneGeometry,sceneBounds,fitScene,safeBox,boxPixelSize});
});
