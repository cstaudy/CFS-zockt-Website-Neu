(() => {
  "use strict";

  const BRAND_MARK = "/assets/img/brand/cfs-zockt-mark-clean.png";
  const BRAND_WORDMARK = "/assets/img/brand/cfs-zockt-wordmark-transparent.png";
  const path = location.pathname.toLowerCase();
  // Eigenständige Werkzeuge behalten bewusst ihr eigenes Layout; sie nutzen
  // aus der gemeinsamen Hülle nur Tastatur-Sprunglink und Jahreszahl.
  const standaloneTools = new Set([
    "/pages/design-vorschau.html", "/pages/obs-setup.html", "/pages/stream-maker.html"
  ]);

  const generalCreatorPages = new Set([
    "/pages/dashboard.html",
    "/pages/account.html",
    "/pages/settings.html",
    "/pages/setup.html",
    "/pages/integrations.html",
    "/pages/tiktok.html",
    "/pages/launcher.html",
    "/pages/launcher-connect.html",
    "/pages/audio-studio.html",
    "/pages/games.html",
    "/pages/shop.html",
    "/pages/cfs-ai.html"
  ]);

  const specializedCreatorPages = new Set([
    "/pages/widget-studio.html",
    "/pages/stream-studio.html",
    "/pages/editor.html",
    "/pages/scene-studio.html",
    "/pages/cut-studio.html"
  ]);

  function brandContextLabel(creator = false) {
    if (!creator) return "GAMING · STREAMS · COMMUNITY";
    if (path === "/pages/admin.html" || path === "/pages/admin-creators.html") return "ADMIN CONTROL";
    if (path === "/pages/cfs-ai.html") return "CFS AI";
    return "CREATOR SUITE";
  }

  function brandMarkup({ creator = false } = {}) {
    return `
      <span class="cfs-brand-wordmark"><img src="${BRAND_WORDMARK}" alt="" aria-hidden="true"></span>
      <span class="cfs-brand-copy">
        <strong>CFS ZOCKT</strong>
        <small>${brandContextLabel(creator)}</small>
      </span>`;
  }

  function upgradeHeaderBrands() {
    document.querySelectorAll(".brand-logo-link, .gaming-brand, .site-header a.brand, header.top a.brand").forEach(anchor => {
      const creatorBrand = document.body.classList.contains("creator-workspace") && !anchor.classList.contains("gaming-brand");
      anchor.classList.add("cfs-brand-lockup");
      anchor.innerHTML = brandMarkup({ creator: creatorBrand });
    });

    document.querySelectorAll(".creator-brand").forEach(anchor => {
      anchor.classList.add("cfs-brand-lockup");
      anchor.innerHTML = brandMarkup({ creator: true });
    });

    const heroLogo = document.querySelector(".brand-hero-logo");
    if (heroLogo && !document.querySelector(".cfs-hero-brand")) {
      const brand = document.createElement("div");
      brand.className = "cfs-hero-brand";
      brand.innerHTML = brandMarkup({ creator: false });
      heroLogo.replaceWith(brand);
    }

    document.querySelectorAll(".public-footer-brand, .gaming-footer-brand, .cfs-footer-v165-brand").forEach(footerBrand => {
      footerBrand.classList.add("cfs-brand-lockup", "cfs-footer-lockup");
      footerBrand.innerHTML = brandMarkup({ creator: false });
    });
  }

  function markActiveTopNavigation() {
    document.querySelectorAll(".public-nav a, .creator-nav a").forEach(link => {
      try {
        const url = new URL(link.href, location.origin);
        const active = url.pathname.toLowerCase() === path;
        link.classList.toggle("active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      } catch {}
    });
  }

  function icon(name) {
    const icons = {
      dashboard:"⌂", account:"◎", widgets:"▦", stream:"◫", tiktok:"♪", shop:"$",
      integrations:"◇", launcher:"▣", settings:"⚙", support:"?",
      overview:"⌂", security:"◇", sessions:"▣", advanced:"⚙", ai:"✦"
    };
    return icons[name] || "•";
  }

  function makeLink({ label, href, key, active = false }) {
    const a = document.createElement("a");
    a.className = `cfs-sidebar-link${active ? " active" : ""}`;
    a.href = href;
    if (active) a.setAttribute("aria-current", "page");
    a.innerHTML = `<span class="cfs-sidebar-icon">${icon(key)}</span><span>${label}</span>`;
    return a;
  }

  function injectCreatorSidebar() {
    if (!document.body.classList.contains("creator-workspace")) return;

    if (specializedCreatorPages.has(path)) {
      document.body.classList.add("cfs-specialized-workspace");
      return;
    }

    if (!generalCreatorPages.has(path)) return;
    if (document.querySelector(".cfs-global-sidebar")) return;

    const aside = document.createElement("aside");
    aside.className = "cfs-global-sidebar";
    aside.setAttribute("aria-label", "Creator Navigation");

    const label = document.createElement("div");
    label.className = "cfs-sidebar-label";
    label.textContent = path === "/pages/account.html" ? "ACCOUNT" : "CREATOR SUITE";
    aside.appendChild(label);

    // R112: A single five-area navigation on every general creator page.
    // Account subsections are handled only by the existing account-tabs component.
    // Editors, links and account JS are preserved, not cloned into the sidebar.
    const items = [
      ["Dashboard", "/pages/dashboard.html", "dashboard", ["/pages/dashboard.html"]],
      ["Meine Tools", "/pages/creator-suite.html", "widgets", ["/pages/creator-suite.html", "/pages/universal-builder.html", "/pages/widget-studio.html", "/pages/stream-maker.html", "/pages/scene-studio.html", "/pages/editor.html", "/pages/cut-studio.html", "/pages/audio-studio.html", "/pages/games.html", "/pages/shop.html", "/pages/launcher.html", "/pages/cfs-ai.html"]],
      ["Streams & Content", "/pages/stream-studio.html", "stream", ["/pages/stream-studio.html", "/pages/tiktok.html", "/pages/integrations.html"]],
      ["Community", "/#community", "overview", []],
      ["Account & Einstellungen", "/pages/account.html", "account", ["/pages/account.html", "/pages/settings.html", "/pages/setup.html", "/pages/launcher-connect.html"]]
    ];
    items.forEach(([text, href, key, pages]) => {
      aside.appendChild(makeLink({label:text, href, key, active:pages.includes(path)}));
    });

    const header = document.querySelector(".site-header");
    if (header) header.insertAdjacentElement("afterend", aside);
    else document.body.prepend(aside);
    document.body.classList.add("cfs-sidebar-ready");
  }


  async function injectCfsAiAdminNavigation() {
    if (!document.body.classList.contains("creator-workspace")) return;
    try {
      const response = await fetch("/api/account/me", { credentials:"same-origin", headers:{"Accept":"application/json"} });
      if (!response.ok) return;
      const data = await response.json();
      if (!data?.admin) return;

      const moreMenu = document.querySelector(".creator-nav-more-menu");
      if (moreMenu) {
        if (!moreMenu.querySelector('a[href="/pages/admin.html"]')) {
          const adminLink = document.createElement("a");
          adminLink.dataset.creatorLink = "";
          adminLink.href = "/pages/admin.html";
          adminLink.textContent = "ADMIN";
          moreMenu.prepend(adminLink);
        }
        if (!moreMenu.querySelector('a[href="/pages/cfs-ai.html"]')) {
          const aiLink = document.createElement("a");
          aiLink.dataset.creatorLink = "";
          aiLink.href = "/pages/cfs-ai.html";
          aiLink.textContent = "CFS AI";
          moreMenu.prepend(aiLink);
        }
      }

      const sidebar = document.querySelector(".cfs-global-sidebar");
      if (sidebar) {
        const divider = sidebar.querySelector(".cfs-sidebar-divider");
        if (!sidebar.querySelector('a[href="/pages/admin.html"]')) {
          const adminLink = makeLink({ label:"Admin", href:"/pages/admin.html", key:"security", active:path === "/pages/admin.html" });
          if (divider) sidebar.insertBefore(adminLink, divider);
          else sidebar.appendChild(adminLink);
        }
        if (!sidebar.querySelector('a[href="/pages/cfs-ai.html"]')) {
          const aiLink = makeLink({ label:"CFS AI", href:"/pages/cfs-ai.html", key:"ai", active:path === "/pages/cfs-ai.html" });
          if (divider) sidebar.insertBefore(aiLink, divider);
          else sidebar.appendChild(aiLink);
        }
      }
    } catch {}
  }


  function injectCreatorShopNavigation() {
    document.querySelectorAll(".creator-nav").forEach(nav => {
      if (nav.querySelector('a[href="/pages/shop.html"]')) return;
      const more = nav.querySelector(".creator-nav-more");
      const link = document.createElement("a");
      link.href = "/pages/shop.html";
      link.dataset.creatorLink = "";
      link.className = "cfs172-shop-link";
      link.textContent = "SHOP";
      if (path === "/pages/shop.html") { link.classList.add("active"); link.setAttribute("aria-current","page"); }
      (more?.querySelector(".creator-nav-more-menu") || more || nav).appendChild(link);
    });
  }

  function injectCreatorBuilderNavigation() {
    document.querySelectorAll(".creator-nav").forEach(nav => {
      if (nav.querySelector('a[href="/pages/universal-builder.html"]')) return;
      const more = nav.querySelector(".creator-nav-more");
      const link = document.createElement("a");
      link.href = "/pages/universal-builder.html";
      link.dataset.creatorLink = "";
      link.className = "cfs204-builder-link";
      link.textContent = "BUILDER";
      if (path === "/pages/universal-builder.html") { link.classList.add("active"); link.setAttribute("aria-current","page"); }
      (more?.querySelector(".creator-nav-more-menu") || more || nav).appendChild(link);
    });
  }

  function ensureBrandV192() {
    document.body.dataset.cfsBrandV192 = "1";
    if (!document.querySelector('link[data-cfs-brand-v192]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/assets/css/cfs-brand-unified-v192.css";
      link.dataset.cfsBrandV192 = "1";
      document.head.appendChild(link);
    }
  }

  function ensureBrandV197() {
    document.body.dataset.cfsBrandV197 = "1";
    if (!document.querySelector('link[data-cfs-brand-v197]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/assets/css/cfs-brand-v197.css";
      link.dataset.cfsBrandV197 = "1";
      document.head.appendChild(link);
    }
  }

  function ensureBrandV198() {
    document.body.dataset.cfsBrandV198 = "1";
    let link = document.querySelector('link[data-cfs-brand-v198]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/assets/css/cfs-brand-v198.css";
      link.dataset.cfsBrandV198 = "1";
    }
    // Keep the professional layer last so legacy page styles cannot overwrite it.
    document.head.appendChild(link);
  }

  function ensureSuiteV203() {
    if (!document.body.classList.contains("creator-workspace")) return;
    document.body.dataset.cfsSuiteV203 = "1";
    let link = document.querySelector('link[data-cfs-suite-v203]');
    if (!link) link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/assets/css/cfs-suite-v203.css";
    link.dataset.cfsSuiteV203 = "1";
    document.head.appendChild(link);
  }

  function injectFallbackBrandHeader() {
    // Spezialseiten besitzen eigene Header oder eine eigenständige kompakte Navigation.
    // Kein zweites Header-Element darüber legen.
    if (document.querySelector("header, nav.r13-topnav")) return;
    const header = document.createElement("header");
    const creator = document.body.classList.contains("creator-workspace");
    header.className = `site-header ${creator ? "creator-site-header" : "brand-header public-site-header"} cfs-shell-generated-header`;
    header.innerHTML = `<div class="container header-inner"><a class="brand cfs-brand-lockup" href="${creator ? "/pages/dashboard.html" : "/"}" aria-label="cfs_zockt ${creator ? "Creator Suite Dashboard" : "Startseite"}">${brandMarkup({ creator })}</a></div>`;
    document.body.prepend(header);
  }

  function installUnifiedV172() {
    if (document.querySelector('link[data-cfs-unified-v172]')) return;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="/assets/css/cfs-unified-v172.css";
    link.dataset.cfsUnifiedV172="1";
    document.head.appendChild(link);
  }

  function installUiBundleAssets() {
    if (!document.querySelector('link[data-cfs-ui-v18]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/assets/css/cfs-ui-v18.css";
      link.dataset.cfsUiV18 = "1";
      document.head.appendChild(link);
    }

    if (!document.querySelector('script[data-cfs-ui-v18]')) {
      const script = document.createElement("script");
      script.src = "/assets/js/cfs-ui-v18.js";
      script.defer = true;
      script.dataset.cfsUiV18 = "1";
      document.head.appendChild(script);
    }
  }

  function updateCopyrightYear() {
    const year = String(new Date().getFullYear());
    document.querySelectorAll("[data-cfs-current-year]").forEach(node => { node.textContent = year; });
  }

  function injectCreatorProductSignature() {
    if (!document.body.classList.contains("creator-workspace")) return;
    if (document.querySelector(".cfs-product-signature-v180")) return;
    const footer = document.createElement("footer");
    footer.className = "cfs-product-signature-v180";
    footer.innerHTML = `<div class="cfs-brand-lockup">${brandMarkup({ creator: true })}</div><small>© <span data-cfs-current-year>${new Date().getFullYear()}</span> cfs_zockt · Alle Rechte vorbehalten.</small>`;
    document.body.appendChild(footer);
  }

  function ensureSkipLink() {
    const main = document.querySelector("main");
    if (!main || document.querySelector(".cfs-skip-link, a.skip-link[href^='#']")) return;
    if (!main.id) main.id = "cfs-main-content";
    main.tabIndex = -1;
    const skip = document.createElement("a");
    skip.className = "cfs-skip-link";
    skip.href = `#${main.id}`;
    skip.textContent = "Zum Inhalt springen";
    // Spezialseiten nutzen ihre eigenen Stylesheets; der Skip-Link muss ohne
    // das zentrale CSS für Tastatur-Nutzer dennoch sichtbar sein.
    if (standaloneTools.has(path)) {
      skip.style.cssText = "position:fixed;z-index:100000;top:8px;left:8px;padding:10px 14px;background:#082b44;color:white;border:2px solid #57dcff;border-radius:8px;transform:translateY(-180%);";
      skip.addEventListener("focus", () => { skip.style.transform="none"; });
      skip.addEventListener("blur", () => { skip.style.transform="translateY(-180%)"; });
    }
    skip.addEventListener("click", () => main.focus({preventScroll:true}));
    document.body.prepend(skip);
  }

  function init() {
    if (standaloneTools.has(path)) {
      updateCopyrightYear();
      ensureSkipLink();
      return;
    }
    document.documentElement.classList.add("cfs-ui-v3", "cfs-os-v24");
    document.body.classList.add("cfs-ui-v3", "cfs-os-v24");
    ensureBrandV192();
    ensureBrandV197();
    injectFallbackBrandHeader();
    installUnifiedV172();
    upgradeHeaderBrands();
    injectCreatorShopNavigation();
    injectCreatorBuilderNavigation();
    markActiveTopNavigation();
    injectCreatorSidebar();
    injectCfsAiAdminNavigation();
    injectCreatorProductSignature();
    updateCopyrightYear();
    installUiBundleAssets();
    ensureBrandV198();
    ensureSuiteV203();
    ensureSkipLink();
    // Wrapped desktop navigation changes the actual sticky header height.
    const header = document.querySelector(".site-header, .gaming-header, header.top");
    if (header && typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => {
        document.documentElement.style.setProperty("--cfs-shell-header-height", `${Math.ceil(header.getBoundingClientRect().height)}px`);
      }).observe(header);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once:true });
  } else {
    init();
  }
})();
