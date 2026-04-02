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
3. Your `ADMIN_TOKEN` value (the password you use to access `/admin`)

---

## Step 1 — Push to GitHub

Make sure your code is on GitHub. The `data/` folder is excluded from git on purpose — **you do not need to upload it**. The server creates the SQLite files automatically on first startup.

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
| **Branch** | `main` (or `master`) |
| **Runtime** | `Node` |
| **Build Command** | `npm install --include=dev && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | Free |

> **Important:** The build command must be `npm install --include=dev && npm run build` — not just `npm install`. The `--include=dev` flag installs the frontend build tools (Vite, React, etc.) which are needed to compile the app, even though they are listed as dev dependencies.

---

## Step 3 — Set Environment Variables

In the Render dashboard, go to your service → **Environment** tab and add:

| Key | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables static file serving |
| `ADMIN_TOKEN` | `your-secret-here` | Must match what you enter on the `/admin` page |

> Do **not** set `SERVER_PORT`, `DATABASE_URL`, or `DATA_DIR` unless you are using a persistent disk (see Step 4).

---

## Step 4 — Data Persistence (Free vs Paid)

### Free tier — data resets on restart

On Render's free tier, the filesystem is **ephemeral** — it resets whenever your service restarts or redeploys. This means:
- Chat messages, rooms, and user history are lost on restart
- The global room is re-created automatically on each start
- The app works fine otherwise — this is just a storage limitation

**You do not need to upload the `data/` folder to GitHub.** The server creates it fresh on every startup.

This is perfectly fine for testing and demos. If you want to keep data permanently, upgrade to the Starter plan and follow the paid disk setup below.

---

### Paid tier (Starter+) — permanent data storage

1. In your Render service, go to **Disks** → **Add Disk**
2. Set the **Mount Path** to `/data`
3. Set the size to 1 GB (more than enough)
4. Add one extra environment variable:

| Key | Value |
|---|---|
| `DATA_DIR` | `/data` |

That's it — the server reads `DATA_DIR` and stores all SQLite files there. Data will survive restarts and redeployments.

---

## Step 5 — Deploy

Click **Create Web Service**. Render will:
1. Clone your repository
2. Run `npm install --include=dev && npm run build` (installs everything and builds the React frontend)
3. Start the server with `npm start`
4. Assign a public URL like `https://cosmos-chat-xxxx.onrender.com`

The build takes 3–5 minutes on first deploy.

---

## Step 6 — Access the Admin Panel

Once live, visit:

```
https://your-app.onrender.com/admin
```

Enter the exact value you set as `ADMIN_TOKEN` in Step 3.

From the admin panel you can:
- View all rooms and their secret keys
- Read all messages (including deleted ones)
- See live connected users and their IPs
- Browse user sessions per room
- View the audit log (kicks, deletions)
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
| `NODE_ENV` | Yes | Set to `production` — enables the server to serve the React build |
| `ADMIN_TOKEN` | Yes | Password for the admin dashboard at `/admin` |
| `DATA_DIR` | No | Override SQLite data directory. Set to `/data` when using a Render persistent disk |
| `PORT` | No | Set automatically by Render — do not override |

---

## Build & Start Commands

```bash
# Build command — installs everything including frontend tools, then compiles the app
npm install --include=dev && npm run build

# Start command — runs the backend server, which also serves the compiled frontend
npm start
```

---

## Database Files

The app stores data across four SQLite files created automatically in the `data/` directory:

| File | Contents |
|---|---|
| `data/rooms.db` | All chat rooms and their secret keys |
| `data/messages.db` | All messages (including faded and admin-deleted) |
| `data/users.db` | Historical user session records |
| `data/audit.db` | Admin action log (kicks, deletions, room removals) |

---

## Troubleshooting

**`vite: not found` during build**
→ Make sure your build command is `npm install --include=dev && npm run build` (not just `npm install && npm run build`).

**App won't start — "ADMIN_TOKEN environment variable is not set"**
→ Add `ADMIN_TOKEN` in the Environment tab and redeploy.

**Admin panel says "Invalid token"**
→ Enter the exact value you set for `ADMIN_TOKEN` — no extra spaces.

**Data disappears after redeploy**
→ Expected on free tier. Add a persistent disk (Step 4) to keep data permanently.

**WebSocket not connecting**
→ Render supports WebSockets on all plans. Make sure you are not blocking port 443 on your network.

**Build fails with "Cannot find module"**
→ Make sure you are using `npm install --include=dev` in the build command so all frontend dependencies are installed.
