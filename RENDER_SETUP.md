# Deploying Cosmos Chat on Render

This guide walks you through hosting Cosmos Chat on [Render](https://render.com) as a single web service.

---

## Overview

Cosmos Chat runs as a single Node.js process that:
- Serves the built React frontend as static files
- Runs the Express + Socket.io backend
- Stores all data in local SQLite files (no external database required)

---

## Prerequisites

1. A [Render](https://render.com) account (free tier works)
2. Your project pushed to a GitHub or GitLab repository
3. Your `ADMIN_TOKEN` value (choose a strong password — this protects your admin panel)

---

## Step 1 — Push to GitHub

Make sure your code is in a GitHub repository. The `data/` folder (SQLite databases) is excluded from git via `.gitignore`, which is correct — Render's disk will store them persistently.

---

## Step 2 — Create a Web Service on Render

1. Go to [https://dashboard.render.com](https://dashboard.render.com)
2. Click **New → Web Service**
3. Connect your GitHub repository
4. Fill in the service settings:

| Setting | Value |
|---|---|
| **Name** | `cosmos-chat` (or anything you like) |
| **Region** | Closest to your users |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (or Starter for persistence) |

> **Important:** The free tier on Render does **not** provide a persistent disk. Your SQLite data will be wiped on every redeploy or restart. To keep data permanently, use a **Starter** plan or higher and add a Render Disk (see Step 4).

---

## Step 3 — Set Environment Variables

In the Render dashboard, go to your service → **Environment** tab and add:

| Key | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables static file serving |
| `ADMIN_TOKEN` | `your-strong-secret-here` | Admin panel password — keep this secret |
| `PORT` | (leave blank) | Render sets this automatically |

> **Do not** set `SERVER_PORT` or `DATABASE_URL` — they are not used in production.

---

## Step 4 — Add a Persistent Disk (Recommended)

Without a persistent disk, your SQLite data resets on every deploy.

1. In your Render service, go to **Disks** → **Add Disk**
2. Set the **Mount Path** to `/data`
3. Set the size (1 GB is more than enough for most usage)

Then add one more environment variable in Render's **Environment** tab:

| Key | Value |
|---|---|
| `DATA_DIR` | `/data` |

That's it — no code changes needed. The server reads `DATA_DIR` and stores all SQLite files there. Redeploy and your databases will survive restarts and redeployments.

---

## Step 5 — Deploy

Click **Create Web Service**. Render will:
1. Clone your repository
2. Run `npm install && npm run build` (builds the React frontend)
3. Start the server with `npm start`
4. Assign a public URL like `https://cosmos-chat-xxxx.onrender.com`

The build takes 2–4 minutes on first deploy.

---

## Step 6 — Access the Admin Panel

Once live, visit:

```
https://your-app.onrender.com/admin
```

Enter the `ADMIN_TOKEN` value you set in the environment variables.

From the admin panel you can:
- View all rooms and their secret keys
- Read all messages (including deleted ones)
- See live connected users and their IPs
- Browse historical user sessions
- View the full audit log (kicks, deletions, room deletes)
- Kick users and delete messages

---

## Step 7 — Custom Domain (Optional)

1. In your Render service, go to **Settings → Custom Domains**
2. Add your domain (e.g. `chat.yourdomain.com`)
3. Update your DNS with the CNAME record Render provides
4. Render handles HTTPS automatically

---

## Environment Variable Reference

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | Set to `production` for the server to serve the React app |
| `ADMIN_TOKEN` | Yes | Secret token for accessing the admin dashboard |
| `DATA_DIR` | No | Set to `/data` if using a Render persistent disk |
| `PORT` | No | Set automatically by Render |

---

## Build & Start Commands Summary

```bash
# Build command (run once on deploy)
npm install && npm run build

# Start command (runs the server)
npm start
```

The `npm start` command runs `node server/index.js` in production mode, which:
- Reads the `ADMIN_TOKEN` from the environment (exits with an error if not set)
- Initialises all four SQLite databases in the `data/` directory
- Serves the built React frontend from `dist/public/`
- Starts the Express + Socket.io server on the port Render provides

---

## Database Files

The app stores data across four SQLite files:

| File | Contents |
|---|---|
| `data/rooms.db` | All chat rooms and their secret keys |
| `data/messages.db` | All messages (including faded and admin-deleted) |
| `data/users.db` | Historical user session records (connections/disconnections) |
| `data/audit.db` | Admin action log (kicks, message deletions, room deletions) |

These files are created automatically on first run — no setup needed.

---

## Troubleshooting

**App won't start — "ADMIN_TOKEN environment variable is not set"**
→ Add `ADMIN_TOKEN` in Render's Environment tab and redeploy.

**Admin panel says "Forbidden"**
→ Make sure the token you're entering matches exactly what you set in `ADMIN_TOKEN`.

**Data disappears after redeploy**
→ You're on the free tier without a persistent disk. Follow Step 4 to add one.

**Build fails**
→ Check that your repository has `package.json`, `vite.config.ts`, and the `server/` folder at the root level.

**WebSocket not connecting**
→ Render supports WebSockets on all plans. Make sure you're using `wss://` (Render enforces HTTPS/WSS automatically).
