import assert from "node:assert/strict";
import {applyPublicDesign as apply} from "../assets/js/cfs-public-design.js";
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
