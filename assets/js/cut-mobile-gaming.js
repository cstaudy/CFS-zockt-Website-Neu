/* CFS Cut Studio · local mobile multi-range export. No network or project mutations. */
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
function timelinePlan(options,ranges=[]){
 const input=ranges.length?ranges:[{start:options.start,end:options.end}];
 if(input.length>12)throw Error('Maximal 12 Ausschnitte.');
 const segments=input.map(range=>{const p=plan({...options,start:range.start,end:range.end});return {start:p.start,end:p.end}});
 const total=segments.reduce((sum,r)=>sum+r.end-r.start,0);
 if(total>180)throw Error('Das Reel darf insgesamt höchstens 180 Sekunden dauern.');
 return {...plan({...options,...segments[0]}),segments,total};
}
function inspectOutput({width,height,duration},p){
 const expected=p.total??p.end-p.start,delta=Math.abs(Number(duration)-expected);
 if(width!==p.width||height!==p.height)return {ok:false,message:'Ausgabeauflösung weicht vom Ziel ab.'};
 if(!Number.isFinite(duration)||duration<=0||delta>Math.max(.65,expected*.035))return {ok:false,message:'Ausgabedauer weicht vom Schnitt ab.'};
 return {ok:true,message:'Auflösung und Dauer stimmen. Bildrate und Audio noch manuell prüfen.'};
}
function rectangle(sw,sh,w,h,fill=false){const s=(fill?Math.max:Math.min)(w/sw,h/sh);return [(w-sw*s)/2,(h-sh*s)/2,sw*s,sh*s]}
function mime(Recorder){return ['video/mp4','video/mp4;codecs=avc1,mp4a.40.2','video/webm;codecs=vp8,opus','video/webm'].find(t=>Recorder.isTypeSupported(t))||''}
function sourceQuality(sw,sh,p,fill=false){
 const r=rectangle(sw,sh,p.width,p.height,fill),scale=r[2]/sw;
 return {scale,visibleWidth:Math.min(sw,p.width/scale),visibleHeight:Math.min(sh,p.height/scale),drawWidth:Math.round(r[2]),drawHeight:Math.round(r[3])};
}
// Keep the low-resolution backdrop in the same aspect ratio as the final canvas.
function backgroundPlan(w,h,strength=65,darkness=45){
 const amount=clamp(Number(strength)||0,0,100),shade=clamp(Number(darkness)||0,0,85)/100;
 const short=Math.round(160-amount*1.48),ratio=w/h;
 return {width:Math.max(1,Math.round(ratio>=1?short*ratio:short)),height:Math.max(1,Math.round(ratio>=1?short:short/ratio)),shade};
}
function playbackDelta(before,after){
 if(!before||!after)return null;
 const total=after.totalVideoFrames-before.totalVideoFrames,dropped=after.droppedVideoFrames-before.droppedVideoFrames;
 return Number.isFinite(total)&&Number.isFinite(dropped)&&total>0&&dropped>=0&&dropped<=total?{total,dropped,percent:100*dropped/total}:null;
}
function mount(){
 const host=document.getElementById('cutMobileGaming');if(!host||host.dataset.ready)return;host.dataset.ready='1';
 host.innerHTML=`<div class="cut-section-head"><div><span>PS5 · IPHONE</span><h3>Gaming Cutter · direkt auf dem Handy</h3><p>Lokaler Clip- und Reel-Export ohne Launcher, Upload oder KI-Credits. Der bestehende Profi-Schnitt bleibt unverändert.</p></div></div>
 <div class="cut-mobile-actions"><label>Gameplay auswählen<input data-mobile="file" type="file" accept="video/*,.mov,.mp4"></label><button class="btn" type="button" data-mobile="take">Clip aus Schnittvorschau übernehmen</button></div>
 <div class="cut-mobile-screen"><canvas data-mobile="canvas" width="360" height="640" aria-label="Vorschau des mobilen Exports"></canvas><video data-mobile="video" playsinline preload="metadata" aria-hidden="true"></video></div>
 <div class="cut-mobile-actions"><button class="btn" type="button" data-mobile="play" disabled>Abspielen / Pause</button><label><input data-mobile="compare" type="checkbox"> Originalfarben vergleichen</label><label><input data-mobile="safe" type="checkbox" checked> TikTok-Hilfslinien</label><output data-mobile="time">0.00 s</output><input data-mobile="seek" aria-label="Videoposition" type="range" min="0" max="0" step=".01" value="0"></div>
 <div class="cut-project-grid">
 <label><span>START (S)</span><input data-mobile="start" type="number" min="0" step=".01" value="0"></label>
 <label><span>ENDE (S)</span><input data-mobile="end" type="number" min="0" step=".01" value="0"></label>
 <button class="btn" type="button" data-mobile="in">Start hier</button><button class="btn" type="button" data-mobile="out">Ende hier</button>
 <div class="full cut-mobile-timeline"><strong>Reel-Timeline</strong><p>Mehrere Ausschnitte derselben Aufnahme in beliebiger Reihenfolge. Ohne hinzugefügte Ausschnitte wird der oben gewählte Bereich exportiert.</p><button class="btn" type="button" data-mobile="add">+ Aktuellen Ausschnitt hinzufügen</button><button class="btn" type="button" data-mobile="clear">Timeline leeren</button><ol data-mobile="segments"></ol><output data-mobile="total">Einzelclip</output></div>
 <label><span>FORMAT</span><select data-mobile="format"><option value="vertical">9:16 TikTok / Shorts</option><option value="landscape">16:9 YouTube</option><option value="square">1:1</option></select></label>
 <label><span>BILDAUFBAU</span><select data-mobile="fit"><option value="fit">Ganzes Gameplay + Hintergrund</option><option value="fill">Bildfüllend (Zuschnitt)</option></select></label>
 <label><span>GAMING-DESIGN</span><select data-mobile="preset"><option value="clean">Clean · unverändert</option><option value="dark">Dark / DBD</option><option value="neon">Neon</option><option value="funny">Funny Moments</option></select></label>
 <label><span>HINTERGRUND</span><select data-mobile="background"><option value="blur">Weicher Spielhintergrund</option><option value="black">Schwarz</option><option value="solid">Eigene Farbe</option></select></label>
 <div class="full cut-mobile-backdrop"><strong>Hintergrundstudio</strong><small>Dasselbe Gameplay läuft vergrößert und weich hinter dem scharfen Original. Die Einstellungen wirken ausschließlich auf den Hintergrund.</small>
 <div class="cut-project-grid"><label><span>UNSCHÄRFE <output data-mobile="blurValue">65 %</output></span><input data-mobile="blurAmount" type="range" min="0" max="100" value="65"></label>
 <label><span>ABDUNKELUNG <output data-mobile="darkValue">45 %</output></span><input data-mobile="darkness" type="range" min="0" max="85" value="45"></label>
 <label><span>HINTERGRUNDFARBE</span><input data-mobile="bgColor" type="color" value="#101820"></label>
 <button class="btn" type="button" data-mobile="dbdLook">DBD-Hintergrund übernehmen</button></div></div>
 <label class="full"><span>TITEL (OPTIONAL)</span><input data-mobile="title" maxlength="100" placeholder="Das war so nicht geplant."></label>
 <label><span>TITELPOSITION</span><select data-mobile="position"><option value="top">Oben</option><option value="bottom">Unten</option></select></label>
 <label><span>TITELDAUER</span><select data-mobile="titleDuration"><option value="0">Durchgehend</option><option value="3">3 Sekunden</option><option value="5">5 Sekunden</option></select></label>
 <label><span>HELLIGKEIT</span><input data-mobile="brightness" type="range" min="-20" max="25" value="0"></label>
 <label><span>KONTRAST</span><input data-mobile="contrast" type="range" min="-20" max="25" value="0"></label>
 <label><span>SÄTTIGUNG</span><input data-mobile="saturation" type="range" min="-30" max="30" value="0"></label>
 <label class="full"><span>EXPORTPROFIL</span><select data-mobile="profile"><option value="custom">Individuell</option><option value="social">TikTok · 1080p / 30 FPS / 16 Mbit/s</option><option value="motion">PS5 · 1080p / 60 FPS / 20 Mbit/s</option><option value="light">Mobil · 720p / 30 FPS / 8 Mbit/s</option></select></label>
 <label><span>AUFLÖSUNG</span><select data-mobile="resolution"><option value="1080">1080p Full HD</option><option value="720">720p (leichter)</option></select></label>
 <label><span>FPS (ZIEL)</span><select data-mobile="fps"><option value="30">30</option><option value="60">60 (bei 60-FPS-Quelle)</option></select></label>
 <label><span>VIDEO-BITRATE (ZIEL)</span><select data-mobile="rate"><option value="8">8 Mbit/s</option><option value="12">12 Mbit/s</option><option value="16" selected>16 Mbit/s</option><option value="20">20 Mbit/s</option></select></label>
 <label><span>TON</span><select data-mobile="audio"><option value="on">Originalton</option><option value="off">Stumm</option></select></label>
 <label><span>ORIGINALTON <output data-mobile="volumeValue">100 %</output></span><input data-mobile="volume" type="range" min="0" max="100" value="100"></label></div>
 <p data-mobile="quality" class="notice compact"></p><video data-mobile="resultPreview" controls playsinline preload="metadata" hidden aria-label="Fertiges Exportvideo prüfen"></video><p data-mobile="resultAudit" class="notice compact" hidden></p><progress data-mobile="progress" max="1" value="0" aria-label="Exportfortschritt"></progress>
 <div class="cut-mobile-actions"><button class="btn primary" type="button" data-mobile="export" disabled>Video lokal erstellen</button><button class="btn" type="button" data-mobile="cancel" hidden>Abbrechen</button><button class="btn" type="button" data-mobile="share" hidden>Teilen / in Fotos sichern</button><a class="btn" data-mobile="download" hidden>Video herunterladen</a></div>
 <p data-mobile="status" role="status" aria-live="polite">Wähle eine lokale Datei. MP4 wird bevorzugt; Browser können Format, Bildrate und Bitrate begrenzen.</p>
 <small>Reel mit harten Schnitten, einem Titel und Originalton. Mehrere Quelldateien, Mehrspur, Keyframes und komplexe Übergänge bleiben im Launcher. Kein KI-Upscaling. Beim Export die Seite geöffnet lassen.</small>`;
 const $=k=>host.querySelector(`[data-mobile="${k}"]`),v=$('video'),c=$('canvas'),g=c.getContext('2d',{alpha:false}),mini=document.createElement('canvas');
 mini.width=48;mini.height=48;const mg=mini.getContext('2d');
 if(!g||!mg){$('status').textContent='Canvas nicht verfügbar.';return}
 // Some Safari versions expose a filter property without rendering it. Verify pixels.
 let filter=false;try{mg.fillStyle='#fff';mg.fillRect(0,0,1,1);mg.filter='brightness(0%)';mg.fillRect(0,0,1,1);filter=mg.getImageData(0,0,1,1).data[0]===0;mg.filter='none'}catch{}
 for(const k of ['brightness','contrast','saturation'])$(k).disabled=!filter;
 const supported=typeof MediaRecorder!=='undefined'&&typeof c.captureStream==='function'&&typeof MediaRecorder.isTypeSupported==='function';
 let ownUrl='',resultUrl='',resultFile=null,ready=false,busy=false,recording=false,job=null,raf=0,ac=null,source=null,monitor=null,exportGain=null,ranges=[];
 const status=s=>$('status').textContent=s;
 const options=()=>({duration:v.duration,...Object.fromEntries(['start','end','format','resolution','fps','rate'].map(k=>[k,$(k).value]))});
 const currentPlan=()=>timelinePlan(options(),ranges);
 const selectionPlan=()=>plan(options());
 function renderRanges(){
 const list=$('segments');list.replaceChildren();
 ranges.forEach((r,i)=>{const li=document.createElement('li'),label=document.createElement('span');label.textContent=(i+1)+'. '+r.start.toFixed(2)+' – '+r.end.toFixed(2)+' s';li.append(label);
 for(const [action,txt,disabled] of [['up','↑',i===0],['down','↓',i===ranges.length-1],['remove','Entfernen',false]]){const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=txt;b.setAttribute('aria-label',txt+' Ausschnitt '+(i+1));b.disabled=disabled||busy;b.onclick=()=>{if(busy)return;const next=ranges.slice();if(action==='remove')next.splice(i,1);else {const j=i+(action==='up'?-1:1);[next[i],next[j]]=[next[j],next[i]]}ranges=next;renderRanges();report()};li.append(b)}list.append(li)});
 $('total').textContent=ranges.length?ranges.length+' Ausschnitte · '+ranges.reduce((n,r)=>n+r.end-r.start,0).toFixed(2)+' s':'Einzelclip';
 }
 $('add').onclick=()=>{if(!ready||busy)return;try{const p=selectionPlan(),next=[...ranges,{start:p.start,end:p.end}];timelinePlan(options(),next);ranges=next;renderRanges();report()}catch(e){status(e.message)}};
 $('clear').onclick=()=>{if(!busy){ranges=[];renderRanges();report()}};
 $('profile').onchange=()=>{const profile={social:[1080,30,16],motion:[1080,60,20],light:[720,30,8]}[$('profile').value];if(profile){['resolution','fps','rate'].forEach((k,i)=>$(k).value=profile[i]);report()}};
 for(const k of ['resolution','fps','rate'])$(k).addEventListener('change',()=>$('profile').value='custom');
 const palette={clean:'#f1f4f8',dark:'#ff4864',neon:'#ad8cff',funny:'#ffc74b'};
 const presets={clean:[0,0,0],dark:[8,3,4],neon:[3,6,12],funny:[5,4,8]};
 function report(){$('blurValue').textContent=$('blurAmount').value+' %';$('darkValue').textContent=$('darkness').value+' %';$('volumeValue').textContent=$('volume').value+' %';let p;try{p=currentPlan()}catch{} const loaded=ready&&p;let s=loaded?`${v.videoWidth} × ${v.videoHeight} → ${p.width} × ${p.height} · ${p.fps} FPS Ziel · ca. ${Math.ceil(p.total*(p.rate+.192)/8)} MB. `:'Quelle und gültigen Schnittbereich wählen. ';
 if(loaded){const q=sourceQuality(v.videoWidth,v.videoHeight,p,$('fit').value==='fill');if(q.scale>1.01)s+=`Gameplay wird ${q.scale.toFixed(2)}× vergrößert: keine neuen Bilddetails. `;if($('fit').value==='fill')s+=`Sichtbarer Quellausschnitt: ${Math.round(q.visibleWidth)} × ${Math.round(q.visibleHeight)} px; HUD prüfen. `;if(p.fps===60)s+='60 FPS nur bei passender Quelle sinnvoll; Quell-FPS unbekannt. ';}
 if(!filter)s+='Farbkorrektur in diesem Browser nicht verfügbar. ';
 if(!supported)s+='Direkter Export nicht unterstützt; Launcher bleibt verfügbar.';
 $('quality').textContent=s;$('export').disabled=busy||!loaded||!supported;$('time').textContent=(v.currentTime||0).toFixed(2)+' s';$('seek').value=v.currentTime||0;}
 function dimensions(full=false){const n=full?Number($('resolution').value):360,wide=Math.round(n*16/9/2)*2,f=$('format').value;[c.width,c.height]=f==='landscape'?[wide,n]:f==='square'?[n,n]:[n,wide]}
 function draw(){
 const w=c.width,h=c.height,b=Math.min(w,h);g.fillStyle='#080b11';g.fillRect(0,0,w,h);
 if(ready&&v.readyState>=2&&v.videoWidth){
 if($('background').value==='solid'){g.fillStyle=$('bgColor').value;g.fillRect(0,0,w,h)}
 if($('background').value==='black'){g.fillStyle='#000';g.fillRect(0,0,w,h)}
 if($('background').value==='blur'){
 const bg=backgroundPlan(w,h,$('blurAmount').value,$('darkness').value);
 if(mini.width!==bg.width||mini.height!==bg.height){mini.width=bg.width;mini.height=bg.height}
 mg.imageSmoothingEnabled=true;mg.imageSmoothingQuality='high';mg.drawImage(v,...rectangle(v.videoWidth,v.videoHeight,bg.width,bg.height,true));
 g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(mini,0,0,w,h);g.fillStyle='rgba(0,0,0,'+bg.shade+')';g.fillRect(0,0,w,h)
 }
 g.imageSmoothingQuality='high';if(filter&&(busy||!$('compare').checked))g.filter=`brightness(${100+Number($('brightness').value)}%) contrast(${100+Number($('contrast').value)}%) saturate(${100+Number($('saturation').value)}%)`;
 g.drawImage(v,...rectangle(v.videoWidth,v.videoHeight,w,h,$('fit').value==='fill'));if(filter)g.filter='none';
 }else{g.textAlign='center';g.font=`600 ${b*.045}px sans-serif`;g.fillStyle='#aeb8c7';g.fillText('Gameplay importieren',w/2,h/2,w*.85)}
 const title=$('title').value.trim(),limit=Number($('titleDuration').value);
 const elapsed=job?job.offset+Math.max(0,v.currentTime-job.plan.segments[job.index].start):v.currentTime-Number($('start').value);
 if(title&&(!limit||elapsed<limit)){
 g.font=`800 ${Math.round(b*.060)}px sans-serif`;g.textAlign='center';g.textBaseline='middle';
 let lines=[],line='';for(const word of title.split(/\s+/)){const next=(line+' '+word).trim();if(line&&g.measureText(next).width>w*.78){lines.push(line);line=word}else line=next}if(line)lines.push(line);lines=lines.slice(0,4);
 const lh=b*.075,y=$('position').value==='bottom'?h*.77-(lines.length-1)*lh:h*.14;
 g.fillStyle='rgba(0,0,0,.72)';g.fillRect(w*.07,y-lh*.7,w*.86,lh*(lines.length+.45));g.fillStyle=palette[$('preset').value];g.fillRect(w*.09,y-lh*.55,b*.007,lh*(lines.length+.1));g.fillStyle='#fff';lines.forEach((l,i)=>g.fillText(l,w/2,y+i*lh,w*.78));
 }
 // Preview guides only: never burn platform UI zones into the exported file.
 if(!busy&&$('safe').checked&&$('format').value==='vertical'){g.save();g.strokeStyle='rgba(255,255,255,.65)';g.lineWidth=Math.max(1,b*.004);g.setLineDash([b*.017,b*.011]);g.strokeRect(w*.07,h*.10,w*.73,h*.68);g.restore()}
 }
 function clearResult(){$('resultPreview').pause();$('resultPreview').removeAttribute('src');$('resultPreview').load();$('resultPreview').hidden=true;$('resultAudit').hidden=true;if(resultUrl)URL.revokeObjectURL(resultUrl);resultUrl='';resultFile=null;$('download').hidden=true;$('share').hidden=true;$('download').removeAttribute('href')}
 function load(url,owned,selection){if(busy)return;v.pause();clearResult();ranges=[];renderRanges();ready=false;if(ownUrl)URL.revokeObjectURL(ownUrl);ownUrl=owned?url:'';v.src=url;v.load();job=null;pending=selection;report();status('Datei wird lokal geöffnet …')}
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
 function tick(){cancelAnimationFrame(raf);if(job?.switching)return;draw();if(recording&&job){const j=job,p=j.plan,r=p.segments[j.index];$('progress').value=clamp((j.offset+v.currentTime-r.start)/p.total,0,1);if(v.currentTime>=r.end-.01||v.ended){advance(j);return}}else{report();if(!v.paused&&v.currentTime>=Number($('end').value)){v.pause();return}}if(!v.paused||recording)raf=requestAnimationFrame(tick)}
 function recorderEvent(rec,event,action){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{rec.removeEventListener(event,done);reject(Error('Recorder reagiert nicht auf '+event+'.'))},3000);function done(){clearTimeout(timer);resolve()}rec.addEventListener(event,done,{once:true});try{action()}catch(e){clearTimeout(timer);rec.removeEventListener(event,done);reject(e)}})}
 async function advance(j){if(job!==j||j.switching||!recording)return;
 if(j.index>=j.plan.segments.length-1){stop();return}
 j.switching=true;v.pause();cancelAnimationFrame(raf);
 try{
 await recorderEvent(j.rec,'pause',()=>j.rec.pause());if(job!==j||j.error)return;
 const prev=j.plan.segments[j.index];j.offset+=prev.end-prev.start;j.index++;
 await seek(j.plan.segments[j.index].start);if(job!==j||j.error)return;draw();
 await recorderEvent(j.rec,'resume',()=>j.rec.resume());if(job!==j||j.error)return;
 await v.play();if(job!==j||j.error)return;j.switching=false;tick();
 }catch(e){if(job===j)stop(e.message)}
 }
 v.addEventListener('play',tick);v.addEventListener('ended',()=>{if(recording&&job)advance(job)});v.addEventListener('pause',()=>{if(!recording){draw();report()}});
 $('play').onclick=async()=>{if(!ready||busy)return;try{if(!v.paused){v.pause();return}const p=selectionPlan();if(v.currentTime<p.start||v.currentTime>=p.end)v.currentTime=p.start;if(ac)await ac.resume();await v.play()}catch(e){status(e.message)}};
 $('seek').oninput=()=>{if(ready&&!busy)v.currentTime=Number($('seek').value)};
 for(const [button,input] of [['in','start'],['out','end']])$(button).onclick=()=>{if(ready&&!busy){$(input).value=v.currentTime.toFixed(3);report();draw()}};
 $('preset').onchange=()=>{['brightness','contrast','saturation'].forEach((k,i)=>$(k).value=filter?presets[$('preset').value][i]:0);draw();report()};
 $('dbdLook').onclick=()=>{if(busy)return;$('background').value='blur';$('blurAmount').value='65';$('darkness').value='45';$('preset').value='dark';$('preset').dispatchEvent(new Event('change'));report();draw()};
 function syncVolume(){const gain=$('audio').value==='on'?Number($('volume').value)/100:0;if(monitor){monitor.gain.value=busy?0:gain;v.muted=false;v.volume=1}else{v.muted=gain===0;try{v.volume=gain}catch{}}}
 for(const k of ['audio','volume'])$(k).addEventListener('input',syncVolume);
 for(const k of ['start','end','fit','background','blurAmount','darkness','bgColor','title','position','titleDuration','brightness','contrast','saturation','resolution','fps','rate','audio','volume','compare','safe'])$(k).addEventListener('input',()=>{report();draw()});
 $('format').onchange=()=>{dimensions();draw();report()};
 function lock(on){busy=on;for(const el of host.querySelectorAll('input,select,button'))if(el!==$('cancel')&&el!==$('share'))el.disabled=on;if(!on){$('play').disabled=!ready;for(const k of ['brightness','contrast','saturation'])$(k).disabled=!filter} $('cancel').hidden=!on;renderRanges();report()}
 function seek(t){return new Promise((resolve,reject)=>{if(Math.abs(v.currentTime-t)<.01&&!v.seeking)return resolve();const timer=setTimeout(()=>{v.removeEventListener('seeked',done);reject(Error('Schnittposition nicht erreichbar.'))},5000);function done(){clearTimeout(timer);resolve()}v.addEventListener('seeked',done,{once:true});v.currentTime=t})}
 function cleanup(j){clearTimeout(j?.watchdog);recording=false;cancelAnimationFrame(raf);v.pause();if(j?.stream)j.stream.getTracks().forEach(t=>t.stop());if(j?.dest&&exportGain){try{source.disconnect(exportGain);exportGain.disconnect()}catch{}exportGain=null}if(j?.dest)j.dest.stream.getTracks().forEach(t=>t.stop());if(monitor)monitor.gain.value=1;job=null;dimensions();lock(false);syncVolume();draw()}
 function stop(error=''){const j=job;if(!j)return;if(error)j.error=error;recording=false;v.pause();if(j.rec&&j.rec.state!=='inactive'){j.rec.stop()}else if(!j.rec){/* preparation checks j.error after each await */}}
 $('cancel').onclick=()=>stop('Export abgebrochen.');
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&job)stop('Export unterbrochen: Seite während des Exports offen lassen.')});
 async function finalize(j){const chunks=j.chunks;const motion=playbackDelta(j.playbackStart,v.getVideoPlaybackQuality?.());let type=(j.rec.mimeType||chunks[0]?.type||'').split(';')[0];
 if(j.error||!chunks.length||!['video/mp4','video/webm'].includes(type)){status(j.error||'Kein nutzbares Ausgabeformat erhalten.');cleanup(j);return}
 const extension=type==='video/mp4'?'mp4':'webm';resultFile=new File(chunks,`CFS_Gaming_${Date.now()}.${extension}`,{type});resultUrl=URL.createObjectURL(resultFile);
 const preview=$('resultPreview'),audit=$('resultAudit');preview.hidden=false;audit.hidden=false;audit.textContent='Ausgabedatei wird geprüft …';
 const checkUrl=resultUrl;let audited=false;
 const complete=(message)=>{if(resultUrl!==checkUrl||audited)return;audited=true;clearTimeout(timer);audit.textContent=message};
 const timer=setTimeout(()=>complete('Ausgabemetadaten konnten nicht geprüft werden. Datei vor Veröffentlichung manuell abspielen.'),7000);
 preview.onloadedmetadata=()=>{const r=inspectOutput({width:preview.videoWidth,height:preview.videoHeight,duration:preview.duration},j.plan);complete((r.ok?'Ausgabeprüfung: ':'Warnung: ')+r.message+' '+preview.videoWidth+' × '+preview.videoHeight+' · '+(Number.isFinite(preview.duration)?preview.duration.toFixed(2)+' s':'Dauer unbekannt'))};
 preview.onerror=()=>complete('Warnung: Ausgabedatei kann im Browser nicht abgespielt werden. Nicht ungeprüft veröffentlichen.');
 preview.src=resultUrl;preview.load();
 $('download').href=resultUrl;$('download').download=resultFile.name;$('download').hidden=false;$('share').hidden=false;$('progress').value=1;
 status(`Datei erstellt: ${extension.toUpperCase()} · ${(resultFile.size/1000000).toFixed(1)} MB · ${j.plan.width} × ${j.plan.height} Ziel. Vor Veröffentlichung abspielen und Ton prüfen.${motion&&motion.dropped?` Quellwiedergabe: ${motion.dropped} von ${motion.total} Frames verworfen. Bei Rucklern niedrigere Exportlast wählen.`:''}${extension==='webm'?' WebM ist nicht mit jeder iPhone-/TikTok-Version kompatibel.':''}`);cleanup(j);
 }
 $('export').onclick=async()=>{if(busy||!ready||!supported)return;let p;try{p=currentPlan()}catch(e){status(e.message);return}
 clearResult();v.pause();lock(true);$('progress').value=0;const j=job={plan:p,index:0,offset:0,switching:false,chunks:[],error:'',rec:null,stream:null,dest:null};status('Export wird vorbereitet …');
 try{if($('audio').value==='on'){const AC=root.AudioContext||root.webkitAudioContext;if(!AC)throw Error('Originalton nicht unterstützt; stumm exportieren oder Launcher verwenden.');
 if(!ac){ac=new AC();source=ac.createMediaElementSource(v);monitor=ac.createGain();source.connect(monitor);monitor.connect(ac.destination)}await ac.resume();if(ac.state!=='running')throw Error('Audiofreigabe fehlgeschlagen.');j.dest=ac.createMediaStreamDestination();exportGain=ac.createGain();exportGain.gain.value=Number($('volume').value)/100;source.connect(exportGain);exportGain.connect(j.dest);v.muted=false;v.volume=1;monitor.gain.value=0;}else if(monitor)monitor.gain.value=0;
 await seek(p.start);if(j.error)throw Error(j.error);dimensions(true);draw();j.stream=c.captureStream(p.fps);if(j.dest)j.dest.stream.getAudioTracks().forEach(t=>j.stream.addTrack(t));const type=mime(MediaRecorder);if(!type)throw Error('Kein kompatibler MP4-/WebM-Recorder gefunden.');
 j.rec=new MediaRecorder(j.stream,{mimeType:type,videoBitsPerSecond:p.rate*1000000,audioBitsPerSecond:192000});
 if(p.segments.length>1&&(typeof j.rec.pause!=='function'||typeof j.rec.resume!=='function'))throw Error('Dieser Browser unterstützt keine Reel-Schnitte. Einzelclip verwenden.');
 j.rec.ondataavailable=e=>{if(e.data.size)j.chunks.push(e.data)};j.rec.onstop=()=>finalize(j);j.rec.onerror=()=>stop('Recorderfehler. Versuche 720p / 30 FPS oder den Launcher.');
 j.playbackStart=v.getVideoPlaybackQuality?.();j.rec.start(500);recording=true;await v.play();if(j.error){stop(j.error);return}
 status('Video wird lokal in Echtzeit erstellt. Seite geöffnet lassen.');j.watchdog=setTimeout(()=>{if(job===j)stop('Export-Zeitlimit erreicht. Kleinere Auflösung oder kürzeren Clip wählen.')},p.total*1000+20000+7000*(p.segments.length-1));tick();
 }catch(e){j.error=e.message;if(j.rec&&j.rec.state!=='inactive')stop(j.error);else{cleanup(j);status(j.error)}}};
 $('share').onclick=async()=>{if(!resultFile)return;try{if(navigator.canShare?.({files:[resultFile]}))await navigator.share({files:[resultFile]});else $('download').click()}catch(e){if(e.name!=='AbortError')status('Teilen nicht möglich. Nutze den Download.')}};
 dimensions();draw();renderRanges();report();syncVolume();
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount()}
return {plan,timelinePlan,inspectOutput,sourceQuality,backgroundPlan,playbackDelta,rectangle,mime};
});
