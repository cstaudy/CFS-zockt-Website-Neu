(() => {
  "use strict";

  const profileUrl = "https://www.tiktok.com/@cfs_zockt";
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  function safeVideoUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(String(value));
      if (url.protocol !== "https:" || !["www.tiktok.com", "tiktok.com"].includes(url.hostname)) return "";
      if (!/^\/@[^/]+\/video\/\d+\/?$/.test(url.pathname)) return "";
      return url.href;
    } catch { return ""; }
  }

  function safeThumbnailUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(String(value));
      return url.protocol === "https:" ? url.href : "";
    } catch { return ""; }
  }

  function emptyMarkup() {
    // Never present an unrelated stock/design image as an actual TikTok video.
    return `<div class="ref-video-card ref-video-empty" role="status"><strong>Zurzeit keine bestätigten Videos verfügbar.</strong><p>Aktuelle Clips und Highlights findest du direkt auf TikTok.</p><a href="${profileUrl}" target="_blank" rel="noopener noreferrer">TikTok-Profil öffnen →</a></div>`;
  }

  function videoMarkup(data) {
    const videos = Array.isArray(data?.videos) ? data.videos : [];
    const usedIds = new Set();
    const usedUrls = new Set();
    const cards = [];
    for (const video of videos) {
      if (!video || typeof video !== "object") continue;
      const url = safeVideoUrl(video.url);
      if (!url || usedUrls.has(url)) continue;
      const id = video.id == null ? "" : String(video.id);
      if (id && usedIds.has(id)) continue;
      usedUrls.add(url);
      if (id) usedIds.add(id);
      const title = escapeHtml(String(video.title || "TikTok-Video").slice(0, 180));
      const thumbnail = safeThumbnailUrl(video.thumbnail_url);
      cards.push(`<a class="ref-video-card" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy">` : ""}<strong>${title}</strong><small>Video auf TikTok öffnen →</small></a>`);
      if (cards.length >= 6) break;
    }
    return cards.length ? cards.join("") : emptyMarkup();
  }

  async function init() {
    const container = document.getElementById("refTikTokVideos");
    if (!container) return;
    try {
      const response = await fetch("/api/public/tiktok/videos", { cache: "no-store" });
      if (!response.ok) throw new Error("TIKTOK_VIDEO_STATUS_UNAVAILABLE");
      container.innerHTML = videoMarkup(await response.json());
    } catch {
      container.innerHTML = emptyMarkup();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
