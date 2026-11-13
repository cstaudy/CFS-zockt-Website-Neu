// Twitch webhook EventSub deletion needs an app access token, not the
// creator's user access token. 404 is idempotent success for cleanup retries.
const SUBSCRIPTION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function deleteRemoteFollowSubscription(subscriptionId) {
  if (!SUBSCRIPTION_ID.test(String(subscriptionId || "")))
    return { deleted: false, reason: "invalid_subscription" };
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    return { deleted: false, reason: "provider_not_configured" };
  try {
    const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials"
      }),
      signal: AbortSignal.timeout(7000)
    });
    if (!tokenResponse.ok) return { deleted: false, reason: "provider_auth_failed" };
    const token = await tokenResponse.json();
    if (typeof token?.access_token !== "string" || !token.access_token)
      return { deleted: false, reason: "provider_auth_failed" };
    const deleteResponse = await fetch(
      "https://api.twitch.tv/helix/eventsub/subscriptions?id=" +
        encodeURIComponent(subscriptionId), {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + token.access_token, "Client-Id": clientId
        },
        signal: AbortSignal.timeout(7000)
      }
    );
    if (deleteResponse.status === 204 || deleteResponse.status === 404)
      return { deleted: true };
    return { deleted: false, reason: "provider_delete_failed" };
  } catch {
    return { deleted: false, reason: "provider_unavailable" };
  }
}
