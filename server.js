import { createServer } from "node:http";
import { readJson as readJsonBody } from "./src/request-json.js";
import { loginThrottle } from "./src/login-throttle.js";
import { createReadStream } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { closeDatabase, databaseCheck, getPool } from "./src/db.js";
import { currentAccount, isAdminEmail, login, logout, register, cookie, requestPasswordReset, resetPassword, updateProfile, changePassword, listSessions, logoutAll, requestEmailVerification, verifyEmail, exportAccount, deleteAccount } from "./src/auth.js";
import { mailStatus } from "./src/mail.js";
import { mfaStatus, mfaSetup, mfaEnable, mfaDisable, mfaRecovery } from "./src/mfa.js";
import { finishMfaLogin, pendingMfaCookie, clearPendingMfaCookie } from "./src/mfa-login.js";
import { createSupportReport, listSupportReports, updateSupportReport } from "./src/support.js";
import { gameState, gameRuntime, gameRules } from "./src/games.js";
import { modulesState, launcherModuleState, audioModuleState } from "./src/modules.js";
import { publicReviews } from "./src/reviews.js";
import { createProject, deleteProject, listProjects, updateProject, requireAdmin, requireAccount } from "./src/projects.js";
import { createScene, listScenes, updateScene } from "./src/studio-adapter.js";
import { createWidget, getWidget, listWidgets, updateWidget } from "./src/widget-adapter.js";
import { getPublicWidget } from "./src/widget-output.js";
import { listAssets, uploadAsset } from "./src/assets.js";
import { createPackage, listPackages, listShopCatalog, convertBundle } from "./src/packages.js";
import { startTikTok, finishTikTok, tiktokConfigured, getTikTokStatus, disconnectTikTok, syncTikTok, publicTikTokVideos } from "./src/tiktok.js";
import { startTwitch, finishTwitch, twitchConfigured, getTwitchStatus, disconnectTwitch, syncTwitch } from "./src/twitch.js";
import { getPlayStationState, publicPlayStationState, syncPlayStationFromLauncher } from "./src/playstation.js";
import { builderState, saveBundle, renameBundle, deleteBundle } from "./src/universal-builder.js";
import { listDevices, getDeviceLink, confirmDevice, revokeDevice, registerDevice, launcherHeartbeat } from "./src/launcher.js";
import { listToolProjects, getToolProject, saveToolProject, deleteToolProject, listClips, createClip, updateClip, deleteClip, orderClips } from "./src/tool-projects.js";
import { listJobs, createJob, cancelJob, claimJobs, updateLauncherJob } from "./src/tool-jobs.js";
import { listUserMedia, uploadUserMedia, deleteUserMedia } from "./src/user-media.js";
import { listPresets, savePreset, deletePreset } from "./src/creator-presets.js";
import { publicTwitchState, publicTwitchCommunity } from "./src/public-twitch.js";
import { paypalStatus, createPayPalOrder, capturePayPalOrder } from "./src/paypal.js";
import { publicLiveControl } from "./src/public-live.js";
import { creatorSettings } from "./src/creator-settings.js";
import { uploadRoot, persistentUploadsConfigured } from "./src/upload-storage.js";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.env.PORT || 10000);
const host = process.env.HOST || "0.0.0.0";
const startedAt = new Date().toISOString();
let originalDesignCatalogCache = null;
const version = process.env.RENDER_GIT_COMMIT || process.env.APP_VERSION || "local";
const maxBodyBytes = 16 * 1024 * 1024;
const maxJsonBytes = 1024 * 1024;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm"
};

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end(body);
}

async function originalDesignCatalog() {
  if (!originalDesignCatalogCache) {
    originalDesignCatalogCache = JSON.parse(await readFile(join(root, "assets", "data", "original-design-catalog-v32065.json"), "utf8"));
  }
  return originalDesignCatalogCache;
}

function securityHeaders(res) {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "SAMEORIGIN");
  res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
}

function requestId(req) {
  const supplied = req.headers["x-request-id"];
  if (typeof supplied === "string" && /^[a-zA-Z0-9._:-]{1,96}$/.test(supplied)) return supplied;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function requestOriginAllowed(req) {
  // Browser Fetch Metadata is independent of Origin/Referer and blocks
  // cross-site writes even when those optional headers are absent.
  const fetchSite = req.headers["sec-fetch-site"];
  if (typeof fetchSite === "string" && !["same-origin", "none"].includes(fetchSite)) return false;
  const origin = String(req.headers.origin || "").trim();
  // Some clients omit Origin; validate Referer when it is available instead.
  const referer = String(req.headers.referer || "").trim();
  let candidate = origin;
  if (!candidate && referer) {
    try { candidate = new URL(referer).origin; } catch { return false; }
  }
  if (!candidate) return true;
  const configured = String(process.env.APP_BASE_URL || "").trim();
  if (configured) {
    try { return candidate === new URL(configured).origin; } catch { return false; }
  }
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || (req.socket?.encrypted ? "https" : "http");
  return candidate === `${protocol}://${req.headers.host || ""}`;
}

async function readJson(req) {
  return readJsonBody(req, maxJsonBytes);
}

async function readRaw(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > maxBodyBytes * 16) throw Object.assign(new Error("PAYLOAD_TOO_LARGE"), { status: 413 }); chunks.push(chunk); }
  return Buffer.concat(chunks);
}

const publicRootFiles = new Set([
  "index.html", "favicon.ico", "app-icon.png", "cfs-zockt-logo.png",
  "robots.txt", "sitemap.xml", "site.webmanifest", "cfs-studio.webmanifest"
]);
const publicDirectories = new Set(["assets", "pages", "widgets", "games", "auth"]);

function safePath(urlPath) {
  let requested;
  try { requested = decodeURIComponent(urlPath === "/" ? "/index.html" : urlPath); }
  catch { return null; }
  if (!requested.startsWith("/") || requested.includes("\\") || requested.includes("\0")) return null;
  if (requested === "/.well-known/security.txt") return resolve(root, ".well-known", "security.txt");
  if (requested === "/config/monetization.json") return resolve(root, "config", "monetization.json");
  const segments = requested.slice(1).split("/");
  if (segments.some(segment => !segment || segment === "." || segment === ".." || segment.startsWith("."))) return null;
  if (segments.length === 1 ? !publicRootFiles.has(segments[0]) : !publicDirectories.has(segments[0])) return null;
  if (segments[0] === "assets" && segments[1] === "uploads") {
    if (segments.length < 3) return null;
    const uploadedFile = resolve(uploadRoot, ...segments.slice(2));
    return uploadedFile.startsWith(uploadRoot + sep) ? uploadedFile : null;
  }
  const candidate = resolve(root, ...segments);
  return candidate.startsWith(root + sep) ? candidate : null;
}

async function serveStatic(req, res) {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const filePath = safePath(pathname);
  if (!filePath) return json(res, 403, { error: "FORBIDDEN", message: "Ungültiger Pfad." });
  const isUpload = filePath.startsWith(uploadRoot + sep);
  if (isUpload) {
    const storagePath = filePath.slice(uploadRoot.length + 1).split(sep).join("/");
    const pool = getPool();
    // Public widget assets are a deliberate exception, but only for an image
    // referenced as an exact string in a published project of the SAME owner.
    // Never expose user_media or another creator's unpublished files.
    const published = pool ? await pool.query(
      `select exists(
        select 1 from creator_assets asset
        join creator_projects project on project.account_id=asset.account_id
        where asset.storage_path=$1
          and project.status='published'
          and project.kind in ('widget','scene')
          and jsonb_path_exists(
            case when project.kind='widget'
              then coalesce(project.data->'published_config', project.data->'config', '{}'::jsonb)
              else project.data end,
            '$.** ? (@ == $url)'::jsonpath,
            jsonb_build_object('url', $2::text)
          )
      ) as allowed`,
      [storagePath, `/assets/uploads/${storagePath}`]
    ) : { rows: [{ allowed: false }] };
    const publicWidgetAsset = published.rows[0]?.allowed === true;
    if (!publicWidgetAsset) {
      const account = await currentAccount(req);
      if (!account) return json(res, 401, { error: "AUTHENTICATION_REQUIRED" });
      const owned = await pool.query(
        `select exists(
          select 1 from creator_assets where account_id=$1 and storage_path=$2
          union all
          select 1 from user_media where account_id=$1 and storage_path=$2
        ) as allowed`,
        [account.id, storagePath]
      );
      if (!owned.rows[0]?.allowed) return json(res, 404, { error: "NOT_FOUND" });
    }
  }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return json(res, 404, { error: "NOT_FOUND" });
    const isPrivateWorkspacePage = pathname.startsWith("/pages/") && /(?:dashboard|account|creator-suite|widget-studio|scene-studio|stream-studio|universal-builder|settings|integrations|launcher|cut-studio|audio-studio|stream-maker|editor)\.html$/.test(pathname);
    const isWidgetOutputPage = pathname === "/widgets/output.html";
    if (isPrivateWorkspacePage || isWidgetOutputPage) res.setHeader("referrer-policy", "no-referrer");
    res.writeHead(200, {
      "content-type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
      "cache-control": isUpload || isPrivateWorkspacePage || isWidgetOutputPage ? "private, no-store" : extname(filePath) === ".html" ? "no-cache" : "public, max-age=3600"
    });
    if (req.method === "HEAD") return res.end();
    createReadStream(filePath).pipe(res);
  } catch {
    json(res, 404, { error: "NOT_FOUND", message: "Die angeforderte Ressource wurde nicht gefunden." });
  }
}

async function handle(req, res) {
  securityHeaders(res);
  const id = requestId(req);
  res.setHeader("x-request-id", id);
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const method = req.method || "GET";

  if (method === "OPTIONS") {
    res.writeHead(204, { "access-control-allow-methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS", "access-control-allow-headers": "content-type,x-csrf-token" });
    return res.end();
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && !requestOriginAllowed(req)) {
    return json(res, 403, { error: "ORIGIN_NOT_ALLOWED", message: "Die Anfrage stammt nicht von dieser Website." });
  }

  const publicWidgetMatch = url.pathname.match(/^\/api\/public\/widgets\/([^/]+)$/);
  if (publicWidgetMatch && method === "GET") {
    const result = await getPublicWidget(publicWidgetMatch[1]);
    return result.error ? json(res, result.status, { error: result.error }) : json(res, 200, result.payload);
  }

  if (url.pathname === "/api/health" && ["GET", "HEAD"].includes(method)) {
    return json(res, 200, { ok: true, service: "cfs-zockt", status: "healthy", started_at: startedAt, uptime_seconds: Math.floor(process.uptime()), version });
  }
  if (url.pathname === "/api/integrations/status" && ["GET", "HEAD"].includes(method)) {
    return json(res, 200, { ok: true, integrations: { database: Boolean(process.env.DATABASE_URL), session_secret: Boolean(process.env.SESSION_SECRET), twitch: twitchConfigured(), tiktok: tiktokConfigured(), launcher: Boolean(process.env.LAUNCHER_BRIDGE_SECRET), paypal: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET), playstation: Boolean(process.env.PSN_PROVIDER && process.env.PSN_CLIENT_ID), storage: Boolean(process.env.ASSET_STORAGE_BUCKET) || (process.env.ASSET_STORAGE_PROVIDER || "local") === "local", persistent_upload_path: persistentUploadsConfigured }, note: "Nur Konfigurationsstatus; keine Secrets werden ausgegeben. Ein Upload-Pfad ist erst mit persistentem Mount dauerhaft." });
  }
  if (url.pathname === "/api/creator/integration-capabilities" && method === "GET") {
    const account=await currentAccount(req); if(!account)return json(res,401,{error:"AUTHENTICATION_REQUIRED"});
    return json(res,200,{ok:true,integrations:{oauth:[{provider:"tiktok",configured:tiktokConfigured(),oauth_implemented:true,configuration:{client_id:Boolean(process.env.TIKTOK_CLIENT_KEY),client_secret:Boolean(process.env.TIKTOK_CLIENT_SECRET),redirect_uri:Boolean(process.env.TIKTOK_REDIRECT_URI||process.env.APP_BASE_URL),session_secret:Boolean(process.env.SESSION_SECRET)}},{provider:"twitch",configured:twitchConfigured(),oauth_implemented:true,configuration:{client_id:Boolean(process.env.TWITCH_CLIENT_ID),client_secret:Boolean(process.env.TWITCH_CLIENT_SECRET),redirect_uri:Boolean(process.env.TWITCH_REDIRECT_URI||process.env.APP_BASE_URL),session_secret:Boolean(process.env.SESSION_SECRET)}}],obs_websocket:Boolean(process.env.OBS_WEBSOCKET_URL||process.env.OBS_WS_URL),launcher:Boolean(process.env.LAUNCHER_BRIDGE_SECRET),paypal:paypalStatus(),playstation:Boolean(process.env.PSN_PROVIDER&&process.env.PSN_CLIENT_ID)}});
  }

  if (url.pathname === "/api/integrations/tiktok/start" && method === "GET") {
    const result = await startTikTok(req, res);
    if (result?.error) return json(res, result.status || 500, { error: result.error });
    return;
  }
  if (["/api/auth/tiktok/callback", "/auth/tiktok/callback"].includes(url.pathname) && method === "GET") { const result=await finishTikTok(req,res,url); if(result?.error)return json(res,result.status,{error:result.error,message:result.detail}); return; }
  if (url.pathname === "/api/integrations/twitch/start" && method === "GET") {
    const result = await startTwitch(req, res);
    if (result?.error) return json(res, result.status || 500, { error: result.error });
    return;
  }
  if (["/api/auth/twitch/callback", "/auth/twitch/callback"].includes(url.pathname) && method === "GET") { const result=await finishTwitch(req,res,url); if(result?.error)return json(res,result.status,{error:result.error}); return; }
  if (url.pathname === "/api/creator/playstation" && method === "GET") { const result=await getPlayStationState(req); return result.error ? json(res,result.status,{error:result.error}) : json(res,200,result); }
  if (url.pathname === "/api/creator/tiktok/status" && method === "GET") { const result=await getTikTokStatus(req); return result.error ? json(res,result.status,{error:result.error}) : json(res,200,result); }
  if (url.pathname === "/api/creator/tiktok/disconnect" && method === "POST") { const result=await disconnectTikTok(req); return result.error ? json(res,result.status,{error:result.error}) : json(res,200,result); }
  if (url.pathname === "/api/creator/tiktok/sync" && method === "POST") { const result=await syncTikTok(req); return result.error ? json(res,result.status,{error:result.error}) : json(res,200,result); }
  if (url.pathname === "/api/creator/twitch/status" && method === "GET") { const result=await getTwitchStatus(req); return result.error ? json(res,result.status,{error:result.error}) : json(res,200,result); }
  if (url.pathname === "/api/creator/twitch/disconnect" && method === "POST") { const result=await disconnectTwitch(req); return result.error ? json(res,result.status,{error:result.error}) : json(res,200,result); }
  if (url.pathname === "/api/creator/twitch/sync" && method === "POST") { const result=await syncTwitch(req); return result.error ? json(res,result.status,{error:result.error}) : json(res,200,result); }

  if (url.pathname === "/api/ready" && ["GET", "HEAD"].includes(method)) {
    const database = await databaseCheck();
    const ready = database.connected;
    return json(res, ready ? 200 : 503, { ok: ready, status: ready ? "ready" : database.configured ? "database_unavailable" : "waiting_for_database", checks: { configuration: true, database }, version });
  }

  if (url.pathname === "/api/public/status" && ["GET", "HEAD"].includes(method)) {
    // Public status reports real account-store readiness, not a synthetic green light.
    // Do not expose database connection strings or internal errors to visitors.
    const database = await databaseCheck();
    const accountsReady = database.connected === true;
    return json(res, 200, {
      ok: true,
      service: "cfs-zockt",
      environment: process.env.NODE_ENV || "production",
      api_version: "1",
      generated_at: new Date().toISOString(),
      status: accountsReady ? "online" : "degraded",
      message: accountsReady
        ? "Website und Datenbank sind erreichbar."
        : "Die Website ist erreichbar. Anmeldung und Creator-Speicherung sind derzeit möglicherweise eingeschränkt."
    });
  }

  if (url.pathname === "/api/public/live-session" && ["GET", "HEAD"].includes(method)) {
    return json(res, 200, await publicTwitchState());
  }

  if (url.pathname === "/api/public/community-stats" && ["GET", "HEAD"].includes(method)) {
    return json(res, 200, {...await publicTwitchCommunity(),tiktok_followers:null,discord_members:null,message:"Nur bestätigte Providerdaten werden angezeigt."});
  }

  if (url.pathname === "/api/public/creator-state" && ["GET", "HEAD"].includes(method)) {
    return json(res, 200, { ok: true, available: false, online: false, status: "unavailable", source: "fallback" });
  }

  if (["/api/public/games", "/api/public/recent-games"].includes(url.pathname) && ["GET", "HEAD"].includes(method)) {
    return json(res, 200, { ok: true, games: [], recent_games: [], source: "fallback", message: "Noch keine Spieldaten verfügbar." });
  }
  if (url.pathname === "/api/public/playstation" && ["GET", "HEAD"].includes(method)) {
    return json(res, 200, await publicPlayStationState());
  }

  if (url.pathname === "/api/account/me" && ["GET", "HEAD"].includes(method)) {
    const account = await currentAccount(req);
    const view = account ? { ...account, admin: Boolean(account.email_verified_at) && isAdminEmail(account.email), role: Boolean(account.email_verified_at) && isAdminEmail(account.email) ? "admin" : "creator", email_verified: Boolean(account.email_verified_at) } : null;
    return json(res, 200, { authenticated: Boolean(view), account: view });
  }
  if(url.pathname==="/api/account/mail/status"&&method==="GET")return json(res,200,mailStatus());
  if(url.pathname==="/api/account/password/forgot"&&method==="POST"){const body=await readJson(req);return json(res,200,await requestPasswordReset(body.email));}
  if(url.pathname==="/api/account/password/reset"&&method==="POST"){const body=await readJson(req),result=await resetPassword(String(body.token||""),body.new_password);return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/account/email/verification/request"&&method==="POST")return json(res,200,await requestEmailVerification((await readJson(req)).email));
  if(url.pathname==="/api/account/email/verify"&&method==="POST"){const result=await verifyEmail(String((await readJson(req)).token||""));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/account/profile"&&method==="PATCH"){const result=await updateProfile(req,await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/account/password"&&method==="POST"){const result=await changePassword(req,await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/account/sessions"&&method==="GET"){const result=await listSessions(req);return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/account/security-events"&&method==="GET"){const account=await currentAccount(req);if(!account)return json(res,401,{error:"AUTHENTICATION_REQUIRED"});const events=(await getPool().query("select event_type,created_at from account_security_events where account_id=$1 order by created_at desc limit 100",[account.id])).rows;return json(res,200,{ok:true,events,summary:{last_login_at:null,suspicious_mfa_failures_30d:events.filter(x=>x.event_type==='mfa_failed').length}});}
  if(url.pathname==="/api/account/logout-all"&&method==="POST"){const result=await logoutAll(req);if(result.error)return json(res,result.status,{error:result.error});res.setHeader("set-cookie",cookie("cfs_session","",0));return json(res,200,result);}
  if(url.pathname==="/api/account/export"&&method==="POST"){const body=await readJson(req),result=await exportAccount(req,body.password);return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/account"&&method==="DELETE"){const result=await deleteAccount(req,await readJson(req));if(result.error)return json(res,result.status,{error:result.error});res.setHeader("set-cookie",cookie("cfs_session","",0));return json(res,200,result);}
  if(url.pathname==="/api/account/mfa"&&method==="GET"){const result=await mfaStatus(req);return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/account/mfa/setup"&&method==="POST"){const result=await mfaSetup(req,await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/account/mfa/enable"&&method==="POST"){const result=await mfaEnable(req,await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/account/mfa/disable"&&method==="POST"){const result=await mfaDisable(req,await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/account/mfa/recovery-codes"&&method==="POST"){const result=await mfaRecovery(req,await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/account/passkeys"&&method==="GET"){const account=await currentAccount(req);if(!account)return json(res,401,{error:"AUTHENTICATION_REQUIRED"});return json(res,200,{ok:true,available:false,passkeys:[],message:"Passkeys sind für diese Installation noch nicht aktiviert."});}
  if(url.pathname.startsWith("/api/account/passkeys/")&&(method==="POST"||method==="DELETE")){return json(res,503,{error:"PASSKEYS_NOT_CONFIGURED",message:"WebAuthn/Passkeys sind für diese Installation noch nicht aktiviert."});}
  if(url.pathname.startsWith("/api/account/mfa/passkey/")&&method==="POST"){return json(res,503,{error:"PASSKEYS_NOT_CONFIGURED",message:"WebAuthn/Passkeys sind für diese Installation noch nicht aktiviert."});}
  if(url.pathname==="/api/account/mfa/login"&&method==="POST"){
    const result=await finishMfaLogin(req,await readJson(req));
    if(result.error)return json(res,result.status,{error:result.error});
    res.setHeader("set-cookie",[cookie("cfs_session",result.token,result.maxAge),clearPendingMfaCookie()]);
    return json(res,200,{authenticated:true,account:result.account,recovery_code_used:result.recovery_code_used});
  }
  if(url.pathname==="/api/public/support/report"&&method==="POST"){const result=await createSupportReport(await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,201,result);}
  if(url.pathname==="/api/public/reviews/merch"&&(method==="GET"||method==="POST")){const result=await publicReviews(req,method==="POST"?await readJson(req):null);return result.error?json(res,result.status,{error:result.error}):json(res,method==="POST"?201:200,result);}
  if(url.pathname==="/api/public/tiktok/videos"&&method==="GET")return json(res,200,await publicTikTokVideos());
  if(url.pathname==="/api/original-designs/catalog"&&method==="GET"){try{return json(res,200,{ok:true,...await originalDesignCatalog()});}catch(error){return json(res,503,{error:"ORIGINAL_DESIGN_CATALOG_UNAVAILABLE",message:"Der statische Originaldesign-Katalog konnte nicht geladen werden."});}}
  if(url.pathname==="/api/original-designs/status"&&method==="GET"){const catalog=await originalDesignCatalog();return json(res,200,{ok:true,available:true,version:catalog.version,designs:Array.isArray(catalog.designs)?catalog.designs.length:0,colors:Array.isArray(catalog.designs)?catalog.designs.reduce((n,d)=>n+(Array.isArray(d.colors)?d.colors.length:0),0):0});}
  const designPreview=url.pathname.match(/^\/api\/original-designs\/preview\/([a-z0-9-]+)\/([a-z0-9-]+)\.(?:jpg|webp)$/i);
  if(designPreview&&method==="GET"){const catalog=await originalDesignCatalog(),design=catalog.designs?.find(x=>x.id===designPreview[1]),color=design?.colors?.find(x=>x.id===designPreview[2]);if(!design||!color)return json(res,404,{error:"DESIGN_PREVIEW_NOT_FOUND"});res.writeHead(302,{location:`/assets/img/cfs-original-design-previews/${design.id}/${color.id}.webp`,"cache-control":"public, max-age=3600"});return res.end();}
  if(url.pathname.startsWith("/api/original-designs/package/")&&method==="GET")return json(res,503,{error:"DESIGN_PACKAGE_NOT_CONFIGURED",message:"Die statischen Vorschauen sind verfügbar; Download-Pakete werden nach dem Storage-Produktvertrag aktiviert."});
  if(url.pathname==="/api/creator/modules"&&method==="GET"){const result=await modulesState(req);return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/creator/modules/launcher/state"&&method==="GET"){const result=await launcherModuleState(req);return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/creator/modules/audio_studio/state"&&(method==="GET"||method==="PUT")){const result=await audioModuleState(req,method==="PUT"?await readJson(req):null);return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/creator/stream-ready"&&method==="GET"){const account=await currentAccount(req);if(!account)return json(res,401,{error:"AUTHENTICATION_REQUIRED"});return json(res,200,{ok:true,ready:false,status:"setup_required",checks:{twitch:twitchConfigured(),tiktok:tiktokConfigured(),launcher:Boolean(process.env.LAUNCHER_BRIDGE_SECRET),obs:false},message:"Provider und Launcher prüfen, bevor live gestartet wird."});}
  if(url.pathname==="/api/creator/technical-status"&&method==="GET"){const account=await currentAccount(req);if(!account)return json(res,401,{error:"AUTHENTICATION_REQUIRED"});const database=Boolean(process.env.DATABASE_URL),oauth=twitchConfigured()||tiktokConfigured();return json(res,200,{ok:true,service:"cfs-zockt",status:database?"operational_with_setup_requirements":"database_required",checks:{database,oauth,mail:mailStatus().email_verification_available,paypal:paypalStatus().configured,launcher:Boolean(process.env.LAUNCHER_BRIDGE_SECRET)}});}
  if(url.pathname==="/api/creator/settings"&&(method==="GET"||method==="PUT")){const result=await creatorSettings(req,method==="PUT"?await readJson(req):null);return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/creator/security-readiness"&&method==="GET"){const account=await currentAccount(req);if(!account)return json(res,401,{error:"AUTHENTICATION_REQUIRED"});const sessionSecret=Boolean(process.env.SESSION_SECRET);return json(res,200,{ok:true,ready:sessionSecret,security:{session_secret:sessionSecret,csrf_origin_check:true,headers:true,mfa_available:true},message:sessionSecret?"Sicherheits-Baseline aktiv; Provider- und Browser-Acceptance bleiben separat.":"SESSION_SECRET fehlt; OAuth ist gesperrt."});}
  if(url.pathname==="/api/creator/suite-readiness"&&method==="GET"){const account=await currentAccount(req);if(!account)return json(res,401,{error:"AUTHENTICATION_REQUIRED"});const database=Boolean(process.env.DATABASE_URL),storage=persistentUploadsConfigured;return json(res,200,{ok:true,ready:database,checks:{database,account:true,creator_tools:true,persistent_uploads:storage},message:database?storage?"Creator-Suite-Kern und persistente Uploads sind konfiguriert.":"Creator-Suite-Kern ist bereit; Uploads sind ohne Persistent Disk nicht dauerhaft.":"Datenbank fehlt; Creator-Suite ist nicht bereit."});}
  if(url.pathname==="/api/creator/release-readiness"&&method==="GET"){const account=await currentAccount(req);if(!account)return json(res,401,{error:"AUTHENTICATION_REQUIRED"});return json(res,200,{ok:true,release:{local_ready:true,production_deploy_required:true,provider_acceptance_pending:true},message:"Code und Datenbank sind vorbereitet; Render-Deployment und externe Acceptance stehen aus."});}
  if(url.pathname==="/api/plans/catalog"&&method==="GET")return json(res,200,{ok:true,configured:false,plans:[],message:"Kein kostenpflichtiger Produktkatalog freigegeben. Statische Planübersicht bleibt verfügbar."});
  if(url.pathname==="/api/creator/billing/status"&&method==="GET"){const account=await currentAccount(req);if(!account)return json(res,401,{error:"AUTHENTICATION_REQUIRED"});return json(res,200,{ok:true,configured:false,subscription:{plan:account.plan||"free",access_active:true},paypal:paypalStatus(),message:"Billing ist vorbereitet, aber kostenpflichtige Planwechsel sind noch gesperrt."});}
  if((url.pathname==="/api/creator/billing/checkout"||url.pathname==="/api/creator/billing/portal")&&method==="POST"){const account=await currentAccount(req);if(!account)return json(res,401,{error:"AUTHENTICATION_REQUIRED"});return json(res,503,{error:"BILLING_NOT_CONFIGURED",message:"Kostenpflichtige Billing-Funktionen sind bis zur Produkt- und Providerfreigabe gesperrt."});}
  if(url.pathname==="/api/creator/public-live-control"&&(method==="GET"||method==="POST")){const result=await publicLiveControl(req,method==="POST"?await readJson(req):null);return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/creator/stream-studio/runtime"&&method==="GET"){const account=await currentAccount(req);if(!account)return json(res,401,{error:"AUTHENTICATION_REQUIRED"});const devices=(await getPool().query("select machine_name,client_version,status,obs_connected,obs_version,last_seen_at from launcher_devices where account_id=$1 and status='active' order by updated_at desc",[account.id])).rows;const d=devices[0]||null;return json(res,200,{ok:true,runtime:{connected:Boolean(d),launcher:d?{machine_name:d.machine_name,client_version:d.client_version}:null,obs_connected:Boolean(d?.obs_connected),status:d?.obs_connected?"ready":d?"launcher_only":"offline"}});}
  if(url.pathname==="/api/creator/universal-builder/live-readiness"&&method==="GET"){const account=await currentAccount(req);if(!account)return json(res,401,{error:"AUTHENTICATION_REQUIRED"});return json(res,200,{ok:true,ready:false,providers:{tiktok:tiktokConfigured(),twitch:twitchConfigured()},message:"Live-Daten erscheinen nach Provider-Verbindung und Veröffentlichung des Widgets."});}
  if(url.pathname==="/api/creator/stream-maker-shop"&&method==="GET"){const account=await currentAccount(req);if(!account)return json(res,401,{error:"AUTHENTICATION_REQUIRED"});return json(res,200,{ok:true,enabled:false,templates:[],message:"Noch keine veröffentlichten Maker-Vorlagen vorhanden."});}
  if(url.pathname.startsWith("/api/creator/cfson/")&&method==="GET"){const account=await currentAccount(req);if(!account)return json(res,401,{error:"AUTHENTICATION_REQUIRED"});if(url.pathname.endsWith("/status"))return json(res,200,{ok:true,mode:"private_alpha",integration:"ui_preview_only",version:"Alpha",enabled:false,message:"CFSON ist nur als lokaler, lesender Diagnosetest vorbereitet."});return json(res,503,{ok:false,state:"disabled",error:"CFSON_NOT_CONNECTED",liveIngestDisabled:true,message:"Kein CFSON-Dienst verbunden. Es werden keine Konto-, Medien- oder Live-Daten freigegeben."});}
  if(url.pathname.startsWith("/api/creator/cfs-ai/")&&(method==="GET"||method==="POST")){const account=await currentAccount(req);if(!account)return json(res,401,{error:"AUTHENTICATION_REQUIRED"});const enabled=Boolean(process.env.CFS_AI_ENABLED&&process.env.CFS_AI_BRIDGE_TOKEN);if(url.pathname.endsWith("/status"))return json(res,200,{ok:true,enabled,configured:enabled,provider:null,status:enabled?"configured":"disabled",message:enabled?"AI-Bridge konfiguriert.":"CFS-AI ist aktuell nicht konfiguriert."});if(url.pathname.endsWith("/bridge"))return json(res,200,{ok:true,enabled,connected:false,provider:null,message:"Keine AI-Bridge verbunden."});if(url.pathname.endsWith("/knowledge"))return json(res,200,{ok:true,enabled,items:[]});if(url.pathname.endsWith("/roadmap"))return json(res,200,{ok:true,enabled,items:[]});if(url.pathname.endsWith("/proposals"))return json(res,200,{ok:true,enabled,proposals:[]});return json(res,enabled?501:503,{error:enabled?"AI_BRIDGE_NOT_IMPLEMENTED":"AI_NOT_CONFIGURED",message:"Dieser optionale AI-Bereich ist derzeit deaktiviert."});}
  if(url.pathname==="/api/public/launcher/releases"&&method==="GET"){return json(res,200,{ok:true,channel:String(url.searchParams.get("channel")||"stable"),build_target_version:process.env.LAUNCHER_VERSION||null,release:null,message:"Noch kein öffentlicher Launcher-Download hinterlegt."});}
  if(url.pathname==="/api/creator/modules/games/state"&&method==="GET"){const result=await gameState(req);return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/creator/modules/games/state"&&method==="PUT"){const result=await gameState(req,await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/creator/games/runtime"&&method==="GET"){const result=await gameRuntime(req);return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  const gameAction=url.pathname.match(/^\/api\/creator\/games\/runtime\/(start|stop|reset|score)$/);if(gameAction&&method==="POST"){const result=await gameRuntime(req,gameAction[1],await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/creator/games/rules"&&(method==="GET"||method==="POST")){const result=await gameRules(req,method,null,method==="POST"?await readJson(req):{});return result.error?json(res,result.status,{error:result.error}):json(res,method==="POST"?201:200,result);}
  const gameRule=url.pathname.match(/^\/api\/creator\/games\/rules\/([^/]+)$/);if(gameRule&&(method==="PUT"||method==="DELETE")){const result=await gameRules(req,method,decodeURIComponent(gameRule[1]),method==="PUT"?await readJson(req):{});return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/admin/creator-suite/support-reports"&&method==="GET"){const result=await listSupportReports(req,url);return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/admin/control-center/summary"&&method==="GET"){const admin=await requireAdmin(req);if(admin.error)return json(res,admin.status,{error:admin.error});const pool=getPool(),counts=await Promise.all([pool.query("select count(*)::int as n from accounts"),pool.query("select count(*)::int as n from creator_projects where status<>'archived'"),pool.query("select count(*)::int as n from support_reports where status='new'")]);return json(res,200,{ok:true,summary:{accounts:counts[0].rows[0].n,projects:counts[1].rows[0].n,open_support:counts[2].rows[0].n}});}
  if(url.pathname==="/api/admin/store/checkout-readiness"&&method==="GET"){const admin=await requireAdmin(req);if(admin.error)return json(res,admin.status,{error:admin.error});const paypal=paypalStatus(),reasons=[];if(!paypal.configured)reasons.push("PayPal-Katalog oder PayPal-Variablen fehlen.");reasons.push("Produktfreigabe und Zahlungsstatus müssen vor kostenpflichtigen Käufen geprüft werden.");return json(res,200,{ok:true,paid_checkout_enabled:false,paid_preview_products:0,stripe_subscription_mode:"not_configured",paypal, reasons});}
  if(url.pathname==="/api/admin/creator-suite/audit-events"&&method==="GET"){const admin=await requireAdmin(req);if(admin.error)return json(res,admin.status,{error:admin.error});const rows=(await getPool().query("select id,event_name,account_id,metadata,created_at from audit_events order by created_at desc limit 200")).rows;return json(res,200,{ok:true,events:rows});}
  if(url.pathname==="/api/admin/creator-suite/elevation"&&(method==="GET"||method==="POST"||method==="DELETE")){const admin=await requireAdmin(req);if(admin.error)return json(res,admin.status,{error:admin.error});return json(res,200,{ok:true,active:false,available:false,message:"Admin-Elevation ist für diese Installation noch nicht aktiviert."});}
  if(url.pathname==="/api/admin/store/bundle-factory"&&method==="GET"){const admin=await requireAdmin(req);if(admin.error)return json(res,admin.status,{error:admin.error});return json(res,200,{ok:true,enabled:false,assets:[],products:[],collections:[],message:"Bundle-Factory ist noch nicht aktiviert."});}
  if(url.pathname.startsWith("/api/admin/store/")&&method!=="GET"){const admin=await requireAdmin(req);if(admin.error)return json(res,admin.status,{error:admin.error});return json(res,503,{error:"SHOP_FACTORY_NOT_CONFIGURED",message:"Shop-/Bundle-Factory ist für diese Installation noch nicht aktiviert."});}
  const supportReport=url.pathname.match(/^\/api\/admin\/creator-suite\/support-reports\/([^/]+)$/);
  if(supportReport&&method==="PUT"){const result=await updateSupportReport(req,decodeURIComponent(supportReport[1]),await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}

  if (url.pathname === "/api/creator/launcher/devices" && method === "GET") { const result=await listDevices(req); return result.error?json(res,result.status,{error:result.error}):json(res,200,result); }
  const deviceMatch=url.pathname.match(/^\/api\/creator\/launcher\/devices\/([^/]+)$/);
  if(deviceMatch&&method==="DELETE"){const result=await revokeDevice(req,decodeURIComponent(deviceMatch[1]));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  const linkMatch=url.pathname.match(/^\/api\/creator\/launcher\/device-link\/([^/]+)$/);
  if(linkMatch&&method==="GET"){const result=await getDeviceLink(req,decodeURIComponent(linkMatch[1]));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/creator/launcher/device-link/confirm"&&method==="POST"){const result=await confirmDevice(req,await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/creator/shop/paypal/orders"&&method==="POST"){const result=await createPayPalOrder(req,await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,201,result);}
  const paypalOrder=url.pathname.match(/^\/api\/creator\/shop\/paypal\/orders\/([^/]+)\/capture$/);
  if(paypalOrder&&method==="POST"){const result=await capturePayPalOrder(req,decodeURIComponent(paypalOrder[1]));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}

  if(url.pathname==="/api/creator/stream-studio"&&method==="GET"){const result=await listToolProjects(req,"stream");return result.error?json(res,result.status,{error:result.error}):json(res,200,{...result,config:result.projects[0]?.data||{}});}
  if(url.pathname==="/api/creator/stream-studio"&&method==="PUT"){const result=await saveToolProject(req,"stream",null,await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,200,{...result,config:result.project.data});}
  if(url.pathname==="/api/creator/cut-studio/projects"&&method==="GET"){const result=await listToolProjects(req,"cut");return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/creator/cut-studio/projects"&&method==="POST"){const result=await saveToolProject(req,"cut",null,await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,201,result);}
  const clipList=url.pathname.match(/^\/api\/creator\/cut-studio\/projects\/([^/]+)\/clips$/);
  if(clipList&&method==="GET"){const result=await listClips(req,decodeURIComponent(clipList[1]));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(clipList&&method==="POST"){const result=await createClip(req,decodeURIComponent(clipList[1]),await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,201,result);}
  const clipOrder=url.pathname.match(/^\/api\/creator\/cut-studio\/projects\/([^/]+)\/clips\/order$/);
  if(clipOrder&&method==="PUT"){const result=await orderClips(req,decodeURIComponent(clipOrder[1]),await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  const clipItem=url.pathname.match(/^\/api\/creator\/cut-studio\/projects\/([^/]+)\/clips\/([^/]+)$/);
  if(clipItem){const projectId=decodeURIComponent(clipItem[1]),clipId=decodeURIComponent(clipItem[2]);const result=method==="PUT"?await updateClip(req,projectId,clipId,await readJson(req)):method==="DELETE"?await deleteClip(req,projectId,clipId):{error:"METHOD_NOT_ALLOWED",status:405};return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  const toolProject=url.pathname.match(/^\/api\/creator\/(stream-studio|cut-studio)\/projects\/([^/]+)$/);
  if(toolProject){const kind=toolProject[1]==="stream-studio"?"stream":"cut",id=decodeURIComponent(toolProject[2]);const result=method==="GET"?await getToolProject(req,kind,id):method==="PUT"?await saveToolProject(req,kind,id,await readJson(req)):method==="DELETE"?await deleteToolProject(req,kind,id):{error:"METHOD_NOT_ALLOWED",status:405};return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/creator/cut-studio/jobs"&&method==="GET"){const result=await listJobs(req);return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  const mediaList=url.pathname.match(/^\/api\/creator\/media\/(videos|clips)$/);
  if(mediaList&&method==="GET"){const result=await listUserMedia(req,mediaList[1]);return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(mediaList&&method==="POST"){
    if (!await requireAccount(req)) return json(res,401,{error:"AUTHENTICATION_REQUIRED"});
    const result=await uploadUserMedia(req,await readRaw(req),mediaList[1]);
    return result.error?json(res,result.status,{error:result.error}):json(res,201,result);
  }
  const mediaItem=url.pathname.match(/^\/api\/creator\/media\/(videos|clips)\/([^/]+)$/);
  if(mediaItem&&method==="DELETE"){const result=await deleteUserMedia(req,decodeURIComponent(mediaItem[2]));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  const presetList=url.pathname.match(/^\/api\/creator\/presets(?:\/(caption|export|scene))?$/);
  if(presetList&&method==="GET"){const result=await listPresets(req,presetList[1]);return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(presetList&&method==="POST"){const result=await savePreset(req,await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,201,result);}
  const presetItem=url.pathname.match(/^\/api\/creator\/presets\/([^/]+)$/);
  if(presetItem&&method==="PUT"){const result=await savePreset(req,await readJson(req),decodeURIComponent(presetItem[1]));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(presetItem&&method==="DELETE"){const result=await deletePreset(req,decodeURIComponent(presetItem[1]));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  const exportJob=url.pathname.match(/^\/api\/creator\/cut-studio\/projects\/([^/]+)\/export-jobs$/);
  if(exportJob&&method==="POST"){const result=await createJob(req,decodeURIComponent(exportJob[1]),"cut_export",await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,202,result);}
  const cancelJobMatch=url.pathname.match(/^\/api\/creator\/cut-studio\/jobs\/([^/]+)\/cancel$/);
  if(cancelJobMatch&&method==="POST"){const result=await cancelJob(req,decodeURIComponent(cancelJobMatch[1]));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/launcher/devices/register"&&method==="POST"){const result=await registerDevice(req,await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,201,result);}
  if(url.pathname==="/api/launcher/heartbeat"&&method==="POST"){const result=await launcherHeartbeat(req,await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/launcher/playstation/sync"&&method==="POST"){const result=await syncPlayStationFromLauncher(req,await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(url.pathname==="/api/launcher/jobs"&&method==="GET"){const result=await claimJobs(req);return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  const launcherJob=url.pathname.match(/^\/api\/launcher\/jobs\/([^/]+)$/);
  if(launcherJob&&method==="PUT"){const result=await updateLauncherJob(req,decodeURIComponent(launcherJob[1]),await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}

  if (url.pathname === "/api/admin/status" && ["GET", "HEAD"].includes(method)) {
    const account = await requireAdmin(req);
    if (account.error) return json(res, account.status, { error: account.error });
    return json(res, 200, { ok: true, admin: true, account: { id: account.id, email: account.email, display_name: account.display_name, role: account.role } });
  }

  if (url.pathname === "/api/admin/accounts" && ["GET", "HEAD"].includes(method)) {
    const account = await requireAdmin(req);
    if (account.error) return json(res, account.status, { error: account.error });
    const result = await getPool().query("select id, email, display_name, role, plan, email_verified_at, created_at, updated_at from accounts order by created_at desc");
    return json(res, 200, { accounts: result.rows.map(row => ({ ...row, admin: Boolean(row.email_verified_at) && isAdminEmail(row.email), email_verified: Boolean(row.email_verified_at) })), total: result.rowCount });
  }

  if (["/api/auth/register", "/api/account/register"].includes(url.pathname) && method === "POST") {
    const body = await readJson(req);
    if (!["terms_accepted", "privacy_acknowledged", "beta_acknowledged", "age_18_confirmed"].every(key => body[key] === true)) return json(res, 400, { error: "LEGAL_ACCEPTANCE_REQUIRED", code: "legal_acceptance_required" });
    const result = await register(body);
    if (result.error) return json(res, result.status, { error: result.error });
    const session = await login(body);
    if (session.error) return json(res, session.status, { error: session.error });
    res.setHeader("set-cookie", cookie("cfs_session", session.token, session.maxAge));
    return json(res, 201, { authenticated: true, account: session.account, verification_required: false, message: "Konto erstellt." });
  }

  if (["/api/auth/login", "/api/account/login"].includes(url.pathname) && method === "POST") {
    const credentials = await readJson(req);
    // Never trust client-supplied forwarding headers for the source address.
    const address = req.socket.remoteAddress || "unknown";
    // Socket addresses can identify the shared Render reverse proxy rather than
    // the visitor. Never activate address-wide lockouts automatically.
    const throttleEnabled = process.env.CFS_LOGIN_THROTTLE_SOCKET_MODE === "enabled";
    const attempt = throttleEnabled
      ? loginThrottle.allow(address, credentials.email)
      : { allowed: true };
    if (!attempt.allowed) {
      res.setHeader("retry-after", String(attempt.retryAfter));
      return json(res, 429, { error: "LOGIN_RATE_LIMITED" });
    }
    const result = await login(credentials);
    if (result.error) {
      if (result.status === 429) res.setHeader("retry-after", "900");
      return json(res, result.status, { error: result.error });
    }
    if (throttleEnabled) loginThrottle.successful(address, credentials.email);
    if (result.mfa_required) {
      res.setHeader("set-cookie", pendingMfaCookie(result.pendingToken));
      return json(res, 200, { authenticated: false, mfa_required: true, mfa_methods: result.mfa_methods });
    }
    res.setHeader("set-cookie", [cookie("cfs_session", result.token, result.maxAge), clearPendingMfaCookie()]);
    return json(res, 200, { authenticated: true, account: result.account });
  }

  if (["/api/auth/logout", "/api/account/logout"].includes(url.pathname) && method === "POST") {
    res.setHeader("set-cookie", await logout(req));
    return json(res, 200, { authenticated: false, account: null });
  }

  if (url.pathname === "/api/creator/projects" && method === "GET") {
    const result = await listProjects(req, url);
    return result.error ? json(res, result.status, { error: result.error }) : json(res, 200, result);
  }

  if (url.pathname === "/api/creator/projects" && method === "POST") {
    const result = await createProject(req, await readJson(req));
    return result.error ? json(res, result.status, { error: result.error }) : json(res, 201, result);
  }

  if (url.pathname === "/api/creator/universal-builder" && method === "GET") { const result=await builderState(req); return result.error?json(res,result.status,{error:result.error}):json(res,200,result); }
  if (url.pathname === "/api/creator/universal-builder/bundles" && method === "POST") { const result=await saveBundle(req,await readJson(req)); return result.error?json(res,result.status,{error:result.error}):json(res,201,result); }
  const builderBundle= url.pathname.match(/^\/api\/creator\/universal-builder\/bundles\/([^/]+)$/);
  if(builderBundle&&method==="PUT"){const result=await saveBundle(req,await readJson(req),decodeURIComponent(builderBundle[1]));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(builderBundle&&method==="PATCH"){const result=await renameBundle(req,decodeURIComponent(builderBundle[1]),await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  const builderRename= url.pathname.match(/^\/api\/creator\/universal-builder\/bundles\/([^/]+)\/name$/);
  if(builderRename&&method==="PATCH"){const result=await renameBundle(req,decodeURIComponent(builderRename[1]),await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}
  if(builderBundle&&method==="DELETE"){const result=await deleteBundle(req,decodeURIComponent(builderBundle[1]),await readJson(req));return result.error?json(res,result.status,{error:result.error}):json(res,200,result);}

  if (url.pathname === "/api/creator/widget-studio/scenes" && method === "GET") {
    const result = await listScenes(req);
    return result.error ? json(res, result.status, { error: result.error }) : json(res, 200, result);
  }
  if (url.pathname === "/api/creator/widget-studio/scenes" && method === "POST") {
    const result = await createScene(req, await readJson(req));
    return result.error ? json(res, result.status, { error: result.error }) : json(res, 201, result);
  }
  const sceneMatch = url.pathname.match(/^\/api\/creator\/widget-studio\/scenes\/([^/]+)(?:\/(publish))?$/);
  if (sceneMatch && method === "PUT") {
    const result = await updateScene(req, decodeURIComponent(sceneMatch[1]), await readJson(req));
    return result.error ? json(res, result.status, { error: result.error }) : json(res, 200, result);
  }
  if (sceneMatch && sceneMatch[2] === "publish" && method === "POST") {
    const result = await updateScene(req, decodeURIComponent(sceneMatch[1]), await readJson(req), true);
    return result.error ? json(res, result.status, { error: result.error }) : json(res, 200, result);
  }

  if (url.pathname === "/api/creator/widget-studio/widgets" && method === "GET") {
    const result = await listWidgets(req);
    return result.error ? json(res, result.status, { error: result.error }) : json(res, 200, result);
  }

  if (url.pathname === "/api/creator/widget-studio/assets" && method === "GET") {
    const result = await listAssets(req);
    return result.error ? json(res, result.status, { error: result.error }) : json(res, 200, result);
  }
  if (url.pathname === "/api/creator/widget-studio/assets" && method === "POST") {
    if (!await requireAccount(req)) return json(res, 401, { error: "AUTHENTICATION_REQUIRED" });
    const result = await uploadAsset(req, await readRaw(req));
    return result.error ? json(res, result.status, { error: result.error }) : json(res, 201, result);
  }
  if (url.pathname === "/api/creator/widget-studio/packages" && method === "GET") return json(res, 200, await listPackages(req));
  if (url.pathname === "/api/creator/widget-studio/packages" && method === "POST") return json(res, 201, await createPackage(req, await readJson(req)));
  if (url.pathname === "/api/creator/shop/catalog" && method === "GET") { const result = await listShopCatalog(req); return result.error ? json(res, result.status, { error: result.error }) : json(res, 200, result); }
  const shopBundleMatch = url.pathname.match(/^\/api\/creator\/shop\/bundles\/([^/]+)\/convert$/);
  if (shopBundleMatch && method === "POST") { const result = await convertBundle(req, decodeURIComponent(shopBundleMatch[1])); return result.error ? json(res, result.status, { error: result.error }) : json(res, 200, result); }
  if (url.pathname === "/api/creator/widget-studio/widgets" && method === "POST") {
    const result = await createWidget(req, await readJson(req));
    return result.error ? json(res, result.status, { error: result.error }) : json(res, 201, result);
  }
  const widgetMatch = url.pathname.match(/^\/api\/creator\/widget-studio\/widgets\/([^/]+)(?:\/(draft|publish))?$/);
  if (widgetMatch && method === "GET") {
    const result = await getWidget(req, decodeURIComponent(widgetMatch[1]));
    return result.error ? json(res, result.status, { error: result.error }) : json(res, 200, result);
  }
  if (widgetMatch && widgetMatch[2] && method === "PUT") {
    const result = await updateWidget(req, decodeURIComponent(widgetMatch[1]), await readJson(req), false);
    return result.error ? json(res, result.status, { error: result.error }) : json(res, 200, result);
  }
  if (widgetMatch && widgetMatch[2] === "publish" && method === "POST") {
    const result = await updateWidget(req, decodeURIComponent(widgetMatch[1]), await readJson(req), true);
    return result.error ? json(res, result.status, { error: result.error }) : json(res, 200, result);
  }

  const projectMatch = url.pathname.match(/^\/api\/creator\/projects\/([^/]+)$/);
  if (projectMatch && method === "PATCH") {
    const result = await updateProject(req, decodeURIComponent(projectMatch[1]), await readJson(req));
    return result.error ? json(res, result.status, { error: result.error }) : json(res, 200, result);
  }
  if (projectMatch && method === "DELETE") {
    const result = await deleteProject(req, decodeURIComponent(projectMatch[1]));
    return result.error ? json(res, result.status, { error: result.error }) : json(res, 200, result);
  }

  if (url.pathname.startsWith("/api/")) {
    return json(res, 501, { error: "API_NOT_IMPLEMENTED", message: "Dieser API-Bereich wird im nächsten Backend-Modul aktiviert.", path: url.pathname });
  }

  if (!["GET", "HEAD"].includes(method)) {
    res.setHeader("allow", "GET, HEAD");
    return json(res, 405, { error: "METHOD_NOT_ALLOWED", message: "Diese Ressource akzeptiert nur GET-Anfragen." });
  }
  return serveStatic(req, res);
}

const server = createServer((req, res) => {
  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > maxBodyBytes) return json(res, 413, { error: "PAYLOAD_TOO_LARGE" });
  handle(req, res).catch(error => {
    console.error("request_failed", error);
    if (!res.headersSent) json(res, error.status || 500, { error: error.message === "INVALID_JSON" ? "INVALID_JSON" : error.status === 413 ? "PAYLOAD_TOO_LARGE" : "INTERNAL_SERVER_ERROR" });
    else res.destroy();
  });
});

server.listen(port, host, () => console.log(`CFS Zockt server listening on ${host}:${port}`));

function shutdown(signal) {
  console.log(`${signal}: shutting down`);
  server.close(async () => { await closeDatabase().catch(() => {}); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
