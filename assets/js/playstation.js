(() => {
  "use strict";

  // This is the creator's private workspace, never the public admin feed.
  const $ = id => document.getElementById(id);
  const status = $("psnStatus");
  const recent = $("psnRecent");
  const catalog = $("psnPurchased");
  const videos = $("psnVideos");
  let loading = false;
  let hasSnapshot = false;

  const formatDate = value => {
    if (!value) return "Zeitpunkt nicht bekannt";
    const date = new Date(value);
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date)
      : "Zeitpunkt nicht bekannt";
  };

  function setStatus(label, current = false) {
    status.textContent = label;
    status.classList.toggle("connected", current);
  }

  function emptyList(root, message) {
    const p = document.createElement("p");
    p.className = "psn-empty";
    p.textContent = message;
    root.replaceChildren(p);
  }

  function renderGames(root, games, type) {
    if (!games.length) {
      emptyList(root, type === "recent"
        ? "Keine bestätigte Spielaktivität gespeichert."
        : "Keine Spiele im synchronisierten Katalog.");
      return;
    }
    const items = games.map(game => {
      const article = document.createElement("article");
      const title = document.createElement("strong");
      const meta = document.createElement("small");
      title.textContent = game.title || "Unbekannter Titel";
      meta.textContent = type === "recent"
        ? (game.platform || "PlayStation") + " · zuletzt gespielt: " + formatDate(game.last_played_at)
        : (game.platform || "PlayStation") + " · über Launcher gemeldet, Kauf nicht verifiziert";
      article.append(title, meta);
      return article;
    });
    root.replaceChildren(...items);
  }

  function renderVideos(entries) {
    if (!entries.length) {
      emptyList(videos, "Noch keine bestätigten Videolinks gespeichert.");
      return;
    }
    const items = entries.flatMap(video => {
      try {
        const url = new URL(video.url);
        if (url.protocol !== "https:" || url.username || url.password) return [];
        const article = document.createElement("article");
        const title = document.createElement("a");
        const meta = document.createElement("small");
        title.href = url.href;
        title.target = "_blank";
        title.rel = "noopener noreferrer";
        title.textContent = video.title || "Video öffnen";
        meta.textContent = "Gemeldet: " + formatDate(video.published_at);
        article.append(title, meta);
        return [article];
      } catch {
        return [];
      }
    });
    if (items.length) videos.replaceChildren(...items);
    else emptyList(videos, "Keine gültigen Videolinks gespeichert.");
    $("psnVideoCount").textContent = String(items.length);
  }

  function render(data) {
    const state = ["current", "offline", "stale", "unavailable"].includes(data.sync_state)
      ? data.sync_state : "unavailable";
    const titles = {
      current: "LAUNCHER ONLINE · DATEN AKTUELL",
      offline: "LAUNCHER OFFLINE",
      stale: "DATEN VERALTET",
      unavailable: "NOCH NICHT SYNCHRONISIERT"
    };
    setStatus(titles[state], state === "current" && data.online === true);
    $("psnLastSync").textContent = "Letzte Synchronisierung: " +
      (data.last_synced_at ? formatDate(data.last_synced_at) : "noch keine");
    $("psnActiveTitle").textContent = "Kein bestätigter Live-Spielstatus";
    $("psnActiveMeta").textContent = state === "unavailable"
      ? "Bitte verbinde den Launcher. Es liegen noch keine gesicherten PlayStation-Daten vor."
      : (data.message || "Die Liste zeigt gespeicherte Aktivität, kein aktuell laufendes Spiel.");

    const last = Array.isArray(data.recent_games) ? data.recent_games.slice(0, 3) : [];
    const owned = Array.isArray(data.game_catalog)
      ? data.game_catalog.filter(game => game?.in_catalog === true).slice(0, 500) : [];
    const links = Array.isArray(data.videos) ? data.videos.slice(0, 100) : [];
    $("psnRecentCount").textContent = last.length + " / 3";
    $("psnPurchasedCount").textContent = String(owned.length);
    $("psnVideoCount").textContent = "0";
    renderGames(recent, last, "recent");
    renderGames(catalog, owned, "catalog");
    renderVideos(links);
    hasSnapshot = true;
  }

  function clearPrivateData() {
    hasSnapshot = false;
    $("psnLastSync").textContent = "Letzte Synchronisierung: nicht verfügbar";
    $("psnActiveTitle").textContent = "Bitte anmelden";
    $("psnActiveMeta").textContent = "Diese Übersicht gehört zu deinem Creator-Konto.";
    $("psnRecentCount").textContent = "0 / 3";
    $("psnPurchasedCount").textContent = "0";
    $("psnVideoCount").textContent = "0";
    emptyList(recent, "Bitte melde dich an.");
    emptyList(catalog, "Bitte melde dich an.");
    emptyList(videos, "Bitte melde dich an.");
  }

  async function refresh() {
    if (loading) return;
    loading = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch("/api/creator/playstation", {
        credentials: "same-origin", cache: "no-store", signal: controller.signal
      });
      if (response.status === 401) {
        clearPrivateData();
        setStatus("ANMELDUNG ERFORDERLICH");
        return;
      }
      if (!response.ok) throw new Error("PlayStation data unavailable: " + response.status);
      const data = await response.json();
      if (data?.ok !== true) throw new Error("Invalid PlayStation response");
      render(data);
    } catch (error) {
      console.error("PlayStation refresh failed", error);
      setStatus("SERVER NICHT ERREICHBAR");
      if (hasSnapshot) {
        $("psnActiveMeta").textContent =
          "Verbindung unterbrochen. Angezeigt werden nur zuletzt geladene Daten.";
      } else {
        $("psnActiveTitle").textContent = "Status nicht verfügbar";
        $("psnActiveMeta").textContent = "Die PlayStation-Daten konnten nicht geladen werden.";
      }
    } finally {
      clearTimeout(timeout);
      loading = false;
    }
  }

  refresh();
  setInterval(refresh, 60000);
})();
