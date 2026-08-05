# Browser-based access without the tailnet

Status: design, not yet deployed. Nothing in this document is live.

Today production is reachable only from the tailnet
(`spectech-llm.tail7ba35e.ts.net`). That is a strong perimeter, but it costs a
client install for every person and every device. This document describes
replacing it with Cloudflare Access in front of the Cloudflare Tunnel already
scripted in `deploy/setup-tunnel.sh`, so people authenticate with Google in a
browser instead of joining the tailnet.

The goal is to change *how* people prove who they are, not to remove the
requirement that they prove it. Do not deploy the tunnel without Access in
front of it. A tunnel alone publishes the CRM to the internet.

## Why this instead of going public

Access authenticates the request at Cloudflare's edge and rejects it before it
reaches the origin. An unauthenticated attacker cannot reach the login page,
the GraphQL endpoint, or any Twenty CVE, which is the property the tailnet
gives us today and the one worth keeping.

What it does not give us is device identity. Tailscale authenticates the
machine and the person; Access authenticates only the person. A phished Google
account gets in from any device. Enforce 2FA on the Google Workspace accounts
and keep Access sessions short to narrow that gap.

## Pre-flight

These must be true before the tunnel carries production traffic. Each one is
currently set the permissive way because the tailnet made it irrelevant.

- [ ] No `@apple.dev` seed user exists in production. Their password is
      published in the open-source repo, and production currently reports
      `signInPrefilled: true`, so its login page prefills those credentials.
      Check: `psql -d default -Atc 'SELECT email FROM core."user"'`
- [ ] `signInPrefilled` is off in production.
- [ ] Public invite link disabled (`isPublicInviteLinkEnabled` is currently
      true).
- [ ] Two-factor enforced (`isTwoFactorAuthenticationEnforced` is currently
      false).
- [ ] A captcha driver is configured. `CaptchaGuard` already decorates the auth
      mutations but no-ops while `CAPTCHA_DRIVER` is unset.
- [ ] Email verification required (`isEmailVerificationRequired` is currently
      false).

## Hostname and policy design

`setup-tunnel.sh` publishes two hostnames:

| Hostname | Origin | Notes |
| --- | --- | --- |
| `crm.spec.tech` | frontend | script currently points at `:3001`, the dev vite server |
| `api.crm.spec.tech` | `:3000` | the backend |

Two things follow.

**The script's frontend port is wrong for production.** Production serves the
*built* frontend on `:3010` via `serve-public.sh`; `:3001` is a developer's
vite dev server. Parameterise the port before using this script for anything
but local development.

**Both hostnames need a policy, in one application.** Protecting only
`crm.spec.tech` leaves the API open, which protects nothing. Put both hostnames
in a single Access application so one Google sign-in covers both; otherwise the
browser holds a session for the frontend and gets redirected mid-XHR when it
calls the API.

Suggested policies on that application:

1. **Allow** — emails ending `@spec.tech`. This is the team.
2. **Allow** — an explicit list of external addresses, for contractors and
   advisors. This list is the thing you audit; keep it short and dated.
3. **Service token** — for machine callers. See below.

Set the session duration to something short (a working day). Access sessions
are independent of Twenty's own session, so a revoked Google account still
holds an Access session until it expires.

## Machine callers will break

Access challenges every request with a browser redirect, which non-browser
clients cannot follow. Anything holding a Twenty API key stops working the
moment Access goes live. Known callers to check before cutting over:

- the folk sync integration
- any Zapier connections
- webhooks *into* Twenty from third parties
- the `workspace:generate-api-key` keys issued for scripts

Each needs either a Cloudflare service token (a header pair the client sends,
matched by the service-token policy) or a bypass policy scoped to a specific
path. Prefer service tokens. A path bypass on `/webhooks` is an unauthenticated
hole in exactly the way we are trying to avoid, so scope it narrowly and
require Twenty's own webhook signature verification behind it.

## Setup

1. Confirm every pre-flight box above.
2. Parameterise the frontend port in `setup-tunnel.sh`, then run it on the
   deploy host. This creates the tunnel and the DNS records but does not start
   it.
3. In the Cloudflare dashboard, create an Access application covering both
   hostnames, with the policies above, *before* starting the tunnel.
4. Start the tunnel.
5. Verify, from a device that is not on the tailnet and not signed in:
   - `https://crm.spec.tech` returns the Cloudflare login challenge, not
     Twenty's login page.
   - `https://api.crm.spec.tech/healthz` also challenges. If it answers
     directly, the API hostname is unprotected and you must stop.
   - After signing in with a `@spec.tech` account, the app loads and behaves
     normally.
   - Signing in with a personal Google account is refused.
6. Leave the tailnet in place. It costs nothing to keep and is the way back in
   if Access locks everyone out.

## Rollback

Stop the tunnel (`sudo launchctl stop com.cloudflare.cloudflared`). The
hostnames stop resolving to the origin and tailnet access is unaffected, since
it never depended on any of this.

## Open questions

- Whether to keep `api.crm.spec.tech` as a separate hostname at all. Serving
  the API under a path on `crm.spec.tech` would remove the cross-hostname
  session problem entirely, at the cost of changing `SERVER_URL` and the
  frontend's API base.
- Whether Access sits in front of staging too, or staging stays tailnet-only.
  Tailnet-only is simpler and staging has no external users.
