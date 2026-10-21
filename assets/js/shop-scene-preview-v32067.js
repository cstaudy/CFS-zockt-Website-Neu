/* R16 · Public preview is always visible; locked original PNGs are optional.
   Never claim a camera frame/alert is loaded if the private beta gate rejects it. */
(function(){'use strict';
 const $=id=>document.getElementById(id);if(!$('shopScenePreview'))return;
 const camera=$('shopSceneCamera'),alert=$('shopSceneAlert'),stage=$('shopScenePreview');
 const cameraImage=$('shopSceneCameraAsset'),alertImage=$('shopSceneAlertAsset');
 function setAsset(img,src){
   img.hidden=true;img.removeAttribute('src');
   img.onload=()=>{img.hidden=false;img.closest('.shop-scene-camera,.shop-scene-alert')?.classList.add('has-private-asset')};
   img.onerror=()=>{img.hidden=true;img.removeAttribute('src');img.closest('.shop-scene-camera,.shop-scene-alert')?.classList.remove('has-private-asset')};
   if(src)img.src=src;
 }
 function update(){
  const query=new URLSearchParams(location.search),d=String(query.get('design')||''),c=String(query.get('color')||'');
  if(!/^[a-z0-9-]{2,60}$/.test(d)||!/^[a-z0-9-]{2,40}$/.test(c))return;
  const base=`/api/original-designs/asset/${encodeURIComponent(d)}/${encodeURIComponent(c)}/`;
  setAsset(cameraImage,base+encodeURIComponent('07-Kamerarahmen-16zu9.png'));
  setAsset(alertImage,base+encodeURIComponent('10-Hinweis-Follower.png'));
  stage.classList.toggle('no-camera',!camera.checked);stage.classList.toggle('no-alert',!alert.checked);
  $('shopSceneState').textContent='Designvorschau · Demo, keine Live-Daten. Kamera- und Alert-Originaldateien nur bei freigeschalteter privater Beta.';
 }
 camera.onchange=update;alert.onchange=update;
 document.addEventListener('cfs:original-design-preview',e=>{
  const url=e.detail?.cover;
  if(typeof url==='string'&&url.startsWith('/assets/img/cfs-original-design-previews/')&&url.endsWith('.webp')){
    const world=stage.querySelector('.shop-scene-world');
    if(world){world.style.backgroundImage=`linear-gradient(0deg,rgba(1,9,20,.78),rgba(1,10,22,.24)),url("${url}")`;world.classList.add('r16-world-cover')}
  }
 });
 for(const id of ['detailColorSelect','detailGroupSelect'])$(id)?.addEventListener('change',()=>setTimeout(update,0));
 update();
})();
