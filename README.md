# Cosmos Chat

A real-time anonymous chat application with multiple rooms, self-destructing messages, and an admin dashboard.

## Architecture

**Full-stack monorepo** — backend and frontend live in the same repository.

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS v4 + Shadcn/UI + Wouter routing + Zustand state + TanStack Query
- **Backend**: Node.js + Express + Socket.io (real-time WebSockets)
- **Database**: SQLite via `better-sqlite3` — four separate files, no external DB required

## Key Files

| Path | Purpose |
|---|---|
| `server/index.js` | Main server — Express API + Socket.io event handlers |
| `server/db/rooms-db.js` | Rooms database module |
| `server/db/messages-db.js` | Messages database module |
| `server/db/users-db.js` | User session history database module |
| `server/db/audit-db.js` | Admin audit log database module |
| `src/pages/chat.tsx` | Main chat UI |
| `src/pages/admin.tsx` | Admin dashboard |
| `src/pages/login.tsx` | Login / username entry |
| `src/hooks/use-socket.ts` | All Socket.io client logic |
| `vite.config.ts` | Vite config — proxies /api and /socket.io to the backend |

## Database Layout

Four SQLite files in `data/` (created automatically on first run):

| File | Contents |
|---|---|
| `data/rooms.db` | All chat rooms and secret keys |
| `data/messages.db` | All messages (including faded/deleted) |
| `data/users.db` | Historical user session records |
| `data/audit.db` | Admin action log |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ADMIN_TOKEN` | **Yes** | Secret token for the admin dashboard |
| `SERVER_PORT` | No | Port the backend listens on (default: 3001) |
| `PORT` | No | Port Vite/the production server listens on (default: 5000) |
| `DATA_DIR` | No | Override SQLite data directory (use `/data` on Render with a persistent disk) |

## Running Locally

```bash
npm run dev
```

Starts both the backend (port 3001) and Vite dev server (port 5000). The Vite server proxies `/api` and `/socket.io` to the backend.

## Admin Access

Visit `/admin` and enter the `ADMIN_TOKEN` value. Admins can:
- View all rooms (including private keys)
- Read all messages (including deleted)
- See live and historical user sessions with IPs
- Kick users, delete messages, delete rooms
- View the full audit log

## Deployment

See `RENDER_SETUP.md` for full Render hosting instructions.

Build command: `npm install && npm run build`
Start command: `npm start`



express dependecies lowered from //  "express": "^5.2.1",