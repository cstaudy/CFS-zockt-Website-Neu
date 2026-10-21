
(() => {
  "use strict";

  const tabSelector = "[data-account-tab]";
  const panelSelector = "[data-account-panel]";

  function setupAccountTabs() {
    const tabs = Array.from(document.querySelectorAll(tabSelector));
    const panels = Array.from(document.querySelectorAll(panelSelector));

    if (!tabs.length || !panels.length) return;

    const names = new Set(panels.map(panel => panel.dataset.accountPanel));

    function activate(name, { updateHash = true, focus = false, scroll = true } = {}) {
      if (!names.has(name)) name = "overview";

      for (const tab of tabs) {
        const active = tab.dataset.accountTab === name;
        tab.setAttribute("aria-selected", active ? "true" : "false");
        tab.tabIndex = active ? 0 : -1;
        if (active && focus) tab.focus();
      }

      for (const panel of panels) {
        panel.hidden = panel.dataset.accountPanel !== name;
      }

      if (updateHash) {
        const nextHash = `account-${name}`;
        if (location.hash !== `#${nextHash}`) {
          history.replaceState(null, "", `#${nextHash}`);
        }
      }

      if (scroll) {
        window.scrollTo({
          top: Math.max(0, document.querySelector(".account-tabs")?.offsetTop - 92 || 0),
          behavior: "smooth"
        });
      }
    }

    function nameFromHash() {
      const match = /^#account-(overview|security|sessions|advanced)$/.exec(location.hash);
      return match ? match[1] : "overview";
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activate(tab.dataset.accountTab));

      tab.addEventListener("keydown", event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();

        let nextIndex = index;
        if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
        if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = tabs.length - 1;

        activate(tabs[nextIndex].dataset.accountTab, { focus: true });
      });
    });

    document.querySelectorAll("[data-open-account-tab]").forEach(control => {
      control.addEventListener("click", () => {
        const targetId = control.dataset.accountTarget;
        const target = targetId ? document.getElementById(targetId) : null;
        const panelName = control.dataset.openAccountTab;
        // Reveal the containing panel *before* focusing its destination.
        activate(panelName, { scroll: !target });
        if (target && target.closest(`[data-account-panel="${panelName}"]`)) {
          target.focus({ preventScroll: true });
          target.scrollIntoView({ block: "start", behavior: "smooth" });
        }
      });
    });

    window.addEventListener("hashchange", () => {
      activate(nameFromHash(), { updateHash: false, scroll: false });
    });

    activate(nameFromHash(), { updateHash: false, scroll: false });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupAccountTabs);
  } else {
    setupAccountTabs();
  }
})();
