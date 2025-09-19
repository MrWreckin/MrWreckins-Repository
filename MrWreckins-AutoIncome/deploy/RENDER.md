# Deploy Backend on Render (No Node on your PC)

This guide deploys the Node backend from your GitHub repo to Render with a persistent disk for SQLite. Your frontend (the `public/` folder) can be hosted on IONOS Web Hosting Plus.

## Prerequisites
- GitHub repo containing this project
- IONOS domain (optional for custom API domain)

## 1) Connect GitHub to Render
1. Go to https://render.com and create an account.
2. Click "New" → "Web Service" → Connect your GitHub account.
3. Select your repository.

## 2) Configure the Web Service
- Root Directory: repository root
- Environment: Node
- Build Command: `npm ci`
- Start Command: `npm start`
- Instance Plan: Starter (upgrade later as needed)

## 3) Add a Persistent Disk (for SQLite)
- Click "Add Disk"
- Name: `autoincome-data`
- Mount Path: `/opt/render/project/src/data`
- Size: `2 GB`

This matches the SQLite path used by `src/database/database.js` (`data/autoincome.db`).

## 4) Environment Variables
Add:
- `DISABLE_AUTOMATION=1` (stabilize first boot; re-enable later)
- `OPENAI_API_KEY=...` (optional; heuristics work without it)

Render automatically provides `PORT`.

## 5) Deploy and Test Health
- Click "Deploy".
- When live, open: `https://<your-service>.onrender.com/api/health`
  - You should see: `{ ok: true, uptime: ..., time: ... }`

## 6) Assign a Custom Domain for the API (optional)
- In Render, add a custom domain, e.g., `api.yourdomain.com`.
- Render shows a DNS record (usually CNAME). In IONOS DNS, add it to your domain.
- Wait for SSL provisioning.

## 7) Point the Frontend to the API
Edit `public/config.js` in your IONOS webspace:

```html
<script>
  window.API_BASE_URL = 'https://api.yourdomain.com';
  window.WS_BASE_URL = 'wss://api.yourdomain.com';
</script>
```

This ensures `public/dashboard.js` uses your managed backend for fetch and WebSocket.

## 8) Upload Frontend to IONOS
- In IONOS → Hosting → Webspace/File Manager (or FTP), upload the contents of `public/`.
- Navigate to your domain to see the UI.

## 9) Re-enable Automation (optional)
- In Render → Environment → set `DISABLE_AUTOMATION=0` (or remove it) and redeploy.
- This starts scraping, analysis, marketplace bot, and periodic updates.

## Troubleshooting
- 502 from Render: check service logs. Ensure disk is mounted at `/opt/render/project/src/data`.
- WebSocket not connecting: confirm your `WS_BASE_URL` is `wss://...` and that your platform supports WebSockets (Render does).
- Trends not updating: if automation is still disabled, use the UI "Scan New Trends" button which calls `/api/scan-trends`.
