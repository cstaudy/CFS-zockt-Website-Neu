(function () {
  "use strict";
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const root = document.getElementById("cfsSceneRuntime");
  const id = new URLSearchParams(location.search).get("scene");
  if (!root) return;
  const notice = document.createElement("div");
  notice.className = "cfs-scene-error";
  notice.hidden = true;
  document.body.append(notice);
  function error(message) {
    root.replaceChildren();
    notice.textContent = message;
    notice.hidden = false;
  }
  if (!id || !UUID.test(id)) { error("Keine gültige Scene-ID angegeben."); return; }
  let stopped = false, loading = false, failures = 0, lastVersion = "";
  function fit() {
    const width = Number(root.style.width.replace("px", "")) || 1920;
    const height = Number(root.style.height.replace("px", "")) || 1080;
    root.style.transform = "scale(" + Math.min(window.innerWidth / width, window.innerHeight / height) + ")";
  }
  function draw(scene) {
    if (!scene || scene.id !== id || !Array.isArray(scene.items) ||
        !scene.canvas || !Number.isFinite(scene.canvas.width) || !Number.isFinite(scene.canvas.height)) {
      throw new Error("Invalid published scene");
    }
    const version = JSON.stringify(scene);
    if (version === lastVersion) return;
    const children = [];
    for (const item of scene.items.slice(0, 100)) {
      if (!item || !UUID.test(String(item.widget_id)) ||
          !Number.isFinite(item.width) || !Number.isFinite(item.height) ||
          item.width < 1 || item.height < 1) continue;
      const layer = document.createElement("div");
      layer.className = "cfs-scene-item";
      layer.style.left = item.x + "px";
      layer.style.top = item.y + "px";
      layer.style.opacity = String(item.opacity);
      layer.style.zIndex = String(item.z_index);
      layer.style.transform = "rotate(" + item.rotation + "deg) scale(" + item.scale + ")";
      const frame = document.createElement("iframe");
      frame.src = "/widgets/output.html?widget=" + encodeURIComponent(item.widget_id);
      frame.width = String(item.width);
      frame.height = String(item.height);
      frame.title = "Widget " + item.widget_id;
      frame.setAttribute("scrolling", "no");
      layer.append(frame);
      children.push(layer);
    }
    if (!children.length) throw new Error("Published scene has no available widgets");
    root.style.width = scene.canvas.width + "px";
    root.style.height = scene.canvas.height + "px";
    root.style.background = scene.canvas.background || "transparent";
    root.replaceChildren(...children);
    notice.hidden = true;
    lastVersion = version;
    fit();
  }
  async function refresh() {
    if (stopped || loading) return;
    loading = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch("/api/public/scenes/" + encodeURIComponent(id), {
        credentials: "omit", cache: "no-store", signal: controller.signal
      });
      if (!response.ok) {
        if ([403, 404, 410].includes(response.status)) {
          stopped = true;
          error("Diese Scene ist nicht veröffentlicht oder nicht mehr verfügbar.");
        }
        throw new Error("Scene unavailable: " + response.status);
      }
      const payload = await response.json();
      draw(payload.scene);
      failures = 0;
    } catch (e) {
      console.error("Scene refresh failed", e);
      if (!stopped && ++failures >= 4) error("Scene-Verbindung unterbrochen. Wiederverbindung läuft.");
    } finally {
      clearTimeout(timeout);
      loading = false;
    }
  }
  window.addEventListener("resize", fit);
  refresh();
  setInterval(refresh, 15000);
})();
