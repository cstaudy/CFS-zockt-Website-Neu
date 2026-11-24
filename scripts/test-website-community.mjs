import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
const read = path => readFile(new URL('../'+path, import.meta.url),'utf8');
const home = await read('index.html');
const suite = await read('pages/creator-suite.html');
for (const html of [home,suite]) {
 const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length);
 for(const [,anchor] of html.matchAll(/href="#([^"]+)"/g)) assert(ids.includes(anchor),anchor);
}
assert(home.indexOf('id="community"') < home.indexOf('id="games"'));
assert(home.indexOf('id="games"') < home.indexOf('id="refStreamsTitle"'));
assert.match(home,/COMMUNITY-PROJEKT · IN PLANUNG/);
assert.match(home,/Der Server ist noch nicht gestartet/);
const script=await read('assets/js/admin-control-center-v181.js');
for(const status of [401,403,404]){
 const buttons=Object.fromEntries(['#siteSaveDraft','#sitePublish','#siteRevert','#sitePreview'].map(id=>[id,{disabled:false,addEventListener(){}}]));
 const state={textContent:'',className:''},form={innerHTML:''};
 let ready;
 const document={querySelector:id=>buttons[id]||(id==='#siteContentState'?state:id==='#siteContentForm'?form:null),addEventListener:(name,fn)=>{ready=fn}};
 const CFS={json:async()=>{throw Object.assign(new Error('unavailable'),{status})}};
 runInNewContext(script,{document,CFS});
 await ready();
 assert(Object.values(buttons).every(b=>b.disabled));
 assert.match(state.textContent,/Keine Speicherung möglich/);
}
console.log('Website community: structure and unavailable CMS controls verified.');

async function previewHarness(){
 const node=()=>({value:'',style:{},listeners:{},addEventListener(k,f){this.listeners[k]=f},dispatchEvent(e){this.listeners[e.type]?.()},remove(){mounted=null}});
 const file=node(),shade=node(),preview=node(),status=node(),reset=node(),panel=node(),refresh=node(),size=node(),position=node();
 shade.value='65';size.value='desktop';position.value='center';panel.lastElementChild=preview;
 panel.querySelector=s=>({'input[type=file]':file,'input[type=range]':shade,'[role=status]':status,'button':reset,'[data-preview-size]':size,'[data-preview-position]':position}[s]);
 let mounted=null,ready,allowed=true,decoded,serial=0;
 const revoked=[],requests=[];
 const host={after:p=>{mounted=p}};
 const document={querySelector:s=>({'#sitePreviewHost':host,'#cfsLocalDesignPreview':mounted,'#adminRefresh':refresh}[s]||null),createElement:()=>panel,addEventListener:(k,f)=>{ready=f}};
 const window={addEventListener(){},removeEventListener(){}};
 const CFS={json:async path=>{requests.push(path);if(allowed&&path.endsWith('/summary'))return {ok:true};throw Object.assign(new Error('unavailable'),{status:403})}};
 const URL={createObjectURL:()=> 'blob:test-'+(++serial),revokeObjectURL:u=>revoked.push(u)};
 class Image{constructor(){decoded=this}}
 class Event{constructor(type){this.type=type}}
 runInNewContext(script,{document,window,CFS,URL,Image,Event});
 await ready();
 assert.equal(mounted,panel);
 size.value="mobile";size.listeners.change();assert.equal(preview.style.maxWidth,"390px");
 position.value="top";position.listeners.change();assert.equal(preview.style.backgroundPosition,"top");
 file.files=[{type:'image/svg+xml',size:100}];file.listeners.change();assert.match(status.textContent,/PNG/);assert.equal(serial,0);
 file.files=[{type:'image/png',size:9*1024*1024}];file.listeners.change();assert.equal(serial,0);
 file.files=[{type:'image/png',size:100}];file.listeners.change();decoded.naturalWidth=6000;decoded.naturalHeight=6000;decoded.onload();assert.match(status.textContent,/zu groß/);assert.deepEqual(revoked,['blob:test-1']);
 file.listeners.change();decoded.onerror();assert.match(status.textContent,/nicht gelesen/);
 file.listeners.change();decoded.naturalWidth=1920;decoded.naturalHeight=1080;decoded.onload();assert.match(preview.style.backgroundImage,/blob:test-3/);
 reset.listeners.click();assert.equal(size.value,"desktop");assert.equal(position.value,"center");assert.match(preview.style.backgroundImage,/cfs-site-background/);assert(revoked.includes('blob:test-3'));
 allowed=false;refresh.listeners.click();await new Promise(resolve=>setImmediate(resolve));assert.equal(mounted,null);
 assert(requests.every(p=>p==='/api/admin/control-center/summary'||p==='/api/admin/site-content'));
}
await previewHarness();
console.log('Local design preview: simulated admin access, image validation, reset and revocation verified.');
