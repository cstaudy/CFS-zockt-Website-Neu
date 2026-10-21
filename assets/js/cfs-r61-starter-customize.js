/* R61: Preview-safe, immutable starter color sets. No network or storage. */
(function(root,factory){"use strict";const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;if(root)root.CFSR61StarterCustomize=api})(typeof globalThis!=="undefined"?globalThis:this,function(){"use strict";
 const palettes=Object.freeze([
  Object.freeze({id:"original",label:"Original",main:"#148cff",second:"#20d4e6",minor:"#4eb7ff"}),
  Object.freeze({id:"mint",label:"Türkis",main:"#09b9ae",second:"#8bf5d2",minor:"#70e9dd"}),
  Object.freeze({id:"violet",label:"Violett",main:"#9065ef",second:"#e2a1fb",minor:"#ba9cff"}),
  Object.freeze({id:"gold",label:"Gold",main:"#e5a83c",second:"#ffe39a",minor:"#f7c46c"}),
  Object.freeze({id:"coral",label:"Koralle",main:"#fa6c68",second:"#ffc69c",minor:"#ffaaa1"})
 ]);
 function resolve(id){return palettes.find(p=>p.id===id)||palettes[0]}
 function cleanName(value,fallback="Mein Design"){const text=String(value??"").replace(/[\u0000-\u001f\u007f<>]/g,"").replace(/\s+/g," ").trim().slice(0,50);return text||String(fallback||"Mein Design").slice(0,50)}
 function recolorColor(value,p){if(typeof value!=="string")return value;const low=value.toLowerCase();if(low==="#148cff")return p.main;if(low==="#20d4e6")return p.second;if(low==="#4eb7ff")return p.minor;
  return value.replace(/^rgba\(\s*20\s*,\s*140\s*,\s*255\s*,\s*([0-9.]+)\s*\)$/i,(_,alpha)=>`rgba(${parseInt(p.main.slice(1,3),16)},${parseInt(p.main.slice(3,5),16)},${parseInt(p.main.slice(5,7),16)},${alpha})`)}
 function apply(config,paletteId){if(!config||!Array.isArray(config.elements)||!config.canvas)throw new Error("Ungültige Vorlagenkonfiguration.");const copied=JSON.parse(JSON.stringify(config)),p=resolve(paletteId);if(p.id==="original")return copied;
  const properties=["color","fillColor","borderColor","backgroundColor","glowColor","gradientFrom","gradientTo","shadowColor"];
  for(const element of copied.elements){if(!element?.style)continue;for(const prop of properties)if(typeof element.style[prop]==="string")element.style[prop]=recolorColor(element.style[prop],p)}
  return copied;
 }
 function matchesPreview(expected,stored){if(!expected?.canvas||!stored?.canvas||!Array.isArray(expected.elements)||!Array.isArray(stored.elements))return false;
  if(Number(expected.canvas.width)!==Number(stored.canvas.width)||Number(expected.canvas.height)!==Number(stored.canvas.height)||String(expected.canvas.background)!==String(stored.canvas.background)||expected.elements.length!==stored.elements.length)return false;
  const ids=new Map(stored.elements.map(e=>[String(e.id),e]));
  return expected.elements.every(e=>{const other=ids.get(String(e.id));if(!other||e.type!==other.type)return false;for(const prop of ["backgroundColor","borderColor","fillColor","glowColor","color","gradientFrom","gradientTo"]){if(String(e.style?.[prop]??"").toLowerCase()!==String(other.style?.[prop]??"").toLowerCase())return false}return true});
 }
 return Object.freeze({palettes,resolve,cleanName,apply,matchesPreview});
});
