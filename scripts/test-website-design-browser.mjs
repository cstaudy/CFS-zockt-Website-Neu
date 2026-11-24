import assert from "node:assert/strict";
import {applyPublicDesign as apply,loadPublicDesign} from "../assets/js/cfs-public-design.js";
const values=new Map(),hero={style:{setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k)}};
const design={revision:1,backgroundAssetId:null,shade:60,position:"top",accent:"#ABCDEF"};
assert.equal(apply(hero,{design}),true);
assert.equal(values.get("--cfs-home-shade-start"),"0.6");
assert.equal(values.get("--cfs-home-position"),"top");
assert.equal(values.get("--cfs-home-accent"),"#abcdef");
for(const bad of [null,{...design,shade:99},{...design,position:"url(x)"},{...design,accent:"red"},{...design,backgroundAssetId:"https://example.com/a"},{...design,backgroundAssetId:"12345678-1234-1234-1234-123456789abc"}]){
 assert.equal(apply(hero,{design}),true);
 assert.equal(apply(hero,{design:bad}),false);
 assert.equal(values.size,0);
}
assert.equal(apply(null,{design}),false);
console.log("Public design adapter passed");

const request=async(url,options)=>{
 assert.equal(url,"/api/public/website-design");
 assert.equal(options.credentials,"omit");
 assert.equal(options.cache,"no-store");
 assert.equal(options.redirect,"error");
 return {ok:true,json:async()=>({design})};
};
assert.equal(await loadPublicDesign(hero,request),true);
for(const fail of [async()=>({ok:false}),async()=>{throw Error("offline")},async()=>({ok:true,json:async()=>{throw Error("invalid JSON")}}),async()=>({ok:true,json:async()=>({design:null})})]){
 apply(hero,{design});
 assert.equal(await loadPublicDesign(hero,fail),false);
 assert.equal(values.size,0);
}
assert.equal(await loadPublicDesign(null,request),false);
