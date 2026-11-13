(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const root = $("widget"), error = $("error"), status = $("status");
  if (!root || !error || !status) return;
  const query = new URLSearchParams(location.search);
  const goalRaw = Number(query.get("goal"));
  const goal = Number.isSafeInteger(goalRaw) && goalRaw >= 1 && goalRaw <= 1000000000 ? goalRaw : 200;
  const preset = query.get("preset");
  root.dataset.preset = ["bar", "compact", "card"].includes(preset) ? preset : "bar";
  const accent = query.get("accent") || "";
  if (/^#[0-9a-f]{6}$/i.test(accent)) document.documentElement.style.setProperty("--accent", accent);
  $("label").textContent = String(query.get("label") || "Follower-Ziel").slice(0, 80);
  const fmt = value => value.toLocaleString("de-DE");
  let busy = false, failures = 0;
  async function refresh() {
    if (busy) return;
    busy = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch("/api/public/community-stats", {
        credentials: "omit", cache: "no-store", signal: controller.signal
      });
      if (!response.ok) throw new Error("Follower statistics unavailable: " + response.status);
      const data = await response.json();
      // Never substitute mock, Twitch or stale numbers for an unverified TikTok count.
      const value = data?.tiktok_followers;
      if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
        root.hidden = true;
        error.hidden = false;
        error.textContent = "TikTok-Followerdaten derzeit nicht verfügbar.";
        status.hidden = true;
        return;
      }
      const percent = Math.max(0, Math.min(100, Math.round(value / goal * 100)));
      $("count").replaceChildren();
      const current = document.createElement("strong");
      current.textContent = fmt(value);
      $("count").append(current, document.createTextNode(" / " + fmt(goal)));
      $("bar").style.width = percent + "%";
      $("percent").textContent = percent + "%";
      $("creator").textContent = "TikTok";
      root.hidden = false;
      error.hidden = true;
      status.hidden = true;
      failures = 0;
    } catch (e) {
      console.error("Follower goal update failed", e);
      if (++failures >= 4 || root.hidden) {
        root.hidden = true;
        error.hidden = false;
        error.textContent = "Followerdaten nicht erreichbar. Verbindung wird erneut geprüft.";
      }
    } finally {
      clearTimeout(timeout);
      busy = false;
    }
  }
  refresh();
  setInterval(refresh, 30000);
})();
