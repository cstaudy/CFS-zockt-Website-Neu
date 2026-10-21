/* R20: ONE studio heading, real editor first. Never change business logic or permissions. */
(() => {
  'use strict';
  const studio = {
    '/pages/widget-studio.html': {name:'Widget Studio'},
    '/pages/editor.html': {name:'Creator Editor'},
    '/pages/stream-maker.html': {name:'Stream Maker', move:['#uploadTop']},
    '/pages/universal-builder.html': {name:'Universal Builder'},
    '/pages/stream-studio.html': {name:'Stream Studio'},
    '/pages/scene-studio.html': {name:'Scene Studio', move:['#newVerticalScene','#newLandscapeScene']},
    '/pages/audio-studio.html': {name:'Tonstudio'},
    '/pages/cut-studio.html': {name:'Cut Studio', move:['#newCutProject']},
    '/pages/launcher.html': {name:'Launcher', move:['#heroDownload']}
  };
  const $ = (s, parent=document) => parent.querySelector(s);
  const el = (tag, klass, value) => {const node=document.createElement(tag);if(klass)node.className=klass;if(value)node.textContent=value;return node;};
  const current=location.pathname;
  function tuneNavigation() {
    // Existing R14 is the sole visible site header. The original creator logout
    // button has registered its usual handler in app.js and must remain usable.
    const top=$('.cfs-r14-top');
    if (top && studio[current]) {
      const logout=$('.creator-site-header [data-logout]');
      const account=$('.cfs-r14-account',top);
      // Only display logout once the server confirms an authenticated session.
      if(logout && account) fetch('/api/account/me',{
        credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}
      }).then(r=>r.ok?r.json():null).then(data=>{
        if(data?.authenticated===true){logout.textContent='Abmelden';account.append(logout);}
      }).catch(()=>{});
    }
    if(studio[current] && !top){
      const nav=$('.creator-site-header .creator-nav');
      if(nav){
        let extra=$('.creator-nav-more',nav);
        if(!extra){
          extra=el('details','creator-nav-more');extra.append(el('summary','','Mehr'));
          extra.append(el('div','creator-nav-more-menu'));
          nav.insertBefore(extra,$('[data-logout]',nav));
        }
        const menu=$('.creator-nav-more-menu',extra);
        const visible=new Set(['/pages/dashboard.html','/pages/universal-builder.html','/pages/stream-studio.html','/pages/launcher.html']);
        for(const link of [...nav.querySelectorAll(':scope > a[href]')]){
          if(!visible.has(link.getAttribute('href')))menu.append(link);
        }
      }
    }
    // General Creator sidebar repeats links already in the top navigation.
    if(studio[current] && $('.cfs-global-sidebar')) document.body.classList.add('cfs-r20-no-sidebar');
    if (!studio[current]) return;
    // Add a single entry to all studios when the older header has no switcher.
    const header=top || $('.site-header .header-inner') || $('.sm-header');
    if(header && !$('.cfs-r23-top') && !$('#cfsR19Switch') && !$('.cfs-r20-directory',header)){
      const a=el('a','cfs-r20-directory','Studios');a.href='/pages/creator-suite.html';
      header.append(a);
    }
  }
  function setupStudio(info) {
    const main=$('main'); if(!main || $('#cfsR20Bar'))return;
    document.documentElement.classList.add('cfs-r20','cfs-r20-studio');
    document.body.classList.add('cfs-r20-studio');
    document.body.dataset.cfsR20=location.pathname.split('/').pop().replace('.html','');
    // A single compact toolbar, rather than three hero banners and several step flows.
    const bar=el('section','cfs-r20-bar');bar.id='cfsR20Bar';bar.setAttribute('aria-label',info.name);
    const title=el('div','cfs-r20-bar-title');
    title.append(el('h1','',info.name));bar.append(title);
    const controls=el('div','cfs-r20-bar-controls');
    for(const sel of info.move || []) {
      const action=$(sel);
      if (action) {action.classList.add('cfs-r20-primary-action');controls.append(action);}
    }
    if(current==='/pages/widget-studio.html'){
      const mode=$('.ws-experience-switch-top');
      if(mode)controls.append(mode);
    }
    bar.append(controls);main.prepend(bar);
    if(current==='/pages/launcher.html'){
      const orbit=$('.release-orbit .orbit-status');
      const devices=$('.device-management');
      if(orbit && devices)devices.prepend(orbit);
    }

    const explanations = [];
    const patterns=['.cfs-r7-hub','.creator-tool-entry','.page-hero',
      '.ws-role-boundary','.sm-role-boundary','.sm-flow'];
    // Collect only the introductory blocks. Never put active editor surfaces,
    // device controls, publishing forms or permission notices inside help.
    for(const selector of patterns) {
      for(const node of main.querySelectorAll(selector)){
        if(node.closest('#cfsR20Bar') || explanations.includes(node))continue;
        if(!node.closest('main'))continue;
        explanations.push(node);
      }
    }
    if(current==='/pages/cut-studio.html') explanations.push(...main.querySelectorAll('.cut-hero,.cut-steps'));
    if(current==='/pages/scene-studio.html') explanations.push(...main.querySelectorAll('.scene-hero'));
    if(current==='/pages/audio-studio.html') explanations.push(...main.querySelectorAll('#audioWorkspace,main > .section'));
    if(current==='/pages/stream-maker.html') explanations.push(...main.querySelectorAll('.sm-heading'));
    if(current==='/pages/widget-studio.html') explanations.push(...main.querySelectorAll('.ws-simple-guide,.ws-simple-start-hub,.ws-topbar'));
    if(current==='/pages/launcher.html') explanations.push(...main.querySelectorAll('.release-hero'));
    if(current==='/pages/universal-builder.html') explanations.push(...main.querySelectorAll('.ub-hero'));
    // Save all content, links and IDs in a native disclosure rather than deleting anything.
    const unique=[...new Set(explanations)].filter(node=>node.isConnected && !node.contains(bar));
    if(unique.length){
      const help=el('details','cfs-r20-help');help.id='cfsR20Help';
      const summary=el('summary','','Hinweise & Anleitungen');help.append(summary);
      const contents=el('div','cfs-r20-help-content');help.append(contents);
      for(const node of unique)contents.append(node);
      main.append(help);
      const reveal=()=>{
        const key=decodeURIComponent(location.hash.slice(1));
        const target=key ? document.getElementById(key) : null;
        if(target && contents.contains(target))help.open=true;
      };
      addEventListener('hashchange',reveal);reveal();
    }
    // The true local sound editor precedes future mixer plans.
    if(current==='/pages/audio-studio.html'){
      const tone=$('#alertToneStudio'), notice=$('#locked');
      if(tone && tone.parentNode===main)bar.after(tone);
      // Trim visible instructions but keep them available in an editor disclosure.
      const paragraphs=['.tone-lead','.tone-fineprint'].map(sel=>$(sel,tone)).filter(Boolean);
      if(paragraphs.length){
        const note=el('details','cfs-r20-audio-info');note.append(el('summary','','Dateiformate & Hinweise'));
        for(const paragraph of paragraphs)note.append(paragraph);
        tone.append(note);
      }
    }
    tuneNavigation();
  }
  function setupSuite() {
    // R21 keeps the directory in real HTML, readable even when JS is disabled.
    if (!$('#cfsR21Suite')) return;
    document.documentElement.classList.add('cfs-r20','cfs-r20-suite');
    document.body.classList.add('cfs-r20-suite');
  }
  function mergeHelp() {
    if (!studio[current]) return;
    const main=$('main');if(!main)return;
    const extra=$('#creatorUxHelp',main);
    if (!extra)return;
    let panel=$('#cfsR20Help',main);
    if (!panel){
      panel=el('details','cfs-r20-help');panel.id='cfsR20Help';
      panel.append(el('summary','','Hilfe'));
      panel.append(el('div','cfs-r20-help-content'));
      main.append(panel);
    } else {
      const summary=$('summary',panel);if(summary)summary.textContent='Hilfe';
    }
    const content=$('.cfs-r20-help-content',panel);
    if(content && !content.contains(extra))content.append(extra);
    const target=location.hash.slice(1);
    if(target && (target==='creatorUxHelp'||content?.querySelector('[id]') && content.contains(document.getElementById(target))))panel.open=true;
  }
  function init(){
    if(studio[current])setupStudio(studio[current]);
    else if(current==='/pages/creator-suite.html')setupSuite();
    if(studio[current])setTimeout(mergeHelp,0);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
