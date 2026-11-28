import assert from "node:assert/strict";
import { getTikTokAccess, normalizeTikTokGrant } from "../src/tiktok-token-lifecycle.js";
const now=Date.parse("2026-11-28T12:00:00Z");
const env={TIKTOK_CLIENT_KEY:"fake-key",TIKTOK_CLIENT_SECRET:"fake-secret",SESSION_SECRET:"fake-session"};
const grant={access_token:"new-access",refresh_token:"new-refresh",open_id:"user-1",expires_in:7200,refresh_expires_in:15552000,scope:"user.info.basic",token_type:"Bearer"};
const row={open_id:"user-1",access_token:"enc:old-access",refresh_token:"enc:old-refresh",expires_at:new Date(now-1),refresh_expires_at:new Date(now+86400000),scope:"user.info.basic,video.list"};
const open=v=>typeof v==="string"&&v.startsWith("enc:")?v.slice(4):"";
const seal=v=>"enc:"+v;
const make=({record=row,reply=grant,ok=true,networkError=false,writeError=false}={})=>{
  const queries=[],requests=[];let released=false;
  const client={async query(sql,args){queries.push({sql,args});if(sql.startsWith("select open_id"))return{rows:record?[record]:[]};if(sql.startsWith("update")){if(writeError)throw Error("write failed");return{rowCount:1}}return{}},release(){released=true}};
  const pool={connect:async()=>client};
  const fetchImpl=async(url,options)=>{requests.push({url,options});if(networkError)throw Error("fake-secret");return{ok,json:async()=>reply}};
  return{queries,requests,get released(){return released},run:()=>getTikTokAccess({pool,accountId:"account-1",open,seal,env,fetchImpl,now})};
};
assert(normalizeTikTokGrant(grant,"user-1"));
for(const bad of [{...grant,open_id:"other"},{...grant,refresh_token:""},{...grant,refresh_expires_in:undefined},{...grant,expires_in:-1},{...grant,scope:["video.publish"]},{...grant,token_type:"other"}])
  assert.equal(normalizeTikTokGrant(bad,"user-1"),null);
const refreshed=make();assert.deepEqual(await refreshed.run(),{access:"new-access",scope:"user.info.basic"});
assert.equal(refreshed.requests.length,1);
assert.equal(refreshed.requests[0].url,"https://open.tiktokapis.com/v2/oauth/token/");
assert.equal(refreshed.requests[0].options.redirect,"error");
assert.equal(refreshed.requests[0].options.body.get("refresh_token"),"old-refresh");
assert.equal(refreshed.requests[0].options.body.get("grant_type"),"refresh_token");
assert.equal(refreshed.requests[0].options.body.has("scope"),false);
assert.match(refreshed.queries[2].sql,/where account_id=\$1 for update/);
assert.deepEqual(refreshed.queries[2].args,["account-1"]);
assert.deepEqual(refreshed.queries[3].args,["account-1","enc:new-access","enc:new-refresh",7200,15552000,"user.info.basic"]);
assert.equal(refreshed.queries.at(-1).sql,"COMMIT");assert(refreshed.released);
const fresh=make({record:{...row,expires_at:new Date(now+120000)}});
assert.equal((await fresh.run()).access,"old-access");assert.equal(fresh.requests.length,0);
for(const [options,expected] of [
  [{record:null},"TIKTOK_NOT_CONNECTED"],
  [{record:{...row,refresh_expires_at:new Date(now)}},"TIKTOK_RECONNECT_REQUIRED"],
  [{record:{...row,refresh_expires_at:null}},"TIKTOK_RECONNECT_REQUIRED"],
  [{record:{...row,refresh_token:"corrupt"}},"TIKTOK_RECONNECT_REQUIRED"],
  [{reply:{error:"invalid_grant"},ok:false},"TIKTOK_RECONNECT_REQUIRED"],
  [{reply:{...grant,open_id:"other"}},"TIKTOK_REFRESH_RESPONSE_INVALID"],
  [{reply:{...grant,refresh_token:""}},"TIKTOK_REFRESH_RESPONSE_INVALID"],
  [{networkError:true},"TIKTOK_REFRESH_UNAVAILABLE"]
]){
  const t=make(options);const result=await t.run();assert.equal(result.error,expected);assert(t.released);
  assert(!t.queries.some(q=>q.sql.startsWith("update")));
  assert.doesNotMatch(JSON.stringify(result),/fake-secret|old-refresh|new-access/);
}
const failed=make({writeError:true});assert.equal((await failed.run()).error,"TIKTOK_REFRESH_UNAVAILABLE");
assert.equal(failed.queries.at(-1).sql,"ROLLBACK");assert(failed.released);
console.log("TikTok lifecycle: expiry, rotated tokens, account lock, error isolation and no scope expansion.");
