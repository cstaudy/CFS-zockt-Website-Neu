(() => {
 "use strict";
 // Standalone, offline. No requests, storage, credentials, or provider SDK.
 const cues = new Set(["follow", "chat", "goal", "brb", "reset"]);
 const toast = document.getElementById("demo-toast");
 const brb = document.getElementById("demo-brb");
 const bar = document.getElementById("demo-progress-bar");
 const goal = document.getElementById("demo-progress-text");
 const chat = document.getElementById("demo-chat-row");
 let progress = 68, timer = null, tick = 0;
 function cue(kind) {
   if (!cues.has(kind)) return;
   if (kind === "reset") {
     progress = 68; goal.textContent = "68 / 100"; bar.style.width = "68%";
     chat.textContent = "TestBot: Keine echten Chatdaten.";
     brb.classList.remove("active");toast.classList.remove("active");
     return;
   }
   if (kind === "brb") { brb.classList.toggle("active"); return; }
   brb.classList.remove("active");
   if (kind === "chat") chat.textContent = "DemoUser: Chat-Test angekommen ✓";
   if (kind === "goal") { progress = Math.min(100, progress + 7); goal.textContent = `${progress} / 100`; bar.style.width = `${progress}%`; }
   if (kind === "follow") {
     toast.classList.add("active");
     clearTimeout(timer);
     timer = setTimeout(() => toast.classList.remove("active"), 4300);
   }
 }
 window.addEventListener("message", event => {
   if (event.source !== window.parent || window.parent === window) return;
   const data = event.data;
   if (!data || data.type !== "cfs-on-demo-cue" || typeof data.cue !== "string") return;
   cue(data.cue);
 });
 // Standalone OBS Browser Source: periodically exercise demo graphics even
 // without a controlling parent page. This never generates a real event.
 setInterval(() => { tick += 1; cue(["chat", "follow", "goal", "reset"][tick % 4]); }, 16000);
})();
