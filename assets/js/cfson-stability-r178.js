/* R178: Opt-in local simulator UI. No credentials, provider APIs or network I/O. */
(() => {
  "use strict";
  const section=document.getElementById("cfson-stability-r178");
  if(!section)return;
  const model=globalThis.CfsonStabilityR178;
  const runButton=document.getElementById("cfson-stability-run");
  const exportButton=document.getElementById("cfson-stability-export");
  const scenario=document.getElementById("cfson-stability-scenario");
  const count=document.getElementById("cfson-stability-count");
  const output=document.getElementById("cfson-stability-result");
  const state=document.getElementById("cfson-stability-status");
  let last=null;
  if(!model){state.textContent="Simulationsmodul fehlt. Keine Prüfung ausgeführt.";runButton.disabled=true;return;}
  runButton.addEventListener("click",()=>{
    // Explicit click only; never automatically run heavy work on page load.
    last=model.run({scenario:scenario.value,count:Number(count.value)});
    const m=last.metrics;
    const lines=[
      `Szenario: ${last.scenarioLabel} · ${last.config.count} künstliche Ereignisse`,
      `Verarbeitet: ${m.delivered} · Duplikate abgefangen: ${m.duplicatesSuppressed}`,
      `Überlast verworfen: ${m.backpressureDropped} · Veraltet verworfen: ${m.expiredDropped}`,
      `Wiederholungen: ${m.retried} · Warteschlangenspitze: ${m.queuePeak} / ${last.config.maxQueue}`,
      `Modell-Wartezeit Ø: ${m.averageDelayMs} ms · Maximum: ${m.maxDelayMs} ms`,
      `Bilanz- und Grenzwertregeln: ${last.invariantsPassed ? "EINGEHALTEN" : "FEHLER"}`
    ];
    output.textContent=lines.join("\n");
    state.textContent=last.invariantsPassed
      ?"Nur synthetisches Modell geprüft. Kein Nachweis für die Stabilität von Website, OBS oder CFSON im Echtbetrieb."
      :"Modellprüfung FEHLGESCHLAGEN – keine Freigabe.";
    exportButton.disabled=false;
  });
  exportButton.addEventListener("click",()=>{
    if(!last)return;
    const blob=new Blob([JSON.stringify({...last,exportedAt:new Date().toISOString()},null,2)+"\n"],{type:"application/json"});
    const link=document.createElement("a"),url=URL.createObjectURL(blob);
    link.href=url;
    link.download="CFS_ON_R178_STABILITAETS_SIMULATION.json";
    link.hidden=true;
    document.body.appendChild(link);
    link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
})();
