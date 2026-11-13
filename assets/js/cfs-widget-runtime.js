(function () {
  "use strict";
  const scene = document.getElementById("cfsScene");
  const stage = document.getElementById("cfsWidgetStage");
  const renderer = globalThis.CFSWidgetRenderer;
  const id = new URLSearchParams(location.search).get("widget");
  const profile = new URLSearchParams(location.search).get("profile") || "obs";
  if (!scene || !stage || !renderer || !id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    console.error("Invalid widget output configuration");
    return;
  }
  let stopped = false;
  let loading = false;
  let consecutiveFailures = 0;
  const maxStaleFailures = 4;
  const requestTimeoutMs = 10000;
  async function refresh() {
    if (stopped || loading) return;
    loading = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch("/api/public/widgets/" + encodeURIComponent(id), {
        credentials: "omit", cache: "no-store", signal: controller.signal
      });
      if (!response.ok) {
        // Permanent removal or access revocation must never leave a stale OBS frame visible.
        if ([403, 404, 410].includes(response.status)) { stopped = true; stage.replaceChildren(); }
        throw new Error("Widget unavailable: " + response.status);
      }
      const payload = await response.json();
      if (!payload || !payload.widget || payload.widget.id !== id || !payload.widget.config || typeof payload.widget.config !== "object" || Array.isArray(payload.widget.config)) {
        throw new Error("Invalid widget response");
      }
      const data = renderer.runtimeData(payload);
      renderer.mountScene({
        scene, stage, config: payload.widget.config, data,
        profile: ["obs", "tiktok_vertical", "landscape"].includes(profile) ? profile : "obs"
      });
      consecutiveFailures = 0;
    } catch (error) {
      console.error("Widget refresh failed", error);
      // Brief outages keep the last frame; prolonged outages must not show stale data indefinitely.
      if (!stopped && ++consecutiveFailures >= maxStaleFailures) stage.replaceChildren();
      // Continue polling so a recovered connection can restore the frame.
    } finally {
      clearTimeout(timeout);
      loading = false;
    }
  }
  refresh();
  setInterval(refresh, 15000);
})();
