/* CFS Zockt / CFSON private diagnostics. READ-ONLY; no cross-service login. */
(() => {
  "use strict";
  // Each diagnostic is read-only, but browsers/networks can leave a request
  // pending indefinitely. Abort at the deadline and ignore late responses.
  const DIAGNOSTIC_TIMEOUT_MS = 6000;
  function withDeadline(request) {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        controller?.abort();
        reject(new Error("diagnostic_timeout"));
      }, DIAGNOSTIC_TIMEOUT_MS);
      Promise.resolve().then(() => request(controller?.signal))
        .then(resolve, reject).finally(() => clearTimeout(timer));
    });
  }
  const entryLinks = document.querySelectorAll("[data-cfson-lab-entry]");
  const status = document.getElementById("cfson-lab-status");
  if (!entryLinks.length && !status) return;
  withDeadline(signal => fetch("/api/creator/cfson/status", {
    method: "GET", credentials: "same-origin", cache: "no-store",
    headers: { "Accept": "application/json" }, signal
  }).then(async response => {
    if (!response.ok) throw new Error("unavailable");
    return response.json();
  })).then(data => {
    if (data?.ok !== true || data?.mode !== "private_alpha" || data?.integration !== "ui_preview_only") throw new Error("invalid_status");
    for (const link of entryLinks) link.hidden = false;
    if (!status) return;
    status.textContent = "Privater Testbereich vorbereitet · keine Produktverbindung";
    const service = document.getElementById("cfson-lab-service");
    const version = document.getElementById("cfson-lab-version");
    if (service) service.textContent = "Noch nicht verbunden";
    if (version) version.textContent = String(data.version || "Alpha");
    const readiness = document.getElementById("cfson-local-readiness");
    const attestation = document.getElementById("cfson-local-attestation");
    const adminGate = document.getElementById("cfson-local-admin-gate");
    // A positive overall status requires ALL diagnostics visible on this page.
    // Otherwise a fast readiness response could previously mask a later bad
    // signature or a failed website-admin gate.
    const checks = {
      readiness: readiness ? undefined : null,
      attestation: attestation ? undefined : null,
      admin: adminGate ? undefined : null
    };
    function showOverall() {
      const values = Object.values(checks);
      const unsafe = checks.readiness?.state === "safety_mismatch" ||
        checks.attestation?.state === "safety_mismatch" || checks.admin?.state === "safety_mismatch";
      if (unsafe) {
        status.textContent = "Verbindung nicht freigegeben · Sicherheitsabweichung";
        if (service) service.textContent = "Keine Produktverbindung";
        return;
      }
      const mismatch = values.some(value => value?.state === "version_mismatch");
      if (mismatch) {
        status.textContent = "Verbindung nicht freigegeben · Versionsabweichung";
        if (service) service.textContent = "Keine Produktverbindung";
        return;
      }
      if (values.some(value => value === undefined)) {
        status.textContent = "Lokale Sicherheitsprüfungen laufen · keine Produktverbindung";
        return;
      }
      const okReadiness = checks.readiness === null ||
        (checks.readiness?.ok === true && checks.readiness?.state === "reachable" &&
        checks.readiness?.stage === "private-alpha" && checks.readiness?.liveIngestDisabled === true);
      const okAttestation = checks.attestation === null ||
        (checks.attestation?.ok === true && checks.attestation?.state === "verified_local_service" &&
        checks.attestation?.liveIngestDisabled === true);
      const okAdmin = checks.admin === null ||
        (checks.admin?.ok === true && checks.admin?.state === "verified_local_admin_gate" &&
        checks.admin?.accountLinked === false);
      // A missing verification widget must never silently count as verified.
      // Older compact pages may display the limited read-only probe result only.
      if (okReadiness && okAttestation && okAdmin &&
          checks.readiness !== null && checks.attestation !== null && checks.admin !== null) {
        status.textContent = "CFSON lokal geprüft · nur lesender Diagnosetest, kein Produktbetrieb";
        if (service) service.textContent = "Nur Diagnose · keine Produktverbindung";
      } else if (okReadiness && checks.readiness !== null &&
                 (checks.attestation === null || checks.admin === null)) {
        status.textContent = "Lokaler Status: nur lesender Diagnosetest · Identitäts-/Admin-Prüfung fehlt, keine Produktverbindung";
        if (service) service.textContent = "Diagnose unvollständig · keine Produktverbindung";
      } else {
        status.textContent = "Verbindung nicht freigegeben · lokale Prüfungen unvollständig";
        if (service) service.textContent = "Keine Produktverbindung";
      }
    }
    // Distinct requests are intentional: these routes have different guards.
    if (attestation) withDeadline(signal => fetch("/api/creator/cfson/local-attestation", {
      method: "GET", credentials: "same-origin", cache: "no-store", headers: { "Accept": "application/json" }, signal
    }).then(async response => {
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("attestation_unavailable");
      return response.json();
    })).then(result => {
      checks.attestation = result ?? {ok:false,state:"disabled"};
      if (result?.ok === true && result.state === "verified_local_service" && result.liveIngestDisabled === true) {
        attestation.textContent = "Lokaler CFSON-Dienst signiert bestätigt (" + String(result.version || "Alpha") + "). Keine Konto- oder Medienfreigabe.";
      } else if (result?.state === "signature_mismatch") {
        attestation.textContent = "Dienstidentität nicht bestätigt: Signatur ungültig.";
      } else if (result?.state === "version_mismatch" || result?.state === "safety_mismatch") {
        attestation.textContent = "Dienstidentität nicht freigegeben: Version oder Sicherheitsstatus abweichend.";
      } else {
        attestation.textContent = "Dienstidentität nicht bestätigt oder Test deaktiviert.";
      }
      showOverall();
    }).catch(() => {
      checks.attestation = {ok:false,state:"unavailable"};
      attestation.textContent = "Dienstidentität konnte nicht bestätigt werden.";
      showOverall();
    });
    if (adminGate) withDeadline(signal => fetch("/api/creator/cfson/local-admin-gate", {
      method: "GET", credentials: "same-origin", cache: "no-store", headers: { "Accept": "application/json" }, signal
    }).then(async response => {
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("admin_gate_unavailable");
      return response.json();
    })).then(result => {
      checks.admin = result ?? {ok:false,state:"disabled"};
      if (result?.ok === true && result.state === "verified_local_admin_gate" && result.accountLinked === false) {
        adminGate.textContent = "Lokale Admin-Prüfung bestätigt (nur Diagnose). Keine CFSON-Kontoanmeldung.";
      } else {
        adminGate.textContent = "Admin-Prüfpfad nicht bestätigt. Keine Konto- oder Produktfreigabe.";
      }
      showOverall();
    }).catch(() => {
      checks.admin = {ok:false,state:"unavailable"};
      adminGate.textContent = "Admin-Prüfpfad nicht verfügbar. Keine Konto- oder Produktfreigabe.";
      showOverall();
    });
    if (readiness) withDeadline(signal => fetch("/api/creator/cfson/local-readiness", {
      method: "GET", credentials: "same-origin", cache: "no-store", headers: { "Accept": "application/json" }, signal
    }).then(async response => {
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("readiness_unavailable");
      return response.json();
    })).then(result => {
      checks.readiness = result ?? {ok:false,state:"disabled"};
      if (result?.ok === true && result.state === "reachable" && result.stage === "private-alpha" && result.liveIngestDisabled === true) {
        readiness.textContent = "Lokaler CFSON-Diagnosetest erfolgreich (" + String(result.version || "Alpha") + "). Keine Konto-, Medien- oder Live-Verbindung.";
      } else if (result?.state === "safety_mismatch") {
        readiness.textContent = "CFSON-Sicherheitsabweichung: Live-Funktionen unerwartet aktiviert. Keine Freigabe.";
      } else if (result?.state === "version_mismatch") {
        readiness.textContent = "CFSON-Version nicht kompatibel. Verbindung nicht freigegeben.";
      } else if (result?.state === "configuration_invalid") {
        readiness.textContent = "Lokaler Testdienst: Konfiguration ungültig.";
      } else {
        readiness.textContent = "Lokaler Verbindungstest nicht freigegeben oder nicht erreichbar.";
      }
      showOverall();
    }).catch(() => {
      checks.readiness = {ok:false,state:"unavailable"};
      readiness.textContent = "Lokaler Verbindungstest fehlgeschlagen.";
      showOverall();
    });
  }).catch(() => {
    if (status) status.textContent = "Dieser Testbereich ist zurzeit nicht verfügbar.";
  });
})();
