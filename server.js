import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closeDatabase, databaseCheck, getPool } from "./src/db.js";
import { currentAccount, isAdminEmail, login, logout, register, cookie } from "./src/auth.js";
import { createProject, deleteProject, listProjects, updateProject, requireAdmin } from "./src/projects.js";
import { createScene, listScenes, updateScene } from "./src/studio-adapter.js";
import { createWidget, getWidget, listWidgets, updateWidget } from "./src/widget-adapter.js";
import { listAssets, uploadAsset } from "./src/assets.js";
import { createPackage, listPackages } from "./src/packages.js";
import { startTikTok, finishTikTok, tiktokConfigured } from "./src/tiktok.js";
import { startTwitch, finishTwitch } from "./src/twitch.js";
import { getPlayStationState } from "./src/playstation.js";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.env.PORT || 10000);
const host = process.env.HOST || "0.0.0.0";
const startedAt = new Date().toISOString();
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

function securityHeaders(res) {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "SAMEORIGIN");
  res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
}

function requestId(req) {
  return req.headers["x-request-id"] || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readJson(req) {
  if (!req.headers["content-length"]) return {};
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > maxJsonBytes) throw Object.assign(new Error("PAYLOAD_TOO_LARGE"), { status: 413 });
  }
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error("INVALID_JSON"), { status: 400 }); }
}

async function readRaw(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > maxBodyBytes * 16) throw Object.assign(new Error("PAYLOAD_TOO_LARGE"), { status: 413 }); chunks.push(chunk); }
  return Buffer.concat(chunks);
}

function safePath(urlPath) {
  const requested = decodeURIComponent(urlPath === "/" ? "/index.html" : urlPath);
  const candidate = resolve(root, `.${normalize(requested)}`);
  return candidate.startsWith(root) ? candidate : null;
}

async function serveStatic(req, res) {
  const filePath = safePath(new URL(req.url, "http://localhost").pathname);
  if (!filePath) return json(res, 403, { error: "FORBIDDEN", message: "Ungültiger Pfad." });
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return json(res, 404, { error: "NOT_FOUND" });
    res.writeHead(200, {
      "content-type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
      "cache-control": extname(filePath) === ".html" ? "no-cache" : "public, max-age=3600"
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

  if (url.pathname === "/api/health" && ["GET", "HEAD"].includes(method)) {
    return json(res, 200, { ok: true, service: "cfs-zockt", status: "healthy", started_at: startedAt, uptime_seconds: Math.floor(process.uptime()), version });
  }
  if (url.pathname === "/api/integrations/status" && ["GET", "HEAD"].includes(method)) {
    return json(res, 200, { ok: true, integrations: { database: Boolean(process.env.DATABASE_URL), session_secret: Boolean(process.env.SESSION_SECRET), twitch: Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET), tiktok: tiktokConfigured(), launcher: Boolean(process.env.LAUNCHER_BRIDGE_SECRET), paypal: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET), playstation: Boolean(process.env.PSN_PROVIDER && process.env.PSN_CLIENT_ID), storage: Boolean(process.env.ASSET_STORAGE_BUCKET) || (process.env.ASSET_STORAGE_PROVIDER || "local") === "local" }, note: "Nur Konfigurationsstatus; keine Secrets werden ausgegeben." });
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

  if (url.pathname === "/api/ready" && ["GET", "HEAD"].includes(method)) {
    const database = await databaseCheck();
    const ready = database.connected;
    return json(res, ready ? 200 : 503, { ok: ready, status: ready ? "ready" : database.configured ? "database_unavailable" : "waiting_for_database", checks: { configuration: true, database }, version });
  }

  if (url.pathname === "/api/public/status" && ["GET", "HEAD"].includes(method)) {
    return json(res, 200, { ok: true, service: "cfs-zockt", environment: process.env.NODE_ENV || "production", api_version: "1", generated_at: new Date().toISOString() });
  }

  if (url.pathname === "/api/public/live-session" && ["GET", "HEAD"].includes(method)) {
    return json(res, 200, { ok: true, live: false, status: "offline", channel: "cfs_zockt", title: "Aktuell nicht live", game: null, viewer_count: 0, source: "fallback" });
  }

  if (url.pathname === "/api/public/community-stats" && ["GET", "HEAD"].includes(method)) {
    return json(res, 200, { ok: true, twitch_followers: null, tiktok_followers: null, discord_members: null, source: "fallback", message: "Community-Daten werden derzeit nicht synchronisiert." });
  }

  if (url.pathname === "/api/public/creator-state" && ["GET", "HEAD"].includes(method)) {
    return json(res, 200, { ok: true, available: false, online: false, status: "unavailable", source: "fallback" });
  }

  if (["/api/public/games", "/api/public/recent-games"].includes(url.pathname) && ["GET", "HEAD"].includes(method)) {
    return json(res, 200, { ok: true, games: [], recent_games: [], source: "fallback", message: "Noch keine Spieldaten verfügbar." });
  }
  if (url.pathname === "/api/public/playstation" && ["GET", "HEAD"].includes(method)) {
    return json(res, 200, { ok: true, connected: false, provider: "playstation_network", platform: null, active_game: null, recent_games: [], purchased_games: [], limits: { recent_games: 3 }, message: "PlayStation Network ist noch nicht verbunden." });
  }

  if (url.pathname === "/api/account/me" && ["GET", "HEAD"].includes(method)) {
    const account = await currentAccount(req);
    const view = account ? { ...account, admin: isAdminEmail(account.email), role: isAdminEmail(account.email) ? "admin" : "creator", email_verified: Boolean(account.email_verified_at) } : null;
    return json(res, 200, { authenticated: Boolean(view), account: view });
  }

  if (url.pathname === "/api/admin/status" && ["GET", "HEAD"].includes(method)) {
    const account = await requireAdmin(req);
    if (account.error) return json(res, account.status, { error: account.error });
    return json(res, 200, { ok: true, admin: true, account: { id: account.id, email: account.email, display_name: account.display_name, role: account.role } });
  }

  if (url.pathname === "/api/admin/accounts" && ["GET", "HEAD"].includes(method)) {
    const account = await requireAdmin(req);
    if (account.error) return json(res, account.status, { error: account.error });
    const result = await getPool().query("select id, email, display_name, role, plan, email_verified_at, created_at, updated_at from accounts order by created_at desc");
    return json(res, 200, { accounts: result.rows.map(row => ({ ...row, admin: isAdminEmail(row.email), email_verified: Boolean(row.email_verified_at) })), total: result.rowCount });
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
    const result = await login(await readJson(req));
    if (result.error) return json(res, result.status, { error: result.error });
    res.setHeader("set-cookie", cookie("cfs_session", result.token, result.maxAge));
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
    const result = await uploadAsset(req, await readRaw(req));
    return result.error ? json(res, result.status, { error: result.error }) : json(res, 201, result);
  }
  if (url.pathname === "/api/creator/widget-studio/packages" && method === "GET") return json(res, 200, await listPackages(req));
  if (url.pathname === "/api/creator/widget-studio/packages" && method === "POST") return json(res, 201, await createPackage(req, await readJson(req)));
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

