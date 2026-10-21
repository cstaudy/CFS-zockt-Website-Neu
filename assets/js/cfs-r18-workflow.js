/* CFS R18 — reduzierte Creator-Oberfläche. Keine API- oder Berechtigungsänderungen. */
(() => {
  'use strict';
  const cfg = {
    '/pages/widget-studio.html': {
      title: 'Widget Studio', summary: 'Live-Widgets erstellen, testen und gezielt veröffentlichen.',
      steps: [['Meine Widgets', '#wsWidgetGrid'], ['Widget erstellen', '#wsApp'], ['Speichern & Testen', '#wsApp']],
      explain: ['.cfs-r7-hub', '.creator-tool-entry', '.ws-role-boundary', '.ws-simple-guide']
    },
    '/pages/editor.html': {
      title: 'Creator Editor', summary: 'Profil und Widget-Details anpassen, prüfen und speichern.',
      steps: [['Profil bearbeiten', '#editorForm'], ['Widget anpassen', '#widgetTabs'], ['Vorschau prüfen', '#previewName']],
      explain: ['.cfs-r7-hub', '.creator-tool-entry', '.page-hero']
    },
    '/pages/stream-maker.html': {
      title: 'Stream Maker', summary: 'Design auswählen, anpassen und als Bundle speichern.',
      steps: [['Design auswählen', '#editorView'], ['Vorschau anpassen', '#editorView'], ['Bundle speichern', '#save']],
      explain: ['.cfs-r7-hub', '.sm-role-boundary', '.sm-flow']
    },
    '/pages/universal-builder.html': {
      title: 'Bundle Builder', summary: 'Design, Plattform und Widgets in einem geführten Ablauf kombinieren.',
      steps: [['Design wählen', '#builderApp'], ['Widgets einrichten', '#builderApp'], ['Bundle exportieren', '#ubExportBundle']],
      explain: ['.cfs-r7-hub', '.ub-hero']
    },
    '/pages/stream-studio.html': {
      title: 'Stream Studio', summary: 'Szenen, Vorschau, Ton und Live-Kontrolle an einem Ort.',
      steps: [['Szene vorbereiten', '#scene-composer'], ['Vorschau prüfen', '#streamDockWorkspace'], ['Live-Kontrolle', '#stream-io']],
      explain: ['.cfs-r7-hub', '.stream-operator-heading']
    },
    '/pages/scene-studio.html': {
      title: 'Scene Studio', summary: 'Bestehende Szenen gestalten und bewusst freigeben.',
      steps: [['Szene wählen', '.scene-workspace'], ['Elemente bearbeiten', '.scene-workspace'], ['Speichern', '#saveScene']],
      explain: ['.cfs-r7-hub', '.creator-tool-entry']
    },
    '/pages/audio-studio.html': {
      title: 'Tonstudio', summary: 'Sounddatei lokal laden, schneiden, anhören und als WAV speichern. Kein Upload.',
      steps: [['Audio laden', '#toneDrop'], ['Schnitt & Pegel', '.tone-controls'], ['WAV exportieren', '#toneDownload']],
      explain: ['.creator-tool-entry', '.page-hero', '#audioWorkspace', '.tone-fineprint', 'main > .section']
    },
    '/pages/cut-studio.html': {
      title: 'Cut Studio', summary: 'Clip auswählen, Schnitt festlegen und Export für den lokalen Launcher vorbereiten.',
      steps: [['Projekt erstellen', '#newCutProject'], ['Clip prüfen', '#cutPreviewDrop'], ['Exportplan', '#cutCheckExport']],
      explain: ['.cfs-r7-hub', '.creator-tool-entry', '.cut-steps']
    },
    '/pages/launcher.html': {
      title: 'Launcher', summary: 'Windows-Setup laden, PC verbinden und Gerätestatus prüfen.',
      steps: [['Launcher laden', '#heroDownload'], ['PC verbinden', '/pages/launcher-connect.html'], ['Geräte ansehen', '#deviceGrid']],
      explain: ['.creator-tool-entry', '.launcher-simple-note']
    }
  };
  const $ = (s, base=document) => base.querySelector(s);
  const all = (s, base=document) => [...base.querySelectorAll(s)];
  const make = (tag, className='', content='') => {
    const el = document.createElement(tag);
    if (className) el.className=className;
    if (content) el.textContent=content;
    return el;
  };
  function safeLink(label, address) {
    const link=make('a','cfs-r18-step-link',label);
    link.href=address;
    return link;
  }
  function organizeNav() {
    const nav=$('[data-creator-nav]');
    if (!nav) return;
    const more=$('.creator-nav-more-menu',nav);
    if (!more) return;
    const find = path=>all('a[href]',nav).find(el=>el.getAttribute('href')===path);
    // Bestehende Links umsortieren; Auth-, Logout- und Mobile-Steuerung bleiben erhalten.
    ['/pages/tiktok.html','/pages/integrations.html'].forEach(path=>{
      const link=find(path); if(link) more.append(link);
    });
    const morePanel=$('.creator-nav-more',nav);
    ['/pages/cut-studio.html','/pages/audio-studio.html'].forEach(path=>{
      const link=find(path); if(link && morePanel) nav.insertBefore(link,morePanel);
    });
    const names = {
      '/pages/dashboard.html':'Übersicht', '/pages/widget-studio.html':'Widgets',
      '/pages/stream-studio.html':'Stream', '/pages/cut-studio.html':'Cut',
      '/pages/audio-studio.html':'Ton', '/pages/launcher.html':'Launcher',
      '/pages/account.html':'Konto'
    };
    for(const [path,name] of Object.entries(names)) {
      const link=find(path); if(!link)continue;
      link.textContent=name;
      if(location.pathname===path){link.classList.add('cfs-r18-current');link.setAttribute('aria-current','page');}
    }
    const summary=$('.creator-nav-more > summary',nav);
    if(summary) summary.textContent='Mehr';
  }
  function enhanceStudio(page) {
    const main=$('main'); if(!main)return;
    document.documentElement.classList.add('cfs-r18','cfs-r18-studio');
    document.body.dataset.cfsR18Studio=location.pathname.split('/').pop().replace('.html','');
    const aside=make('section','cfs-r18-workflow');
    aside.setAttribute('aria-label', 'Schnelleinstieg '+page.title);
    const heading=make('div','cfs-r18-workflow-heading');
    heading.append(make('span','cfs-r18-kicker','CREATOR SUITE'));
    heading.append(make('h1','cfs-r18-title',page.title));
    heading.append(make('p','cfs-r18-subtitle',page.summary));
    aside.append(heading);
    const steps=make('nav','cfs-r18-steps');
    steps.setAttribute('aria-label','Arbeitsschritte');
    page.steps.forEach(([label, address], index)=>{
      if(address.startsWith('#')){
        const target=$(address);
        if(!target)return; // keine Links ins Leere bei Versionsunterschieden
        if(!target.id)target.id='cfs-r18-step-'+index;
      }
      const href=address.startsWith('#') ? '#'+$(address).id : address;
      const link=safeLink(label,href);
      const number=make('span','cfs-r18-step-number',String(index+1));
      link.prepend(number);steps.append(link);
    });
    aside.append(steps);
    const explanations=[];
    page.explain.forEach(sel=>all(sel,main).forEach(node=>{
      if(node.matches('script,style') || explanations.includes(node))return;
      // Sicherheitskritische Formular-/Account-Grenzen werden niemals versteckt.
      explanations.push(node);node.classList.add('cfs-r18-explainer');
      node.hidden=true;
    }));
    let toggle;
    if(explanations.length){
      const tools=make('div','cfs-r18-workflow-actions');
      toggle=make('button','cfs-r18-info-toggle','Erklärungen anzeigen');
      toggle.type='button';toggle.setAttribute('aria-expanded','false');
      toggle.addEventListener('click',()=>setInfo(explanations[0].hidden));
      tools.append(toggle);aside.append(tools);
    }
    function setInfo(show){
      explanations.forEach(el=>{el.hidden=!show;});
      if(toggle){toggle.textContent=show?'Erklärungen ausblenden':'Erklärungen anzeigen';toggle.setAttribute('aria-expanded',String(show));}
    }
    main.prepend(aside);
    // Audacity-artiger Arbeitsfluss: Der tatsächliche Editor steht vor Status/Roadmap.
    if(location.pathname==='/pages/audio-studio.html'){
      const tone=$('#alertToneStudio'), workspace=$('#audioWorkspace');
      if(tone && workspace && tone.parentNode===workspace.parentNode) workspace.before(tone);
    }
    const revealHash=()=>{
      let target;
      try{target=location.hash?document.getElementById(decodeURIComponent(location.hash.slice(1))):null;}catch{return;}
      if(!target)return;
      if(explanations.some(el=>el===target || el.contains(target)))setInfo(true);
    };
    window.addEventListener('hashchange',revealHash);
    revealHash();
    // Der Schnellstart verwendet normale Anker, keine verdeckten App-Callbacks.
    all('a[href^="#"]',aside).forEach(link=>link.addEventListener('click',()=>{
      const el=document.getElementById(link.getAttribute('href').slice(1));
      if(el && explanations.some(node=>node===el || node.contains(el)))setInfo(true);
    }));
  }
  function enhanceSuite() {
    const main=$('main'); if(!main)return;
    document.documentElement.classList.add('cfs-r18','cfs-r18-suite');
    const hub=make('section','cfs-r18-suite-hub');
    hub.setAttribute('aria-label','Creator Suite Werkzeuge');
    const kicker=make('span','cfs-r18-kicker','CREATOR SUITE');hub.append(kicker);
    hub.append(make('h1','cfs-r18-title','Deine Tools. Ohne Umwege.'));
    hub.append(make('p','cfs-r18-subtitle','Wähle das passende Studio. Alles Weitere findest du direkt im Werkzeug.'));
    const cards=make('div','cfs-r18-suite-cards');
    [
      ['Widget Studio','Live-Widgets erstellen','/pages/widget-studio.html'],
      ['Stream Studio','Szenen und Live-Kontrolle','/pages/stream-studio.html'],
      ['Stream Maker','Designs und Bundles','/pages/stream-maker.html'],
      ['Cut Studio','Clips schneiden','/pages/cut-studio.html'],
      ['Tonstudio','Sounds lokal bearbeiten','/pages/audio-studio.html'],
      ['Launcher','PC verbinden','/pages/launcher.html'],
      ['Bundle Builder','Design und Widgets verbinden','/pages/universal-builder.html'],
      ['Creator Shop','Designs entdecken','/pages/shop.html']
    ].forEach(([title,desc,url])=>{
      const item=make('a','cfs-r18-suite-card');item.href=url;
      item.append(make('strong','',title),make('span','',desc));cards.append(item);
    });hub.append(cards);
    const status=make('p','cfs-r18-beta-note','Private Beta: Zugang nur nach individueller Freigabe.');
    hub.append(status);main.prepend(hub);
    const details=make('details','cfs-r18-suite-background');
    const summary=make('summary','','Mehr über die Creator Suite erfahren');details.append(summary);
    // Legacy-Bereich ist weiter verfügbar. IDs/Links bleiben bestehen.
    [...main.children].filter(el=>el!==hub && ['SECTION'].includes(el.tagName)).forEach(el=>details.append(el));
    main.append(details);
    const openHash=()=>{
      const id=location.hash.slice(1);
      if(id && document.getElementById(id) && details.contains(document.getElementById(id))) details.open=true;
    };
    addEventListener('hashchange',openHash);openHash();
  }
  function init() {
    organizeNav();
    const page=cfg[location.pathname];
    if(page)enhanceStudio(page);
    else if(location.pathname==='/pages/creator-suite.html')enhanceSuite();
    else if(location.pathname==='/'||location.pathname==='/index.html')document.documentElement.classList.add('cfs-r18','cfs-r18-home');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
