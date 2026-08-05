# Instructions for a coding agent on the deploy host: security preflight

You are on `spectech-llm`. This machine runs the **live CRM**. Read this whole
file before running anything.

Your task is to audit and then correct a set of authentication settings that
are currently permissive because the CRM is only reachable from the tailnet.
None of this changes network exposure. Do not set up a tunnel, do not touch
Cloudflare, and do not make the CRM publicly reachable. That is a separate
decision Ben has not made yet, described in `deploy/ACCESS.md`.

Read `deploy/LLM-DEPLOY-HOST.md` first for the machine layout. Its hard rules
apply here in full.

## Why this work exists

Production sits behind Tailscale, so nothing unauthenticated can reach it. That
made several app-level protections irrelevant, and they were left off. If the
CRM is ever exposed, or a single tailnet device is compromised, those settings
become the only thing standing in the way. We are fixing them now, while the
tailnet is still there to make mistakes survivable.

Established from outside the host, unauthenticated, before you started:

| Setting | Value | Source |
|---|---|---|
| `signInPrefilled` | true | `/client-config` |
| `captcha` | `{}` (unconfigured) | `/client-config` |
| `isEmailVerificationRequired` | false | `/client-config` |
| `isMultiWorkspaceEnabled` | false | `/client-config` |
| `isConfigVariablesInDbEnabled` | true | `/client-config` |
| `isPublicInviteLinkEnabled` | true | mirrored database |
| `isTwoFactorAuthenticationEnforced` | false | mirrored database |

The last two came from a mirror, so confirm them against production yourself
rather than trusting them.

## Hard rules

1. Phase 1 is read-only. Do not change anything until it is complete and
   reported.
2. Never repair anything with manual SQL. Settings changes go through the app
   UI or the admin panel, never `UPDATE`.
3. Do not print secrets. Do not paste `.env` contents, API keys, tokens, or
   password hashes into your output. Report names and whether a value is set,
   never the value.
4. Report actual command output. A skipped check is worse than a failed one.
5. If a guard or permission stops you, stop and report it. Do not work around
   it.
6. Do not proceed to the next phase if the previous one did not fully succeed.

## Phase 0: preflight

```bash
hostname
ls -d /Users/ben/Deploy/twenty
launchctl list | grep -i twenty
curl --fail -s http://127.0.0.1:3000/healthz && echo
curl --fail -s http://127.0.0.1:3010/healthz && echo
```

Stop if the production clone is missing or either health check fails.

## Phase 1: read-only audit

Nothing here changes state. Report all output.

**1a. Seed accounts.** This is the blocking item. The `@apple.dev` users ship
with Twenty's dev seeder and their password is published in the open-source
repo. Combined with `signInPrefilled: true`, an existing seed user means the
production login page prefills working credentials.

```bash
psql -d default -Atc 'SELECT email, "canAccessFullAdminPanel", "canImpersonate" FROM core."user" ORDER BY email'
```

If any address ends in `@apple.dev`, **stop immediately and report it as
urgent**. Do not delete it yourself; Ben decides whether to delete or disable,
and deleting a user cascades.

**1b. Workspace security settings.**

```bash
psql -d default -Atc 'SELECT "displayName", "isPublicInviteLinkEnabled", "isTwoFactorAuthenticationEnforced", "isPasswordAuthEnabled", "isGoogleAuthEnabled" FROM core.workspace'
```

**1c. Where `SIGN_IN_PREFILLED` is set.** Production has
`IS_CONFIG_VARIABLES_IN_DB_ENABLED=true`, so it may come from either the
environment file or the database. Check both. Report only whether each is set
and to what, never surrounding file contents.

```bash
grep -c '^SIGN_IN_PREFILLED' /Users/ben/Deploy/twenty/packages/twenty-server/.env
grep '^SIGN_IN_PREFILLED' /Users/ben/Deploy/twenty/packages/twenty-server/.env
psql -d default -Atc "SELECT key, value, type FROM core.\"keyValuePair\" WHERE key = 'SIGN_IN_PREFILLED'"
```

Database config variables live in `core."keyValuePair"`. An empty result there
means the value is coming from `.env`.

**1d. Machine callers.** Anything holding an API key will break later if Access
is ever introduced, and each key is also a credential that bypasses the login
page today.

```bash
psql -d default -Atc 'SELECT id, name, "expiresAt", "revokedAt" FROM core."apiKey" ORDER BY "createdAt"'
psql -d default -Atc 'SELECT id, "targetUrl", operations FROM core.webhook'
```

Report the list. Do not revoke anything. Ben needs to match them against the
folk sync, Zapier, and any scripts before anything is revoked.

**Stop here.** Report everything from Phase 1 and wait for Ben to confirm
before continuing.

## Phase 2: back up

Only after Ben confirms Phase 1.

```bash
cd /Users/ben/Deploy/twenty
bash deploy/backup-db.sh
```

Confirm the dump reports `OK`. Do not continue without it.

## Phase 3: turn off the developer sign-in prefill

This is the most urgent fix. It makes the production login page prefill
`tim@apple.dev` in both the email and password fields.

Set `SIGN_IN_PREFILLED` to `false` wherever Phase 1c found it. If it is in the
database, use the admin panel config variables screen rather than SQL. If it is
in `.env`, edit that one line and restart the production services the way
`deploy/PRODUCTION.md` describes.

Verify from your own machine, not from the host:

```bash
curl -s https://spectech-llm.tail7ba35e.ts.net/client-config | grep -o '"signInPrefilled":[a-z]*'
```

It must report `false`. A cached frontend bundle can keep serving the old value,
so if it still says true after a restart, republish the frontend with
`bash deploy/publish-frontend.sh` and check again.

## Phase 4: workspace security settings

Do these in the CRM UI as an admin, under Settings, not with SQL. They are
per-workspace application settings and the UI performs side effects that a
direct `UPDATE` would skip.

1. Disable the public invite link.
2. Enforce two-factor authentication. Warn Ben first: every existing user will
   be prompted to enrol on next sign-in, and anyone who cannot complete it is
   locked out. Confirm both Ben and Daniel are ready before you enable it.
3. Require email verification.

After each change, re-run the Phase 1b query and confirm the value actually
moved.

## Phase 5: captcha

`CaptchaGuard` already decorates the auth mutations in the code but does
nothing while `CAPTCHA_DRIVER` is unset. Configuring it needs a provider
account and keys that only Ben can create.

Do not attempt this yourself. Report to Ben that it needs `CAPTCHA_DRIVER`,
`CAPTCHA_SITE_KEY` and `CAPTCHA_SECRET_KEY`, and stop.

## Out of scope

Do not do any of the following without a fresh instruction from Ben:

- Running `deploy/setup-tunnel.sh`, starting `cloudflared`, or configuring
  Cloudflare Access. See `deploy/ACCESS.md` for why this is sequenced after the
  above.
- Enabling Tailscale Funnel or otherwise making the host publicly reachable.
- Revoking API keys or webhooks.
- Deleting users.
- Any change to staging. This work is production only.

## Report format

Finish with a summary that states, for each phase: what you ran, the actual
result, what you changed, and anything you could not verify. Call out
explicitly if any check was skipped and why.
