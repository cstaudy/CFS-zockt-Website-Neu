/* R87 r87-shop-maker.js: ordered, unmodified sources; originals retained. */
/* R87 BEGIN stream-maker-core.js */
/* Shared, dependency-free model and renderer for editor, shop and OBS. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.StreamMaker=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const colors=['#38bdf8','#818cf8','#a78bfa','#e879f9','#fb7185','#ef4444','#fb923c','#fbbf24','#fde047','#a3e635','#34d399','#2dd4bf','#22d3ee','#60a5fa','#e2e8f0','#94a3b8'];
const colorNames=['Eisblau','Indigo','Violett','Pink','Rose','Rot','Orange','Gold','Zitrone','Lime','Mint','Türkis','Cyan','Blau','Weiß','Silber'];
const designs=[['aurora','Aurora','Weiche Verläufe, klare Konturen','soft'],['circuit','Circuit','Technische Linien und markante Ecken','tech'],['minimal','Essential','Reduziert, ruhig und vielseitig','minimal'],['arcade','Arcade','Pixelkanten und Retro-Charakter','pixel'],['orbit','Orbit','Runde Formen und leuchtende Akzente','round'],['editorial','Studio','Kontrastreiche Typografie, klare Flächen','editorial'],['ember','Ember','Warme Akzente und kräftige Rahmen','bold'],['midnight','Midnight','Dunkle Flächen mit feinen Details','glass']].map(([id,name,description,style])=>({id,name,description,style}));
const catalog=[
 ['countdown','Countdown','Widgets','timer','Bis zum nächsten Moment',960,320],['stopwatch','Stoppuhr','Widgets','stopwatch','Verstrichene Zeit im Blick',960,320],['counter','Zähler','Widgets','counter','Punkte, Siege oder Versuche',800,320],['deaths','Death Counter','Widgets','counter','Jeder Versuch zählt',800,320],['wins','Siege','Widgets','counter','Deine Erfolge im Stream',800,320],['goal','Community-Ziel','Widgets','goal','Fortschritt gemeinsam erreichen',1000,300],['followers','Follower-Ziel','Widgets','goal','Dein nächster Meilenstein',1000,300],['subs','Sub-Ziel','Widgets','goal','Unterstützung sichtbar machen',1000,300],
 ['camera','Kamerarahmen 16:9','Overlays','camera','Freie Mitte für deine Kamera',960,540],['portrait','Kamerarahmen 9:16','Overlays','camera','Für deinen vertikalen Stream',540,960],['square','Kamerarahmen 1:1','Overlays','camera','Kompakt und quadratisch',640,640],['lower','Namensleiste','Overlays','text','Name und Untertitel',1000,240],['social','Social-Leiste','Overlays','text','Deine Kanäle auf einen Blick',1000,240],['sponsor','Sponsor','Overlays','text','Platz für deine Partner',1000,280],
 ['starting','Starting Soon','Szenen','timer','Countdown vor deinem Start',1920,1080],['brb','Bin gleich zurück','Szenen','text','Deine Pause im passenden Look',1920,1080],['ending','Stream endet','Szenen','text','Ein stimmiger Abschluss',1920,1080],['offline','Offline','Szenen','text','Bis zum nächsten Stream',1920,1080],
 ['follow_alert','Follow-Alert','Alerts','alert','Begrüße neue Zuschauer',1000,360],['sub_alert','Sub-Alert','Alerts','alert','Ein Moment für Unterstützer',1000,360],['raid_alert','Raid-Alert','Alerts','alert','Begrüße die Community',1000,360],['donation_alert','Support-Alert','Alerts','alert','Sag Danke für Unterstützung',1000,360],
 ['about','Über mich','Panels','text','Dein Profil im eigenen Design',640,300],['rules','Chatregeln','Panels','text','Ein guter Ort für alle',640,300],['schedule','Streamplan','Panels','text','Deine nächsten Live-Termine',640,360],['links','Links & Socials','Panels','text','Alles Wichtige an einem Ort',640,300]
].map(([id,name,category,kind,description,width,height])=>({id,name,category,kind,description,width,height}));
const clamp=(v,a,b,d)=>Number.isFinite(Number(v))?Math.max(a,Math.min(b,Number(v))):d;
const text=(v,d='',n=160)=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,' ').slice(0,n):d;
const color=(v,d)=>/^#[\da-f]{6}$/i.test(v||'')?v:d;
const asset=v=>{const value=String(v||'');if(/^\/widget-assets\/[a-f\d]{48}$/i.test(value))return value;if(/^\/assets\/img\/design-pack-v208\/[a-z0-9-]+-master\.jpg$/i.test(value))return value;if(/^\/assets\/img\/design-pack-v210\/[a-z0-9-]+-master\.webp$/i.test(value))return value;if(/^\/assets\/img\/cfs-original-designs-v32053\/[a-z0-9-]+-master\.jpg$/i.test(value))return value;if(/^\/assets\/img\/cfs-original-designs-v32056\/[a-z0-9-]+-master\.jpg$/i.test(value))return value;return '';};
function element(id='countdown'){const d=catalog.find(x=>x.id===id)||catalog[0];return {id:'el_'+Math.random().toString(36).slice(2,12),template:d.id,label:d.name,text:d.kind==='alert'?'Danke, Community!':d.name,subtitle:d.description,width:d.width,height:d.height,value:0,goal:100,duration:300,fontSize:d.kind==='camera'?36:80,opacity:1,box:{x:10,y:d.kind==='camera'?85:28,w:80,h:d.kind==='camera'?12:48},cutout:{x:3,y:4,w:94,h:87},runtime:{running:false,anchor:0,elapsed:0,alertUntil:0}};}
function bundle(design='aurora'){return {name:'Mein Stream-Bundle',design,accent:colors[0],textColor:'#f8fafc',variants:[],activeVariant:0,source:'',theme:{focusX:50,focusY:50,brightness:50,contrast:50,accent2:'#818cf8',packTone:false},elements:[element('camera')]};}
function sanitize(raw={}){if(!raw||typeof raw!=='object'||Array.isArray(raw))raw={};const b=bundle();b.name=text(raw.name,b.name,120);b.design=designs.some(d=>d.id===raw.design)?raw.design:b.design;b.accent=color(raw.accent,b.accent);b.textColor=color(raw.textColor,b.textColor);b.source=asset(raw.source);b.variants=(Array.isArray(raw.variants)?raw.variants:[]).slice(0,16).map((v,i)=>({name:text(v.name,`Variante ${i+1}`,60),source:asset(v.source),accent:color(v.accent,colors[i])}));b.activeVariant=Math.round(clamp(raw.activeVariant,0,Math.max(0,b.variants.length-1),0));const theme=raw.theme||{};b.theme={focusX:clamp(theme.focusX,0,100,50),focusY:clamp(theme.focusY,0,100,50),brightness:clamp(theme.brightness,0,100,50),contrast:clamp(theme.contrast,0,100,50),accent2:color(theme.accent2,'#818cf8'),packTone:theme.packTone===true};const seen=new Set();b.elements=(Array.isArray(raw.elements)?raw.elements:[]).slice(0,32).map((v,i)=>{const e=element(v.template);e.id=/^[\w-]{1,64}$/.test(v.id||'')&&!seen.has(v.id)?v.id:`element_${i}`;while(seen.has(e.id))e.id+='_'+i;seen.add(e.id);for(const k of ['label','text','subtitle'])e[k]=text(v[k],e[k]);for(const [k,a,z] of [['width',160,3840],['height',120,2160],['value',0,1e9],['goal',1,1e9],['duration',1,86400],['fontSize',12,240]])e[k]=Math.round(clamp(v[k],a,z,e[k]));e.opacity=clamp(v.opacity,0,1,1);for(const k of ['box','cutout']){e[k]={x:clamp(v[k]?.x,0,95,e[k].x),y:clamp(v[k]?.y,0,95,e[k].y),w:clamp(v[k]?.w,5,100,e[k].w),h:clamp(v[k]?.h,5,100,e[k].h)};e[k].w=Math.min(e[k].w,100-e[k].x);e[k].h=Math.min(e[k].h,100-e[k].y);}const r=v.runtime||{};e.runtime={running:r.running===true,anchor:clamp(r.anchor,0,1e15,0),elapsed:clamp(r.elapsed,0,86400000,0),alertUntil:clamp(r.alertUntil,0,1e15,0)};return e;});return b;}
function source(b){return b.variants[b.activeVariant]?.source||b.source;}
function accent(b){return b.variants[b.activeVariant]?.accent||b.accent;}
function seconds(e,now=Date.now()){const elapsed=e.runtime.elapsed+(e.runtime.running?Math.max(0,now-e.runtime.anchor):0);return catalog.find(x=>x.id===e.template)?.kind==='stopwatch'?Math.floor(elapsed/1000):Math.max(0,e.duration-Math.floor(elapsed/1000));}
function clock(n){return `${Math.floor(n/3600)?String(Math.floor(n/3600)).padStart(2,'0')+':':''}${String(Math.floor(n/60)%60).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
function control(e,action,now=Date.now()){const r=e.runtime;if(action==='start'&&!r.running){r.anchor=now;r.running=true;}if(action==='pause'&&r.running){r.elapsed+=Math.max(0,now-r.anchor);r.running=false;}if(action==='reset'){r.running=false;r.elapsed=0;e.value=0;r.alertUntil=0;}if(action==='plus')e.value=Math.min(1e9,e.value+1);if(action==='minus')e.value=Math.max(0,e.value-1);if(action==='alert')r.alertUntil=now+6000;return e;}
function rect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,Math.max(0,Math.min(r,w/2,h/2)));}
function coverImage(ctx,image,w,h,focusX=50,focusY=50){const scale=Math.max(w/image.width,h/image.height),dw=image.width*scale,dh=image.height*scale,maxX=Math.max(0,dw-w),maxY=Math.max(0,dh-h),sx=-maxX*(focusX/100),sy=-maxY*(focusY/100);ctx.drawImage(image,sx,sy,dw,dh);}
function render(canvas,b,e,image,opts={}){const c=canvas.getContext('2d');if(canvas.width!==e.width)canvas.width=e.width;if(canvas.height!==e.height)canvas.height=e.height;const w=e.width,h=e.height,ac=accent(b),d=designs.find(x=>x.id===b.design)||designs[0],def=catalog.find(x=>x.id===e.template)||catalog[0],camera=def.kind==='camera',theme=b.theme||{},focusX=clamp(theme.focusX,0,100,50),focusY=clamp(theme.focusY,0,100,50),ac2=color(theme.accent2,'#818cf8');c.clearRect(0,0,w,h);if(def.kind==='alert'&&opts.output&&e.runtime.alertUntil<(opts.now??Date.now()))return;
 c.save();if(camera){c.beginPath();c.rect(0,0,w,h);c.rect(w*e.cutout.x/100,h*e.cutout.y/100,w*e.cutout.w/100,h*e.cutout.h/100);c.clip('evenodd');}
 if(image){c.filter=def.category==='Szenen'?'saturate(1.06) contrast(1.03)':'saturate(1.12) contrast(1.07)';coverImage(c,image,w,h,focusX,focusY);c.filter='none';if(theme.packTone===true){c.save();c.globalCompositeOperation='color';c.globalAlpha=.82;c.fillStyle=ac;c.fillRect(0,0,w,h);c.restore();}if(!camera){const g=c.createLinearGradient(0,0,w,h);const shade=Math.max(.28,Math.min(.72,.58-(Number(theme.brightness||50)-50)/180));g.addColorStop(0,`rgba(2,8,18,${Math.min(.82,shade+.08)})`);g.addColorStop(.55,`rgba(2,8,18,${Math.max(.18,shade-.14)})`);g.addColorStop(1,`rgba(2,8,18,${Math.min(.86,shade+.14)})`);c.fillStyle=g;c.fillRect(0,0,w,h);c.globalAlpha=.18;c.fillStyle=ac;c.fillRect(0,0,w,Math.max(5,h*.025));c.globalAlpha=1;}else{c.strokeStyle=ac;c.lineWidth=Math.max(3,Math.min(w,h)*.012);c.strokeRect(2,2,w-4,h-4);}}
 else{const radius=d.style==='round'?Math.min(w,h)*.16:d.style==='pixel'||d.style==='tech'?0:24;rect(c,3,3,w-6,h-6,radius);c.fillStyle='#0b1424';c.fill();const g=c.createLinearGradient(0,h,w,0);g.addColorStop(0,ac+'10');g.addColorStop(1,ac+(d.style==='minimal'?'12':'60'));c.fillStyle=g;c.fill();c.strokeStyle=ac;c.lineWidth=d.style==='bold'?12:3;c.stroke();c.globalAlpha=.12;c.strokeStyle=ac;if(['tech','pixel'].includes(d.style)){for(let x=30;x<w;x+=50){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=30;y<h;y+=50){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}}else if(d.style!=='minimal'){c.lineWidth=2;for(let i=0;i<5;i++){c.beginPath();c.arc(w*.9,h*.15,80+i*45,0,Math.PI*2);c.stroke();}}c.globalAlpha=1;c.fillStyle=ac;c.fillRect(24,20,d.style==='editorial'?w-48:48,4);}
 c.restore();
 if(image&&!camera){c.save();const radius=d.style==='round'?Math.min(w,h)*.12:d.style==='tech'||d.style==='pixel'?4:Math.min(28,Math.min(w,h)*.08);rect(c,4,4,w-8,h-8,radius);c.strokeStyle=ac;c.lineWidth=d.style==='bold'?Math.max(6,Math.min(w,h)*.018):Math.max(2,Math.min(w,h)*.006);c.globalAlpha=.72;c.stroke();c.globalAlpha=.24;c.strokeStyle=ac2;c.lineWidth=Math.max(1,Math.min(w,h)*.003);rect(c,12,12,w-24,h-24,Math.max(0,radius-4));c.stroke();c.globalAlpha=1;
 if(def.category==='Widgets'){const gx=w*.055,gy=h*.12,gw=w*.89,gh=h*.76;rect(c,gx,gy,gw,gh,Math.min(26,gh*.16));c.fillStyle='rgba(3,10,18,.48)';c.fill();c.strokeStyle=ac;c.globalAlpha=.58;c.lineWidth=Math.max(2,Math.min(w,h)*.006);c.stroke();c.globalAlpha=.11;c.fillStyle=ac2;rect(c,gx+8,gy+8,Math.max(8,gw*.018),gh-16,6);c.fill();}
 else if(def.category==='Overlays'){const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'rgba(2,8,18,.68)');g.addColorStop(.56,'rgba(2,8,18,.28)');g.addColorStop(1,'rgba(2,8,18,.52)');c.fillStyle=g;c.fillRect(0,0,w,h);c.globalAlpha=.34;c.fillStyle=ac;c.fillRect(0,h-Math.max(4,h*.028),w,Math.max(4,h*.028));}
 else if(def.category==='Panels'){rect(c,w*.035,h*.08,w*.93,h*.84,Math.min(24,h*.12));c.fillStyle='rgba(4,12,20,.50)';c.fill();c.strokeStyle=ac2;c.globalAlpha=.34;c.lineWidth=Math.max(1,h*.007);c.stroke();}
 else if(def.category==='Szenen'){const vignette=c.createRadialGradient(w*.5,h*.45,Math.min(w,h)*.08,w*.5,h*.5,Math.max(w,h)*.72);vignette.addColorStop(0,'rgba(2,8,18,0)');vignette.addColorStop(1,'rgba(2,8,18,.42)');c.fillStyle=vignette;c.fillRect(0,0,w,h);}
 c.restore();}
 const box=e.box,x=w*box.x/100,y=h*box.y/100,bw=w*box.w/100,bh=h*box.h/100,fs=Math.min(e.fontSize,bh*.5);c.save();c.beginPath();c.rect(x,y,bw,bh);c.clip();c.textAlign='center';c.textBaseline='middle';c.fillStyle=b.textColor;c.shadowColor='#000';c.shadowBlur=8;const draw=(str,yy,size,weight=700)=>{c.font=`${weight} ${size}px Arial, sans-serif`;c.fillText(str,x+bw/2,yy,bw-8);};
 if(['timer','stopwatch','counter','goal'].includes(def.kind)){draw(e.text,y+bh*.15,Math.min(fs*.36,bh*.16),600);const val=def.kind==='timer'||def.kind==='stopwatch'?clock(seconds(e,opts.now??Date.now())):def.kind==='goal'?`${e.value} / ${e.goal}`:String(e.value);draw(val,y+bh*.52,fs);if(def.kind==='goal'){c.shadowBlur=0;rect(c,x+bw*.1,y+bh*.8,bw*.8,Math.max(6,bh*.055),6);c.fillStyle='#ffffff33';c.fill();rect(c,x+bw*.1,y+bh*.8,bw*.8*Math.min(1,e.value/e.goal),Math.max(6,bh*.055),6);c.fillStyle=ac;c.fill();}else if(e.subtitle)draw(e.subtitle,y+bh*.88,Math.min(fs*.23,bh*.13),400);}else{draw(e.text,y+bh*.4,Math.min(fs,bh*.48));if(e.subtitle)draw(e.subtitle,y+bh*.78,Math.min(fs*.38,bh*.2),400);}c.restore();
 const outputOpacity=clamp(e.opacity,0,1,1);if(outputOpacity<1){c.save();c.globalCompositeOperation='destination-in';c.globalAlpha=outputOpacity;c.fillStyle='#000';c.fillRect(0,0,w,h);c.restore();}
}
return {colors,colorNames,designs,catalog,element,bundle,sanitize,source,accent,seconds,clock,control,render};
});

;/* R87 END stream-maker-core.js */

/* R87 BEGIN design-downloads-core-v32064.js */
/* CFS built-in design downloads. No legacy original artwork, server uploads or external ZIP library. */
(function(root,factory){const exports=factory();if(typeof module==='object'&&module.exports)module.exports=exports;else root.CFSDesignDownloads=exports;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const TEMPLATES=['camera','lower','social','starting','brb','ending','about'];
const encoder=new TextEncoder();
function selection(M,id,color){
 if(!M||!Array.isArray(M.designs)||!Array.isArray(M.colors))throw Error('Stream Maker fehlt.');
 const design=M.designs.find(row=>row.id===id);
 if(!design)throw Error('Unbekanntes Basisdesign.');
 if(!M.colors.includes(color))throw Error('Unbekannte Farbvariante.');
 return {design,color};
}
function bundle(M,id,color){
 const {design}=selection(M,id,color);
 const model=M.bundle(design.id);model.name=`${design.name} · Basisdesign`;model.accent=color;
 model.elements=TEMPLATES.map(template=>M.element(template));
 model.elements.forEach((element,index)=>{element.id=`design_${index+1}_${element.template}`;element.runtime={running:false,anchor:0,elapsed:0,alertUntil:0};});
 return M.sanitize(model);
}
function documentFor(M,id,color){return {kind:'cfs-maker-design-download',schema:1,origin:'built-in-generated-v32064',config:bundle(M,id,color)};}
function parseDocument(M,raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.kind!=='cfs-maker-design-download'||raw.schema!==1||raw.origin!=='built-in-generated-v32064')throw Error('Keine unterstützte CFS-Basisdesign-Datei.');
 const b=raw.config;
 if(!b||typeof b!=='object'||Array.isArray(b)||!Array.isArray(b.elements)||b.elements.length!==TEMPLATES.length||b.source||b.variants?.length||!TEMPLATES.every((id,index)=>b.elements[index]?.template===id))throw Error('Das Basisdesign hat eine ungültige Struktur.');
 selection(M,b.design,b.accent);
 // Reject embedded remote/private assets and additional keys rather than trusting deserialized runtime.
 const safe=bundle(M,b.design,b.accent);
 safe.name=String(b.name||safe.name).replace(/[\u0000-\u001f]/g,' ').slice(0,120);
 for(let i=0;i<safe.elements.length;i++){
  const source=b.elements[i];
  if(!source||typeof source!=='object'||source.source||source.image||source.url)throw Error('Unerlaubte Bildreferenz im Basisdesign.');
  safe.elements[i].text=typeof source.text==='string'?source.text.replace(/[\u0000-\u001f]/g,' ').slice(0,160):safe.elements[i].text;
  safe.elements[i].subtitle=typeof source.subtitle==='string'?source.subtitle.replace(/[\u0000-\u001f]/g,' ').slice(0,160):safe.elements[i].subtitle;
 }
 return M.sanitize(safe);
}
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function nameOk(name){return typeof name==='string'&&name.length<130&&/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(name)&&!name.startsWith('/')&&!name.includes('//')&&!name.split('/').some(x=>x==='.'||x==='..')&&name.split('/').every(x=>x.length>0);}
async function zip(files){
 if(!Array.isArray(files)||files.length<1||files.length>32)throw Error('Ungültige Paketgröße.');
 const parts=[],centers=[];let offset=0,total=0;const seen=new Set();
 for(const entry of files){
  if(!nameOk(entry.name)||seen.has(entry.name))throw Error('Unsicherer oder doppelter ZIP-Pfad.');seen.add(entry.name);
  const name=encoder.encode(entry.name),bytes=entry.data instanceof Uint8Array?entry.data:new Uint8Array(await entry.data.arrayBuffer());
  if(bytes.length>10_000_000||total+bytes.length>40_000_000)throw Error('Designpaket zu groß.');total+=bytes.length;
  const crc=crc32(bytes),local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);
  lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint32(14,crc,true);lv.setUint32(18,bytes.length,true);lv.setUint32(22,bytes.length,true);lv.setUint16(26,name.length,true);local.set(name,30);
  parts.push(local,bytes);
  const central=new Uint8Array(46+name.length),cv=new DataView(central.buffer);
  cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint32(16,crc,true);cv.setUint32(20,bytes.length,true);cv.setUint32(24,bytes.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);central.set(name,46);
  centers.push(central);offset+=local.length+bytes.length;
 }
 const centerSize=centers.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);
 e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,centerSize,true);e.setUint32(16,offset,true);
 return new Blob([...parts,...centers,end],{type:'application/zip'});
}
async function pngFor(canvas){
 if(!canvas||typeof canvas.toBlob!=='function')throw Error('PNG-Export wird von diesem Browser nicht unterstützt.');
 const blob=await new Promise((resolve,reject)=>{try{canvas.toBlob(value=>value?resolve(value):reject(Error('PNG konnte nicht erstellt werden.')),'image/png');}catch(e){reject(e);}});
 if(blob.type!=='image/png'||blob.size<8||blob.size>10_000_000)throw Error('Ungültige PNG-Ausgabe.');const header=new Uint8Array(await blob.slice(0,8).arrayBuffer());if(![137,80,78,71,13,10,26,10].every((value,i)=>header[i]===value))throw Error('PNG-Signatur ungültig.');return blob;
}
async function packageFor(M,id,color,render){
 selection(M,id,color);if(typeof render!=='function')throw Error('Kein Canvas-Renderer.');
 const doc=documentFor(M,id,color),files=[
  {name:'stream-maker.json',data:encoder.encode(JSON.stringify(doc,null,2)+'\n')},
  {name:'README.txt',data:encoder.encode(`CFS Zockt · generiertes Basisdesign ${id}\n\nDiese Datei stammt aus 8 integrierten Farb-/Formdesigns, NICHT aus den fehlenden 31 Original-Designwelten.\nPNG-Dateien sind statische Bilder ohne Live-Daten, Ton oder Provider-Anbindung.\nZum Bearbeiten: Stream Maker öffnen und stream-maker.json über „Basisdesign importieren“ laden.\nLive-Widgets: Widget Studio; Sounds: Tonstudio.\n`)},
  {name:'manifest.json',data:encoder.encode(JSON.stringify({kind:doc.kind,schema:1,origin:doc.origin,id,color,files:TEMPLATES.map(x=>`png/${x}.png`)},null,2)+'\n')}
 ];
 for(const element of doc.config.elements){
  const canvas=await render(doc.config,element);
  files.push({name:`png/${element.template}.png`,data:await pngFor(canvas)});
 }
 return zip(files);
}
return {TEMPLATES,selection,bundle,documentFor,parseDocument,crc32,nameOk,zip,pngFor,packageFor};
});

;/* R87 END design-downloads-core-v32064.js */

/* R87 BEGIN design-downloads-page-v32064.js */
(function(){'use strict';
const root=document.getElementById('designDownloads');if(!root)return;
const M=window.StreamMaker,D=window.CFSDesignDownloads;
const grid=document.getElementById('designDownloadGrid'),color=document.getElementById('designDownloadColor'),status=document.getElementById('designDownloadStatus');
const message=(value,error=false)=>{status.textContent=value;status.hidden=false;status.classList.toggle('error',error);};
if(!M||!D){message('Designkatalog kann nicht geladen werden.',true);return;}
for(let i=0;i<M.colors.length;i++){const opt=document.createElement('option');opt.value=M.colors[i];opt.textContent=M.colorNames[i];color.append(opt);}
let catalog=[],busy=false;
function draw(card,designId){const canvas=card.querySelector('canvas'),b=D.bundle(M,designId,color.value);M.render(canvas,b,b.elements.find(e=>e.template==='lower'),null);}
function render(){grid.replaceChildren();catalog.forEach(item=>{
 const card=document.createElement('article');card.className='design-download-card';
 const visual=document.createElement('div');visual.className='design-download-preview';const canvas=document.createElement('canvas');canvas.setAttribute('aria-label',item.name+' Designvorschau');visual.append(canvas);
 const h=document.createElement('h3');h.textContent=item.name;const description=document.createElement('p');description.textContent=item.description;
 const buttons=document.createElement('div');buttons.className='design-download-actions';const dl=document.createElement('button');dl.type='button';dl.textContent='ZIP herunterladen ↓';dl.dataset.downloadDesign=item.id;
 const maker=document.createElement('a');maker.href='/pages/stream-maker.html?design='+encodeURIComponent(item.id)+'&color='+encodeURIComponent(color.value);maker.textContent='Im Maker öffnen ↗';buttons.append(dl,maker);card.append(visual,h,description,buttons);grid.append(card);draw(card,item.id);
 dl.onclick=async()=>{if(busy)return;busy=true;dl.disabled=true;message(`${item.name}: PNGs und ZIP werden lokal erstellt …`);
  try{const blob=await D.packageFor(M,item.id,color.value,async(b,e)=>{const c=document.createElement('canvas');M.render(c,b,e,null);return c;});
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`cfs-basisdesign-${item.id}-${color.value.slice(1)}.zip`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   message(`${item.name}: ZIP erstellt (${(blob.size/1024/1024).toFixed(1)} MB). Die Bilder sind statisch.`);
  }catch(error){message(error?.message||'ZIP-Download fehlgeschlagen.',true);}finally{busy=false;dl.disabled=false;}
 };
 });}
color.onchange=render;
fetch('/assets/data/design-download-catalog-v32064.json',{cache:'no-store',credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error('Designkatalog fehlt.');return r.json();}).then(data=>{
 if(data.kind!=='cfs-built-in-design-catalog'||data.schema!==1||data.original_design_packs_included!==false||!Array.isArray(data.designs)||data.designs.length!==M.designs.length||data.designs.some((item,i)=>item.id!==M.designs[i]?.id||item.name!==M.designs[i]?.name))throw Error('Designkatalog und Renderer passen nicht zusammen.');
 catalog=data.designs;render();message(data.message);
}).catch(error=>message(error.message||'Designkatalog nicht verfügbar.',true));
})();

;/* R87 END design-downloads-page-v32064.js */

/* R87 BEGIN stream-maker-shop.js */
(function(){'use strict';const root=document.getElementById('makerShopTemplates');if(!root)return;const M=window.StreamMaker;function add(config,title,description,href){const card=document.createElement('article');card.className='sm-template-card';const cover=document.createElement('div');cover.className='sm-cover';const canvas=document.createElement('canvas');cover.append(canvas);const copy=document.createElement('div');copy.className='sm-template-copy';const h=document.createElement('h3');h.textContent=title;const p=document.createElement('p');p.textContent=description;const a=document.createElement('a');a.className='sm-btn';a.href=href;a.textContent='Im Maker anpassen ↗';copy.append(h,p,a);card.append(cover,copy);root.append(card);const e=config.elements[0];M.render(canvas,config,e,null);const src=M.source(config);if(src){const im=new Image();im.onload=()=>M.render(canvas,config,e,im);im.src=src;}}
M.designs.forEach((d,i)=>{const b=M.bundle(d.id);b.accent=M.colors[i*2];add(b,d.name,'6 Starter-Elemente · 16 Farben · kostenlos','/pages/stream-maker.html?design='+d.id);});fetch('/api/creator/stream-maker-shop',{credentials:'same-origin'}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>data.templates.forEach(t=>add(t.config,t.config.name,`${t.config.elements.length} Elemente · eigene Kopie · kostenlos`,'/pages/stream-maker.html?template='+encodeURIComponent(t.id)))).catch(()=>{const p=document.createElement('p');p.className='sm-hint';p.textContent='Melde dich an, um zusätzlich veröffentlichte Maker-Vorlagen zu sehen.';root.append(p);});})();

;/* R87 END stream-maker-shop.js */
