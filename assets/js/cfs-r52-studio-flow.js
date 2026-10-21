/* R52 · Small, accessible studio workflow navigation. Only operates existing controls.
   It never saves, publishes, exports, or modifies a design without an explicit
   click on the original control. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  if(root && root.document) api.init(root.document);
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
  const messages={
    scene:{edit:'Öffne oder erstelle zuerst eine Scene.',settings:'Wähle erst ein Widget auf der Scene aus.',review:'Öffne zuerst eine Scene, um sie zu prüfen.',output:'Öffne eine Scene; nach der Veröffentlichung steht die OBS-Adresse bereit.'},
    maker:{},
    widget:{review:'Öffne zuerst ein Widget, um sein Design zu prüfen.',output:'Öffne zuerst ein Widget, um sein Design zu exportieren.'}
  };
  function visible(el){return !!(el && !el.closest('[hidden]'));}
  // The R115 compact views hide editor columns with CSS. A shortcut must first
  // reveal its destination, otherwise it scrolls to an invisible panel on mobile.
  // This custom event changes only the visible workspace, never project data.
  function requestView(doc,mode){
    if(typeof doc.dispatchEvent !== 'function')return;
    const EventCtor=doc.defaultView?.CustomEvent || (typeof CustomEvent==='function'?CustomEvent:null);
    if(EventCtor)doc.dispatchEvent(new EventCtor('cfs:studio-view-request', {
      detail:{mode,source:'workflow'},bubbles:false
    }));
  }
  function revealContainingPanel(doc,element){
    if(!element)return;
    const host=element.closest?.('.scene-sidebar, .scene-library, .scene-editor, .ws-editor-left-v2, .ws-editor-right-v2, .ws-canvas-column-v2');
    if(!host)return;
    requestView(doc,host.matches('.scene-sidebar, .ws-editor-left-v2')?'tools':
      host.matches('.scene-library, .ws-editor-right-v2')?'properties':'canvas');
  }
  function move(el){if(!el)return false; el.scrollIntoView?.({behavior:'smooth',block:'start'});return true;}
  function activateEditor(doc){
    const editor=doc.getElementById('editorView');
    if(visible(editor))return true;
    const tab=doc.querySelector('.sm-tabs [data-view="editor"]');
    if(tab && !tab.disabled){tab.click();return visible(editor);}
    return false;
  }
  function handle(doc,mode,action){
    const id=name=>doc.getElementById(name);
    const go=sel=>move(doc.querySelector(sel));
    if(mode==='scene'){
      const open=visible(id('sceneEditor'));
      if(!open){requestView(doc,'tools');go('.scene-sidebar');return messages.scene[action]||messages.scene.edit;}
      if(action==='edit'){requestView(doc,'canvas');move(id('sceneViewport'));return '';}
      if(action==='settings'){
        requestView(doc,'properties');
        if(visible(id('sceneProperties'))){move(id('sceneProperties'));return '';}
        move(id('widgetLibrary'));return messages.scene.settings;
      }
      if(action==='review'){
        const details=id('sceneQualityPanel'),btn=id('sceneQualityRun');
        if(!details || !btn)return 'Die Scene-Prüfung ist noch nicht bereit.';
        requestView(doc,'canvas');details.open=true;move(details);if(!btn.disabled)btn.click();return '';
      }
      if(action==='output'){
        requestView(doc,'canvas');go('.scene-output-bar');
        if(!id('sceneOutputUrl')?.value)return 'OBS-Adresse erst nach dem bewussten Veröffentlichen verfügbar.';
        return '';
      }
    }
    if(mode==='maker'){
      if(!activateEditor(doc))return 'Der Design-Editor ist noch nicht bereit.';
      if(action==='edit')move(id('stage'));
      else if(action==='settings')move(id('title')||doc.querySelector('.sm-settings'));
      else if(action==='review')move(id('preview')||id('stage'));
      else if(action==='output')go('.sm-export');
      return '';
    }
    if(mode==='widget'){
      const editor=doc.querySelector('.ws-view[data-view="editor"]');
      if(action==='edit'){
        if(visible(editor)){requestView(doc,'canvas');go('.ws-editor-grid');return '';}
        const btn=doc.querySelector('[data-action="open-create"]');
        if(!btn)return 'Widget-Erstellung ist noch nicht bereit.';
        btn.click();return '';
      }
      if(action==='settings'){
        const btn=doc.querySelector('.ws-assets-open[data-action="open-assets"]');
        if(!btn)return 'Dateibibliothek ist noch nicht bereit.';
        btn.click();return '';
      }
      if(!visible(editor))return messages.widget[action]||messages.widget.review;
      if(action==='review'){
        const btn=id('wsCheckDesign');
        if(!btn)return 'Qualitätsprüfung lädt noch. Bitte erneut versuchen.';
        revealContainingPanel(doc,btn);btn.click();move(id('wsOutputAudit')||btn);return '';
      }
      if(action==='output'){
        const btn=id('wsExportDesign');
        if(!btn)return 'Designexport lädt noch. Bitte erneut versuchen.';
        // Navigation only: the guarded R48 export remains an explicit second click.
        revealContainingPanel(doc,btn);move(btn);btn.focus({preventScroll:true});return 'Zum Export „PRÜFEN & EXPORTIEREN“ auswählen.';
      }
    }
    return 'Aktion ist hier nicht verfügbar.';
  }
  function init(doc){
    const rail=doc.querySelector('.cfs-r52-flow[data-r52-studio]');
    if(!rail || rail.dataset.r52Bound==='1')return false;
    const mode=rail.dataset.r52Studio;
    if(!['scene','maker','widget'].includes(mode))return false;
    rail.dataset.r52Bound='1';
    const status=rail.querySelector('.cfs-r52-flow-status');
    rail.addEventListener('click',event=>{
      const btn=event.target.closest('button[data-r52-action]');
      if(!btn || !rail.contains(btn) || btn.disabled)return;
      const action=btn.dataset.r52Action;
      const result=handle(doc,mode,action);
      rail.querySelectorAll('[data-r52-action]').forEach(item=>item.setAttribute('aria-pressed',String(item===btn)));
      if(status)status.textContent=result||'';
    });
    return true;
  }
  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init(document),{once:true});
    else init(document);
  }
  return {init,handle,visible,messages};
});
