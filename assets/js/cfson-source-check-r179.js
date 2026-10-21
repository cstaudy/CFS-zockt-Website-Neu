/* R179: gated CFSON-lab preflight for EXISTING published Creator Suite URLs.
 * Read-only creator lists + bounded unauthenticated public-runtime GETs.
 * No CFSON calls, output install commands, WebSockets, or provider writes.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) { root.CfsonSourceCheckR179 = api; api.mount(root); }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const OWNER_ENDPOINTS = Object.freeze([
    "/api/creator/widget-studio/widgets", "/api/creator/widget-studio/scenes"
  ]);
  const WIDGET_TYPES = new Set([
    "obs_overlay", "camera_frame", "camera_frame_portrait", "camera_frame_square",
    "stream_frame", "stream_frame_vertical", "lower_third", "stream_label", "static_banner",
    "social_bar", "stream_header", "stream_sidebar", "starting_screen", "brb_screen",
    "ending_screen", "offline_screen"
  ]);
  const POLL_INTERVAL_MS = 10000;
  const PROBE_TIMEOUT_MS = 4000;
  const MAX_SAMPLES = 6;
  function runtimeUrl(raw, ownOrigin) {
    // Strictly accept standard output URLs on the CURRENT site, not arbitrary URLs.
    if (typeof raw !== "string" || raw.length > 800 || !ownOrigin) return null;
    try {
      const origin = new URL(ownOrigin);
      const url = new URL(raw); // absolute URL from the owner's authenticated API
      if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin.origin || url.username || url.password || url.search) return null;
      const isWidget = url.pathname === "/widgets/studio.html" || url.pathname === "/widgets/output.html";
      const isScene = url.pathname === "/widgets/scene.html";
      if (!isWidget && !isScene) return null;
      const hash = new URLSearchParams(url.hash.slice(1));
      const token = hash.getAll("token");
      if (token.length !== 1 || !/^[A-Za-z0-9_-]{16,160}$/.test(token[0])) return null;
      const allowed = isScene ? ["token", "layout", "mode"] : ["token", "profile"];
      if ([...hash.keys()].some(key => !allowed.includes(key))) return null;
      if (isScene && (hash.getAll("layout").length > 1 || hash.getAll("mode").length > 1 ||
          ![null,"landscape","tiktok_vertical"].includes(hash.get("layout")) ||
          ![null,"recording"].includes(hash.get("mode")))) return null;
      if (isWidget && (hash.getAll("profile").length > 1 || ![null,"obs","landscape","tiktok_vertical"].includes(hash.get("profile")))) return null;
      return {
        href: url.href,
        kind: isScene ? "scene" : "widget",
        apiPath: (isScene ? "/api/widgets/scene/" : "/api/widgets/studio/") + encodeURIComponent(token[0])
      };
    } catch { return null; }
  }
  function summarize(samples) {
    const sorted = samples.filter(x => x.ok).map(x => x.elapsedMs).sort((a,b) => a-b);
    const percentile = value => sorted.length ? sorted[Math.ceil(sorted.length*value)-1] : null;
    let consecutive = 0, maxConsecutiveFailures = 0, recoveries = 0;
    for(let i = 0; i < samples.length; i++) {
      if(!samples[i].ok) { consecutive++; maxConsecutiveFailures=Math.max(maxConsecutiveFailures,consecutive); }
      else { if(consecutive > 0) recoveries++; consecutive=0; }
    }
    return {
      attempts:samples.length, successful:sorted.length,
      failed:samples.length-sorted.length,
      timedOut:samples.filter(x=>x.reason==="timeout").length,
      p50Ms:percentile(.5), p95Ms:percentile(.95),
      maxMs:sorted.length?sorted[sorted.length-1]:null,
      maxConsecutiveFailures, recoveries
    };
  }
  function listSources(widgetResponse,sceneResponse,ownOrigin) {
    const staticWidgetIds = new Set();
    const rows = [];
    const widgets = Array.isArray(widgetResponse?.widgets) ? widgetResponse.widgets : [];
    for (const w of widgets.slice(0,200)) {
      if (w?.status !== "live" || !w.published_config) continue;
      // R179 is intentionally limited to OBS-only, provider-independent designs.
      // Other platforms/connected data are not read or polled in this acceptance.
      if (!WIDGET_TYPES.has(w.widget_type)) continue;
      const validated = runtimeUrl(w.source_urls?.obs || w.source_url,ownOrigin);
      if (!validated || validated.kind !== "widget") continue;
      staticWidgetIds.add(String(w.id));
      rows.push({ name:String(w.name||"Unbenanntes Widget").slice(0,100), type:"widget", format:"obs", url:validated.href, apiPath:validated.apiPath,
        unpublishedChanges:w.has_unpublished_changes===true });
    }
    const scenes=Array.isArray(sceneResponse?.scenes)?sceneResponse.scenes:[];
    for(const s of scenes.slice(0,200)) {
      if(s?.status!=="live"||!s.published_config)continue;
      const items=s.published_config?.items;
      // Only scenes made entirely from published static OBS widgets. Exclude
      // native sources and provider-bound / unknown components fail closed.
      if(!Array.isArray(items)||!items.length||!items.every(item=>
        item && item.source_kind!=="native" && staticWidgetIds.has(String(item.widget_id||"")))) continue;
      const validated=runtimeUrl(s.source_url,ownOrigin);
      if(!validated||validated.kind!=="scene")continue;
      rows.push({name:String(s.name||"Unbenannte Scene").slice(0,100),type:"scene",format:String(s.profile||"landscape"),
        url:validated.href,apiPath:validated.apiPath,unpublishedChanges:false});
    }
    return rows.slice(0,80);
  }
  async function requestJson(url, fetchImpl, timeoutMs=PROBE_TIMEOUT_MS, credentials="omit") {
    const controller = new AbortController();
    let timedOut = false;
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
    const started=performance.now();
    try {
      const response=await fetchImpl(url,{method:"GET",credentials,cache:"no-store",redirect:"error",signal:controller.signal,headers:{Accept:"application/json"}});
      if(!response.ok)throw new Error("http_"+response.status);
      if(!(response.headers?.get("content-type")||"").includes("application/json"))throw new Error("invalid_type");
      const data=await response.json();
      if(data?.ok!==true)throw new Error("invalid_response");
      return {ok:true,data,elapsedMs:Math.round(performance.now()-started)};
    }catch(error){
      return {ok:false,reason:timedOut?"timeout":/^http_\d+$/.test(error?.message||"")?error.message:"request_failed",
        elapsedMs:Math.round(performance.now()-started)};
    }finally{clearTimeout(timer);}
  }
  function mount(root) {
    const {document,location} = root;
    const panel = document.getElementById("cfson-source-r179");
    if (!panel) return;
    const el=id=>document.getElementById(id);
    const refresh=el("cfson-r179-load"),select=el("cfson-r179-select"),urlField=el("cfson-r179-url"),copy=el("cfson-r179-copy"),open=el("cfson-r179-open");
    const once=el("cfson-r179-once"),soak=el("cfson-r179-soak"),stop=el("cfson-r179-stop"),exportBtn=el("cfson-r179-export");
    const status=el("cfson-r179-status"),results=el("cfson-r179-results"),check=el("cfson-r179-obs-checked");
    let sources=[],current=null,samples=[],timerId=null,generation=0,running=false,lastReport=null;
    function setStatus(s){status.textContent=s;}
    function setControls(){
      const ready=!!current;
      select.disabled=sources.length===0;
      once.disabled=!ready||running;soak.disabled=!ready||running;
      stop.disabled=!running;copy.disabled=!ready;
      open.hidden=!ready; urlField.value=ready?current.url:"";
      if(ready)open.href=current.url;else open.removeAttribute("href");
      refresh.disabled=running;exportBtn.disabled=!lastReport||running;
    }
    function stopRun(message="Test angehalten.") {
      generation++;
      running=false;
      if(timerId!==null){root.clearTimeout(timerId);timerId=null;}
      setStatus(message);
      setControls();
    }
    function choose(index){
      stopRun("Quelle ausgewählt. Es wurde noch keine Erreichbarkeit bestätigt.");
      const i=Number(index);
      current=Number.isInteger(i)&&i>=0&&i<sources.length?sources[i]:null;
      samples=[];lastReport=null;check.checked=false;
      results.textContent=current
        ? "Veröffentlichte OBS-Widget-URL geladen. Test ist noch nicht gestartet. Bitte in OBS zusätzlich lokal aufnehmen."
        : "Keine Quelle ausgewählt.";
      if(current?.unpublishedChanges) setStatus("Hinweis: Der Widget-Entwurf enthält Änderungen, die noch nicht veröffentlicht wurden.");
      setControls();
    }
    function snapshot() {
      const report={schema:"cfs-on-website-source-preflight-r179",createdAt:new Date().toISOString(),
        sourceType:current?.type==="scene"?"published_static_obs_scene":"published_static_obs_widget",
        sourceFormat:current?.format||"",publicUrlIncluded:false,
        durationPlannedSeconds:(MAX_SAMPLES-1)*POLL_INTERVAL_MS/1000,samplingMs:POLL_INTERVAL_MS,timeoutMs:PROBE_TIMEOUT_MS,
        metrics:summarize(samples),samples:samples.map(x=>({ok:x.ok,elapsedMs:x.elapsedMs,reason:x.ok?undefined:x.reason})),
        obsLocalRecordingManuallyConfirmed:check.checked===true,
        sourcePreviewInObsAutomaticallyVerified:false,realRenderFpsMeasured:false,
        cfsonMediaConnected:false,externalProviderTested:false,
        productionRelease:"HOLD / NO-GO"};
      lastReport=report;return report;
    }
    function renderProgress(){
      const m=summarize(samples);
      const fmt=n=>n===null?"–":String(n)+" ms";
      results.textContent=[
        `Website-Quellenprüfung (GET): ${m.attempts} Abfragen · ${m.successful} OK · ${m.failed} Fehler`,
        `Timeouts: ${m.timedOut} · Ausfälle am Stück (max.): ${m.maxConsecutiveFailures} · Wiederherstellungen: ${m.recoveries}`,
        `Antwortzeit erfolgreicher Abfragen: P50 ${fmt(m.p50Ms)} · P95 ${fmt(m.p95Ms)} · Maximum ${fmt(m.maxMs)}`,
        "Kein FPS-, OBS- oder CFSON-Medientest. Keine Streaming-Freigabe."
      ].join("\n");
    }
    async function probe(runId){
      const source=current;
      const res=await requestJson(source.apiPath,root.fetch.bind(root));
      if(runId!==generation||current!==source)return;
      // Never copy token-bearing runtime payload, source URLs or creator metadata into logs/reports.
      samples.push({ok:res.ok,elapsedMs:res.elapsedMs,reason:res.reason});
      renderProgress();
      snapshot();
      if(!running){setControls();return;}
      if(samples.length>=MAX_SAMPLES){stopRun("HTTP-Prüfserie abgeschlossen. Ergebnisse sind nur HTTP-Erreichbarkeit, keine Live-Freigabe.");return;}
      timerId=root.setTimeout(()=>{timerId=null;void probe(runId);},POLL_INTERVAL_MS);
    }
    refresh.addEventListener("click",async()=>{
      stopRun("Lade veröffentlichte OBS-Widgets aus deinem Creator-Konto (nur lesend) …");
      sources=[];current=null;lastReport=null;select.replaceChildren();setControls();refresh.disabled=true;
      const reqId=generation;
      const [widgets,scenes]=await Promise.all(OWNER_ENDPOINTS.map(endpoint=>
        requestJson(endpoint,root.fetch.bind(root),5000,"same-origin")));
      if(reqId!==generation){refresh.disabled=false;return;}
      // Fail closed: do not display a possibly incomplete list as full success.
      if(!widgets.ok){setStatus("Creator-Quellen konnten nicht vollständig geladen werden. Bitte anmelden und erneut prüfen.");refresh.disabled=false;setControls();return;}
      sources=listSources(widgets.data,scenes.ok?scenes.data:{},location.origin);
      const placeholder=document.createElement("option");placeholder.textContent="Bitte OBS-Widget auswählen";placeholder.value="";select.appendChild(placeholder);
      sources.forEach((item,i)=>{const option=document.createElement("option");option.value=String(i);option.textContent=`${item.name}${item.unpublishedChanges?" · Entwurf neuer als Veröffentlichung":""}`;select.appendChild(option);});
      select.value="";
      setStatus(sources.length?`${sources.length} veröffentlichte OBS-Widgets/Scenes verfügbar. ${scenes.ok?"":"Scenes konnten nicht geladen werden. "}Keine Quelle wird automatisch geöffnet.`:
        "Keine freigegebenen statischen OBS-Widgets/Scenes gefunden. Im Widget Studio ein Design erstellen und veröffentlichen.");
      setControls();
    });
    select.addEventListener("change",()=>choose(select.value));
    copy.addEventListener("click",async()=>{
      if(!current)return;
      try{await root.navigator.clipboard.writeText(current.url);setStatus("OBS-Browserquellen-URL kopiert. Nur lokal für deine OBS-Testszene verwenden.");}
      catch{urlField.focus();urlField.select();setStatus("URL markiert. Mit Strg+C kopieren.");}
    });
    once.addEventListener("click",()=>{
      if(!current||running)return;
      stopRun("Einzelabfrage gestartet …");samples=[];lastReport=null;
      void probe(generation);
    });
    soak.addEventListener("click",()=>{
      if(!current||running)return;
      stopRun("HTTP-Quellenprüfung gestartet …");samples=[];lastReport=null;running=true;setControls();
      void probe(generation);
    });
    stop.addEventListener("click",()=>stopRun("Manuell angehalten. Vorhandene HTTP-Messwerte bleiben sichtbar."));
    check.addEventListener("change",()=>{if(lastReport){snapshot();setControls();}});
    exportBtn.addEventListener("click",()=>{
      if(!lastReport||running)return;
      snapshot();
      const blob=new Blob([JSON.stringify(lastReport,null,2)+"\n"],{type:"application/json"});
      const href=URL.createObjectURL(blob),link=document.createElement("a");
      link.href=href;link.download="CFS_ON_R179_WEBSITE_QUELLENPRUEFUNG.json";link.hidden=true;
      document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(href),1000);
    });
    setControls();
  }
  return { runtimeUrl, listSources, summarize, mount, constants:{POLL_INTERVAL_MS,PROBE_TIMEOUT_MS,MAX_SAMPLES} };
});
