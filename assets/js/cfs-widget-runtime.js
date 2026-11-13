(function () {
  "use strict";
  const scene = document.getElementById("cfsScene");
  const stage = document.getElementById("cfsWidgetStage");
  const renderer = globalThis.CFSWidgetRenderer;
  const id = new URLSearchParams(location.search).get("widget");
  const profile = new URLSearchParams(location.search).get("profile") || "obs";
  if (!scene || !stage || !renderer || !id || !/^[a-f0-9-]{36}$/i.test(id)) {
    console.error("Invalid widget output configuration");
    return;
  }
  let stopped = false;
  let loading = false;
  let consecutiveFailures = 0;
  const maxStaleFailures = 4;
  async function refresh() {
    if (stopped || loading) return;
    loading = true;
    try {
      const response = await fetch("/api/public/widgets/" + encodeURIComponent(id), {
        credentials: "omit", cache: "no-store"
      });
      if (!response.ok) {
        // Permanent removal or access revocation must never leave a stale OBS frame visible.
        if ([403, 404, 410].includes(response.status)) { stopped = true; stage.replaceChildren(); }
        throw new Error("Widget unavailable: " + response.status);
      }
      const payload = await response.json();
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
      loading = false;
    }
  }
  refresh();
  setInterval(refresh, 15000);
})();
