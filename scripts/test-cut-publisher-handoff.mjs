import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {runInNewContext} from "node:vm";
const cut=await readFile(new URL("../assets/js/cut-studio.js",import.meta.url),"utf8");
const ui=await readFile(new URL("../assets/js/page-integrations.js",import.meta.url),"utf8");
const id="11111111-1111-4111-8111-111111111111", foreign="22222222-2222-4222-8222-222222222222";
const entry={id,name:"Export.mp4",size:1234,created_at:"2026-11-28",url:"/assets/uploads/example.mp4"};
const cutFn=cut.slice(cut.indexOf("async function loadUserMedia()"),cut.indexOf("async function uploadUserMedia("));
assert(cutFn.startsWith("async function loadUserMedia()"));
const elements=new Map();
const $=key=>{if(!elements.has(key))elements.set(key,{});return elements.get(key);};
const escape=v=>String(v).replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;");
await runInNewContext(cutFn+"\nloadUserMedia()",{CFS:{escape,json:async path=>({media:path.endsWith("/videos")?[entry,{...entry,id:'" onclick="alert(1)'}]:[]})},$,mediaFolder:"videos"});
const markup=$("#cutMediaList").innerHTML;
assert(markup.includes('/pages/integrations.html#publisher-media='+id));
assert.equal((markup.match(/PUBLISHER-VORSCHAU/g)||[]).length,1);
const previewFn=ui.slice(ui.indexOf("  async function setupPublisherPreview()"),ui.indexOf("  await setupPublisherPreview();"));
assert(previewFn.includes("async function setupPublisherPreview()"));
async function simulate(hash,entries=[entry],unavailable=false){
  const calls=[],historyCalls=[],formEvents=[];
  const media={value:"",disabled:false,options:[],replaceChildren(...options){this.options=options;this.value="";},add(option){this.options.push(option);}};
  const form={addEventListener(type){formEvents.push(type);},scrollIntoView(){this.scrolled=true;}};
  const status={},submit={},results={replaceChildren(){}};
  const nodes={publisherPreviewForm:form,publisherMedia:media,publisherPreviewSubmit:submit,publisherPreviewStatus:status,publisherPreviewResults:results};
  const context={document:{getElementById:key=>nodes[key]},location:{hash,pathname:"/pages/integrations.html",search:""},history:{state:null,replaceState(...args){historyCalls.push(args);}},
    Option:class {constructor(text,value){this.text=text;this.value=value;}},
    CFS:{json:async path=>{calls.push(path);if(unavailable)throw Error("offline");return{media:path.endsWith("/videos")?entries:[]};}}};
  await runInNewContext(previewFn+"\nsetupPublisherPreview()",context);
  return {media,status,calls,historyCalls,formEvents,form};
}
const ok=await simulate("#publisher-media="+id.toUpperCase());
assert.equal(ok.media.value,id);
assert.match(ok.status.textContent,/Kein Upload gestartet/);
assert.equal(ok.historyCalls[0][2],"/pages/integrations.html#publisherPreviewForm");
assert(ok.form.scrolled);
assert.deepEqual(ok.calls,["/api/creator/media/videos","/api/creator/media/clips"]);
assert.deepEqual(ok.formEvents,["input","submit"]);
for(const hash of ["#publisher-media="+foreign,"#publisher-media=https://example.invalid/video","#publisher-media="+id+"&publish=true"]){
  const t=await simulate(hash);
  assert.equal(t.media.value,"");assert.match(t.status.textContent,/nicht verfügbar/);
  assert.equal(t.calls.length,2);
}
const normal=await simulate("#publisherPreviewForm");
assert.equal(normal.media.value,"");assert.equal(normal.historyCalls.length,0);
const offline=await simulate("#publisher-media="+id,[],true);
assert.match(offline.status.textContent,/nicht erreichbar/);assert.equal(offline.media.value,"");
console.log("Cut-to-Publisher handoff: existing media link, owner-list selection, invalid/foreign/expired handoff and no auto-submit.");
