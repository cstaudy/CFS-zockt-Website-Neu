import assert from "node:assert/strict";
import { syncTwitchConnection, validTwitchValidation, validTwitchRefresh } from "../src/twitch-token-lifecycle.js";
const env={TWITCH_CLIENT_ID:"app",TWITCH_CLIENT_SECRET:"fake-secret",SESSION_SECRET:"fake-session"};
const row={twitch_user_id:"user-1",access_token:"enc:old-access",refresh_token:"enc:old-refresh"};
const meta={client_id:"app",user_id:"user-1",expires_in:3600,scopes:["user:read:email"]};
const grant={access_token:"new-access",refresh_token:"new-refresh",expires_in:3600,token_type:"bearer"};
const user={id:"user-1",login:"test",display_name:"Test",email:"test@example.invalid"};
const response=(status,body)=>({status,ok:status>=200&&status<300,json:async()=>body});
const open=v=>typeof v==="string"&&v.startsWith("enc:")?v.slice(4):"";
const seal=v=>"enc:"+v;
function make({record=row,replies=[],writeError=false}={}) {
  const queries=[],requests=[];let released=false;
  const client={async query(sql,args){queries.push({sql,args});if(sql.startsWith("select twitch_user_id"))return {rows:record?[record]:[]};if(sql.startsWith("update")){if(writeError)throw Error("fake-secret");return {rowCount:1};}return {};},release(){released=true;}};
  const pool={connect:async()=>client};
  const fetchImpl=async(url,options)=>{requests.push({url,options});const next=replies.shift();if(next instanceof Error)throw next;if(!next)throw Error("unexpected HTTP");return next;};
  return {queries,requests,get released(){return released;},run:()=>syncTwitchConnection({pool,accountId:"account-1",open,seal,env,fetchImpl})};
}
assert(validTwitchValidation(meta,"app","user-1"));
assert(!validTwitchValidation({...meta,user_id:"other"},"app","user-1"));
assert(!validTwitchValidation({...meta,client_id:"other"},"app","user-1"));
assert(!validTwitchValidation({...meta,scopes:"user:read:email"},"app","user-1"));
assert(validTwitchRefresh(grant));
assert(!validTwitchRefresh({...grant,refresh_token:""}));
const fresh=make({replies:[response(200,meta),response(200,{data:[user]})]});
assert.equal((await fresh.run()).ok,true);assert.equal(fresh.requests.length,2);
assert.match(fresh.queries[2].sql,/account_id=\$1 for update/);
assert.deepEqual(fresh.queries[2].args,["account-1"]);
assert.equal(fresh.queries.at(-1).sql,"COMMIT");assert(fresh.released);
const rotated=make({replies:[response(401,{}),response(200,grant),response(200,meta),response(200,{data:[user]})]});
const good=await rotated.run();assert.equal(good.ok,true);
assert.doesNotMatch(JSON.stringify(good),/new-access|new-refresh|fake-secret/);
assert.equal(rotated.requests[1].url,"https://id.twitch.tv/oauth2/token");
assert.equal(rotated.requests[1].options.body.get("refresh_token"),"old-refresh");
assert.equal(rotated.requests[1].options.body.has("scope"),false);
assert(rotated.requests.every(r=>r.options.redirect==="error"&&r.options.signal===rotated.requests[0].options.signal));
assert.deepEqual(rotated.queries[3].args,["account-1","enc:new-access","enc:new-refresh",3600,"user:read:email","user-1"]);
const profileFailure=make({replies:[response(401,{}),response(200,grant),response(200,meta),response(503,{})]});
assert.equal((await profileFailure.run()).error,"TWITCH_SYNC_FAILED");
assert.equal(profileFailure.queries.filter(q=>q.sql.startsWith("update")).length,1);
assert.equal(profileFailure.queries.at(-1).sql,"COMMIT");
for(const [options,expected] of [
  [{record:null},"TWITCH_NOT_CONNECTED"],
  [{record:{...row,access_token:"corrupt"}},"TWITCH_RECONNECT_REQUIRED"],
  [{record:{...row,refresh_token:"corrupt"},replies:[response(401,{})]},"TWITCH_RECONNECT_REQUIRED"],
  [{replies:[response(401,{}),response(400,{})]},"TWITCH_RECONNECT_REQUIRED"],
  [{replies:[response(401,{}),response(200,grant),response(200,{...meta,user_id:"other"})]},"TWITCH_RECONNECT_REQUIRED"],
  [{replies:[response(200,{...meta,client_id:"other"})]},"TWITCH_RECONNECT_REQUIRED"],
  [{replies:[response(503,{})]},"TWITCH_VALIDATION_UNAVAILABLE"],
  [{replies:[new Error("fake-secret")]},"TWITCH_SYNC_UNAVAILABLE"]
]){
  const t=make(options);const result=await t.run();assert.equal(result.error,expected);assert(t.released);
  assert(!t.queries.some(q=>q.sql.startsWith("update")));assert.doesNotMatch(JSON.stringify(result),/fake-secret|old-refresh|new-access/);
}
const mismatch=make({replies:[response(200,meta),response(200,{data:[{...user,id:"other"}]})]});
assert.equal((await mismatch.run()).error,"TWITCH_PROFILE_FAILED");assert.equal(mismatch.queries.filter(q=>q.sql.startsWith("update")).length,1);
const badWrite=make({replies:[response(200,meta)],writeError:true});
assert.equal((await badWrite.run()).error,"TWITCH_SYNC_UNAVAILABLE");assert.equal(badWrite.queries.at(-1).sql,"ROLLBACK");assert(badWrite.released);
console.log("Twitch lifecycle: app/user validation, 401-only rotation, serialized account update, profile failure preservation and neutral errors.");
