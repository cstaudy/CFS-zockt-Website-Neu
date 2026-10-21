/* R90 – gated import of static original PNG layers; never executes third-party scene HTML. */
(()=>{'use strict';
const root=document.getElementById('ub90Import');if(!root)return;
const $=id=>root.querySelector(id);
const world=$('#ub90World'),color=$('#ub90Color'),load=$('#ub90Load'),apply=$('#ub90Apply'),list=$('#ub90Layers'),status=$('#ub90Status');
let catalog=[],confirmed=null,busy=false;
const sceneBlock=$('#ub91SceneBlock'),sceneSelect=$('#ub91Scene'),sceneApply=$('#ub91ApplyScene'),sceneTitle=$('#ub91Title'),sceneSubtitle=$('#ub91Subtitle'),sceneMotion=$('#ub91Motion');
const countdown=$('#ub92Countdown'),current=$('#ub92Current'),target=$('#ub92Target'),ticker=$('#ub92Ticker');
function updateSpecialFields(){const mode=sceneSelect.value;for(const [id,show] of [['#ub92CountdownFields',['countdown','countdownWidget'].includes(mode)],['#ub92GoalFields',mode==='goal'],['#ub92TickerFields',mode==='ticker']]){$(id).hidden=!show;}}
const say=(message,error=false)=>{status.textContent=message;status.style.color=error?'#ffb5b5':'';};
function fill(select,rows,prompt){select.replaceChildren(new Option(prompt,''),...rows.map(row=>new Option(row.name,row.id)));select.disabled=rows.length===0;}
async function start(){
 try{
  const response=await fetch('/api/original-designs/catalog',{credentials:'same-origin'});
  if(!response.ok)throw Error('Katalog antwortet mit HTTP '+response.status);
  const data=await response.json();
  catalog=Array.isArray(data.designs)?data.designs:[];
  if(catalog.length!==31||catalog.some(d=>!Array.isArray(d.colors)||d.colors.length!==16))throw Error('Der Designkatalog ist unvollständig.');
  fill(world,catalog,'Originaldesign wählen …');
  say('31 Originaldesigns mit je 16 Farben. PNG-Ebenen sind nur mit berechtigtem Creator-Login verfügbar.');
 }catch(error){say('Designkatalog konnte nicht geladen werden: '+error.message,true);}
}
function clearLayers(){confirmed=null;apply.disabled=true;list.replaceChildren();sceneBlock.hidden=true;sceneApply.disabled=true;sceneSelect.replaceChildren(new Option('Szene wählen …',''));updateSpecialFields();}
world.addEventListener('change',()=>{
 clearLayers();const chosen=catalog.find(d=>d.id===world.value);
 fill(color,chosen?.colors||[],'Farbe wählen …');say('Bitte Farbe auswählen und Original-Ebenen anzeigen.');
});
color.addEventListener('change',()=>{clearLayers();say('Original-Ebenen anzeigen, dann bis zu acht PNG-Dateien auswählen.');});
load.addEventListener('click',async()=>{
 if(busy)return;
 const design=world.value,variant=color.value;
 if(!design||!variant){say('Bitte Design und Farbe wählen.',true);return;}
 busy=true;load.disabled=true;clearLayers();say('Original-Ebenen werden mit deinen Creator-Rechten geprüft …');
 try{
  const url=`/api/creator/universal-builder/original-layers/${encodeURIComponent(design)}/${encodeURIComponent(variant)}`;
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(response.status===401?'Bitte anmelden.':response.status===403?'Die Beta ist noch gesperrt. Nur der bestätigte Website-Admin kann davor privat importieren.':data.error||`HTTP ${response.status}`);
  if(!data.ok||data.design?.id!==design||data.color?.id!==variant||!Array.isArray(data.layers)||data.layers.length!==36)throw Error('Der Server hat keine vollständigen 36 PNG-Ebenen bestätigt.');
  confirmed=data;
  for(const layer of data.layers){
   const label=document.createElement('label');
   const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=layer.file;
   if(layer.file==='01-Start.png')checkbox.checked=true;
   const span=document.createElement('span');span.textContent=`${layer.label} · ${layer.width} × ${layer.height}`;
   label.append(checkbox,span);list.append(label);
  }
  apply.disabled=false;
  if(Array.isArray(data.scenes)&&data.scenes.length===29){
   sceneSelect.replaceChildren(new Option('Szene wählen …',''),...data.scenes.map(x=>new Option(x.name,x.id)));
   sceneBlock.hidden=false;
  }
  say('36 Original-Ebenen verfügbar. 1–8 auswählen; anschließend als bearbeitbare Ebenen importieren.');
 }catch(error){say(error.message,true);}finally{busy=false;load.disabled=false;}
});
sceneSelect.addEventListener('change',()=>{sceneApply.disabled=!confirmed||!confirmed.scenes?.some(x=>x.id===sceneSelect.value);updateSpecialFields();});
sceneApply.addEventListener('click',()=>{
 if(!confirmed)return;
 const scene=confirmed.scenes?.find(x=>x.id===sceneSelect.value);
 if(!scene){say('Bitte eine geprüfte Szenenvorlage auswählen.',true);return;}
 const bridge=window.CFSUniversalBuilder,old=bridge?.snapshot();
 if(!old?.ready){say('Bitte anmelden und Builder laden.',true);return;}
 if(old.elements.length&&!confirm('Szenenvorlage als neuen Entwurf öffnen? Nicht gespeicherte Änderungen werden verworfen.'))return;
 try{
  const result=bridge.importOriginalScene({...confirmed,scene},{replace:old.elements.length>0,title:sceneTitle.value,subtitle:sceneSubtitle.value,motion:sceneMotion.value,countdownSeconds:Number(countdown.value),goalCurrent:Number(current.value),goalTarget:Number(target.value),tickerText:ticker.value});
  const name=document.getElementById('ub65Name');if(name)name.value=result.name;
  document.getElementById('erstellen')?.click();
  say(`Szenenvorlage „${scene.name}“ geladen: Originalgrafik und ${result.count-1} bearbeitbare(s) Element(e) geladen. Bewegung und Format lassen sich anpassen; alle Zahlen bleiben statisch. Die alte Engine wird nicht ausgeführt.`);
 }catch(error){say('Szenenimport fehlgeschlagen: '+error.message,true);}
});
apply.addEventListener('click',()=>{
 if(!confirmed)return;
 const files=[...list.querySelectorAll('input:checked')].map(x=>x.value);
 if(files.length<1||files.length>8){say('Bitte 1 bis 8 Ebenen auswählen.',true);return;}
 const chosen=files.map(file=>confirmed.layers.find(x=>x.file===file));
 if(chosen.some(x=>!x)){say('Auswahl ist ungültig, bitte neu laden.',true);return;}
 const bridge=window.CFSUniversalBuilder;
 if(!bridge?.snapshot()?.ready){say('Bitte anmelden und Builder laden.',true);return;}
 const old=bridge.snapshot();
 if(old.elements.length&&!confirm('Original-Ebenen als neuen Entwurf öffnen? Ungespeicherte Änderungen werden verworfen. Vorhandene gespeicherte Designs bleiben erhalten.'))return;
 try{
  const result=bridge.importOriginalLayers({...confirmed,layers:chosen},{replace:old.elements.length>0});
  const name=document.getElementById('ub65Name');if(name)name.value=result.name;
  const editor=document.getElementById('erstellen');if(editor)editor.click();
  say(`${result.count} Original-PNG-Ebene(n) geladen. Du kannst ihre Größe/Position bearbeiten, Texte ergänzen, privat speichern und ein statisches OBS-ZIP exportieren.`);
 }catch(error){say('Import fehlgeschlagen: '+error.message,true);}
});
start();
})();
