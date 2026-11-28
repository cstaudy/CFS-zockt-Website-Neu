document.addEventListener("DOMContentLoaded", async () => {
  const me = await CFS.requireAuth();
  if (!me) return;

  const actionError = (error, title = "Provider-Aktion nicht abgeschlossen") => {
    const message = error?.message || "Die Aktion konnte nicht abgeschlossen werden.";
    if (window.CFSCreatorUX?.announce) {
      window.CFSCreatorUX.announce(message, "error", { title });
      return;
    }
    console.error(title, error);
  };

  try {
    const tt = await CFS.json("/api/creator/tiktok/status");
    const betaBlocked = tt?.beta_access?.required === true && tt?.beta_access?.allowed !== true;
    ttStatus.textContent = betaBlocked ? "BETA AUSSTEHEND" : tt.connected ? "VERBUNDEN" : "OFFLINE";
    ttText.textContent = betaBlocked
      ? (tt?.beta_access?.email_verified === false ? "E-Mail zuerst bestätigen; danach kann der Admin TikTok freigeben." : "TikTok wartet auf deine Beta-Freigabe im Admin Control.")
      : tt.connected
        ? `${tt.profile?.display_name || "TikTok"} · ${Number(tt.profile?.follower_count || 0).toLocaleString("de-DE")} Follower`
        : "TikTok ist aktuell nicht verbunden.";
  } catch(error) {
    ttStatus.textContent = "FEHLER";
    ttText.textContent = error.message;
  }


  function renderPlatformCapabilities(caps) {
    const grid = document.getElementById("platformCapabilitiesGrid");
    const status = document.getElementById("platformCapabilitiesStatus");
    if (!grid || !status) return;
    grid.replaceChildren();
    if (caps?.integrations?.platforms_status !== "ok" || !Array.isArray(caps.integrations.platforms)) {
      status.textContent = "Plattformstatus derzeit nicht prüfbar. Keine Freigabe bestätigt.";
      return;
    }
    const names = {tiktok:"TikTok",twitch:"Twitch",youtube:"YouTube / Shorts",instagram:"Instagram",facebook:"Facebook",kick:"Kick",custom_rtmp:"Custom RTMP"};
    const liveLabels = {official_access_required:"Offizieller LIVE-Zugang erforderlich",runtime_acceptance_required:"Reale Launcher-Abnahme offen",planned:"Geplant",manual_setup:"Manuelle Einrichtung vorgesehen",not_supported:"Nicht in CFS unterstützt"};
    const publishLabels = {planned:"Geplant · keine Freigabe",not_supported:"Kein Datei-Direktupload in CFS"};
    const connectionLabels = {record_present:"Verbindung gespeichert",not_connected:"Nicht verbunden",not_implemented:"OAuth noch nicht verfügbar"};
    const tokenLabels = {not_expired_unverified:"Gültigkeitsdatum vorhanden, Token nicht geprüft",expired:"Token abgelaufen",expiry_unknown:"Ablauf unbekannt"};
    for (const p of caps.integrations.platforms) {
      if (!p || !Object.hasOwn(names,p.provider)) continue;
      const card = document.createElement("article");
      card.className = "management-summary-card";
      const title = document.createElement("h3");
      title.textContent = names[p.provider];
      card.append(title);
      const add = text => { const line = document.createElement("p"); line.textContent = text; card.append(line); };
      add("Konto: " + (connectionLabels[p.connection] || "Unbekannt"));
      if (Object.hasOwn(tokenLabels,p.token_status)) add(tokenLabels[p.token_status]);
      add("Live: " + (liveLabels[p.live?.status] || "Nicht geprüft"));
      add("Upload: " + (publishLabels[p.publishing?.status] || "Nicht freigegeben"));
      grid.append(card);
    }
    status.textContent = "Status aus gespeicherten Kontodaten; keine Live- oder Publishing-Freigabe bestätigt.";
  }

  try {
    const caps = await CFS.json("/api/creator/integration-capabilities");
    renderPlatformCapabilities(caps);
    const oauth = Array.isArray(caps?.integrations?.oauth) ? caps.integrations.oauth : [];
    const twitch = oauth.find(item => item.provider === "twitch");
    if (twitch && twitchIntegrationStatus && !twitchIntegrationStatus.dataset.liveStatus) {
      const cfg = twitch.configuration || {};
      const configured = cfg.client_id && cfg.client_secret && cfg.redirect_uri;
      twitchIntegrationStatus.textContent = `${twitch.oauth_implemented ? "OAuth implementiert" : "OAuth-Grundlage vorbereitet"} · ${configured ? "Server-Konfiguration vorhanden" : "Server-Konfiguration noch offen"} · EventSub + Chat sind code-seitig implementiert; reale Twitch-Abnahme bleibt offen.`;
    }
    if (obsIntegrationStatus && caps?.integrations?.obs_websocket) {
      obsIntegrationStatus.textContent = "OBS WebSocket ist code-seitig implementiert: Szenen lesen/wechseln, Browser Sources aktualisieren, lokale verschlüsselte Credentials. Reale OBS-Abnahme bleibt offen.";
    }
  } catch (_) { renderPlatformCapabilities(null); }

  const twitchRetryButton = document.getElementById("twitchRetry");
  let checkingTwitch = false;
  async function checkTwitchStatus() {
    if (checkingTwitch) return;
    checkingTwitch = true;
    if (twitchRetryButton) { twitchRetryButton.disabled = true; twitchRetryButton.hidden = true; }
    if (twitchIntegrationBadge) twitchIntegrationBadge.textContent = "PRÜFE…";
    if (twitchIntegrationStatus) twitchIntegrationStatus.textContent = "Twitch-Verbindungsstatus wird geprüft.";
    // Bis zur erfolgreichen Auth-Statusprüfung keine Provider-Aktion anbieten.
    for (const button of [twitchConnect, twitchSync, twitchDisconnect]) if (button) button.hidden = true;
    try {
    const tw = await CFS.json("/api/creator/twitch/status");
    const betaBlocked = tw?.beta_access?.required === true && tw?.beta_access?.allowed !== true;
    if (twitchIntegrationStatus) {
      twitchIntegrationStatus.dataset.liveStatus = "1";
      const name = tw.account?.display_name || tw.account?.login || "Twitch";
      twitchIntegrationStatus.textContent = betaBlocked
        ? (tw?.beta_access?.email_verified === false ? "E-Mail zuerst bestätigen; danach kann der cfs_zockt Admin Twitch freigeben." : "Twitch wartet auf deine Beta-Freigabe im Admin Control.")
        : tw.connected
          ? `${name} hat eine gespeicherte Verbindung${tw.validated_at ? " · Letzte Prüfung: " + new Date(tw.validated_at).toLocaleString("de-DE") : " · Tokenprüfung offen"}. Reale Twitch-, EventSub- und Chat-Abnahme bleibt offen.`
          : (tw.configured ? "Bereit zum Verbinden. Twitch OAuth ist auf dem Server konfiguriert." : "Twitch OAuth-Code ist vorhanden, aber TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET / TWITCH_REDIRECT_URI sind noch nicht vollständig gesetzt.");
    }
    if (twitchIntegrationBadge) twitchIntegrationBadge.textContent = betaBlocked ? "BETA AUSSTEHEND" : tw.connected ? "VERBUNDEN" : (tw.configured ? "BEREIT" : "KONFIG FEHLT");
    if (twitchConnect) twitchConnect.hidden = betaBlocked || tw.connected || !tw.configured;
    if (twitchSync) twitchSync.hidden = betaBlocked || !tw.connected;
    if (twitchDisconnect) twitchDisconnect.hidden = !tw.connected;
    if (twitchSync) twitchSync.onclick = async () => {
      twitchSync.disabled = true;
      try { await CFS.json("/api/creator/twitch/sync",{method:"POST",body:"{}"}); location.reload(); }
      catch(error){ actionError(error,"Twitch-Synchronisierung fehlgeschlagen"); twitchSync.disabled=false; }
    };
    if (twitchDisconnect) twitchDisconnect.onclick = async () => {
      if(!confirm("Twitch-Verbindung für dein Creator-Konto wirklich trennen?"))return;
      twitchDisconnect.disabled=true;
      try { await CFS.json("/api/creator/twitch/disconnect",{method:"POST",body:"{}"}); location.reload(); }
      catch(error){ actionError(error,"Twitch konnte nicht getrennt werden"); twitchDisconnect.disabled=false; }
    };
    } catch(error) {
      if (twitchIntegrationStatus) twitchIntegrationStatus.textContent = "Twitch-Status derzeit nicht prüfbar. Keine Verbindung wurde geändert. Bitte erneut prüfen.";
      if (twitchIntegrationBadge) twitchIntegrationBadge.textContent = "NICHT ERREICHBAR";
      if (twitchRetryButton) twitchRetryButton.hidden = false;
    } finally {
      checkingTwitch = false;
      if (twitchRetryButton) twitchRetryButton.disabled = false;
    }
  }
  if (twitchRetryButton) twitchRetryButton.addEventListener("click", checkTwitchStatus);
  await checkTwitchStatus();

  // Preview uses the existing authenticated media list; no file upload or job.
  async function setupPublisherPreview() {
    const form=document.getElementById("publisherPreviewForm");
    if (!form) return;
    const media=document.getElementById("publisherMedia"), submit=document.getElementById("publisherPreviewSubmit"),
      status=document.getElementById("publisherPreviewStatus"), results=document.getElementById("publisherPreviewResults");
    let generation=0, busy=false;
    // Fragment contains only a media UUID, never a path, token or authorization.
    // The selection is resolved against the authenticated account's media list.
    const handoff=location.hash.startsWith("#publisher-media=")
      ? /^#publisher-media=([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(location.hash)
      : null;
    const handoffRequested=location.hash.startsWith("#publisher-media=");
    const invalidate=()=>{generation++;results.replaceChildren();status.textContent="Einstellungen geändert. Vorschau erneut prüfen.";};
    form.addEventListener("input",invalidate);
    try {
      const lists=await Promise.all(["videos","clips"].map(folder=>CFS.json("/api/creator/media/"+folder)));
      const entries=lists.flatMap(list=>Array.isArray(list?.media)?list.media:[]);
      media.replaceChildren(new Option("Video auswählen",""));
      for(const item of entries) if(item?.id && item?.name) media.add(new Option(item.name,item.id));
      media.disabled=entries.length===0;submit.disabled=entries.length===0;
      status.textContent=entries.length?"Wähle ein Video und die gewünschten Zielprofile.":"Noch keine Medien vorhanden. Importiere zuerst ein Video oder einen Clip.";
      if(handoffRequested){
        const selected=handoff?.[1]?.toLowerCase();
        const owned=selected&&entries.find(item=>item?.id===selected&&typeof item.name==="string"&&item.name);
        if(owned){
          media.value=owned.id;
          status.textContent="Medium aus dem Cut Studio ausgewählt. Prüfe Titel und Zielprofile selbst. Kein Upload gestartet.";
        }else{
          media.value="";
          status.textContent="Übergebenes Medium nicht verfügbar. Wähle ein eigenes Video oder einen Clip.";
        }
        // Remove the identifier from the displayed URL after selection.
        // Do not submit or fetch the preview automatically.
        try{history.replaceState(history.state,"",location.pathname+location.search+"#publisherPreviewForm");}catch{}
        form.scrollIntoView?.({block:"start"});
      }
    } catch { status.textContent="Mediathek derzeit nicht erreichbar. Keine Vorschau möglich.";return; }
    const names={tiktok:"TikTok",youtube_shorts:"YouTube Shorts",youtube_video:"YouTube Video",instagram_reels:"Instagram Reels",facebook_reels:"Facebook Reels"};
    const labels={PUBLISHING_NOT_IMPLEMENTED:"Publishing noch nicht implementiert",PROVIDER_ACCEPTANCE_REQUIRED:"Plattformabnahme offen",USER_APPROVAL_REQUIRED:"Separate Veröffentlichungsfreigabe erforderlich",RENDERED_VARIANT_VALIDATION_REQUIRED:"Video-Variante noch nicht gerendert/geprüft",OAUTH_CONFIGURATION_REQUIRED:"Entwickler-App-Konfiguration offen",ACCOUNT_CONNECTION_REQUIRED:"Kontoverbindung erforderlich",TOKEN_REVALIDATION_REQUIRED:"Tokenprüfung erforderlich",PUBLISH_SCOPE_REQUIRED:"Publishing-Berechtigung fehlt",TIKTOK_CREATOR_INFO_REQUIRED:"Aktuelle TikTok-Creator-Optionen erforderlich",MEDIA_DURATION_UNVERIFIED:"Videodauer nicht bestätigt"};
    form.addEventListener("submit",async event=>{
      event.preventDefault();if(busy)return;
      invalidate();
      const targets=[...form.querySelectorAll('input[name="publisherTarget"]:checked')].map(el=>el.value);
      if(!targets.length || (targets.includes("youtube_shorts")&&targets.includes("youtube_video"))) {
        status.textContent="Wähle mindestens ein Ziel und höchstens ein YouTube-Profil.";return;
      }
      const request={media_id:media.value,targets,title:document.getElementById("publisherTitle").value,
        description:document.getElementById("publisherDescription").value,captions:document.getElementById("publisherCaptions").checked,
        brand_style:document.getElementById("publisherBrand").value};
      const ticket=generation;busy=true;submit.disabled=true;status.textContent="Vorschau wird geprüft…";
      try {
        const data=await CFS.json("/api/creator/publisher/preview",{method:"POST",body:JSON.stringify(request)});
        if(ticket!==generation)return;
        if(data?.mode!=="preview_only"||data.can_publish!==false||data.job_created!==false||!Array.isArray(data.targets))throw Error("INVALID_PREVIEW");
        for(const target of data.targets){
          const card=document.createElement("article");card.className="management-summary-card";
          const title=document.createElement("h3");title.textContent=names[target.target]||"Zielprofil";card.append(title);
          const format=document.createElement("p");format.textContent=target.format+" · "+target.width+" × "+target.height+" · geplanter MP4-Export";card.append(format);
          const list=document.createElement("ul");
          for(const blocker of (Array.isArray(target.blockers)?target.blockers:[])){const item=document.createElement("li");item.textContent=labels[blocker]||"Weitere Prüfung erforderlich";list.append(item);}
          card.append(list);results.append(card);
        }
        status.textContent="Vorschau erstellt. Kein Auftrag gespeichert, kein Video veröffentlicht.";
      } catch {if(ticket===generation)status.textContent="Vorschau fehlgeschlagen. Keine Veröffentlichung ausgelöst.";}
      finally {busy=false;submit.disabled=false;}
    });
  }
  await setupPublisherPreview();





});
