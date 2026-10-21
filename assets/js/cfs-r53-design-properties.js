/* R53 · A tiny shared, pure property model for consistent studio controls. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CFSR53DesignProperties=api;})(typeof window!=='undefined'?window:globalThis,function(){'use strict';
 const bounds=(value,min,max,fallback)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};
 function percent(value){return Math.round(bounds(value,0,1,1)*100);}
 function opacity(value){return bounds(value,0,100,100)/100;}
 const PRESETS=Object.freeze({landscape:Object.freeze({width:1920,height:1080,label:'16:9 · Full HD'}),portrait:Object.freeze({width:1080,height:1920,label:'9:16 · Vertical'}),square:Object.freeze({width:1080,height:1080,label:'1:1 · Quadrat'})});
 function preset(name){const v=PRESETS[name];return v?{width:v.width,height:v.height}:null;}
 function applyPreset(item,name){const dimensions=preset(name);if(!dimensions||!item||typeof item!=='object')return false;const changed=item.width!==dimensions.width||item.height!==dimensions.height;if(changed){item.width=dimensions.width;item.height=dimensions.height;}return changed;}
 return Object.freeze({bounds,percent,opacity,preset,applyPreset,PRESETS});
});
