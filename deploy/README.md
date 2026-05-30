# Deploying your custom Twenty build

This folder runs your fork's image (built in CI and published to GHCR) on a
single VM, with automatic HTTPS via Caddy.

Architecture:

```
your fork ──push──► GitHub Actions builds image ──► ghcr.io/YOURUSER/twenty
                                                          │
                                            VM ◄──────────┘  docker compose pull + up
                                            (Caddy terminates HTTPS → server:3000)
```

---

## One-time setup

### 1. Build your image (in your fork)
`.github/workflows/build-custom-image.yml` (already committed) builds and pushes
to GHCR on every push to `main`. After the first successful run:

- Go to your GitHub profile → **Packages** → `twenty` → **Package settings**
- Set visibility to **Public** (simplest), OR keep it private and log the VM into
  GHCR with `docker login ghcr.io` using a personal access token (read:packages).

### 2. Provision the VM
- Create an Ubuntu 24.04 VM (recommended: Hetzner CX22 or DigitalOcean $12 droplet).
- Point a DNS **A record** (e.g. `crm.yourdomain.com`) at the VM's public IP.
- Install Docker:
  ```bash
  curl -fsSL https://get.docker.com | sh
  ```
- Firewall — only expose web + SSH:
  ```bash
  ufw allow 22,80,443/tcp && ufw enable
  ```

### 3. Copy these deploy files to the VM
From your laptop:
```bash
scp -r deploy/ root@YOUR_VM_IP:~/twenty
```
(or `git clone` your fork on the VM and `cd packages/.../deploy` — wherever you keep it)

### 4. Configure
On the VM, in the deploy folder:
```bash
cp .env.example .env
nano .env          # set IMAGE, SERVER_URL, ENCRYPTION_KEY, PG_DATABASE_PASSWORD
nano Caddyfile     # set your real domain
```
Generate the encryption key with: `openssl rand -base64 32`

### 5. Launch
```bash
docker compose pull
docker compose up -d
docker compose logs -f server   # wait for migrations + "healthy"
```

Visit `https://crm.yourdomain.com` and sign up the first (admin) user.

---

## Deploying updates later
After pushing code to your fork (CI rebuilds `:latest`), on the VM:
```bash
docker compose pull && docker compose up -d
```
Migrations run automatically on the `server` container at boot.

## Rollback
Pin `IMAGE` in `.env` to a specific commit SHA tag, then `up -d`:
```
IMAGE=ghcr.io/YOURUSER/twenty:<old-sha>
```

## Backups
- Postgres data lives in the `twenty_db-data` volume; uploaded files in
  `twenty_server-local-data` (or S3 if configured).
- Back up the `db-data` volume regularly, and keep `ENCRYPTION_KEY` somewhere safe.
- Dump the DB on demand:
  ```bash
  docker compose exec db pg_dump -U postgres default > backup.sql
  ```
