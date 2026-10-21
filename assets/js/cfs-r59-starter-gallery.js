/* R59: immutable, server-allowlisted starter templates. No network or publishing here. */
(function(root){'use strict';
 const definitions=[
  {id:'camera-wide',type:'camera_frame',platform:'obs',platformLabel:'OBS',label:'Kamera Clean 16:9',description:'Kameramitte transparent · ruhiger Gaming-Rahmen',width:640,height:360,layout:'camera_soft',template:'cfs-standard',style:'camera-wide'},
  {id:'camera-portrait',type:'camera_frame_portrait',platform:'obs',platformLabel:'OBS',label:'Kamera Portrait 9:16',description:'Hochkant-Facecam mit transparentem Zentrum',width:420,height:620,layout:'camera_portrait',template:'cfs-standard',style:'camera-portrait'},
  {id:'camera-square',type:'camera_frame_square',platform:'obs',platformLabel:'OBS',label:'Kamera Quadrat 1:1',description:'Quadratischer Facecam-Rahmen mit freier Mitte',width:520,height:520,layout:'camera_square',template:'cfs-standard',style:'camera-square'},
  {id:'stream-wide',type:'stream_frame',platform:'obs',platformLabel:'OBS',label:'Stream-Rahmen Full HD',description:'Transparentes 16:9-Szenen-Overlay',width:1920,height:1080,layout:'scene_clean',template:'cfs-standard',style:'stream-wide'},
  {id:'stream-portrait',type:'stream_frame_vertical',platform:'obs',platformLabel:'OBS',label:'Stream-Rahmen Hochkant',description:'Transparentes Overlay für vertikale Streams',width:1080,height:1920,layout:'scene_clean',template:'cfs-standard',style:'stream-portrait'},
  {id:'lower-third',type:'lower_third',platform:'obs',platformLabel:'OBS',label:'Nameplate / Lower Third',description:'Editierbare Namensleiste für den unteren Rand',width:720,height:138,layout:'lower_classic',template:'cfs-standard',style:'lower-third'},
  {id:'live-goal',type:'follower_goal',platform:'tiktok',platformLabel:'TikTok',label:'LIVE Follower-Goal',description:'Dynamisches Ziel mit echten Kontodaten nach Verbindung',width:620,height:132,layout:'goal_balanced',template:'cfs-standard',style:'live-goal'}
 ];
 const frozen=Object.freeze(definitions.map(recipe=>Object.freeze({...recipe})));
 const byId=new Map(frozen.map(recipe=>[recipe.id,recipe]));
 function resolve(id,registry){
  const recipe=byId.get(String(id||''));
  if(!recipe||!Array.isArray(registry))return null;
  const def=registry.find(item=>item?.key===recipe.type);
  if(!def||def.available===false||String(def.provider||def.platform||'').toLowerCase()!==recipe.platform)return null;
  return recipe;
 }
 function cards(registry){return frozen.map(recipe=>({recipe,enabled:!!resolve(recipe.id,registry)}))}
 root.CFSR59StarterGallery=Object.freeze({recipes:frozen,resolve,cards});
})(typeof window!=='undefined'?window:globalThis);
