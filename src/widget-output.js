import { getPool } from "./db.js";
import { widgetConfigs } from "./widget-publication.js";
import { twitchStreamForUserId } from "./public-twitch.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Conservative public renderer subset: remote media and chat require separate URL/data policies.
const ALLOWED_ELEMENTS = new Set(["text", "counter", "progress", "shape"]);
const ALLOWED_SETTINGS = new Set(["goal", "manualValue", "offlineBehavior"]);
const safeNumber = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
const safeColor = value => typeof value === "string" && /^(?:#[0-9a-f]{3,8}|transparent|rgba?\([0-9., %]+\))$/i.test(value) ? value : "transparent";
function safeElement(e) {
  const st = e.style && typeof e.style === "object" && !Array.isArray(e.style) ? e.style : {};
  return {
    id: String(e.id ?? "").slice(0, 80), type: e.type, visible: e.visible !== false,
    position: { x: safeNumber(e.position?.x, 0, -4000, 4000), y: safeNumber(e.position?.y, 0, -4000, 4000) },
    size: { width: safeNumber(e.size?.width, 100, 1, 4000), height: safeNumber(e.size?.height, 30, 1, 4000) },
    rotation: safeNumber(e.rotation, 0, -360, 360), opacity: safeNumber(e.opacity, 1, 0, 1), zIndex: safeNumber(e.zIndex, 0, -1000, 1000),
    style: { color: st.color === undefined ? "#ffffff" : safeColor(st.color), backgroundColor: safeColor(st.backgroundColor), fillColor: safeColor(st.fillColor),
      borderColor: safeColor(st.borderColor), fontSize: safeNumber(st.fontSize, 20, 8, 180),
      fontWeight: safeNumber(st.fontWeight, 700, 100, 900), borderRadius: safeNumber(st.borderRadius, 0, 0, 500) },
    data: e.type === "text" ? { text: String(e.data?.text ?? "").slice(0, 1000) }
      : e.type === "counter" ? { format: String(e.data?.format ?? "{{current}}").slice(0, 200) }
      : e.type === "shape" ? { shape: e.data?.shape === "ellipse" ? "ellipse" : "rectangle" } : {}
  };
}

export function publicWidgetPayload(row) {
  if (!row || row.status !== "published") return null;
  const data = row.data || {};
  const { published } = widgetConfigs(data, row.status);
  if (!published || typeof published !== "object" || Array.isArray(published)) return null;
  // Explicit projection: never serialize arbitrary project data, credentials or draft.
  const config = {
    canvas: published.canvas && typeof published.canvas === "object" ? {
      width: safeNumber(published.canvas.width, 620, 1, 4000), height: safeNumber(published.canvas.height, 132, 1, 4000), background: safeColor(published.canvas.background)
    } : {},
    elements: Array.isArray(published.elements)
      ? published.elements.filter(e => e && typeof e === "object" && !Array.isArray(e) && ALLOWED_ELEMENTS.has(e.type)).slice(0, 100).map(safeElement)
      : [],
    outputs: {}, // placement settings require a separate validated schema
    settings: Object.fromEntries(Object.entries(published.settings && typeof published.settings === "object" && !Array.isArray(published.settings) ? published.settings : {}).filter(([key]) => ALLOWED_SETTINGS.has(key)).map(([key, value]) => [key, key === "offlineBehavior" ? (value === "zero" ? "zero" : "hold") : safeNumber(value, 0, 0, 1000000000)]))
  };
  // A timer may use live data only if Twitch is linked to THIS widget's
  // account. Alerts and follower counters have no verified event feed yet.
  const isTimer = published.widgetType === "twitch_live_timer";
  const isLatestFollow = published.widgetType === "twitch_latest_follower";
  const isFollowAlert = published.widgetType === "twitch_follow_alert";
  const isFollow = isLatestFollow || isFollowAlert;
  const isManual = published.widgetType === "manual_counter";
  return { widget: { id: row.id, config, definition: {
    source_kind: isTimer || isFollow ? "live_provider" : isManual ? "manual" : "static",
    mode: isTimer ? "timer" : isFollowAlert ? "alert" : isLatestFollow ? "latest"
      : isManual ? "manual_counter" : "static",
    ...(isTimer ? { provider: "twitch" } : isFollow ? { provider: "twitch_follow" } : {})
  } }, data: { profile: {}, live: {}, bridge: {} } };
}

export function applyTwitchWidgetState(payload, source) {
  if (payload?.widget?.definition?.provider !== "twitch" ||
      payload.widget.definition.mode !== "timer") return payload;
  const validStart = typeof source?.started_at === "string" &&
    Number.isFinite(Date.parse(source.started_at)) &&
    Date.parse(source.started_at) <= Date.now();
  const confirmed = source?.status === "live" && validStart;
  const status = confirmed ? "live" : source?.status === "offline" ? "offline" : "unknown";
  return {
    ...payload,
    data: {
      ...payload.data,
      live: {
        provider: "twitch", status,
        connected: confirmed, stale: !confirmed,
        started_at: confirmed ? new Date(source.started_at).toISOString() : null,
        updated_at: confirmed ? new Date().toISOString() : null
      }
    }
  };
}

// A signed and recorded EventSub notification is the only source of follower
// identities. A Twitch status check or manual test must never forge an alert.
export function applyTwitchFollowWidgetState(payload, signal, now = Date.now()) {
  if (payload?.widget?.definition?.provider !== "twitch_follow") return payload;
  const ready = signal?.status === "enabled";
  const latest = signal?.event;
  const followedAt = Date.parse(latest?.followed_at || "");
  const confirmed = ready && typeof latest?.id === "string" &&
    typeof latest?.follower_name === "string" && latest.follower_name.trim() &&
    Number.isFinite(followedAt) && followedAt <= now + 60000 &&
    followedAt >= now - 30 * 86400000;
  const alertMode = payload.widget.definition.mode === "alert";
  const visible = confirmed && (!alertMode || (followedAt <= now && now - followedAt <= 45000));
  const events = visible ? [{
    id: String(latest.id), event_type: "follow",
    actor_name: latest.follower_name.trim().slice(0, 100),
    created_at: new Date(followedAt).toISOString()
  }] : [];
  return {
    ...payload,
    data: {
      ...payload.data,
      // A Follow event does not prove a Twitch LIVE broadcast.
      live: { provider: "twitch_follow_events", connected: false, stale: true },
      follow: { ready, status: ready ? "ready" : "unavailable" }
    },
    events
  };
}

export async function getPublicWidget(id) {
  if (!UUID.test(String(id))) return { error: "WIDGET_NOT_FOUND", status: 404 };
  const result = await getPool().query(
    "select p.id, p.account_id, p.data, p.status, t.twitch_user_id from creator_projects p left join twitch_connections t on t.account_id=p.account_id where p.id=$1 and p.kind='widget' and p.status='published' limit 1",
    [id]
  );
  const row = result.rows[0];
  const payload = publicWidgetPayload(row);
  if (!payload) return { error: "WIDGET_NOT_FOUND", status: 404 };
  if (payload.widget.definition.provider === "twitch_follow") {
    const follow = await getPool().query(
      `select s.status as subscription_status,e.id,e.follower_name,e.followed_at
       from twitch_follow_subscriptions s
       join twitch_connections c on c.account_id=s.account_id
         and c.twitch_user_id=s.broadcaster_user_id
       left join lateral (
         select id,follower_name,followed_at from twitch_follow_events
         where account_id=s.account_id and broadcaster_user_id=s.broadcaster_user_id
         order by followed_at desc,received_at desc limit 1
       ) e on true
       where s.account_id=$1 and s.broadcaster_user_id=$2 and s.status='enabled'
         and ('moderator:read:followers'=any(regexp_split_to_array(c.scope,'[, ]+'))) limit 1`,
      [row.account_id, row.twitch_user_id || ""]
    );
    const followRow = follow.rows[0];
    return { payload: applyTwitchFollowWidgetState(payload, {
      status: followRow?.subscription_status || "unavailable",
      event: followRow?.id ? followRow : null
    }) };
  }
  if (payload.widget.definition.provider !== "twitch") return { payload };
  // Never fall back to the global channel or to a simulated provider.
  const signal = await twitchStreamForUserId(row?.twitch_user_id);
  return { payload: applyTwitchWidgetState(payload, signal) };
}
