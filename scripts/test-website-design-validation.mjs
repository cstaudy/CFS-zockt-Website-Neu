import assert from "node:assert/strict";
import {validateWebsiteDesign as validate} from "../src/website-design-validation.js";
assert.deepEqual(validate({}),{ok:true,design:{backgroundAssetId:null,shade:65,position:"center",accent:"#28d9f0"}});
assert.equal(validate({shade:0}).ok,true);
assert.equal(validate({shade:90}).ok,true);
assert.equal(validate({backgroundAssetId:"12345678-1234-1234-1234-123456789abc",accent:"#ABCDEF",position:"top"}).design.accent,"#abcdef");
for(const input of [null,[],42,{shade:-1},{shade:91},{shade:1.5},{shade:"65"},{position:"url(x)"},{accent:"red"},{accent:"#123456; color:red"},{backgroundAssetId:"https://example.com/a.png"},{backgroundAssetId:123},{published:true},JSON.parse('{"__proto__":{}}')]) assert.equal(validate(input).ok,false);
console.log("Website design validation passed");
