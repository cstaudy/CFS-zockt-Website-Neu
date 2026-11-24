import assert from "node:assert/strict";
import {initialDesignState} from "../src/website-design-state.js";
import {prepareDesignMutation as mutate,publicDesignResponse as read} from "../src/website-design-api-contract.js";
import {applyPublicDesign as apply} from "../assets/js/cfs-public-design.js";
// In-memory integration fixture, not a production persistence adapter.
let state=initialDesignState();
const ctx={accountId:"owner",isAdmin:true,elevated:true};
const values=new Map(),hero={style:{setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k)}};
function commit(command,context=ctx){
 const result=mutate(state,command,context);
 if(result.status===200){assert.equal(result.expectedRevision,state.revision);state=result.candidate;}
 return result.status;
}
function render(context=ctx){return apply(hero,read(state,context).body);}
assert.equal(render(),false);
assert.equal(commit({type:"save",expectedRevision:0,design:{shade:35,position:"top",accent:"#abcdef"}}),200);
assert.equal(render(),false);
assert.equal(commit({type:"publish",expectedRevision:1},{...ctx,elevated:false}),428);
assert.equal(state.revision,1);
assert.equal(commit({type:"publish",expectedRevision:1}),200);
assert.equal(render(),true);
assert.equal(values.get("--cfs-home-shade-start"),"0.35");
assert.equal(commit({type:"save",expectedRevision:1,design:{shade:90}}),409);
assert.equal(commit({type:"save",expectedRevision:2,design:{shade:80}}),200);
assert.equal(render(),true);
assert.equal(values.get("--cfs-home-shade-start"),"0.35");
assert.equal(commit({type:"publish",expectedRevision:3}),200);
assert.equal(render(),true);
assert.equal(values.get("--cfs-home-shade-start"),"0.8");
assert.equal(commit({type:"restore",expectedRevision:4,sourceRevision:2}),200);
assert.equal(render(),true);
assert.equal(values.get("--cfs-home-shade-start"),"0.8");
assert.equal(commit({type:"publish",expectedRevision:5}),200);
assert.equal(render(),true);
assert.equal(values.get("--cfs-home-shade-start"),"0.35");
const id="12345678-1234-1234-1234-123456789abc";
const asset={id,accountId:"owner",mimeType:"image/png",validated:true,deleted:false,publicApproved:false};
assert.equal(commit({type:"save",expectedRevision:6,design:{backgroundAssetId:id}},{...ctx,asset}),200);
assert.equal(commit({type:"publish",expectedRevision:7},{...ctx,asset}),400);
assert.equal(commit({type:"publish",expectedRevision:7},{...ctx,asset:{...asset,publicApproved:true}}),200);
assert.equal(render({...ctx,asset:{...asset,publicApproved:true}}),false);
assert.equal(values.size,0);
assert.deepEqual(read(state,{...ctx,asset}).body,{design:null});
console.log("Website design integration passed");
