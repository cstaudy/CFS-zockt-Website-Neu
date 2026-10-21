/* R199: conservative read-only readiness across the actually published scene graph. */
(function(global){
  'use strict';
  function safeCount(value){const v=Number(value);return Number.isSafeInteger(v)&&v>=0?Math.min(v,10000):0;}
  function ref(item){
    if(!item||typeof item!=='object')return '';
    const value=item.widget_id ?? item.widgetId ?? item.widget?.id;
    return typeof value==='string'||typeof value==='number'?String(value).trim():'';
  }
  function sceneItems(scene){
    const config=scene?.published_config;
    if(!config||typeof config!=='object'||Array.isArray(config))return [];
    // R199: When v2 layouts exist, config.items is only a legacy mirror and must not
    // override an intentionally cleared layout or count the same item twice.
    if(config.layouts&&typeof config.layouts==='object'&&!Array.isArray(config.layouts))
      return Object.values(config.layouts).flatMap(layout=>Array.isArray(layout?.items)?layout.items:[]);
    return Array.isArray(config.items)?config.items:[];
  }
  function summary(widgetResponse,sceneResponse){
    const valid=Array.isArray(widgetResponse?.widgets)&&Array.isArray(sceneResponse?.scenes);
    const widgets=valid?widgetResponse.widgets:[];
    const scenes=valid?sceneResponse.scenes:[];
    const publishedWidgets=widgets.filter(w=>w&&w.status==='live'&&w.published_config);
    const publishedScenes=scenes.filter(s=>s&&s.status==='live'&&s.published_config);
    const publishedIds=new Set(publishedWidgets.map(w=>String(w.id??'')).filter(Boolean));
    let populatedSceneCount=0,linkedSceneCount=0,orphanedSceneCount=0;
    let invalidWidgetRefCount=0,visibleWidgetRefCount=0,nativeOnlySceneCount=0,nativeSceneCount=0;
    for(const scene of publishedScenes){
      const items=sceneItems(scene).filter(item=>item&&typeof item==='object');
      if(items.length===0)continue;
      populatedSceneCount++;
      const visible=items.filter(item=>item.visible!==false&&item.routing?.live!==false);
      const hasNative=visible.some(item=>item.source_kind==='native');
      if(hasNative)nativeSceneCount++;
      const widgetRefs=visible.filter(item=>item.source_kind!=='native');
      if(widgetRefs.length===0){nativeOnlySceneCount++;continue;}
      visibleWidgetRefCount+=widgetRefs.length;
      const missing=widgetRefs.filter(item=>!ref(item)||!publishedIds.has(ref(item)));
      invalidWidgetRefCount+=missing.length;
      // A single valid widget must not disguise a missing second browser source.
      if(missing.length===0&&!hasNative)linkedSceneCount++;
      else orphanedSceneCount++;
    }
    return {
      widgetCount:safeCount(widgets.length),publishedWidgetCount:safeCount(publishedWidgets.length),
      sceneCount:safeCount(scenes.length),publishedSceneCount:safeCount(publishedScenes.length),
      populatedSceneCount:safeCount(populatedSceneCount),linkedSceneCount:safeCount(linkedSceneCount),
      orphanedSceneCount:safeCount(orphanedSceneCount),invalidWidgetRefCount:safeCount(invalidWidgetRefCount),
      visibleWidgetRefCount:safeCount(visibleWidgetRefCount),nativeOnlySceneCount:safeCount(nativeOnlySceneCount),nativeSceneCount:safeCount(nativeSceneCount),
      accountApiOk:valid,widgetApiOk:valid,sceneApiOk:valid,
      sourceCandidate:valid&&linkedSceneCount>0&&orphanedSceneCount===0&&nativeSceneCount===0
    };
  }
  function report(input){
    const source=input&&input.summary||{};
    const manual=input&&input.manual||{};
    const allowed=['obsBrowserSource','sceneVisible','widgetVisible','audioAudible','audioSync','localRecording','restartPass'];
    const confirmations=Object.fromEntries(allowed.map(k=>[k,manual[k]===true]));
    const checks=['accountApiOk','widgetApiOk','sceneApiOk','sourceCandidate'];
    const status=Object.fromEntries(checks.map(k=>[k,source[k]===true]));
    const counts={};
    for(const key of ['widgetCount','publishedWidgetCount','sceneCount','publishedSceneCount','populatedSceneCount','linkedSceneCount','orphanedSceneCount','invalidWidgetRefCount','visibleWidgetRefCount','nativeOnlySceneCount','nativeSceneCount'])counts[key]=safeCount(source[key]);
    return {
      schema:'cfs_r199_website_obs_manual_v3',mode:'authenticated_read_only_plus_manual',
      generated_at:new Date().toISOString(),technical_summary:status,counts,
      manual_confirmations:confirmations,
      release_status:'HOLD_NO_GO',
      limits:'Prueft alle sichtbaren Widget-Referenzen veroeffentlichter Szenen. Native/Launcher-Quellen sind nicht mit OBS Browserquellen gleichzusetzen. Es findet keine echte PostgreSQL-, OBS-, Audio- oder Live-Abnahme statt.'
    };
  }
  const api={summary,report};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else global.CFSR197=api;
})(typeof window!=='undefined'?window:this);
