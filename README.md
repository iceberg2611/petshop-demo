# Petshop-Demo Eskişehir

Demo-Website für Petshops in Eskişehir. Auswahl des Shops über `?shop=`:

espati · prenses · sena · caglar · zeybek · jelibon

Beispiel: https://iceberg2611.github.io/petshop-demo/?shop=zeybek

## KI-Chat

Die Seite hat unten rechts ein Chatfenster („Sorunuz mu var?“). Die Antworten kommen von Claude über einen kleinen Cloudflare Worker (`worker/`), damit der API-Schlüssel nie in der öffentlichen Seite steht.

Solange `CHAT_ENDPOINT` in `index.html` leer ist, antwortet der Chat nur mit einem Demo-Hinweis.

### Einrichten (einmalig)

1. API-Schlüssel anlegen: https://console.anthropic.com → API Keys (Guthaben aufladen).
2. Kostenloses Cloudflare-Konto: https://dash.cloudflare.com/sign-up
3. Auf deinem Rechner (Node.js nötig):
   ```bash
   cd worker
   npm install
   npx wrangler login
   npx wrangler secret put ANTHROPIC_API_KEY   # Schlüssel einfügen
   npx wrangler deploy
   ```
4. Die ausgegebene URL (z. B. `https://petshop-chat.DEINNAME.workers.dev`) in `index.html` bei `CHAT_ENDPOINT` eintragen und pushen.

Der Worker nimmt nur Anfragen von `https://iceberg2611.github.io` an, kürzt lange Nachrichten und beantwortet nur Petshop-Themen.
