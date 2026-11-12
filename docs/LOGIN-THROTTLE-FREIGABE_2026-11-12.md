# Login-Versuchsbegrenzung: Freigabe vor dem Livebetrieb

## Ausgangspunkt
Die beiden Passwort-Login-Routen teilen sich einen In-Memory-Zähler mit 8 Versuchen pro E-Mail/Quelladresse und 80 Versuchen pro Quelladresse innerhalb von 15 Minuten. Der Zähler reserviert Versuche vor asynchroner Passwortprüfung und antwortet bei Überschreitung mit HTTP 429 und `Retry-After`.

## Wichtige Render-/Proxy-Schranke
Die rohe `req.socket.remoteAddress` kann auf Render **die Adresse eines gemeinsamen Reverse-Proxys** sein und ist nicht zwangsläufig die IP eines einzelnen Besuchers. Daher ist die Option `CFS_LOGIN_THROTTLE_SOCKET_MODE` **standardmäßig deaktiviert**. Nur der explizite Wert `enabled` schaltet sie ein.

**Nicht ohne nachgewiesene Adressisolation im Livebetrieb einschalten.** Ansonsten können mehrere unabhängige Nutzer über das Quelladress-Limit zusammen ausgesperrt werden. Clientseitig manipulierte `X-Forwarded-For`-Werte dürfen nicht ungeprüft vertraut werden.

## Für spätere sichere Aktivierung erforderlich
1. Den tatsächlichen Proxy- und Weiterleitungsweg mit vom Betreiber kontrollierten Testanfragen prüfen; nur authentifizierte/verifizierte Proxy-Metadaten verwenden.
2. Einen gemeinsamen Zählerspeicher für mehrere Node-Prozesse/Instanzen planen, inklusive speichersparender Begrenzung und Fehlertoleranz.
3. Schutz gegen absichtliche Sperrung fremder E-Mail-Konten bewerten und UX bei HTTP 429 prüfen.
4. Danach den Schutz auf einer isolierten Instanz testen, erst nach gesonderter Freigabe aktivieren.

Die GitHub-Integrationstests aktivieren den Modus **ausschließlich im isolierten, lokalen Testserver**. Weder eine Env-Änderung auf Render noch ein Deployment ist Bestandteil des PRs.
