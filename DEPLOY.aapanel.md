# Deploy — Server Node (panel) on aaPanel

Target: **escuelasdeconduccionbogota.de.com** → 188.166.189.57 (aaPanel).
The Node only needs **Node.js** — no database, no Redis. It forwards everything
to the Master at `https://machdientu.de.com`.

> Deploy the Master first and make sure `https://machdientu.de.com/api/health`
> works before deploying the Node.

---

## ⚡ Quick install (recommended)

After installing **Node.js 20** (aaPanel → App Store → Node.js version manager)
and getting a license from the Master (step 2 below), run **one command**:

```bash
curl -fsSL https://raw.githubusercontent.com/silent404s/url-shortener-node/main/install.sh -o install.sh
bash install.sh
```

The script asks for your domain, Master URL, and license, then handles clone +
`npm install` + `.env` + PM2 for you. The only manual step left is the reverse
proxy + SSL (step 6). The detailed manual steps below remain as a reference /
fallback.

> Requires the `url-shortener-node` repo to be **public** (so the script and
> `git clone` work without a token). If it's private, clone with a PAT instead.

---

## 1. Install prerequisites (aaPanel UI)

- **App Store → Node.js version manager** → Node 20 LTS (skip if already done).
- **App Store → PM2 manager**.

---

## 2. Get a license from the Master

The panel authenticates with a license, not a password. Register a user against
the Master once (from your PC or the Master's terminal):

```bash
curl -X POST https://machdientu.de.com/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","password":"StrongPass123","acceptAgreement":true}'
```

Copy `license.licenseKey` and `license.licenseSecret` from the response
(shown only once).

---

## 3. Get the code

```bash
cd /www/wwwroot
git clone https://github.com/silent404s/url-shortener-node.git escuelasdeconduccionbogota.de.com
cd escuelasdeconduccionbogota.de.com
npm install --omit=dev
```

---

## 4. Configure environment

```bash
cp .env.example .env
nano .env
```

```ini
NODE_ENV=production
PORT=3000
MASTER_URL=https://machdientu.de.com
LICENSE_KEY=<licenseKey from step 2>
LICENSE_SECRET=<licenseSecret from step 2>
SESSION_SECRET=<openssl rand -base64 48>
```

---

## 5. Start with PM2

```bash
pm2 start src/server.js --name node-panel
pm2 save
pm2 startup     # follow printed instruction once
```

---

## 6. Reverse proxy + SSL (aaPanel UI)

- **Website → Add site** → `escuelasdeconduccionbogota.de.com`.
- **Reverse proxy → Add**:
  - Target URL: `http://127.0.0.1:3000`
  - Send domain: `$host`
- **SSL → Let's Encrypt** → issue + force HTTPS.

Open `https://escuelasdeconduccionbogota.de.com/login` and click
**Validate license & sign in**.

---

## 7. Updating later

```bash
cd /www/wwwroot/escuelasdeconduccionbogota.de.com
git pull
npm install --omit=dev
pm2 restart node-panel
```
