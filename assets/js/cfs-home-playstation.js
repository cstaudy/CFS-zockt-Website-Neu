(() => {
  "use strict";
  const status = document.getElementById("refPsStatus");
  if (!status) return;
  const recent = document.getElementById("refPsRecent");
  const catalog = document.getElementById("refPsCatalog");
  const videos = document.getElementById("refPsVideos");
  let loading = false;

  function validHttps(value) {
    if (typeof value !== "string") return null;
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
          parsed.port || parsed.hash) return null;
      return parsed.href;
    } catch { return null; }
  }
  function date(value) {
    const parsed = new Date(value || "");
    return Number.isFinite(parsed.getTime())
      ? new Intl.DateTimeFormat("de-AT", { dateStyle: "medium" }).format(parsed)
      : "Zeitpunkt unbekannt";
  }
  function empty(node, message) {
    if (!node) return;
    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    node.replaceChildren(paragraph);
  }
  function gameCard(game) {
    const article = document.createElement("article");
    article.className = "ref-ps-row";
    const cover = validHttps(game.cover_url);
    if (cover) {
      const image = document.createElement("img");
      image.src = cover;
      image.alt = "";
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      article.append(image);
    }
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    const detail = document.createElement("small");
    title.textContent = game.title || "Unbekannter Titel";
    detail.textContent = (game.platform || "PlayStation") +
      (game.last_played_at ? " · Zuletzt gespielt: " + date(game.last_played_at)
        : " · Katalogeintrag, Kauf nicht bestätigt");
    copy.append(title, detail);
    article.append(copy);
    return article;
  }
  function videoCard(video) {
    const url = validHttps(video.url);
    if (!url) return null;
    const link = document.createElement("a");
    link.className = "ref-ps-row";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    const detail = document.createElement("small");
    title.textContent = video.title || "Video";
    detail.textContent = "Video öffnen · " + date(video.published_at);
    copy.append(title, detail);
    link.append(copy);
    return link;
  }
  function renderList(node, items, message, card) {
    if (!node) return;
    const elements = items.map(card).filter(Boolean);
    if (elements.length) node.replaceChildren(...elements);
    else empty(node, message);
  }
  function render(data) {
    const labels = {
      current: "LAUNCHER ONLINE · AKTUELL",
      offline: "LAUNCHER OFFLINE · LETZTE DATEN",
      stale: "DATEN VERALTET",
      unavailable: "NICHT SYNCHRONISIERT"
    };
    const state = labels[data.sync_state] ? data.sync_state : "unavailable";
    status.textContent = labels[state];
    status.classList.toggle("connected", state === "current" && data.online === true);
    status.title = data.last_synced_at
      ? "Letzte Synchronisierung: " + date(data.last_synced_at) : data.message || "";
    const recentGames = Array.isArray(data.recent_games)
      ? data.recent_games.filter(game => game?.last_played_at).slice(0, 3) : [];
    const catalogGames = Array.isArray(data.game_catalog)
      ? data.game_catalog.filter(game => game?.in_catalog === true).slice(0, 8) : [];
    const videoLinks = Array.isArray(data.videos) ? data.videos.slice(0, 4) : [];
    renderList(recent, recentGames, "Keine bestätigte Spielaktivität vorhanden.", gameCard);
    renderList(catalog, catalogGames, "Noch keine bestätigten Katalogeinträge.", gameCard);
    renderList(videos, videoLinks, "Keine bestätigten PlayStation-Videos vorhanden.", videoCard);
  }
  async function load() {
    if (loading) return;
    loading = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch("/api/public/playstation", {
        credentials: "omit", cache: "no-store", signal: controller.signal
      });
      if (!response.ok) throw new Error("PlayStation feed HTTP " + response.status);
      const data = await response.json();
      if (!data || data.ok !== true) throw new Error("Invalid PlayStation feed");
      render(data);
    } catch (error) {
      console.error("PlayStation public feed failed", error);
      status.textContent = "DATEN NICHT ERREICHBAR";
      status.classList.remove("connected");
      status.title = "Der letzte Abruf ist fehlgeschlagen.";
      empty(recent, "Spieldaten derzeit nicht erreichbar.");
      empty(catalog, "Katalogdaten derzeit nicht erreichbar.");
      empty(videos, "Videodaten derzeit nicht erreichbar.");
    } finally {
      clearTimeout(timeout);
      loading = false;
    }
  }
  function init() {
    load();
    setInterval(load, 60000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
