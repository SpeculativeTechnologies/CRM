# Twenty on this Mac — public access + development

Twenty runs on this Mac and is reachable on the public internet at a stable URL
via **Tailscale Funnel**, with the frontend served as a production build (which
streams cleanly over a tunnel; live Vite dev mode does not — see below).

Public URL: **https://spectech-llm-1.tail7ba35e.ts.net**
(Sign in with the prefilled demo creds: `tim@apple.dev` / `Applecar2025`.)

## Architecture

```
Internet ──HTTPS──► Tailscale Funnel ──► 127.0.0.1:3010  (vite preview = built frontend)
                                              │  proxies /graphql,/rest,/auth,/files,... 
                                              └──► 127.0.0.1:3000  (NestJS backend)  + worker
                                                         └── Postgres 16 + Redis (brew services)
```

- **Backend (:3000)** runs in watch mode → backend code edits **hot-reload live**
  on the public URL. No build needed.
- **Frontend (:3010)** is the *built* bundle (`vite preview`). Bundled = ~73
  requests/load, which a tunnel handles fine. (Dev mode = ~1900 module requests,
  which relay tunnels — ngrok free, Tailscale Funnel — choke on.)
- **Tailscale Funnel** proxies the public HTTPS URL to :3010. Its config persists
  across reboots; the tailscaled daemon (Tailscale.app) starts at login.

## Toolchain (installed via Homebrew)

| Tool | Purpose |
|------|---------|
| `fnm` | Node version manager; pins Node **24.5.0** (repo `.nvmrc`), auto-switches on `cd` (in `~/.zshrc`). Global Node 26 untouched. |
| `postgresql@16` | DB. brew service (autostart). role `postgres`/`postgres`, DBs `default`+`test`. Binaries: `/opt/homebrew/opt/postgresql@16/bin`. |
| `redis` | Cache/queues. brew service (autostart). |
| `tailscale` (+ GUI app) | Public tunnel via Funnel. |
| (ngrok, cloudflared) | Installed during setup; not used by the current stack. |

Yarn 4 comes from corepack (bundled with Node 24).

## Auto-start on boot

`~/Library/LaunchAgents/com.twenty.public.plist` runs `deploy/serve-public.sh`
at login (KeepAlive — restarts the stack if any component dies). It waits for
Postgres+Redis, then starts backend + worker + `vite preview`. Postgres/Redis
autostart via brew services; Tailscale + Funnel restore themselves at login.

Control:
```bash
launchctl kickstart -k gui/$(id -u)/com.twenty.public   # restart the public stack
launchctl unload ~/Library/LaunchAgents/com.twenty.public.plist   # stop & disable
launchctl load -w ~/Library/LaunchAgents/com.twenty.public.plist  # enable
tail -f /tmp/twenty-public.log                          # logs
tailscale funnel status                                 # confirm the public URL
```

## Day-to-day development

**Backend** — just edit; the always-on backend hot-reloads. Changes are live on
the public URL within seconds.

**Frontend, live (instant HMR)** — run a dev server locally against the always-on
backend, and view it on localhost (NOT through the tunnel):
```bash
npx nx start twenty-front     # http://localhost:3001  (instant hot reload)
```

**Frontend, publish to the public URL** — when you want your frontend changes
live on the public URL, rebuild + restart the preview:
```bash
bash deploy/publish-frontend.sh   # nx build twenty-front + restart preview (~minutes)
```
Cold build ≈ 8–12 min; warm/incremental is faster. This build-to-publish step is
the tradeoff of serving a production build over a relay tunnel.

## Want live hot-reload on the *public* URL (and the real crm.spec.tech)?

Cloudflare's network (unlike relay tunnels) *can* serve Vite dev mode's request
volume. A **named Cloudflare tunnel** would give live hot-reload on a stable
**crm.spec.tech** with no build-to-publish step — but it requires moving the
`spec.tech` zone to Cloudflare (touches live Google email + Vercel site;
reversible). See `deploy/setup-tunnel.sh` and the notes in git history.

## Env files
- `packages/twenty-front/.env`: `VITE_HOST=127.0.0.1` (so the tunnel can reach
  Vite over IPv4), `VITE_PROXY_API_TO=http://127.0.0.1:3000` (single-origin API
  proxy), `VITE_ALLOWED_HOSTS=.ts.net,localhost`. `REACT_APP_SERVER_BASE_URL`
  intentionally unset → same-origin.
- `packages/twenty-server/.env`: `FRONTEND_URL` / `SERVER_URL` =
  the Funnel URL (for OAuth callbacks, invite links, absolute file URLs).
