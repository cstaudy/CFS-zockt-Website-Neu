import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";
import { listScenes } from "./studio-adapter.js";
import { listWidgets } from "./widget-adapter.js";

const MAX_BYTES = 512 * 1024;
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const rowSql = `select id, data, version, updated_at from creator_projects
  where account_id=$1 and kind='stream' and status <> 'archived'
    and (data->>'type'='stream_studio' or not (data ? 'type'))
  order by case when data->>'type'='stream_studio' then 0 else 1 end,
    updated_at desc limit 1`;

function storedConfig(row) {
  if (!row) return {};
  const data = isObject(row.data) ? row.data : {};
  return data.type === "stream_studio" ? (isObject(data.config) ? data.config : {}) : data;
}

export async function getStreamStudioState(req) {
  const account = await requireAccount(req);
  if (!account) return { error:"AUTHENTICATION_REQUIRED", status:401 };
  const pool = getPool();
  const [found,scenes,widgets] = await Promise.all([
    pool.query(rowSql, [account.id]), listScenes(req), listWidgets(req)
  ]);
  const row = found.rows[0];
  return {
    ok:true, config:storedConfig(row), version:row?.version ?? null,
    scenes:scenes.scenes || [], widgets:widgets.widgets || [], registry:widgets.registry || [],
    access:{ plan:account.plan || "free", entitlements:{ max_scenes:scenes.limits?.max_scenes || 50 } },
    multistream:{ max_destinations:1 }, settings:{}
  };
}

export async function saveStreamStudioState(req, body) {
  const account = await requireAccount(req);
  if (!account) return { error:"AUTHENTICATION_REQUIRED", status:401 };
  if (!isObject(body) || !isObject(body.config) ||
      (body.expected_version !== null && body.expected_version !== undefined &&
       (!Number.isSafeInteger(body.expected_version) || body.expected_version < 1))) {
    return { error:"INVALID_STREAM_STUDIO_REQUEST", status:400 };
  }
  const config = body.config;
  if ((config.scene_order !== undefined && (!Array.isArray(config.scene_order) || config.scene_order.length > 100)) ||
      (config.overlay_widget_ids !== undefined && (!Array.isArray(config.overlay_widget_ids) ||
       config.overlay_widget_ids.length > 100))) return { error:"INVALID_STREAM_STUDIO_CONFIG", status:400 };
  const serialized = JSON.stringify({type:"stream_studio",config});
  if (Buffer.byteLength(serialized,"utf8") > MAX_BYTES) return { error:"STREAM_STUDIO_TOO_LARGE", status:413 };
  const pool = getPool(), client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("select id from accounts where id=$1 for update", [account.id]);
    const found = await client.query(rowSql + " for update", [account.id]);
    const row = found.rows[0];
    if (row) {
      if (!Number.isSafeInteger(body.expected_version) || body.expected_version !== row.version) {
        await client.query("ROLLBACK");
        return { error:"STREAM_STUDIO_VERSION_CONFLICT", status:409 };
      }
      const updated = await client.query(
        "update creator_projects set data=$3::jsonb, version=version+1,updated_at=now() where id=$1 and account_id=$2 and kind='stream' and status <> 'archived' and version=$4 returning id,version",
        [row.id,account.id,serialized,row.version]
      );
      if (!updated.rows[0]) { await client.query("ROLLBACK"); return { error:"STREAM_STUDIO_VERSION_CONFLICT", status:409 }; }
      await client.query("COMMIT");
      return { ok:true,config,version:updated.rows[0].version,settings:{},multistream:{max_destinations:1} };
    }
    if (body.expected_version !== null && body.expected_version !== undefined) {
      await client.query("ROLLBACK");
      return { error:"STREAM_STUDIO_VERSION_CONFLICT", status:409 };
    }
    const created = await client.query(
      "insert into creator_projects(account_id,kind,name,data) values($1,'stream','Stream Studio',$2::jsonb) returning version",
      [account.id,serialized]
    );
    await client.query("COMMIT");
    return { ok:true,config,version:created.rows[0].version,settings:{},multistream:{max_destinations:1} };
  } catch(error) { await client.query("ROLLBACK").catch(()=>{}); throw error; }
  finally { client.release(); }
}
