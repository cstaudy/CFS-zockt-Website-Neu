(() => {
  "use strict";
  if (location.pathname.toLowerCase() !== "/pages/technical-status.html") return;

  const labels = {
    ready:"BEREIT",
    waiting:"WARTET",
    stale:"VERALTET",
    offline:"NICHT BEREIT",
    unknown:"OFFEN"
  };

  const formatTime = value => {
    const date = new Date(String(value || ""));
    if (!Number.isFinite(date.getTime())) return "—";
    return new Intl.DateTimeFormat("de-DE", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit" }).format(date);
  };

  const setCard = (key, component = {}) => {
    const card = document.querySelector(`[data-tech-card="${key}"]`);
    if (!card) return;
    const state = String(component.state || "unknown");
    card.dataset.state = state;
    const stateLabel = card.querySelector("[data-state-label]");
    const detail = card.querySelector("[data-detail]");
    const meta = card.querySelector("[data-meta]");
    if (stateLabel) stateLabel.textContent = labels[state] || "OFFEN";
    if (detail) detail.textContent = component.detail || "Keine Detailinformation verfügbar.";

    let metaText = "";
    if (key === "database") metaText = component.latency_ms != null ? `${component.latency_ms} ms Antwortzeit` : "Keine Latenz verfügbar";
    else if (key === "tiktok") metaText = ({not_configured:"App-Konfiguration fehlt",not_connected:"Keine gespeicherte Verbindung",expired:"Token abgelaufen",record_present_unverified:"Verbindung gespeichert; ungeprüft",unknown:"Status unbekannt"})[component.connection_state] || "Status unbekannt";
    else if (key === "launcher") {
      const age = component.heartbeat_age_seconds != null && Number.isFinite(Number(component.heartbeat_age_seconds)) ? `${Number(component.heartbeat_age_seconds)} s` : "—";
      const grace = component.heartbeat_grace_ms != null && Number.isFinite(Number(component.heartbeat_grace_ms)) ? `${Math.round(Number(component.heartbeat_grace_ms) / 1000)} s Grace` : "Grace offen";
      const state = String(component.connection_state || (component.online ? "online" : "offline")).toUpperCase();
      metaText = `${state} · ${component.client_version || "Version offen"}${component.machine_name ? ` · ${component.machine_name}` : ""} · Heartbeat ${age} · ${grace}`;
    }
    else if (key === "live") metaText = component.active ? `${component.viewers ?? "—"} Zuschauer · Quelle ${component.source || "offen"}` : `Status ${component.status || "unknown"}${component.last_event_at ? ` · Event ${formatTime(component.last_event_at)}` : ""}`;
    else if (key === "game") metaText = component.name ? `${component.name} · ${component.platform || "unknown"}` : "Kein aktives Game";
    else if (key === "playstation") metaText = component.configured ? `${component.recent_count ?? "—"} aktuelle Titel${component.updated_at ? ` · ${formatTime(component.updated_at)}` : ""}` : "Nicht konfiguriert";
    else if (key === "discord") metaText = component.available ? `${component.members ?? "—"} Mitglieder · ${component.online ?? "—"} online` : "Keine Community-Zahlen verfügbar";
    else if (key === "security") metaText = `${component.passed ?? "—"}/${component.total ?? "—"} Checks · Launcher-Signatur ${component.launcher_signed_requests ? "AKTIV" : "WARTET"} · Replay-Guard ${component.launcher_replay_guard ? "AKTIV" : "WARTET"}`;
    else if (key === "suite") metaText = `${component.passed ?? "—"}/${component.total ?? "—"} Kernchecks · ${component.blocking ?? "—"} offen · Stream-Protokoll ${component.stream_studio_protocol || "—"}`;
    else if (key === "release") metaText = `${component.passed ?? "—"}/${component.total ?? "—"} intern · ${component.blocking_internal ?? "—"} Blocker · ${component.external_open ?? "—"} externe Gates offen`;
    else metaText = component.updated_at ? `Stand ${formatTime(component.updated_at)}` : "Statusprüfung aktiv";
    if (meta) meta.textContent = metaText;
  };

  const render = data => {
    const overall = document.getElementById("techOverall");
    const label = document.getElementById("techOverallLabel");
    const generated = document.getElementById("techGeneratedAt");
    const state = String(data?.overall || "partial");
    if (overall) overall.dataset.state = state;
    if (label) label.textContent = state === "ready" ? "ALLES BEREIT" : state === "attention" ? "PRÜFUNG NÖTIG" : "TEILWEISE BEREIT";
    if (generated) generated.textContent = `Letzte Prüfung: ${formatTime(data?.generated_at)}`;
    Object.entries(data?.components || {}).forEach(([key, component]) => setCard(key, component));
  };

  async function load() {
    const button = document.getElementById("techRefresh");
    if (button) { button.disabled = true; button.textContent = "PRÜFE …"; }
    try {
      const response = await fetch("/api/creator/technical-status", { headers:{ Accept:"application/json" }, cache:"no-store" });
      if (response.status === 401 || response.status === 403) {
        location.href = "/pages/login.html?next=%2Fpages%2Ftechnical-status.html";
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      render(await response.json());
    } catch {
      const overall = document.getElementById("techOverall");
      const label = document.getElementById("techOverallLabel");
      const generated = document.getElementById("techGeneratedAt");
      document.querySelectorAll("[data-tech-card]").forEach(card=>setCard(card.dataset.techCard,{state:"unknown",detail:"Status derzeit nicht abrufbar."}));
      if (overall) overall.dataset.state = "attention";
      if (label) label.textContent = "STATUS NICHT ERREICHBAR";
      if (generated) generated.textContent = "Die technische Status-API konnte nicht geladen werden.";
    } finally {
      if (button) { button.disabled = false; button.textContent = "JETZT PRÜFEN"; }
    }
  }

  document.getElementById("techRefresh")?.addEventListener("click", load);
  load();
  window.setInterval(load, 30000);
})();
