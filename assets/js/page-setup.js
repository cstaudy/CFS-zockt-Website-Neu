document.addEventListener("DOMContentLoaded", async () => {
  const me = await CFS.requireAuth();
  if (!me) return;

  const account = me.account;
  const entitlements = me.entitlements || {};
  previewPlan.textContent = CFS.planLabel(account.plan);

  const allowedThemes = entitlements.themes || ["cfs"];
  themeSelect.innerHTML = allowedThemes
    .map(theme => `<option value="${CFS.escape(theme)}">${CFS.escape(theme.toUpperCase())}</option>`)
    .join("");

  const allWidgets = [
    { key: "follower_goal", label: "Follower-Ziel", min: "free" },
    { key: "likes", label: "Likes", min: "creator" },
    { key: "viewer", label: "Viewer", min: "creator" },
    { key: "gifts", label: "Gifts", min: "creator" },
    { key: "auto_thanks", label: "AutoThanks", min: "creator" },
    { key: "custom_branding", label: "Custom Branding", min: "pro" }
  ];

  function planRank(plan) {
    return ({ free:0, creator:1, pro:2 })[String(plan || "free").toLowerCase()] ?? 0;
  }

  widgetList.innerHTML = allWidgets.map(widget => {
    const entitlementMap = {
      follower_goal: true,
      likes: Boolean(entitlements.live_widgets),
      viewer: Boolean(entitlements.live_widgets),
      gifts: Boolean(entitlements.live_widgets),
      auto_thanks: Boolean(entitlements.auto_thanks),
      custom_branding: Boolean(entitlements.custom_branding)
    };
    const allowed = Boolean(entitlementMap[widget.key]);
    return `
      <label style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #173657;border-radius:10px">
        <input
          type="checkbox"
          name="widget"
          value="${widget.key}"
          ${allowed ? "" : "disabled"}
          style="width:auto"
        >
        <span>${widget.label}</span>
        <span class="badge ${allowed ? "ok" : "lock"}" style="margin-left:auto">
          ${allowed ? "OK" : widget.min.toUpperCase()}
        </span>
      </label>
    `;
  }).join("");

  let setupVersion=null, loaded=false, saving=false;
  const saveButton=setupForm.querySelector('button[type="submit"]');
  saveButton.disabled=true;
  try {
    const data = await CFS.json("/api/creator/modules/launcher/state");
    if(!["saved","not_saved"].includes(data.setup_status))throw Error("Gespeichertes Setup muss geprüft werden. Kein Überschreiben möglich.");
    setupVersion=data.setup_version;
    if(!(setupVersion===null||typeof setupVersion==="string"))throw Error("Setup-Version fehlt.");
    const state = data.state?.creator_setup || {};

    setupForm.theme.value = allowedThemes.includes(state.theme) ? state.theme : allowedThemes[0];
    setupForm.start_module.value = state.start_module || "dashboard";
    setupForm.active_game.value = state.active_game || "";
    setupForm.follower_goal.value = Number(state.follower_goal || 200);
    setupForm.show_mode.value = state.show_mode || "standard";

    const selected = Array.isArray(state.widgets) ? state.widgets : ["follower_goal"];
    document.querySelectorAll('input[name="widget"]').forEach(input => {
      input.checked = selected.includes(input.value);
    });

    loaded=true;saveButton.disabled=false;
    syncInfo.textContent = data.setup_status==="saved" && data.updated_at
      ? `Letzte Speicherung der Creator-Einstellungen: ${new Date(data.updated_at).toLocaleString("de-DE")}`
      : "Noch kein Creator Setup gespeichert.";
  } catch (error) {
    message.textContent = error.message;
    message.className = "notice danger";
    syncInfo.textContent = "Setup konnte nicht sicher geladen werden. Bitte Seite neu laden.";
  }

  function render() {
    const widgets = [...document.querySelectorAll('input[name="widget"]:checked')]
      .map(input => input.parentElement.querySelector("span").textContent);

    previewTheme.textContent = String(setupForm.theme.value || "cfs").toUpperCase();
    previewWidgets.textContent = widgets.length ? widgets.join(", ") : "Keine Widgets";
    previewStart.textContent = setupForm.start_module.options[setupForm.start_module.selectedIndex]?.text || "Dashboard";
  }

  setupForm.addEventListener("input", render);

  setupForm.addEventListener("submit", async event => {
    event.preventDefault();
    if(!loaded||saving)return;
    saving=true;saveButton.disabled=true;

    const widgets = [...document.querySelectorAll('input[name="widget"]:checked')]
      .map(input => input.value);

    const state = {
      creator_setup: {
        theme: setupForm.theme.value,
        start_module: setupForm.start_module.value,
        widgets,
        active_game: setupForm.active_game.value,
        follower_goal: Number(setupForm.follower_goal.value || 200),
        show_mode: setupForm.show_mode.value
      }
    };

    try {
      const saved = await CFS.json("/api/creator/modules/launcher/state", {
        method: "PUT",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ state, expected_version:setupVersion })
      });

      if(saved.ok!==true||saved.setup_status!=="saved"||typeof saved.setup_version!=="string")throw Error("Speicherung nicht bestätigt.");
      setupVersion=saved.setup_version;
      message.textContent = "Creator Setup wurde serverseitig gespeichert.";
      message.className = "notice";
      syncInfo.textContent = `Letzte Speicherung der Creator-Einstellungen: ${new Date(saved.updated_at).toLocaleString("de-DE")}`;
    } catch (error) {
      if(error.status===409){loaded=false;message.textContent="Setup wurde geändert oder muss geprüft werden. Bitte Seite neu laden; nichts wurde überschrieben.";}else{message.textContent=error.message;}
      message.className = "notice danger";
    } finally {saving=false;saveButton.disabled=!loaded;}
  });

  render();
});
