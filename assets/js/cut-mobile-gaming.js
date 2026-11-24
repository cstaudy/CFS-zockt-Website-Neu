/* CFS Cut Studio · local mobile single-clip export. No network or project mutations. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.CFSCutMobileGaming=api;})(typeof globalThis!=='undefined'?globalThis:this,function mobileStudio(root){
'use strict';
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function plan({duration,start,end,format='vertical',resolution=1080,fps=30,rate=16}){
 const d=Number(duration),a=Number(start),b=Number(end);
 if(!Number.isFinite(d)||d<=0||!Number.isFinite(a)||!Number.isFinite(b)||a<0||b>d+.001||b-a<.25||b-a>180)throw Error('Schnittbereich prüfen: 0,25 bis 180 Sekunden innerhalb der Quelle.');
 const n=Number(resolution)===720?720:1080,wide=Math.round(n*16/9/2)*2;
 const [width,height]=format==='landscape'?[wide,n]:format==='square'?[n,n]:[n,wide];
 return {start:a,end:Math.min(b,d),width,height,fps:Number(fps)===60?60:30,rate:[8,12,16,20].includes(Number(rate))?Number(rate):16};
}
function rectangle(sw,sh,w,h,fill=false){const s=(fill?Math.max:Math.min)(w/sw,h/sh);return [(w-sw*s)/2,(h-sh*s)/2,sw*s,sh*s]}
function mime(Recorder){return ['video/mp4;codecs=avc1.42001f,mp4a.40.2','video/mp4','video/webm;codecs=vp8,opus','video/webm'].find(t=>Recorder.isTypeSupported(t))||''}
function mount(){
 const host=document.getElementById('cutMobileGaming');if(!host||host.dataset.ready)return;host.dataset.ready='1';
 host.innerHTML=`<div class="cut-section-head"><div><span>PS5 · IPHONE</span><h3>Gaming Cutter · direkt auf dem Handy</h3><p>Lokaler Einzelclip-Export ohne Launcher, Upload oder KI-Credits. Der bestehende Profi-Schnitt bleibt unverändert.</p></div></div>
 <div class="cut-mobile-actions"><label>Gameplay auswählen<input data-mobile="file" type="file" accept="video/*,.mov,.mp4"></label><button class="btn" type="button" data-mobile="take">Clip aus Schnittvorschau übernehmen</button></div>
 <div class="cut-mobile-screen"><canvas data-mobile="canvas" width="360" height="640" aria-label="Vorschau des mobilen Exports"></canvas><video data-mobile="video" playsinline preload="metadata" aria-hidden="true"></video></div>
 <div class="cut-mobile-actions"><button class="btn" type="button" data-mobile="play" disabled>Abspielen / Pause</button><output data-mobile="time">0.00 s</output><input data-mobile="seek" aria-label="Videoposition" type="range" min="0" max="0" step=".01" value="0"></div>
 <div class="cut-project-grid">
 <label><span>START (S)</span><input data-mobile="start" type="number" min="0" step=".01" value="0"></label>
 <label><span>ENDE (S)</span><input data-mobile="end" type="number" min="0" step=".01" value="0"></label>
 <button class="btn" type="button" data-mobile="in">Start hier</button><button class="btn" type="button" data-mobile="out">Ende hier</button>
 <label><span>FORMAT</span><select data-mobile="format"><option value="vertical">9:16 TikTok / Shorts</option><option value="landscape">16:9 YouTube</option><option value="square">1:1</option></select></label>
 <label><span>BILDAUFBAU</span><select data-mobile="fit"><option value="fit">Ganzes Gameplay + Hintergrund</option><option value="fill">Bildfüllend (Zuschnitt)</option></select></label>
 <label><span>GAMING-DESIGN</span><select data-mobile="preset"><option value="clean">Clean · unverändert</option><option value="dark">Dark / DBD</option><option value="neon">Neon</option><option value="funny">Funny Moments</option></select></label>
 <label><span>HINTERGRUND</span><select data-mobile="background"><option value="blur">Weicher Spielhintergrund</option><option value="black">Schwarz</option></select></label>
 <label class="full"><span>TITEL (OPTIONAL)</span><input data-mobile="title" maxlength="100" placeholder="Das war so nicht geplant."></label>
 <label><span>TITELPOSITION</span><select data-mobile="position"><option value="top">Oben</option><option value="bottom">Unten</option></select></label>
 <label><span>TITELDAUER</span><select data-mobile="titleDuration"><option value="0">Durchgehend</option><option value="3">3 Sekunden</option><option value="5">5 Sekunden</option></select></label>
 <label><span>HELLIGKEIT</span><input data-mobile="brightness" type="range" min="-20" max="25" value="0"></label>
 <label><span>KONTRAST</span><input data-mobile="contrast" type="range" min="-20" max="25" value="0"></label>
 <label><span>SÄTTIGUNG</span><input data-mobile="saturation" type="range" min="-30" max="30" value="0"></label>
 <label><span>AUFLÖSUNG</span><select data-mobile="resolution"><option value="1080">1080p Full HD</option><option value="720">720p (leichter)</option></select></label>
 <label><span>FPS (ZIEL)</span><select data-mobile="fps"><option value="30">30</option><option value="60">60 (bei 60-FPS-Quelle)</option></select></label>
 <label><span>VIDEO-BITRATE (ZIEL)</span><select data-mobile="rate"><option value="8">8 Mbit/s</option><option value="12">12 Mbit/s</option><option value="16" selected>16 Mbit/s</option><option value="20">20 Mbit/s</option></select></label>
 <label><span>TON</span><select data-mobile="audio"><option value="on">Originalton</option><option value="off">Stumm</option></select></label></div>
 <p data-mobile="quality" class="notice compact"></p><progress data-mobile="progress" max="1" value="0" aria-label="Exportfortschritt"></progress>
 <div class="cut-mobile-actions"><button class="btn primary" type="button" data-mobile="export" disabled>Video lokal erstellen</button><button class="btn" type="button" data-mobile="cancel" hidden>Abbrechen</button><button class="btn" type="button" data-mobile="share" hidden>Teilen / in Fotos sichern</button><a class="btn" data-mobile="download" hidden>Video herunterladen</a></div>
 <p data-mobile="status" role="status" aria-live="polite">Wähle eine lokale Datei. MP4 wird bevorzugt; Browser können Format, Bildrate und Bitrate begrenzen.</p>
 <small>Einzelclip mit Titel und Originalton. Mehrspur, Keyframes und komplexe Übergänge bleiben im Launcher. Kein KI-Upscaling. Beim Export die Seite geöffnet lassen.</small>`;
 const $=k=>host.querySelector(`[data-mobile="${k}"]`),v=$('video'),c=$('canvas'),g=c.getContext('2d',{alpha:false}),mini=document.createElement('canvas');
 mini.width=48;mini.height=48;const mg=mini.getContext('2d');
 if(!g||!mg){$('status').textContent='Canvas nicht verfügbar.';return}
 // Some Safari versions expose a filter property without rendering it. Verify pixels.
 let filter=false;try{mg.fillStyle='#fff';mg.fillRect(0,0,1,1);mg.filter='brightness(0%)';mg.fillRect(0,0,1,1);filter=mg.getImageData(0,0,1,1).data[0]===0;mg.filter='none'}catch{}
 for(const k of ['brightness','contrast','saturation'])$(k).disabled=!filter;
 const supported=typeof MediaRecorder!=='undefined'&&typeof c.captureStream==='function'&&typeof MediaRecorder.isTypeSupported==='function';
 let ownUrl='',resultUrl='',resultFile=null,ready=false,busy=false,recording=false,job=null,raf=0,ac=null,source=null,monitor=null;
 const status=s=>$('status').textContent=s;
 const currentPlan=()=>plan({duration:v.duration,...Object.fromEntries(['start','end','format','resolution','fps','rate'].map(k=>[k,$(k).value]))});
 const palette={clean:'#f1f4f8',dark:'#ff4864',neon:'#ad8cff',funny:'#ffc74b'};
 const presets={clean:[0,0,0],dark:[8,3,4],neon:[3,6,12],funny:[5,4,8]};
 function report(){let p;try{p=currentPlan()}catch{} const loaded=ready&&p;let s=loaded?`${v.videoWidth} × ${v.videoHeight} → ${p.width} × ${p.height} · ${p.fps} FPS Ziel · ca. ${Math.ceil((p.end-p.start)*(p.rate+.192)/8)} MB. `:'Quelle und gültigen Schnittbereich wählen. ';
 if(loaded){const r=rectangle(v.videoWidth,v.videoHeight,p.width,p.height,$('fit').value==='fill');if(r[2]/v.videoWidth>1.5)s+='Starke Vergrößerung: keine neuen Bilddetails. ';if($('fit').value==='fill')s+='Zuschnitt kann HUD abschneiden. '}
 if(!filter)s+='Farbkorrektur in diesem Browser nicht verfügbar. ';
 if(!supported)s+='Direkter Export nicht unterstützt; Launcher bleibt verfügbar.';
 $('quality').textContent=s;$('export').disabled=busy||!loaded||!supported;$('time').textContent=(v.currentTime||0).toFixed(2)+' s';$('seek').value=v.currentTime||0;}
 function dimensions(full=false){const n=full?Number($('resolution').value):360,wide=Math.round(n*16/9/2)*2,f=$('format').value;[c.width,c.height]=f==='landscape'?[wide,n]:f==='square'?[n,n]:[n,wide]}
 function draw(){
 const w=c.width,h=c.height,b=Math.min(w,h);g.fillStyle='#080b11';g.fillRect(0,0,w,h);
 if(ready&&v.readyState>=2&&v.videoWidth){
 if($('background').value==='blur'){mg.drawImage(v,...rectangle(v.videoWidth,v.videoHeight,48,48,true));g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(mini,0,0,w,h);g.fillStyle='rgba(0,0,0,.60)';g.fillRect(0,0,w,h)}
 g.imageSmoothingQuality='high';if(filter)g.filter=`brightness(${100+Number($('brightness').value)}%) contrast(${100+Number($('contrast').value)}%) saturate(${100+Number($('saturation').value)}%)`;
 g.drawImage(v,...rectangle(v.videoWidth,v.videoHeight,w,h,$('fit').value==='fill'));if(filter)g.filter='none';
 }else{g.textAlign='center';g.font=`600 ${b*.045}px sans-serif`;g.fillStyle='#aeb8c7';g.fillText('Gameplay importieren',w/2,h/2,w*.85)}
 const title=$('title').value.trim(),limit=Number($('titleDuration').value);
 if(!title||(limit&&v.currentTime-Number($('start').value)>=limit))return;
 g.font=`800 ${Math.round(b*.060)}px sans-serif`;g.textAlign='center';g.textBaseline='middle';
 let lines=[],line='';for(const word of title.split(/\s+/)){const next=(line+' '+word).trim();if(line&&g.measureText(next).width>w*.78){lines.push(line);line=word}else line=next}if(line)lines.push(line);lines=lines.slice(0,4);
 const lh=b*.075,y=$('position').value==='bottom'?h*.77-(lines.length-1)*lh:h*.14;
 g.fillStyle='rgba(0,0,0,.72)';g.fillRect(w*.07,y-lh*.7,w*.86,lh*(lines.length+.45));g.fillStyle=palette[$('preset').value];g.fillRect(w*.09,y-lh*.55,b*.007,lh*(lines.length+.1));g.fillStyle='#fff';lines.forEach((l,i)=>g.fillText(l,w/2,y+i*lh,w*.78));
 }
 function clearResult(){if(resultUrl)URL.revokeObjectURL(resultUrl);resultUrl='';resultFile=null;$('download').hidden=true;$('share').hidden=true;$('download').removeAttribute('href')}
 function load(url,owned,selection){if(busy)return;v.pause();clearResult();ready=false;if(ownUrl)URL.revokeObjectURL(ownUrl);ownUrl=owned?url:'';v.src=url;v.load();job=null;pending=selection;report();status('Datei wird lokal geöffnet …')}
 let pending=null;
 v.addEventListener('loadedmetadata',()=>{if(!Number.isFinite(v.duration)||!v.videoWidth){status('Ungültige oder nicht unterstützte Videodatei.');return}
 ready=true;$('start').value=String(pending?clamp(pending.start,0,v.duration):0);$('end').value=String(pending?clamp(pending.end,0,v.duration):Math.min(v.duration,180));$('seek').max=String(v.duration);$('play').disabled=false;pending=null;report();draw();status('Quelle bereit. Prüfe Schnitt und Vorschau.');});
 v.addEventListener('loadeddata',draw);v.addEventListener('seeked',()=>{draw();report()});v.addEventListener('error',()=>{ready=false;report();if(job)stop('Quelldatei nicht lesbar.');else status('Datei nicht lesbar. MP4 oder MOV versuchen.')});
 $('file').addEventListener('change',()=>{const f=$('file').files?.[0];if(f){load(URL.createObjectURL(f),true,null);$('file').value=''}});
 $('take').addEventListener('click',()=>{const src=document.getElementById('cutLocalVideo'),sel=document.getElementById('cutPreviewClip'),row=[...document.querySelectorAll('#cutClipList [data-clip]')].find(r=>r.dataset.clip===sel?.value);
 if(!src?.currentSrc||!src.currentSrc.startsWith('blob:')||!row){status('Zuerst in der bestehenden lokalen Vorschau ein Video und einen Clip auswählen.');return}
 const f=k=>row.querySelector(`[data-field="${k}"]`)?.value;const a=Number(f('in_s')),b=Number(f('out_s'));if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a){status('Schnittgrenzen im Projekt prüfen.');return}
 $('title').value=f('caption_enabled')==='true'?f('caption')||'':''; $('position').value=f('caption_position')==='bottom'?'bottom':'top';
 $('format').value=document.getElementById('cutFormat')?.value||'vertical';$('fps').value=document.getElementById('cutFps')?.value||'30';dimensions();load(src.currentSrc,false,{start:a,end:b})});
 function tick(){cancelAnimationFrame(raf);draw();if(recording&&job){const p=job.plan;$('progress').value=clamp((v.currentTime-p.start)/(p.end-p.start),0,1);if(v.currentTime>=p.end-.01||v.ended){stop();return}}else{report();if(!v.paused&&v.currentTime>=Number($('end').value)){v.pause();return}}if(!v.paused||recording)raf=requestAnimationFrame(tick)}
 v.addEventListener('play',tick);v.addEventListener('ended',()=>{if(recording)stop()});v.addEventListener('pause',()=>{if(!recording){draw();report()}});
 $('play').onclick=async()=>{if(!ready||busy)return;try{if(!v.paused){v.pause();return}const p=currentPlan();if(v.currentTime<p.start||v.currentTime>=p.end)v.currentTime=p.start;if(ac)await ac.resume();await v.play()}catch(e){status(e.message)}};
 $('seek').oninput=()=>{if(ready&&!busy)v.currentTime=Number($('seek').value)};
 for(const [button,input] of [['in','start'],['out','end']])$(button).onclick=()=>{if(ready&&!busy){$(input).value=v.currentTime.toFixed(3);report();draw()}};
 $('preset').onchange=()=>{['brightness','contrast','saturation'].forEach((k,i)=>$(k).value=filter?presets[$('preset').value][i]:0);draw();report()};
 for(const k of ['start','end','fit','background','title','position','titleDuration','brightness','contrast','saturation','resolution','fps','rate','audio'])$(k).addEventListener('input',()=>{report();draw()});
 $('format').onchange=()=>{dimensions();draw();report()};
 function lock(on){busy=on;for(const el of host.querySelectorAll('input,select,button'))if(el!==$('cancel')&&el!==$('share'))el.disabled=on;if(!on){$('play').disabled=!ready;for(const k of ['brightness','contrast','saturation'])$(k).disabled=!filter} $('cancel').hidden=!on;report()}
 function seek(t){return new Promise((resolve,reject)=>{if(Math.abs(v.currentTime-t)<.01&&!v.seeking)return resolve();const timer=setTimeout(()=>{v.removeEventListener('seeked',done);reject(Error('Schnittposition nicht erreichbar.'))},5000);function done(){clearTimeout(timer);resolve()}v.addEventListener('seeked',done,{once:true});v.currentTime=t})}
 function cleanup(j){clearTimeout(j?.watchdog);recording=false;cancelAnimationFrame(raf);v.pause();if(j?.stream)j.stream.getTracks().forEach(t=>t.stop());if(j?.dest&&source){try{source.disconnect(j.dest)}catch{}}if(j?.dest)j.dest.stream.getTracks().forEach(t=>t.stop());if(monitor)monitor.gain.value=1;job=null;dimensions();lock(false);draw()}
 function stop(error=''){const j=job;if(!j)return;if(error)j.error=error;recording=false;v.pause();if(j.rec&&j.rec.state!=='inactive'){j.rec.stop()}else if(!j.rec){/* preparation checks j.error after each await */}}
 $('cancel').onclick=()=>stop('Export abgebrochen.');
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&job)stop('Export unterbrochen: Seite während des Exports offen lassen.')});
 async function finalize(j){const chunks=j.chunks;let type=(j.rec.mimeType||chunks[0]?.type||'').split(';')[0];
 if(j.error||!chunks.length||!['video/mp4','video/webm'].includes(type)){status(j.error||'Kein nutzbares Ausgabeformat erhalten.');cleanup(j);return}
 const extension=type==='video/mp4'?'mp4':'webm';resultFile=new File(chunks,`CFS_Gaming_${Date.now()}.${extension}`,{type});resultUrl=URL.createObjectURL(resultFile);
 $('download').href=resultUrl;$('download').download=resultFile.name;$('download').hidden=false;$('share').hidden=false;$('progress').value=1;
 status(`Datei erstellt: ${extension.toUpperCase()} · ${(resultFile.size/1000000).toFixed(1)} MB · ${j.plan.width} × ${j.plan.height} Ziel. Vor Veröffentlichung abspielen und Ton prüfen.${extension==='webm'?' WebM ist nicht mit jeder iPhone-/TikTok-Version kompatibel.':''}`);cleanup(j);
 }
 $('export').onclick=async()=>{if(busy||!ready||!supported)return;let p;try{p=currentPlan()}catch(e){status(e.message);return}
 clearResult();v.pause();lock(true);$('progress').value=0;const j=job={plan:p,chunks:[],error:'',rec:null,stream:null,dest:null};status('Export wird vorbereitet …');
 try{if($('audio').value==='on'){const AC=root.AudioContext||root.webkitAudioContext;if(!AC)throw Error('Originalton nicht unterstützt; stumm exportieren oder Launcher verwenden.');
 if(!ac){ac=new AC();source=ac.createMediaElementSource(v);monitor=ac.createGain();source.connect(monitor);monitor.connect(ac.destination)}await ac.resume();if(ac.state!=='running')throw Error('Audiofreigabe fehlgeschlagen.');j.dest=ac.createMediaStreamDestination();source.connect(j.dest);monitor.gain.value=0;}else if(monitor)monitor.gain.value=0;
 await seek(p.start);if(j.error)throw Error(j.error);dimensions(true);draw();j.stream=c.captureStream(p.fps);if(j.dest)j.dest.stream.getAudioTracks().forEach(t=>j.stream.addTrack(t));const type=mime(MediaRecorder);if(!type)throw Error('Kein kompatibler MP4-/WebM-Recorder gefunden.');
 j.rec=new MediaRecorder(j.stream,{mimeType:type,videoBitsPerSecond:p.rate*1000000,audioBitsPerSecond:192000});
 j.rec.ondataavailable=e=>{if(e.data.size)j.chunks.push(e.data)};j.rec.onstop=()=>finalize(j);j.rec.onerror=()=>stop('Recorderfehler. Versuche 720p / 30 FPS oder den Launcher.');
 j.rec.start(500);recording=true;await v.play();if(j.error){stop(j.error);return}
 status('Video wird lokal in Echtzeit erstellt. Seite geöffnet lassen.');j.watchdog=setTimeout(()=>{if(job===j)stop('Export-Zeitlimit erreicht. Kleinere Auflösung oder kürzeren Clip wählen.')},(p.end-p.start)*1000+20000);tick();
 }catch(e){j.error=e.message;if(j.rec&&j.rec.state!=='inactive')stop(j.error);else{cleanup(j);status(j.error)}}};
 $('share').onclick=async()=>{if(!resultFile)return;try{if(navigator.canShare?.({files:[resultFile]}))await navigator.share({files:[resultFile]});else $('download').click()}catch(e){if(e.name!=='AbortError')status('Teilen nicht möglich. Nutze den Download.')}};
 dimensions();draw();report();
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount()}
return {plan,rectangle,mime};
});
