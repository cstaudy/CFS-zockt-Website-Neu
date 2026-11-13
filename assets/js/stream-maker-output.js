(function () {
  "use strict";
  const canvas = document.getElementById("output");
  const error = document.getElementById("error");
  const maker = globalThis.StreamMaker;
  if (!canvas || !error || !maker) return;
  const query = new URLSearchParams(location.search);
  const token = query.get("token") || "";
  const elementId = query.get("element") || "";
  let config = null, element = null, image = null, imagePath = "", busy = false, stopped = false, failures = 0;
  function unavailable(message) {
    // Revoke both the canvas and the cached model: the one-second render timer
    // must never resurrect private content after a 404 or token rotation.
    config = element = image = null;
    imagePath = "";
    canvas.width = 1;
    canvas.height = 1;
    canvas.getContext("2d")?.clearRect(0, 0, 1, 1);
    error.textContent = message;
    error.hidden = false;
  }
  if (!/^[A-Za-z0-9_-]{24,128}$/.test(token) || !/^[a-z0-9_-]{1,64}$/i.test(elementId)) {
    unavailable("Ungültige Stream-Maker-Quelladresse.");
    return;
  }

  function render() {
    if (!config || !element) return;
    try { maker.render(canvas, config, element, image, { output: true, now: Date.now() }); }
    catch (e) { console.error("Stream Maker render failed", e); unavailable("Stream-Maker-Ausgabe fehlgeschlagen."); }
  }
  function updateImage(path) {
    if (path === imagePath) return;
    imagePath = path;
    image = null;
    if (!path) return;
    const img = new Image();
    img.onload = () => { if (imagePath === path) { image = img; render(); } };
    img.onerror = () => { if (imagePath === path) image = null; };
    const url = new URL(path, location.origin);
    if (url.origin !== location.origin) return;
    if (url.pathname.startsWith("/assets/uploads/")) url.searchParams.set("source_token", token);
    img.src = url.href;
  }
  async function refresh() {
    if (busy || stopped) return;
    busy = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch("/api/public/stream-maker/" + encodeURIComponent(token), {
        credentials: "omit", cache: "no-store", signal: controller.signal
      });
      if (!response.ok) {
        if ([403, 404, 410].includes(response.status)) {
          stopped = true;
          unavailable("Stream-Maker-Quelle nicht veröffentlicht oder nicht verfügbar.");
        }
        throw new Error("Stream Maker unavailable: " + response.status);
      }
      const payload = await response.json();
      if (!payload || !payload.config || typeof payload.config !== "object") throw new Error("Invalid Stream Maker payload");
      const next = maker.sanitize(payload.config);
      const chosen = next.elements.find(e => e.id === elementId);
      if (!chosen) {
        unavailable("Dieses Stream-Maker-Element ist nicht mehr verfügbar.");
        failures = 0;
        return;
      }
      config = next;
      element = chosen;
      updateImage(maker.source(config));
      error.hidden = true;
      render();
      failures = 0;
    } catch (e) {
      console.error("Stream Maker refresh failed", e);
      if (!stopped && ++failures >= 4) {
        config = element = null;
        unavailable("Stream-Maker-Verbindung unterbrochen. Wiederverbindung läuft.");
      }
    } finally {
      clearTimeout(timeout);
      busy = false;
    }
  }
  refresh();
  setInterval(refresh, 30000);
  setInterval(render, 1000);
})();
