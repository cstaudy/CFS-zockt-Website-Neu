import { createHash } from "node:crypto";
import { normalizePublisherPreview } from "./publisher-preview.js";

// Pure contract prototype; not an authorization service, DB queue, or worker.
// Only a future trusted server adapter may translate verified provider evidence
// into events. Never accept these events directly from a browser or launcher.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const failure = code => ({error:code});
const validId = v => typeof v === "string" && UUID.test(v);
const validProviderId = v => typeof v === "string" && /^[A-Za-z0-9_.:-]{1,160}$/.test(v);
const MAX_ATTEMPTS = 3;

export function buildPublishingDraft(accountId, requestId, body) {
  if (!validId(accountId) || !validId(requestId)) return failure("INVALID_PUBLISHING_IDENTITY");
  const draft = normalizePublisherPreview(body);
  if (draft.error) return failure(draft.error);
  const canonical = {...draft, targets:[...draft.targets].sort()};
  const account = accountId.toLowerCase(), request = requestId.toLowerCase();
  const requestKey = hash(["publisher-request-v1",account,request]);
  return {
    mode:"contract_only", request_key:requestKey,
    request_fingerprint:hash(["publisher-payload-v1",canonical]),
    targets:canonical.targets.map(target => ({
      target, key:hash(["publisher-target-v1",requestKey,target]),
      state:"draft", revision:0, attempts:0, attempt_id:null, provider_ref:null
    }))
  };
}

// The key identifies one client intent, not a permanent prohibition against
// intentionally publishing the same media again. Persist and compare BOTH
// fields under a unique account/request constraint in the future DB adapter.
export function comparePublishingIntent(existing, proposed) {
  if (!existing || !proposed || typeof existing.request_key !== "string" ||
      typeof proposed.request_key !== "string" ||
      typeof existing.request_fingerprint !== "string" ||
      typeof proposed.request_fingerprint !== "string") return "invalid";
  if (existing.request_key !== proposed.request_key) return "different_intent";
  return existing.request_fingerprint === proposed.request_fingerprint ? "same_intent" : "conflict";
}

const states = new Set(["draft","queued","preparing","submitting","reconcile_required",
  "retryable","submitted","published","failed","canceled"]);
const eventKeys = Object.freeze({
  authorize:["type","expected_revision"],
  begin_attempt:["type","expected_revision","attempt_id"],
  pre_submit_failure:["type","expected_revision","attempt_id"],
  submit_started:["type","expected_revision","attempt_id"],
  submission_unknown:["type","expected_revision","attempt_id"],
  provider_accepted:["type","expected_revision","attempt_id","provider_ref"],
  provider_confirmed_absent:["type","expected_revision","attempt_id"],
  provider_published:["type","expected_revision","provider_ref"],
  provider_failed:["type","expected_revision","provider_ref"],
  cancel:["type","expected_revision"]
});

export function reducePublishingTarget(current, event) {
  if (!current || !states.has(current.state) || !Number.isSafeInteger(current.revision) ||
      current.revision < 0 || current.revision >= Number.MAX_SAFE_INTEGER ||
      !Number.isSafeInteger(current.attempts) || current.attempts < 0 || current.attempts > MAX_ATTEMPTS ||
      !event || !Object.hasOwn(eventKeys,event.type) ||
      Object.keys(event).some(key=>!eventKeys[event.type].includes(key)))
    return failure("INVALID_PUBLISHING_EVENT");
  if (event.expected_revision !== current.revision) return failure("PUBLISHING_REVISION_CONFLICT");
  const move = (state, extra={})=>({...current,...extra,state,revision:current.revision+1});
  const sameAttempt = validId(event.attempt_id) && event.attempt_id === current.attempt_id;
  const retryOrFail = ()=>move(current.attempts>=MAX_ATTEMPTS?"failed":"retryable");
  const s=current.state;
  switch(event.type) {
    case "authorize":
      if (s==="draft") return move("queued");
      break;
    case "begin_attempt":
      if ((s==="queued"||s==="retryable") && current.attempts<MAX_ATTEMPTS &&
          validId(event.attempt_id) && event.attempt_id!==current.attempt_id)
        return move("preparing",{attempt_id:event.attempt_id,attempts:current.attempts+1});
      break;
    case "pre_submit_failure":
      if (s==="preparing"&&sameAttempt) return retryOrFail();
      break;
    case "submit_started":
      if (s==="preparing"&&sameAttempt) return move("submitting");
      break;
    case "submission_unknown":
      if (s==="submitting"&&sameAttempt) return move("reconcile_required");
      break;
    case "provider_accepted":
      if ((s==="submitting"||s==="reconcile_required") && sameAttempt && validProviderId(event.provider_ref))
        return move("submitted",{provider_ref:event.provider_ref});
      break;
    case "provider_confirmed_absent":
      if (s==="reconcile_required"&&sameAttempt) return retryOrFail();
      break;
    case "provider_published":
      if (s==="submitted"&&validProviderId(event.provider_ref)&&event.provider_ref===current.provider_ref)
        return move("published");
      break;
    case "provider_failed":
      if (s==="submitted"&&validProviderId(event.provider_ref)&&event.provider_ref===current.provider_ref)
        return move("failed");
      break;
    case "cancel":
      if (["draft","queued","preparing","retryable"].includes(s)) return move("canceled");
      break;
  }
  return failure("PUBLISHING_TRANSITION_DENIED");
}
