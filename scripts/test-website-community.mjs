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
