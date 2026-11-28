document.addEventListener("DOMContentLoaded", async () => {
  const me = await CFS.requireAuth();
  if (!me) return;
  const a = me.account;
  if (me.admin && window.adminCreatorNav) adminCreatorNav.hidden = false;

  const creatorName = String(a.display_name || "").trim();
  const greeting = document.getElementById("dashboardGreeting");
  if (greeting) greeting.textContent = creatorName ? `Willkommen zurück, ${creatorName}.` : "Willkommen zurück in deiner Creator Suite.";

  const journey = { setup: null, widget: null, widgetPublished: null, scene: null, scenePublished: null };
  const setJourneyStep = (id, value, meta) => {
    const el = document.getElementById(id);
    if (!el) return;
    const ready = value === true;
    const unknown = value === null || value === "unknown";
    el.classList.toggle("ready", ready);
    el.classList.toggle("wait", !ready);
    el.classList.toggle("unknown", unknown);
    const small = el.querySelector("small");
    if (small) small.textContent = meta;
  };

  const renderNextStep = () => {
    const title = document.getElementById("nextStepTitle");
    const text = document.getElementById("nextStepText");
    const action = document.getElementById("nextStepAction");
    if (!title || !text || !action) return;

    if ([journey.setup, journey.widget, journey.widgetPublished, journey.scene, journey.scenePublished].some(value => value === null)) {
      title.textContent = "Dein Workspace wird geprüft …";
      text.textContent = "Wir prüfen Setup, Widgets und Szenen. Plattform-Verbindungen sind für den lokalen OBS-Test optional.";
      action.textContent = "BITTE WARTEN";
      action.href = "/pages/dashboard.html";
      action.setAttribute("aria-disabled", "true");
      return;
    }

    action.removeAttribute("aria-disabled");
    if (journey.setup === false) {
      title.textContent = "Grundsetup einmal speichern";
      text.textContent = "Lege Theme, Ziel und dein bevorzugtes Startmodul fest. Das ist die Basis für deinen Creator-Workspace.";
      action.textContent = "SETUP ÖFFNEN";
      action.href = "/pages/setup.html";
    } else if (journey.widget === false) {
      title.textContent = "Dein erstes Widget bauen";
      text.textContent = "Du kannst direkt mit einem manuellen Widget starten. Dafür brauchst du weder TikTok noch eine LIVE-Verbindung.";
      action.textContent = "WIDGET STARTEN";
      action.href = "/pages/widget-studio.html";
    } else if (journey.widgetPublished === false) {
      title.textContent = "Widget lokal vorbereiten und veröffentlichen";
      text.textContent = "Für eine OBS-Browserquelle braucht dein Test-Widget eine veröffentlichte Version. Eine Plattformverbindung ist dafür nicht erforderlich.";
      action.textContent = "WIDGET STUDIO";
      action.href = "/pages/widget-studio.html";
    } else if (journey.scene === false || journey.scenePublished === false) {
      title.textContent = journey.scene === false ? "Deine erste Szene zusammenstellen" : "Testszenen-Entwurf veröffentlichen";
      text.textContent = "Füge dein veröffentlichtes Widget in eine Szene ein und stelle eine OBS-Browserquelle bereit. Noch keinen öffentlichen Stream starten.";
      action.textContent = "SCENE STUDIO";
      action.href = "/pages/scene-studio.html";
    } else {
      title.textContent = "Website und Szene für OBS prüfen";
      text.textContent = "Prüfe jetzt die Browserquelle im OBS-Testmodus. TikTok und Twitch können bis nach der lokalen Abnahme getrennt bleiben.";
      action.textContent = "WEBSITE-ABNAHME";
      action.href = "/pages/website-abnahme.html";
    }
  };

  const setStatus = (id, ready, title, meta) => {
    const el = document.getElementById(id);
    el.classList.toggle("ready", !!ready);
    el.classList.toggle("wait", !ready);
    el.querySelector("strong").textContent = title;
    el.querySelector("small").textContent = meta;
  };

  const connection = { account: true, tiktok: false, launcher: false, live: false, obs: false };
  const renderSystemSummary = () => {
    const readyCount = Object.values(connection).filter(Boolean).length;
    const signal = document.getElementById("systemSignal");
    const headline = document.getElementById("systemHeadline");
    const next = document.getElementById("systemNext");
    signal.classList.toggle("ready", false);
    signal.classList.toggle("wait", true);
    if (!connection.obs) {
      headline.textContent = "Aktuelle OBS-Verbindung noch nicht bestätigt";
      next.innerHTML = 'Im <a href="/pages/widget-studio.html">Widget Studio →</a> zuerst ein statisches oder manuelles Test-Widget vorbereiten.';
    } else if (!connection.launcher) {
      headline.textContent = "Launcher-Heartbeat nicht bestätigt";
      next.innerHTML = 'Die Website kann vor TikTok und Twitch geprüft werden. <a href="/pages/website-abnahme.html">Website-Abnahme öffnen →</a>';
    } else {
      headline.textContent = "Launcher und OBS gemeldet · Abnahme offen";
      next.innerHTML = 'Prüfe die tatsächliche Browserquelle mit OBS. <a href="/pages/website-abnahme.html">Abnahme öffnen →</a>';
    }
    signal.querySelector("span").textContent = `${readyCount}/5 STATUS-SIGNALE`;
  };
  renderSystemSummary();
  document.getElementById("refreshStatus")?.addEventListener("click", () => location.reload());

  const badges = [`<span class="access-badge ${a.plan === "pro" ? "pro" : ""}">${CFS.planLabel(a.plan)} PLAN</span>`];
  if (me.access?.beta?.active) badges.push('<span class="access-badge beta">✓ BETA TESTER</span>');
  else if (me.access?.provider_beta?.enabled && me.access?.provider_beta?.status === "pending") badges.push('<span class="access-badge beta">BETA FREIGABE AUSSTEHEND</span>');
  else if (me.access?.provider_beta?.enabled && me.access?.provider_beta?.status === "paused") badges.push('<span class="access-badge beta">BETA PAUSIERT</span>');
  if (me.access?.effective_plan && me.access.effective_plan !== a.plan) {
    badges.push(`<span class="access-badge pro">ZUGRIFF: ${CFS.planLabel(me.access.effective_plan)}</span>`);
  }
  accessBadges.innerHTML = badges.join("");
  statusAccountMeta.textContent = a.display_name || a.email || "Creator";

  let moduleData = {modules: [], access: {}};
  try { moduleData = await CFS.json("/api/creator/modules"); } catch {}

  const renderStreamReady = async () => {
    const host=document.getElementById("streamReadySteps"),headline=document.getElementById("streamReadyHeadline"),nextTitle=document.getElementById("streamReadyNextTitle"),nextText=document.getElementById("streamReadyNextText"),nextAction=document.getElementById("streamReadyNextAction");
    if(!host||!headline||!nextTitle||!nextText||!nextAction)return;
    try{
      const data=await CFS.json("/api/creator/stream-ready");
      host.innerHTML=(data.steps||[]).map((step,index)=>`<article class="creator-stream-ready-step ${step.ready?"ready":"wait"}"><span>${String(index+1).padStart(2,"0")}</span><div><strong>${CFS.escape(step.label||step.key||"Schritt")}</strong><small>${CFS.escape(step.detail||"")}</small></div><b>${step.ready?"✓ BEREIT":"OFFEN"}</b></article>`).join("");
      if(data.ready){
        headline.textContent="Dein Basis-Stream ist startklar";
        nextTitle.textContent="TikTok, Launcher, OBS und Widget sind bereit";
        nextText.textContent="Du kannst dein veröffentlichtes Widget jetzt direkt aus dem Widget Studio in die aktuelle OBS-Szene einfügen.";
        nextAction.textContent="WIDGET STUDIO ÖFFNEN";
        nextAction.href="/pages/widget-studio.html";
      }else{
        const next=data.next||{};
        headline.textContent="Öffentliches LIVE-Setup noch nicht vollständig";
        nextTitle.textContent="Zuerst Website und OBS lokal abnehmen";
        nextText.textContent="Die Plattformverbindungen und das LIVE-Setup sind separat. Für den jetzigen Test reicht die lokale Website-/OBS-Abnahme.";
        nextAction.textContent="WEBSITE-ABNAHME";
        nextAction.href="/pages/website-abnahme.html";
      }
      nextAction.removeAttribute("aria-disabled");
    }catch{
      headline.textContent="Stream-Startcheck nicht verfügbar";
      nextTitle.textContent="Status konnte nicht geladen werden";
      nextText.textContent="Der LIVE-Status ist derzeit nicht nachgewiesen. Die lokale Website-Abnahme kannst du getrennt öffnen.";
      nextAction.textContent="STATUS NEU LADEN";
      nextAction.href="/pages/dashboard.html";
      nextAction.removeAttribute("aria-disabled");
    }
  };
  renderStreamReady();

  const liveReady = false;
  connection.live = liveReady;
  renderSystemSummary();
  setStatus(
    "statusLive",
    liveReady,
    liveReady ? "FREIGESCHALTET" : "NICHT BESTÄTIGT",
    liveReady ? (moduleData.access?.beta?.active ? "Über Beta-Freigabe" : `${CFS.planLabel(moduleData.access?.effective_plan || a.plan)} Zugriff`) : "Live-Freigabe separat prüfen"
  );

  try {
    const tt = await CFS.json("/api/creator/tiktok/status");
    connection.tiktok = false;
    journey.tiktok = !!tt.connected;
    setJourneyStep("progressTikTok", journey.tiktok, tt.connected ? "Verbunden" : "Optional verbinden");
    renderSystemSummary();
    renderNextStep();
    setStatus("statusTikTok", false, tt.connected ? "GESPEICHERT" : "NICHT VERBUNDEN",
      tt.connected ? "Kontoverbindung gespeichert; Tokenprüfung offen" : "TikTok verbinden");
  } catch {
    journey.tiktok = "unknown";
    setJourneyStep("progressTikTok", journey.tiktok, "Status nicht verfügbar");
    renderNextStep();
    setStatus("statusTikTok", false, "UNBEKANNT", "TikTok-Status nicht verfügbar");
  }

  try {
    const devices = await CFS.json("/api/creator/launcher/devices");
    const active = (devices.devices || []).filter(d => d.status === "active");
    const online = active.find(d => d.online);
    connection.launcher = Boolean(online);
    connection.obs = Boolean(active.some(d=>d.online===true&&d.obs_connected===true));
    journey.launcher = active.length > 0;
    setJourneyStep("progressLauncher", journey.launcher, online ? "Online" : active.length ? "Verbunden" : "Optional verbinden");
    renderSystemSummary();
    renderNextStep();
    setStatus("statusLauncher", Boolean(online), online ? "ONLINE" : active.length ? "GEKOPPELT / OFFLINE" : "NICHT GEKOPPELT",
      online ? `${online.machine_name || "Creator PC"} · ${online.client_version || ""}` : active.length ? `${active.length} PC verbunden` : "Launcher per Device-Link verbinden");
  } catch {
    journey.launcher = "unknown";
    setJourneyStep("progressLauncher", journey.launcher, "Status nicht verfügbar");
    renderNextStep();
    setStatus("statusLauncher", false, "UNBEKANNT", "Gerätestatus nicht verfügbar");
  }

  try {
    const widgets = await CFS.json("/api/creator/widget-studio/widgets");
    const liveWidgets = (widgets.widgets || []).filter(w => w.status === "live");
    // Widget publication is not an OBS heartbeat.
    journey.widget = (widgets.widgets || []).length > 0;
    journey.widgetPublished = liveWidgets.length > 0;
    setJourneyStep("progressWidget", journey.widget, journey.widget ? `${(widgets.widgets || []).length} Widget${(widgets.widgets || []).length === 1 ? "" : "s"} angelegt` : "Noch kein Widget");
    renderSystemSummary();
    renderNextStep();
    setStatus("statusObs", connection.obs, connection.obs ? "OBS GEMELDET" : "NICHT BESTÄTIGT",
      connection.obs ? "Aktueller Launcher meldet OBS; Abnahme offen" : "Widget-Veröffentlichung bestätigt keine OBS-Verbindung");
  } catch {
    journey.widget = "unknown";
    journey.widgetPublished = "unknown";
    setJourneyStep("progressWidget", journey.widget, "Status nicht verfügbar");
    renderNextStep();
    setStatus("statusObs", false, "UNBEKANNT", "Widget-Status nicht verfügbar");
  }

  // R197: Read-only status for the local OBS scene workflow (not a live release gate).
  try {
    const scenesData = await CFS.json("/api/creator/widget-studio/scenes");
    const scenes = Array.isArray(scenesData.scenes) ? scenesData.scenes : [];
    journey.scene = scenes.length > 0;
    journey.scenePublished = scenes.some(scene => scene.status === "live" && scene.published_config);
  } catch {
    journey.scene = "unknown";
    journey.scenePublished = "unknown";
  }
  renderNextStep();

  try {
    const stateData = await CFS.json("/api/creator/modules/launcher/state");
    journey.setup = stateData.setup_status==="saved" ? true : stateData.setup_status==="not_saved" ? false : "unknown";
    setJourneyStep("progressSetup", journey.setup, journey.setup===true ? "Gespeichert" : journey.setup===false ? "Noch offen" : "Status nicht verfügbar");
    if (journey.setup!==true) setupWarning.classList.remove("hidden");
    renderNextStep();
  } catch {
    journey.setup = "unknown";
    setJourneyStep("progressSetup", journey.setup, "Status nicht verfügbar");
    setupWarning.classList.remove("hidden");
    renderNextStep();
  }

  const labels={workspace:"ARBEITSBEREICH",preview:"VORSCHAU",setup:"EINRICHTUNG",planned:"GEPLANT"};
  const modules=Array.isArray(moduleData.modules)?moduleData.modules.filter(m=>Object.hasOwn(labels,m.stage)&&
    typeof m.href==="string"&&/^\/pages\/[a-z0-9-]+\.html$/.test(m.href)):[];
  const openable=modules.filter(m=>m.openable===true);
  const readyCount=document.getElementById("toolReadyCount"),totalCount=document.getElementById("toolTotalCount"),accessPlan=document.getElementById("toolAccessPlan");
  if(readyCount)readyCount.textContent=modules.length?String(openable.length):"—";
  if(totalCount)totalCount.textContent=modules.length?String(modules.length):"—";
  if(accessPlan)accessPlan.textContent=moduleData.access?.recorded_plan?CFS.planLabel(moduleData.access.recorded_plan):"OFFEN";
  const card=m=>`<article class="card creator-module-card"><div class="creator-module-card-head"><span class="badge ${m.openable===true?"ok":"lock"}">${labels[m.stage]}</span><small>ABNAHME OFFEN</small></div><h3>${CFS.escape(m.title)}</h3><p>${CFS.escape(m.detail)}</p><div class="card-actions">${m.openable===true?`<a class="btn" href="${CFS.escape(m.href)}">ÖFFNEN</a>`:"<span>NICHT FREIGEGEBEN</span>"}</div></article>`;
  const empty='<div class="ui-state ui-state-empty" role="status"><strong>Modulkatalog nicht verfügbar</strong><p>Keine bestätigte Modulübersicht geladen. Bitte erneut prüfen.</p></div>';
  const simpleKeys=["widget_studio","launcher","tiktok","games","cut_studio","scene_studio"];
  simpleToolGrid.innerHTML=simpleKeys.map(key=>modules.find(m=>m.key===key)).filter(Boolean).map(card).join("")||empty;
  moduleGrid.innerHTML=modules.map(card).join("")||empty;

  const operationCard = (prefix, stateName, titleText, metaText) => {
    const card = document.getElementById(`dashboard${prefix}Card`);
    const title = document.getElementById(`dashboard${prefix}Title`);
    const meta = document.getElementById(`dashboard${prefix}Meta`);
    if (!card || !title || !meta) return;
    card.classList.remove("ready", "warn", "wait");
    card.classList.add(stateName || "wait");
    title.textContent = titleText;
    meta.textContent = metaText;
  };

  try {
    const gameData = await CFS.json("/api/creator/games/runtime");
    const gameRuntime = gameData.runtime || {};
    const local = gameData.local_engine || {};
    const selected = (gameData.catalog || []).find(game => game.key === gameData.profile?.game_type);
    const status = String(gameRuntime.status || "idle").toLowerCase();
    operationCard("Game", status === "running" ? "ready" : status === "starting" ? "warn" : "wait",
      status === "running" ? `${selected?.label || gameRuntime.title || "Game"} läuft` : status === "starting" ? "Game startet …" : `${selected?.label || gameData.profile?.title || "Game-Plattform"} bereit`,
      selected?.engine === "launcher_local" ? `${local.launcher_online ? "Launcher online" : "Launcher offline"} · ${Number(local.modules?.length || 0)} lokale Module` : "Cloud-Runtime verfügbar");
  } catch {
    operationCard("Game", "warn", "Game-Status nicht verfügbar", "Games-Seite öffnen und Verbindung prüfen");
  }

  try {
    const streamData = await CFS.json("/api/creator/stream-studio/runtime");
    const r = streamData.runtime || {};
    const live = Boolean(r.live || r.output?.live || r.session?.live);
    const launcherOnline = Boolean(r.launcher?.online || r.bridge?.online || r.interactive_game_engine?.launcher_online);
    const gameContext = streamData.game_context || {mode:"none"};
    const platformLabel = value => ({playstation_5:"PS5",playstation_4:"PS4",pc:"PC",xbox_series:"XBOX SERIES",xbox_one:"XBOX ONE",switch:"SWITCH"}[String(value||"")] || "PLATTFORM OFFEN");
    if (gameContext.mode === "active" && gameContext.game_name) {
      const minutes = Math.max(0, Math.floor(Number(gameContext.elapsed_seconds || 0) / 60));
      operationCard("Playing", "ready", `${gameContext.game_name} aktiv`, `${platformLabel(gameContext.platform)} · ${minutes < 60 ? `${minutes} min` : `${Math.floor(minutes/60)} h ${minutes%60} min`} · laufender CFS-Spielkontext`);
    } else if (gameContext.mode === "recent" && gameContext.game_name) {
      operationCard("Playing", "wait", `Zuletzt: ${gameContext.game_name}`, `${platformLabel(gameContext.platform)} · bestätigter letzter Spielkontext`);
    } else {
      operationCard("Playing", "wait", "Kein aktives Spiel", "Game Activity ist aktuell nicht aktiv");
    }
    operationCard("Stream", live ? "ready" : launcherOnline ? "ready" : "wait", live ? "LIVE Session aktiv" : "Stream Studio bereit",
      live ? "Program-Ausgabe und Laufzeit aktiv" : launcherOnline ? "Launcher verbunden · bereit für lokale Sources" : "Studio verfügbar · Launcher derzeit offline");
  } catch {
    operationCard("Stream", "warn", "Stream-Status nicht verfügbar", "Stream Studio öffnen und Status prüfen");
  }

  try {
    const cutData = await CFS.json("/api/creator/cut-studio/projects");
    const projects = Array.isArray(cutData.projects) ? cutData.projects : [];
    const newest = projects[0];
    operationCard("Cut", projects.length ? "ready" : "wait", projects.length ? `${projects.length} Cut-Projekt${projects.length === 1 ? "" : "e"}` : "Noch kein Cut-Projekt",
      newest ? `Zuletzt: ${newest.title || "Cut Projekt"}` : "Recording aus Stream Studio übernehmen oder Projekt anlegen");
  } catch {
    operationCard("Cut", "warn", "CUT-Status nicht verfügbar", "CUT Studio öffnen und Projekte prüfen");
  }

  if (!connection.launcher) {
    operationCard("Launcher", "wait", "Creator-PC offline", "Launcher verbinden für Capture, Games und lokale Medien");
  } else {
    operationCard("Launcher", "ready", "Creator-PC verbunden", "Release-Policy wird geprüft …");
    try {
      const releaseData = await CFS.json("/api/creator/launcher/releases?channel=stable");
      const policy = releaseData.policy || {};
      const current = policy.current_version || releaseData.bridge?.client_version || "Launcher";
      const target = policy.build_target_version || policy.recommended_version || "";
      if (policy.version_blocked === true || policy.live_allowed === false || policy.update_required === true) {
        operationCard("Launcher", "warn", "Launcher Update erforderlich", `${current}${target ? ` → ${target}` : ""} · lokale/LIVE-Funktionen können blockiert sein`);
      } else if (policy.update_available === true) {
        operationCard("Launcher", "warn", "Launcher Update verfügbar", `${current}${target ? ` → ${target}` : ""} · aktuell noch kompatibel`);
      } else if (policy.compatible === true) {
        operationCard("Launcher", "ready", "Creator-PC kompatibel", `Launcher ${current} · Release-Policy erfüllt`);
      } else {
        operationCard("Launcher", "warn", "Launcher verbunden", `Version ${current} · Kompatibilität noch nicht bestätigt`);
      }
    } catch {
      operationCard("Launcher", "warn", "Creator-PC verbunden", "Release-Policy konnte nicht geladen werden");
    }
  }

  document.querySelectorAll("[data-ui-reload]").forEach(button => button.addEventListener("click", () => location.reload()));




});
