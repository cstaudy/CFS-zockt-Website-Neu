/* R177: all actions are local demo/JSON export; NEVER sends stream or CFSON media. */
(() => {
  "use strict";
  const panel = document.getElementById("cfson-abnahme");
  if (!panel) return;
  const frame = document.getElementById("cfson-demo-frame");
  const viewport = panel.querySelector("[data-cfson-viewport]");
  const formats = [...panel.querySelectorAll("[data-cfson-format]")];
  const boxes = [...panel.querySelectorAll("[data-cfson-check]")];
  const feedback = document.getElementById("cfson-demo-feedback");
  const count = document.getElementById("cfson-acceptance-count");
  const status = document.getElementById("cfson-report-status");
  const notes = document.getElementById("cfson-abnahme-notes");
  let selectedFormat = "landscape";
  function countConfirmed() {
    const confirmed = boxes.filter(box => box.checked).length;
    count.textContent = `${confirmed} von ${boxes.length} manuell bestätigt`;
    return confirmed;
  }
  function sendCue(cue) {
    if (!new Set(["follow", "chat", "goal", "brb", "reset"]).has(cue)) return;
    // The frame is sandboxed with opaque origin. Only fixed demonstration cues
    // (no user/credential data) are sent to that exact frame.
    frame.contentWindow?.postMessage({ type: "cfs-on-demo-cue", cue }, "*");
    feedback.textContent = `${cue === "reset" ? "Demo zurückgesetzt" : "Simuliertes Ereignis: " + cue} · keine echte Plattformverbindung.`;
  }
  for (const button of formats) button.addEventListener("click", () => {
    selectedFormat = button.dataset.cfsonFormat === "portrait" ? "portrait" : "landscape";
    viewport.dataset.cfsonViewport = selectedFormat;
    for (const item of formats) item.setAttribute("aria-pressed", String(item === button));
    frame.src = `/assets/cfson/obs-probequelle.html?format=${selectedFormat}`;
    feedback.textContent = `${selectedFormat === "portrait" ? "9:16 Hochkant" : "16:9 Querformat"} · lokale Simulation.`;
  });
  for (const button of panel.querySelectorAll("[data-cfson-cue]")) {
    button.addEventListener("click", () => sendCue(button.dataset.cfsonCue));
  }
  for (const box of boxes) box.addEventListener("change", countConfirmed);
  document.getElementById("cfson-reset-report").addEventListener("click", () => {
    for (const box of boxes) box.checked = false;
    notes.value = "";
    countConfirmed();
    sendCue("reset");
    status.textContent = "Checkliste lokal zurückgesetzt; keine Serverdaten geändert.";
  });
  document.getElementById("cfson-export-report").addEventListener("click", () => {
    const report = {
      schema: "cfs-on-offline-obs-rehearsal-v1",
      createdAt: new Date().toISOString(),
      format: selectedFormat,
      checks: Object.fromEntries(boxes.map(box => [box.dataset.cfsonCheck, Boolean(box.checked)])),
      manualChecksConfirmed: countConfirmed(),
      manualChecksTotal: boxes.length,
      notes: notes.value.slice(0, 1000),
      scope: "Nur Demo-Widget/OBS-Browserquelle/lokale OBS-Aufnahme",
      cfsonMediaConnectionTested: false,
      realStreamTested: false,
      twitchTested: false,
      tiktokTested: false,
      cfsonServiceDiagnostics: "separat im privaten Medienlabor prüfen, hier nicht bewertet",
      productionRelease: "HOLD / NO-GO"
    };
    // Deliberately no fetch, POST, remote persistence or auto-upload.
    const data = new Blob([JSON.stringify(report, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "CFS_ON_ABNAHME_OFFLINE.json";
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = "Lokaler JSON-Bericht vorbereitet. Das ist keine Freigabe für CFSON-Live oder TikTok/Twitch.";
  });
  countConfirmed();
})();
