/* CFS R26 · local image -> transparent PNG. No external services, no network uploads.
 * Public domain input contract: only authenticated CFS-owned library assets are loaded by caller.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CFSImageConverter = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, Number(x) || 0));
  function options(raw = {}) {
    return {
      target: ["overlay", "camera", "scene"].includes(raw.target) ? raw.target : "overlay",
      width: Math.round(clamp(raw.width || 1280, 64, 1920)),
      height: Math.round(clamp(raw.height || 720, 64, 1920)),
      thickness: clamp(raw.thickness == null ? 9 : raw.thickness, 3, 33),
      radius: clamp(raw.radius == null ? 12 : raw.radius, 0, 35),
      removeBackground: Boolean(raw.removeBackground),
      tolerance: clamp(raw.tolerance == null ? 35 : raw.tolerance, 4, 110),
      feather: clamp(raw.feather == null ? 18 : raw.feather, 0, 55),
      fit: raw.fit === "contain" ? "contain" : "cover"
    };
  }
  // Flood-fill from the outer image edge.  Matching colors inside the artwork stay intact.
  // Pixels are removed only when they are connected to the image boundary.
  function removeEdgeBackground(imageData, settings = {}) {
    const width = imageData.width | 0, height = imageData.height | 0, data = imageData.data;
    if (!width || !height || data.length !== width * height * 4) throw new Error("Ungültige Bilddaten.");
    const tolerance = clamp(settings.tolerance == null ? 35 : settings.tolerance, 4, 110);
    const feather = clamp(settings.feather == null ? 18 : settings.feather, 0, 55);
    const total = width * height;
    const corners = [0, width - 1, width * (height - 1), total - 1];
    const refs = corners.map(index => {
      const k = index * 4;
      return [data[k], data[k+1], data[k+2]];
    });
    function delta(i) {
      const k = i * 4;
      let d = 256;
      for (const c of refs) d = Math.min(d, Math.max(Math.abs(data[k] - c[0]), Math.abs(data[k+1] - c[1]), Math.abs(data[k+2] - c[2])));
      return d;
    }
    const visited = new Uint8Array(total), queue = new Int32Array(total);
    let head = 0, tail = 0, removed = 0;
    const edgeMax = tolerance + feather;
    function enqueue(i) {
      if (visited[i]) return;
      visited[i] = 1;
      if (delta(i) > edgeMax) return;
      queue[tail++] = i;
    }
    for (let x=0; x<width; x++) { enqueue(x); enqueue((height-1)*width+x); }
    for (let y=1; y<height-1; y++) { enqueue(y*width); enqueue(y*width+width-1); }
    while (head < tail) {
      const i=queue[head++], x=i%width, y=Math.floor(i/width), k=i*4, dist=delta(i);
      const factor = feather > 0 ? clamp((dist-tolerance)/feather,0,1) : (dist <= tolerance ? 0 : 1);
      data[k+3] = Math.round(data[k+3]*factor);
      if (data[k+3] === 0) removed++;
      if (x>0) enqueue(i-1);
      if (x<width-1) enqueue(i+1);
      if (y>0) enqueue(i-width);
      if (y<height-1) enqueue(i+width);
    }
    return {imageData, clearedPixels:removed, touchedPixels:head};
  }
  function roundedRect(ctx,x,y,w,h,r){
    const radius=clamp(r,0,Math.min(w,h)/2);
    if (typeof ctx.roundRect === "function") {ctx.roundRect(x,y,w,h,radius);return;}
    ctx.moveTo(x+radius,y);ctx.arcTo(x+w,y,x+w,y+h,radius);ctx.arcTo(x+w,y+h,x,y+h,radius);ctx.arcTo(x,y+h,x,y,radius);ctx.arcTo(x,y,x+w,y,radius);
  }
  // Render to an opaque-free canvas. Frame holes are actual alpha=0, not a dark fill.
  function render(bitmap, raw={}, createCanvas) {
    const o=options(raw), canvas=createCanvas?createCanvas(o.width,o.height):document.createElement("canvas");
    canvas.width=o.width;canvas.height=o.height;
    const ctx=canvas.getContext("2d",{willReadFrequently:o.removeBackground});
    if (!ctx) throw new Error("Canvas 2D wird von diesem Browser nicht unterstützt.");
    const iw=Number(bitmap?.width||bitmap?.naturalWidth),ih=Number(bitmap?.height||bitmap?.naturalHeight);
    if (!iw||!ih)throw new Error("Das Bild konnte nicht gelesen werden.");
    const scale=o.fit==="contain"?Math.min(o.width/iw,o.height/ih):Math.max(o.width/iw,o.height/ih);
    const dw=iw*scale,dh=ih*scale;
    ctx.clearRect(0,0,o.width,o.height);
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality="high";
    ctx.drawImage(bitmap,(o.width-dw)/2,(o.height-dh)/2,dw,dh);
    if (o.removeBackground && o.target==="overlay") {
      const pixels=ctx.getImageData(0,0,o.width,o.height);
      removeEdgeBackground(pixels,o);
      ctx.putImageData(pixels,0,0);
    }
    if (o.target==="camera" || o.target==="scene") {
      const short=Math.min(o.width,o.height), border=Math.max(8,Math.round(short*o.thickness/100));
      const outerRadius=Math.round(short*o.radius/100),innerRadius=Math.max(0,outerRadius-border);
      ctx.globalCompositeOperation="destination-in";
      ctx.beginPath();
      roundedRect(ctx,0,0,o.width,o.height,outerRadius);
      if (border*2 < o.width && border*2 < o.height) {
        // Inner path + evenodd produce transparent camera/scene hole.
        roundedRect(ctx,border,border,o.width-2*border,o.height-2*border,innerRadius);
      }
      ctx.fillStyle="#fff";ctx.fill("evenodd");ctx.globalCompositeOperation="source-over";
    }
    return canvas;
  }
  // Analyse der tatsächlichen PNG-Pixel; keine Annahmen über Dateiendungen oder CSS-Schachbrett.
  // Maximal ca. 350.000 Abtastpunkte, unabhängig vom Exportformat.
  function inspect(canvas, bitmap, raw={}) {
    const o=options(raw), w=canvas.width|0,h=canvas.height|0;
    if(w<1||h<1||w>1920||h>1920)throw new Error("Ungültige PNG-Ausgabegröße.");
    const ctx=canvas.getContext("2d",{willReadFrequently:true});
    if(!ctx)throw new Error("Die Pixelprüfung ist in diesem Browser nicht verfügbar.");
    const data=ctx.getImageData(0,0,w,h).data;
    const step=Math.max(1,Math.ceil(Math.sqrt((w*h)/350000)));
    let count=0,transparent=0,visible=0,solid=0;
    for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){
      const alpha=data[(y*w+x)*4+3];count++;
      if(alpha===0)transparent++;
      if(alpha>0)visible++;
      if(alpha===255)solid++;
    }
    const iw=Number(bitmap?.width||bitmap?.naturalWidth)||w;
    const ih=Number(bitmap?.height||bitmap?.naturalHeight)||h;
    const scale=o.fit==="contain"?Math.min(w/iw,h/ih):Math.max(w/iw,h/ih);
    const isFrame=o.target==="camera"||o.target==="scene";
    const centerAlpha=data[(Math.floor(h/2)*w+Math.floor(w/2))*4+3];
    const transparency=Math.round(100*transparent/Math.max(1,count));
    const notes=[];
    if(scale>1.5)notes.push(`Kleine Vorlage: ${scale.toFixed(1).replace(".",",")}× vergrößert – eine größere Quelldatei ergibt schärfere Kanten.`);
    if(visible===0)notes.push("Das PNG ist vollständig durchsichtig. Prüfe Rahmenbreite oder Bildinhalt.");
    if(isFrame&&centerAlpha!==0)notes.push("Die Rahmenmitte ist nicht transparent. Export prüfen.");
    if(o.target==="overlay"&&transparent===0)notes.push("Das Overlay hat keinen transparenten Hintergrund. Falls nötig: Rand-Hintergrund entfernen aktivieren.");
    return Object.freeze({width:w,height:h,transparentPercent:transparency,opaquePercent:Math.round(100*solid/Math.max(1,count)),centerTransparent:centerAlpha===0,scale:Math.round(scale*100)/100,quality:notes.length?"check":"ok",notes});
  }
  function canvasPng(canvas){
    return new Promise((resolve,reject)=>{
      try{canvas.toBlob(blob=>blob&&blob.type==="image/png"?resolve(blob):reject(new Error("Transparenter PNG-Export ist fehlgeschlagen.")),"image/png");}
      catch(e){reject(e)}
    });
  }
  async function bitmapFromPrivateAsset(url, fetchFn = fetch) {
    if (!/^\/widget-assets\/[0-9a-f]{48}$/.test(String(url||""))) throw new Error("Nur eigene, geschützte Bibliotheksbilder sind zugelassen.");
    const response=await fetchFn(url,{credentials:"same-origin",redirect:"error",cache:"no-store"});
    if(!response.ok)throw new Error("Das Bibliotheksbild konnte nicht geladen werden.");
    const blob=await response.blob();
    if(!["image/png","image/jpeg","image/webp"].includes(blob.type) || !blob.size || blob.size>20*1024*1024)throw new Error("Nur PNG, JPG oder WebP bis 20 MB sind erlaubt.");
    if (typeof createImageBitmap === "function") return await createImageBitmap(blob);
    return await new Promise((resolve,reject)=>{
      const img=new Image(),local=URL.createObjectURL(blob);
      img.onload=()=>{URL.revokeObjectURL(local);resolve(img)};
      img.onerror=()=>{URL.revokeObjectURL(local);reject(new Error("Bilddatei konnte nicht dekodiert werden."))};
      img.src=local;
    });
  }
  return Object.freeze({options, removeEdgeBackground, render, inspect, canvasPng, bitmapFromPrivateAsset});
});
