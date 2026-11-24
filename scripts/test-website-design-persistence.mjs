import assert from "node:assert/strict";
import {initialDesignState} from "../src/website-design-state.js";
import {persistDesignMutation as persist} from "../src/website-design-persistence.js";
let state=initialDesignState(),writes=0,conflict=false,fail=false;
const context={accountId:"owner",isAdmin:true,elevated:true};
const repository={async transaction(fn){
 const before=state;
 try{return await fn({async loadForMutation(){return {state,context}},async compareAndSwap(expected,candidate){
 writes++;
 if(conflict||expected!==state.revision)return false;
 state=candidate;
 if(fail)throw Error("storage failure");
 return true;
 }});}catch(e){state=before;throw e;}
}};
const save={type:"save",expectedRevision:0,design:{shade:45}};
assert.equal((await persist(repository,save,{})).status,200);
assert.equal(state.draft.shade,45);
assert.equal(state.published,null);
assert.equal((await persist(repository,save,{})).status,409);
assert.equal(writes,1);
conflict=true;
assert.equal((await persist(repository,{type:"publish",expectedRevision:1},{})).status,409);
assert.equal(state.published,null);
conflict=false;fail=true;
await assert.rejects(()=>persist(repository,{type:"publish",expectedRevision:1},{}),/storage failure/);
assert.equal(state.revision,1);
assert.equal(state.published,null);
fail=false;
const result=await persist(repository,{type:"publish",expectedRevision:1},{});
assert.equal(result.status,200);
assert.equal(state.published.design.shade,45);
assert.equal(Object.hasOwn(result,"candidate"),false);
context.elevated=false;
assert.equal((await persist(repository,{type:"save",expectedRevision:2,design:{}},{})).status,428);
assert.equal(state.revision,2);
console.log("Design persistence contract passed");
