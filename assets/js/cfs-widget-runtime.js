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
  let lastConfirmedTimer = null;
  let timerTickerStarted = false;
  let lastFollowAlert = null;
  let alertTickerStarted = false;

  function tickFollowAlert() {
    if (lastFollowAlert && Date.now() - lastFollowAlert >= 45000) {
      lastFollowAlert = null;
      stage.replaceChildren();
    }
  }

  // Advance only confirmed Twitch timer text locally between provider polls.
  // Update text nodes rather than rebuilding the entire OBS scene each second.
  function tickTimer() {
    const payload = lastConfirmedTimer;
    if (!payload || typeof stage.querySelectorAll !== "function") return;
    const data = renderer.runtimeData(payload);
    const elements = new Map((payload.widget.config.elements || [])
      .filter(element => element && ["text", "counter"].includes(element.type))
      .map(element => [String(element.id || ""), element]));
    for (const node of stage.querySelectorAll("[data-element]")) {
      const element = elements.get(node.getAttribute("data-element"));
      const template = element?.type === "counter" ? element.data?.format : element?.data?.text;
      if (typeof template === "string" && template.includes("{{timer}}")) {
        node.textContent = renderer.text(template, data);
      }
    }
  }

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
      const definition = payload.widget.definition;
      const isFollowAlert = definition?.provider === "twitch_follow" && definition.mode === "alert";
      const eventTime = isFollowAlert && Array.isArray(payload.events)
        ? Date.parse(payload.events[0]?.created_at || "") : NaN;
      const visibleFollow = isFollowAlert && Number.isFinite(eventTime)
        && eventTime <= Date.now() && Date.now() - eventTime <= 45000;
      if (isFollowAlert && !visibleFollow) {
        lastFollowAlert = null;
        stage.replaceChildren();
      } else {
        const data = renderer.runtimeData(payload);
        renderer.mountScene({
          scene, stage, config: payload.widget.config, data,
          profile: ["obs", "tiktok_vertical", "landscape"].includes(profile) ? profile : "obs"
        });
        if (isFollowAlert) {
          lastFollowAlert = eventTime;
          if (!alertTickerStarted) {
            alertTickerStarted = true;
            setInterval(tickFollowAlert, 1000);
          }
        }
      }
      lastConfirmedTimer = definition?.provider === "twitch" && definition.mode === "timer" &&
        payload.data?.live?.status === "live" && payload.data.live.connected === true &&
        payload.data.live.stale === false ? payload : null;
      if (lastConfirmedTimer && !timerTickerStarted) {
        timerTickerStarted = true;
        setInterval(tickTimer, 1000);
      }
      consecutiveFailures = 0;
    } catch (error) {
      // Do not keep incrementing a supposedly live timer while the source is unreachable.
      lastConfirmedTimer = null;
      if (lastFollowAlert) { lastFollowAlert = null; stage.replaceChildren(); }
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
