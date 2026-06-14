# Server Node (User Panel)

Runs on the user's aaPanel. **Pure UI + thin proxy** to the Master. It holds no
Cloudflare logic and never sees raw tokens beyond forwarding the onboarding
request body to the Master.

## Run (dev)

```bash
cp .env.example .env     # set MASTER_URL, LICENSE_KEY, LICENSE_SECRET, SESSION_SECRET
npm install
npm run dev              # panel -> :3000
```

## How it works

- **Login** (`/login`) validates the configured license against the Master
  (`POST /node/session`) and sets a signed session cookie.
- **Offline tolerance:** the last good license snapshot is cached for 24h, so the
  panel stays usable (read-only) during brief Master outages
  (`src/masterClient.js`).
- **Proxy** (`src/routes/proxy.routes.js`) relays a whitelisted set of endpoints
  to the Master, injecting the license headers. Write operations return the
  Master's `QUEUED` response.
- **Quota lock:** the URL page disables creation when the Master reports the quota
  is reached.

## aaPanel deployment

1. Create a Node.js project pointing at `src/server.js`.
2. Set the env vars from `.env.example` in the panel.
3. Put it behind the aaPanel reverse proxy with HTTPS.

## Pages

`/` dashboard · `/domains` Cloudflare + domains · `/urls` URL management ·
`/referral` invite stats · `/help` tutorial · `/agreement` TOS.
