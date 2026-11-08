# CFS Zockt · Finanz-, Rechts- und Schutzplan

Dieser Plan ist eine technische Arbeitsgrundlage und ersetzt keine Rechts- oder Steuerberatung.

## 1. Zahlungsfreigabe

PayPal und andere Zahlungsanbieter bleiben im Sandbox-/Deaktiviert-Modus, bis diese Punkte bestätigt sind:

- Preise und Leistungsumfang je Plan sind festgelegt.
- Kündigung, Verlängerung, Rückerstattung und Ablauf sind definiert.
- Rechnungs- und Steuerprozess ist geklärt.
- Datenschutz- und Nutzungsdokumente sind veröffentlicht.
- Anbieter- und Webhook-Verträge sind geprüft.
- Sandbox-Test für Kauf, Abbruch, Rückerstattung und Webhook ist erfolgreich.
- Admin-Freigabe und Rückfallplan sind dokumentiert.

## 2. Produkt- und Finanzmodell

| Angebot | Entwurf | Noch zu entscheiden |
|---|---:|---|
| Free | 0 € · 3 Widgets | dauerhaft kostenlos oder Beta-Limit |
| Creator | 9,99 €/Monat | Preis, Steuerbehandlung, 25-Widget-Limit |
| Pro | 19,99 €/Monat | Preis, Steuerbehandlung, 100-Widget-Limit |
| Shop-Bundle | noch offen | Einzelkauf, Lizenzumfang, Updates |

Vor der Veröffentlichung festlegen: Währung, Preise inklusive/exklusive Steuern, Abrechnungsintervall, Kündigung, Rückerstattung, Zahlungsgebühren, Hostingkosten und monatlicher Mindestumsatz.

## 3. Rechtliche Dokumente

- Impressum / Anbieterkennzeichnung
- Datenschutzerklärung
- Nutzungsbedingungen
- Beta-Bedingungen
- Preis- und Zahlungsbedingungen
- Kündigungs- und Rückerstattungsregeln
- Lizenzbedingungen für Designs, Widgets und Shop-Bundles
- Regeln für Nutzeruploads und Rechte Dritter
- Hinweise für externe Dienste wie PayPal, Render, Datenbank, Twitch, TikTok und PlayStation

Die Texte müssen vor dem Live-Checkout fachlich geprüft und mit Version, Datum und Änderungsverlauf veröffentlicht werden.

## 4. Technische Schutzmaßnahmen

- Keine Zahlungsdaten selbst speichern.
- Nur Provider-IDs, Status und relevante Referenzen speichern.
- Webhooks signaturgeprüft und idempotent verarbeiten.
- PayPal-Secrets ausschließlich als Render-Umgebungsvariablen hinterlegen.
- Admin-Zugriff nur für `cstaudygaming@googlemail.com`.
- Admin-Aktionen auditieren.
- Uploads, Sessions und Backups mit Löschfristen versehen.
- Datenexport und Kontolöschung testen.
- Free-Limits serverseitig erzwingen.
- Checkout standardmäßig deaktiviert lassen.

## 5. Freigabereihenfolge

1. Beta ohne Zahlung stabilisieren.
2. Datenbank, Backups und Account-Lifecycle prüfen.
3. Rechtstexte und Finanzmodell prüfen lassen.
4. PayPal Sandbox integrieren.
5. Kauf, Abbruch, Kündigung, Rückerstattung und Webhooks testen.
6. Interne Admin-Freigabe dokumentieren.
7. Limitierte Live-Freigabe durchführen.
8. Erst danach öffentliche Vermarktung und bezahlte Pläne aktivieren.

## Aktueller Status

- Checkout: deaktiviert
- PayPal: nicht verbunden
- Stripe-Grundstruktur: vorhanden, nicht als öffentliche Freigabe behandeln
- Free-Plan: 3 Widgets serverseitig begrenzt
- Admin-E-Mail: `cstaudygaming@googlemail.com`
- Rechtliche Freigabe: offen
- Steuerliche Freigabe: offen

