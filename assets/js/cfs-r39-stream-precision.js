/* R39 · mathematically clamped layout actions; no project data leaves the browser. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CFSR39StreamPrecision=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const finite=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function normalize(box){const w=clamp(finite(box?.w,60),5,100),h=clamp(finite(box?.h,30),5,100);return{x:clamp(finite(box?.x),0,100-w),y:clamp(finite(box?.y),0,100-h),w,h};}
function move(box,dx,dy,width,height){const b=normalize(box);const cw=finite(width),ch=finite(height);if(cw<=0||ch<=0)return b;return{...b,x:clamp(Math.round((b.x+finite(dx)/cw*100)*10000)/10000,0,100-b.w),y:clamp(Math.round((b.y+finite(dy)/ch*100)*10000)/10000,0,100-b.h)};}
function align(box,axis){const b=normalize(box);if(axis==='x')b.x=(100-b.w)/2;else if(axis==='y')b.y=(100-b.h)/2;return b;}
function safe(box,inset=5){const b=normalize(box),margin=clamp(finite(inset,5),0,25),limit=100-2*margin;const w=Math.min(limit,b.w),h=Math.min(limit,b.h);return{x:clamp(b.x,margin,100-margin-w),y:clamp(b.y,margin,100-margin-h),w,h};}
function readout(box,width,height){const b=normalize(box);return `${Math.round(b.x*finite(width)/100)} × ${Math.round(b.y*finite(height)/100)} px`}
return{normalize,move,align,safe,readout};
});
