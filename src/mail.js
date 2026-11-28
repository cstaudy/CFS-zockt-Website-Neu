function localHttpHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function appOrigin() {
  try {
    const parsed = new URL(String(process.env.APP_BASE_URL || ""));
    const localHttp = parsed.protocol === "http:" && localHttpHost(parsed.hostname);
    if (parsed.protocol !== "https:" && !localHttp) return null;
    if (parsed.username || parsed.password || !["", "/"].includes(parsed.pathname) || parsed.search || parsed.hash) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function mailStatus() {
  const configured = Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
  const ready = configured && Boolean(appOrigin());
  return {
    password_recovery_available: ready,
    email_verification_available: ready,
    provider: process.env.RESEND_API_KEY ? "resend" : null
  };
}

export async function sendMail({ to, token, type = "recovery" }) {
  const status = mailStatus();
  const base = appOrigin();
  if (!status.password_recovery_available || !base) {
    return { ok: false, error: "MAIL_NOT_CONFIGURED", status: 503 };
  }
  const verify = type === "verification";
  const link = `${base}/pages/${verify ? "verify-email" : "reset-password"}.html#token=${encodeURIComponent(token)}`;
  const subject = verify ? "cfs_zockt - E-Mail bestaetigen" : "cfs_zockt - Passwort zuruecksetzen";
  const text = verify ? "Bitte bestaetige deine E-Mail-Adresse." : "Du hast einen Passwort-Reset angefordert.";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [to],
        subject,
        html: `<p>${text}</p><p><a href="${link}">${verify ? "E-Mail bestaetigen" : "Passwort zuruecksetzen"}</a></p><p>Der Link ist 30 Minuten gueltig und nur einmal verwendbar.</p>`
      })
    });
    return response.ok
      ? { ok: true }
      : { ok: false, error: "MAIL_DELIVERY_FAILED", status: 502 };
  } catch {
    return { ok: false, error: "MAIL_DELIVERY_UNAVAILABLE", status: 502 };
  }
}

export const sendRecoveryMail = ({ to, token }) => sendMail({ to, token, type: "recovery" });
