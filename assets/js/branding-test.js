(() => {
  // Kompatibilitätsroute: Es gibt nur noch einen zentralen Umwandler im Widget Studio.
  if (location.pathname.endsWith('/branding-test.html')) {
    location.replace('/pages/widget-studio.html?open=converter&source=branding-test');
    return;
  }
  const $ = id => document.getElementById(id);
  const state = { imageUrl: "", image: null };
  const ids = ["btPlatform","btFormat","btPlacement","btImageScale","btFit","btImageOpacity","btImageRotation","btShape","btColorMode","btAccent","btSurface","btBackground","btBorderWidth","btGlow","btTitle","btTitlePosition","btLabel","btValue","btProgressValue","btProgress","btPreset","btAnimation","btShadow","btFont","btFontSize","btTextColor","btTextAlign","btRemoveBackground","btTolerance","btFeather","btPackage"];
  const value = id => $(id).type === "checkbox" ? $(id).checked : $(id).value;
  function imageColor() {
    if (!state.image) return "#22d3ee";
    const c = document.createElement("canvas"); c.width = c.height = 1;
    const x = c.getContext("2d"); x.drawImage(state.image, 0, 0, 1, 1);
    const p = x.getImageData(0,0,1,1).data;
    return "#" + [p[0],p[1],p[2]].map(n => n.toString(16).padStart(2,"0")).join("");
  }
  function render() {
    const placement = value("btPlacement");
    const accent = value("btColorMode") === "image" ? imageColor() : value("btAccent");
    const surface = value("btSurface");
    const radius = { square:"3px", rounded:"18px", pill:"999px" }[value("btShape")];
    $("btImageScaleValue").textContent = value("btImageScale") + " %";
    $("btImageOpacityValue").textContent = value("btImageOpacity") + " %";
    $("btImageRotationValue").textContent = value("btImageRotation") + "°";
    $("btBorderWidthValue").textContent = value("btBorderWidth") + " px";
    $("btGlowValue").textContent = value("btGlow");
    $("btProgressValueText").textContent = value("btProgressValue") + " %";
    $("btFontSizeValue").textContent = value("btFontSize") + " px";
    $("btToleranceValue").textContent = value("btTolerance");
    $("btFeatherValue").textContent = value("btFeather");
    const preset = value("btPreset");
    const presetColors = { clean:["#60a5fa","#081525"], glass:["#22d3ee","#10283a"], neon:["#d946ef","#11091f"], hud:["#39e69d","#061b19"], retro:["#facc15","#21190a"], frost:["#bfdbfe","#12243a"], ember:["#fb7185","#281017"] };
    if (preset !== "custom" && presetColors[preset]) { $("btAccent").value=presetColors[preset][0]; $("btSurface").value=presetColors[preset][1]; }
    const platform = value("btPlatform"), format = value("btFormat");
    document.body.dataset.btFormat = format;
    const twitch = [["TWITCH · FOLLOW-ZIEL","Follower-Ziel","750 / 1.000",true],["TWITCH · SUB-ZIEL","Sub-Ziel","42 / 100",true],["TWITCH · STREAM-TIMER","Stream-Timer","01:24:36",false]];
    const tiktok = [["TIKTOK LIVE · FOLLOW-ZIEL","Follower-Ziel","750 / 1.000",true],["TIKTOK LIVE · LIKE-ZIEL","Like-Ziel","7.500 / 10.000",true],["TIKTOK LIVE · LIVE-TIMER","LIVE-Timer","01:24:36",false]];
    const types = platform === "twitch" ? twitch : platform === "tiktok" ? tiktok : twitch.map((item,index) => [item[0] + " / " + tiktok[index][0].split(" · ").slice(-1), item[1], item[2], item[3]]);
    $("btCards").innerHTML = types.map(item => {
      const img = state.imageUrl ? '<div class="bt-card-image '+placement+'"><img src="'+state.imageUrl+'" alt="" style="opacity:'+(Number(value("btImageOpacity"))/100)+';transform:rotate('+value("btImageRotation")+'deg) scale('+(Number(value("btImageScale"))/100)+')"></div>' : "";
      const label = value("btLabel") || item[1], text = value("btValue") || item[2];
      const bar = item[3] && value("btProgress") ? '<div class="bt-bar"><span style="width:'+value("btProgressValue")+'%;background:'+accent+'"></span></div>' : "";
      return '<article class="bt-card placement-'+placement+'" style="font-family:'+value("btFont")+';text-align:'+value("btTextAlign")+';--card-text:'+value("btTextColor")+';--card-accent:'+accent+';--card-surface:'+(value("btBackground")==="transparent"?"transparent":surface)+';--card-bg:'+surface+';--card-radius:'+radius+';--card-border:'+value("btBorderWidth")+'px;--card-glow:'+(value("btShadow")?value("btGlow"):0)+'px;--fit:'+value("btFit")+'">'+img+'<div class="bt-card-content"><span class="bt-card-type">'+item[0]+'</span><span class="bt-card-title title-'+value("btTitlePosition")+'">'+value("btTitle")+'</span><span class="bt-card-label">'+label+'</span><strong class="bt-card-value" style="font-size:'+value("btFontSize")+'px;color:'+value("btTextColor")+'">'+(item[0]==="STREAM-TIMER"?item[2]:text)+'</strong>'+bar+'</div></article>';
    }).join("");
    $("btStatus").textContent = (platform === "both" ? "Twitch + TikTok LIVE" : platform.toUpperCase()) + " · " + format + (state.image ? " · Eigenes Bild aktiv" : " · Beispieldaten");
  }
  function exportPng() {
    const canvas = document.createElement("canvas"); canvas.width=900; canvas.height=300;
    const ctx=canvas.getContext("2d"), accent=value("btColorMode")==="image"?imageColor():value("btAccent"), surface=value("btBackground")==="transparent"?"transparent":value("btSurface");
    if(surface!=="transparent"){ctx.fillStyle=surface;ctx.fillRect(0,0,900,300)}
    ctx.strokeStyle=accent;ctx.lineWidth=3;ctx.strokeRect(2,2,896,296);
    if(state.image){const scale=Math.min(260/state.image.width,260/state.image.height),w=state.image.width*scale,h=state.image.height*scale,x=value("btPlacement")==="right"?900-w-26:26;ctx.globalAlpha=.82;ctx.drawImage(state.image,x,(300-h)/2,w,h);ctx.globalAlpha=1}
    ctx.fillStyle="#edf7ff";ctx.font="900 22px system-ui";ctx.fillText(value("btTitle"),300,78);ctx.fillStyle=accent;ctx.font="800 16px system-ui";ctx.fillText(value("btLabel"),300,116);ctx.fillStyle="#edf7ff";ctx.font="900 42px system-ui";ctx.fillText(value("btValue"),300,175);
    if(value("btProgress")){ctx.fillStyle="#ffffff30";ctx.fillRect(300,210,500,14);ctx.fillStyle=accent;ctx.fillRect(300,210,375,14)}
    const a=document.createElement("a");a.download="cfs-branding-widget-test.png";a.href=canvas.toDataURL("image/png");a.click();
  }
  $("btImage").addEventListener("change", e => {const file=e.target.files&&e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{state.imageUrl=reader.result;state.image=new Image();state.image.onload=render;state.image.src=state.imageUrl;$("btFileName").textContent=file.name};reader.readAsDataURL(file)});
  $("btClear").onclick=()=>{state.imageUrl="";state.image=null;$("btImage").value="";$("btFileName").textContent="PNG, JPG, WebP oder GIF";render()};
  ids.forEach(id => $(id).addEventListener("input",render));
  $("btExport").onclick=exportPng;
  $("btSaveProfile").onclick=()=>{const profile={platform:value("btPlatform"),format:value("btFormat"),placement:value("btPlacement"),shape:value("btShape"),preset:value("btPreset"),accent:value("btAccent"),surface:value("btSurface"),title:value("btTitle"),label:value("btLabel"),saved_at:new Date().toISOString()};try{localStorage.setItem("cfs_branding_test_profile",JSON.stringify(profile));$("btSaveProfile").textContent="Testprofil gespeichert ✓"}catch{$("btSaveProfile").textContent="Lokal nicht verfügbar"}};
  $("btStudioLink").addEventListener("click",()=>{try{localStorage.setItem("cfs_branding_test_profile",JSON.stringify({platform:value("btPlatform"),format:value("btFormat"),placement:value("btPlacement"),shape:value("btShape"),preset:value("btPreset"),accent:value("btAccent"),surface:value("btSurface"),title:value("btTitle"),label:value("btLabel"),saved_at:new Date().toISOString()}))}catch{}});
  render();
})();

