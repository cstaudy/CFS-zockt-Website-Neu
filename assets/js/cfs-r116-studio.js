/* R116 · Progressive view navigation; original forms, events, and state remain in place.
   Without JavaScript the old full layout remains visible. */
(() => {
  'use strict';
  const cutModes=[['all','Übersicht'],['preview','Vorschau'],['timeline','Timeline'],['export','Ton & Export']];
  const audioModes=[['edit','Schnitt'],['polish','Feinschliff'],['presets','Presets'],['all','Alles']];
  function navFor(options,label){
    const bar=document.createElement('nav');
    bar.className='r116-switch';
    bar.setAttribute('aria-label',label);
    options.forEach(([mode,title])=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='r116-switch-button';
      button.textContent=title;
      button.dataset.r116Target=mode;
      button.setAttribute('aria-pressed','false');
      bar.append(button);
    });
    return bar;
  }
  function wire({bar,attr,defaultMode,modes,isAllowed}){
    let selected=defaultMode;
    const set=(next,focus=false)=>{
      const options=new Set(modes.map(m=>m[0]));
      if(!options.has(next)||!isAllowed(next))return;
      selected=next;
      document.body.dataset[attr]=next;
      bar.querySelectorAll('button').forEach(btn=>{
        const active=btn.dataset.r116Target===next;
        btn.setAttribute('aria-pressed',String(active));
        btn.disabled=!isAllowed(btn.dataset.r116Target);
        if(active && focus)btn.focus({preventScroll:true});
      });
      window.dispatchEvent(new Event('resize'));
    };
    bar.addEventListener('click',event=>{
      const target=event.target.closest('button[data-r116-target]');
      if(target&&bar.contains(target))set(target.dataset.r116Target);
    });
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape' && selected!==defaultMode && !event.defaultPrevented){
        set(defaultMode,true);
      }
    });
    set(defaultMode);
    return {set,refresh:()=>set(isAllowed(selected)?selected:defaultMode)};
  }
  function initCut(){
    const workspace=document.getElementById('cutApp');
    const editor=document.getElementById('cutEditor');
    const empty=document.getElementById('cutEmpty');
    if(!workspace||!editor||!empty||document.querySelector('.r116-switch'))return;
    const bar=navFor(cutModes,'Cut Studio: Arbeitsbereich wählen');
    workspace.before(bar);
    const allowed=mode=>mode==='all'||(!editor.hidden && !editor.closest('[hidden]'));
    const controls=wire({bar,attr:'r116CutMode',defaultMode:'all',modes:cutModes,isAllowed:allowed});
    function reconcile(){
      controls.refresh();
      bar.querySelectorAll('button').forEach(btn=>{btn.disabled=!allowed(btn.dataset.r116Target)});
    }
    const observer=new MutationObserver(reconcile);
    observer.observe(editor,{attributes:true,attributeFilter:['hidden']});
    observer.observe(empty,{attributes:true,attributeFilter:['hidden']});
    reconcile();
    document.body.classList.add('r116-ready');
  }
  function initAudio(){
    const editor=document.getElementById('alertToneStudio');
    const status=document.getElementById('audioWorkspace');
    if(!editor||!status||document.querySelector('.r116-switch'))return;
    const bar=navFor(audioModes,'Audio Studio: Arbeitsbereich wählen');
    editor.before(bar);
    wire({bar,attr:'r116AudioMode',defaultMode:'edit',modes:audioModes,isAllowed:()=>true});
    document.body.classList.add('r116-ready');
  }
  function init(){
    const name=document.body?.dataset.cfsR108View;
    if(name==='cut-studio')initCut();
    if(name==='audio-studio')initAudio();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
