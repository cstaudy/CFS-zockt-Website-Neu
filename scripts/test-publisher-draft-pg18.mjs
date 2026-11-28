import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { persistPublisherDraft, MAX_PUBLISHER_DRAFTS } from "../src/publisher-draft-store.js";

// Explicitly use the exact disposable local CI service, never arbitrary URLs.
const expected="postgresql://cfs_ci:ci_test_only_password@127.0.0.1:5432/cfs_ci";
if (process.env.CFS_CI_DATABASE_ACCEPTANCE!=="yes" || process.env.DATABASE_URL!==expected)
  throw Error("Publisher acceptance requires disposable local CI PostgreSQL");
const schema="publisher_ci_"+randomUUID().replaceAll("-","");
const admin=new pg.Pool({connectionString:expected,ssl:false,max:1});
let pool,created=false;
try {
  await admin.query("create schema "+schema); created=true;
  pool=new pg.Pool({connectionString:expected,ssl:false,max:5,options:"-c search_path="+schema});
  const check=await pool.query("select current_schema() as name");
  assert.equal(check.rows[0].name,schema);
  // Deliberately minimal fixtures, separate from the actual application schema.
  await pool.query("create table accounts (id uuid primary key); create table user_media (id uuid primary key, account_id uuid not null references accounts(id), folder text not null, mime_type text not null, size_bytes bigint not null)");
  await pool.query(await readFile(new URL("./fixtures/publisher-draft-schema.sql",import.meta.url),"utf8"));
  const a=randomUUID(),b=randomUUID(),media=randomUUID(),otherMedia=randomUUID(),badMedia=randomUUID();
  await pool.query("insert into accounts(id) values($1),($2)",[a,b]);
  await pool.query("insert into user_media values($1,$2,'videos','video/mp4',1234),($3,$4,'clips','video/webm',1234),($5,$2,'videos','text/plain',1234)",[media,a,otherMedia,b,badMedia]);
  const body={media_id:media,targets:["tiktok","instagram_reels"],title:"Highlight",description:"Test",captions:true,brand_style:"gaming"};
  const request=randomUUID();
  const both=await Promise.all([persistPublisherDraft(pool,a,request,body),persistPublisherDraft(pool,a,request,{...body,targets:[...body.targets].reverse()})]);
  assert(both.every(x=>x.ok&&x.can_publish===false));
  assert.equal(both.filter(x=>x.created).length,1);
  assert.equal(both[0].request_key,both[1].request_key);
  assert.equal((await pool.query("select count(*)::int as n from publisher_drafts")).rows[0].n,1);
  assert.equal((await pool.query("select count(*)::int as n from publisher_draft_targets")).rows[0].n,2);
  assert.equal((await persistPublisherDraft(pool,a,request,{...body,title:"Changed"})).status,409);
  assert.equal((await persistPublisherDraft(pool,b,request,body)).status,404);
  assert.equal((await persistPublisherDraft(pool,a,randomUUID(),{...body,media_id:badMedia})).status,422);
  assert.equal((await persistPublisherDraft(pool,randomUUID(),request,body)).status,401);
  assert.equal((await persistPublisherDraft(pool,a,request,{...body,publish:true})).status,400);
  const isolated=await persistPublisherDraft(pool,b,request,{...body,media_id:otherMedia});
  assert(isolated.ok);assert.notEqual(isolated.request_key,both[0].request_key);
  await assert.rejects(pool.query("update publisher_draft_targets set state='queued' where request_key=$1",[both[0].request_key]),/check constraint/);
  await assert.rejects(pool.query("update publisher_draft_targets set account_id=$2 where request_key=$1",[both[0].request_key,b]),/foreign key constraint/);
  // Force a target insert to fail after parent insert; neither survives rollback.
  await pool.query("alter table publisher_draft_targets add constraint test_failure check (target <> 'facebook_reels')");
  const failed=await persistPublisherDraft(pool,a,randomUUID(),{...body,targets:["facebook_reels"]});
  assert.equal(failed.status,503);
  assert.equal((await pool.query("select count(*)::int as n from publisher_drafts where account_id=$1",[a])).rows[0].n,1);
  await pool.query("alter table publisher_draft_targets drop constraint test_failure");
  for(let i=1;i<MAX_PUBLISHER_DRAFTS;i++) assert((await persistPublisherDraft(pool,a,randomUUID(),body)).ok);
  assert.equal((await persistPublisherDraft(pool,a,randomUUID(),body)).status,429);
  assert.equal((await persistPublisherDraft(pool,a,request,body)).created,false);
  await pool.query("delete from user_media where id=$1",[media]);
  assert.equal((await persistPublisherDraft(pool,a,request,body)).status,404);
  assert.equal((await pool.query("select count(*)::int as n from publisher_drafts where account_id=$1",[a])).rows[0].n,MAX_PUBLISHER_DRAFTS);
  console.log("Publisher draft PostgreSQL: concurrent replay, ownership, rollback, quota and draft-only constraints passed.");
} finally {
  try {await pool?.end();} finally {
    try {if(created) await admin.query("drop schema "+schema+" cascade");} finally {await admin.end();}
  }
}
