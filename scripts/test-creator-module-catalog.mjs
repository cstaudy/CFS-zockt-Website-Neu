import assert from "node:assert/strict";
import {access,readFile} from "node:fs/promises";
import {buildCreatorCatalog,widgetLimit,MAX_SCENES,MAX_PENDING_EXPORT_JOBS,MAX_STREAM_DESTINATIONS} from "../src/creator-module-catalog.js";
const account={id:"ci-account",plan:"free"};
assert.throws(()=>buildCreatorCatalog(null),/ACCOUNT_REQUIRED/);
for(const [plan,limit] of [["free",3],["creator",25],["pro",100],["unknown",3],[null,3]]){
  const c=buildCreatorCatalog({...account,plan});
  assert.equal(widgetLimit(plan),limit);assert.equal(c.limits.max_widgets,limit);
  assert.equal(c.limits.max_scenes,MAX_SCENES);assert.equal(c.limits.max_pending_export_jobs,MAX_PENDING_EXPORT_JOBS);
  assert.equal(c.limits.max_stream_destinations,1);assert.equal(MAX_STREAM_DESTINATIONS,1);
  assert.equal(c.access.billing_enabled,false);
  assert.equal(c.access.recorded_plan,["free","creator","pro"].includes(plan)?plan:null);
  assert.equal(c.modules.length,new Set(c.modules.map(m=>m.key)).size);
  assert(c.modules.every(m=>m.production_ready===false&&!Object.hasOwn(m,"allowed")&&!Object.hasOwn(m,"minimum_plan")));
  assert(c.modules.filter(m=>m.stage==="planned").every(m=>m.openable===false));
  assert(c.modules.filter(m=>m.stage!=="planned").every(m=>m.openable===true));
  for(const m of c.modules){assert.match(m.href,/^\/pages\/[a-z0-9-]+\.html$/);await access(new URL(".."+m.href,import.meta.url));}
}
const state=buildCreatorCatalog(account,{launcher:{status:"offline",obs_connected:false},platforms:[{provider:"twitch",configured:true,connection:"record_present",token_status:"expired"}]});
assert.equal(state.modules.find(m=>m.key==="launcher").runtime_status,"offline");
assert.equal(state.modules.find(m=>m.key==="twitch").runtime_status,"expired");
assert.equal(state.modules.find(m=>m.key==="obs").runtime_status,"not_confirmed");
assert.equal(state.modules.find(m=>m.key==="tiktok").runtime_status,"unknown");
const dash=await readFile(new URL("../assets/js/page-dashboard.js",import.meta.url),"utf8");
assert(!dash.includes("ERFORDERLICH"));assert(dash.includes("m.openable===true"));assert(dash.includes("moduleData.access?.recorded_plan"));
console.log("Creator module catalog: unique existing routes, distinct navigation/runtime/release status, actual quotas and unknown-plan fallback.");
