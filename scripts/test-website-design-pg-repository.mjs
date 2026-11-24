import assert from "node:assert/strict";
import {createWebsiteDesignRepository as create} from "../src/website-design-pg-repository.js";
const design={backgroundAssetId:null,shade:65,position:"center",accent:"#28d9f0"};
const initial={revision:0,draft:design,published:null,history:[]};
let stored=initial,writes=0;
const calls=[];let failCommit=false,failRollback=false;
const client={async query(sql){calls.push(sql);if(sql==="COMMIT"&&failCommit)throw Error("commit failed");if(sql==="ROLLBACK"&&failRollback)throw Error("rollback failed")},release(discard){calls.push(discard?"discard":"release")}};
const repo=create({async connect(){return client}},{async loadForMutation(c){assert.equal(c,client);return {state:stored}},async compareAndSwap(c){assert.equal(c,client);writes++;return true}});
assert.equal((await repo.transaction(async tx=>{await tx.loadForMutation({},{});await tx.compareAndSwap(0,{...initial,revision:1});return {status:200}})).status,200);
assert.deepEqual(calls.splice(0),["BEGIN","COMMIT","release"]);
assert.equal((await repo.transaction(async()=>({status:409}))).status,409);
assert.deepEqual(calls.splice(0),["BEGIN","ROLLBACK","release"]);
await assert.rejects(()=>repo.transaction(async()=>{throw Error("write failed")}),/write failed/);
assert.deepEqual(calls.splice(0),["BEGIN","ROLLBACK","release"]);
failCommit=true;
await assert.rejects(()=>repo.transaction(async()=>({status:200})),/commit failed/);
assert.deepEqual(calls.splice(0),["BEGIN","COMMIT","ROLLBACK","release"]);
failRollback=true;
await assert.rejects(()=>repo.transaction(async()=>{throw Error("write failed")}),/write failed/);
assert.deepEqual(calls.splice(0),["BEGIN","ROLLBACK","discard"]);
console.log("PostgreSQL transaction adapter contract passed");

failCommit=false;failRollback=false;
stored={};
await assert.rejects(()=>repo.transaction(async tx=>{await tx.loadForMutation({},{});return {status:200}}),/INVALID_STORED_DESIGN/);
assert.deepEqual(calls.splice(0),["BEGIN","ROLLBACK","release"]);
stored=initial;
for(const candidate of [{},{...initial,revision:2}]){
 await assert.rejects(()=>repo.transaction(async tx=>{await tx.compareAndSwap(0,candidate);return {status:200}}),/INVALID_DESIGN_CANDIDATE/);
 assert.deepEqual(calls.splice(0),["BEGIN","ROLLBACK","release"]);
}
assert.equal(writes,1);
