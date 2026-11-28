import { providerEvidence } from "./creator-status-evidence.js";
import { mediaQuota } from "./media-quota.js";
import { assetQuota } from "./asset-quota.js";

// Existing enforced quotas, not a new commercial plan matrix.
export const MAX_SCENES=50;
export const MAX_PENDING_EXPORT_JOBS=3;
export function widgetLimit(plan){
  return plan==="pro"?100:plan==="creator"?25:3;
}
export const MAX_STREAM_DESTINATIONS=1;
const definitions=[
  ["widget_studio","Widget Studio","/pages/widget-studio.html","workspace","Widgets und manuelle OBS-Ausgabe"],
  ["scene_studio","Scene Studio","/pages/scene-studio.html","workspace","Szenen und veröffentlichte Layouts"],
  ["stream_studio","Stream Studio","/pages/stream-studio.html","preview","Konfiguration; Live-Engine nicht abgenommen"],
  ["launcher","Launcher","/pages/launcher.html","setup","Geräte koppeln; Installer/OBS-Abnahme offen"],
  ["cut_studio","Cut Studio","/pages/cut-studio.html","workspace","Projekte und Export-Aufträge; Geräteabnahme offen"],
  ["audio_studio","Audio Studio","/pages/audio-studio.html","preview","Audio-Presets; keine bestätigte Mixersteuerung"],
  ["stream_maker","Stream Maker","/pages/stream-maker.html","workspace","Private Designs und signierte OBS-Ausgabe"],
  ["universal_builder","Universal Builder","/pages/universal-builder.html","workspace","Design-Bundles verwalten"],
  ["editor","Creator Editor","/pages/editor.html","preview","Vorhandene Editor-Oberfläche; Abnahme offen"],
  ["games","Games","/pages/games.html","preview","Game-Konfiguration und manuelle Laufzeit; Provider-Trigger offen"],
  ["tiktok","TikTok","/pages/tiktok.html","setup","OAuth-Verbindung verwalten"],
  ["twitch","Twitch","/pages/integrations.html","setup","OAuth-Verbindung verwalten"],
  ["obs","OBS","/pages/obs-setup.html","setup","Lokale Browserquellen und Geräteprüfung"],
  ["playstation","PlayStation","/pages/playstation.html","setup","Launcher-Synchronisierung; Geräteabnahme offen"],
  ["cfs_ai","CFS AI","/pages/cfs-ai.html","planned","KI-Bridge nicht abgenommen"],
  ["cfson","CFSON","/pages/cfson-lab.html","planned","Privater Alpha-Entwurf; nicht aktiviert"]
];
export function buildCreatorCatalog(account,evidence={}){
  if(!account?.id)throw Error("ACCOUNT_REQUIRED");
  const plan=["free","creator","pro"].includes(account.plan)?account.plan:null;
  const provider=name=>providerEvidence(evidence.platforms?.find(p=>p.provider===name));
  const runtime={tiktok:provider("tiktok"),twitch:provider("twitch"),launcher:evidence.launcher?.status||"unknown",
    obs:evidence.launcher?evidence.launcher.obs_connected?"obs_reported":"not_confirmed":"unknown"};
  const modules=definitions.map(([key,title,href,stage,detail])=>({
    key,title,label:title,href,stage,detail,openable:stage!=="planned",
    status:runtime[key]|| (stage==="workspace"?"available":stage),
    runtime_status:runtime[key]||"not_checked",production_ready:false
  }));
  return {modules,access:{recorded_plan:plan,plan_status:plan?"recorded":"unknown",billing_enabled:false},
    limits:{max_widgets:widgetLimit(plan),max_scenes:MAX_SCENES,max_pending_export_jobs:MAX_PENDING_EXPORT_JOBS,
      max_stream_destinations:MAX_STREAM_DESTINATIONS,max_media_items_per_folder:mediaQuota.max_items,
      max_assets:assetQuota.max_assets,max_asset_bytes:assetQuota.max_total_bytes}};
}
