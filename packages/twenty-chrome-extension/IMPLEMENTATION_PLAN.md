# Twenty Browser Extension — Implementation Plan

A Chrome (MV3) extension that captures a contact into a Twenty instance in one
click — from a LinkedIn profile, or from any page via a manual popup. This is a
folkX-style "one-click contact capture" feature.

**Key property:** it is purely additive. It talks to Twenty's existing public
REST API. No changes to `twenty-server` or `twenty-front` are required.

- **Auth:** pasted API key (generated in Twenty → Settings → APIs & Webhooks)
- **Capture sources (v1):** LinkedIn profiles + generic "any page" manual popup
- **Target:** Chrome / Chromium MV3, loaded unpacked for personal use

---

## 1. Package layout

New package `packages/twenty-chrome-extension/` (Vite + React + TS, matching the
monorepo conventions):

```
twenty-chrome-extension/
├── manifest.json              # MV3
├── src/
│   ├── background/
│   │   └── service-worker.ts  # all API calls (bypasses CORS via host_permissions)
│   ├── content/
│   │   └── linkedin.ts        # injects "Save to Twenty" button, scrapes DOM
│   ├── popup/                 # manual "add contact on any page" form
│   ├── options/               # paste instance URL + API key
│   ├── lib/
│   │   ├── twenty-client.ts   # REST wrappers (find-or-create company, upsert person)
│   │   ├── linkedin-scraper.ts# DOM selectors → ContactDraft
│   │   └── storage.ts         # chrome.storage.local wrapper
│   └── types.ts
└── vite.config.ts
```

## 2. Auth (pasted API key)

- Options page stores `{ instanceUrl, apiKey }` in `chrome.storage.local`.
- User generates the key in Twenty → **Settings → APIs & Webhooks** (existing
  `api-key` module).
- Every API call sends header `Authorization: Bearer <apiKey>`.
- All `fetch` happens in the **background service worker** with `host_permissions`
  for the instance URL → no CORS issues. Content scripts never call the API
  directly; they `chrome.runtime.sendMessage` to the worker.

## 3. API contract (verified against the repo)

Twenty's generic REST API: `@Controller('rest')`, `POST /rest/<objectNamePlural>`.

**Person** (`person.workspace-entity.ts`) uses composite fields, so payloads are
nested:

```jsonc
POST /rest/people
{
  "name":         { "firstName": "Jane", "lastName": "Doe" },
  "jobTitle":     "Head of Sales",
  "city":         "Berlin",
  "linkedinLink": { "primaryLinkUrl": "https://www.linkedin.com/in/janedoe" },
  "emails":       { "primaryEmail": "jane@acme.com" },
  "companyId":    "<uuid-from-company-step>"
}
```

Confirmed person field API names: `name` (FULL_NAME), `emails` (EMAILS),
`phones` (PHONES), `linkedinLink` & `xLink` (LINKS), `jobTitle`, `city`,
`avatarUrl`, and the `company` relation (set via `companyId`).

**Company:** `POST /rest/companies` with
`{ "name": "...", "domainName": { "primaryLinkUrl": "acme.com" } }`
*(verify company's exact field names during Milestone 0).*

## 4. Dedup strategy (find-or-create)

1. **Company:** `GET /rest/companies?filter=name[eq]:Acme` → reuse id if found,
   else create.
2. **Person:** `GET /rest/people?filter=linkedinLink.primaryLinkUrl[eq]:<url>` →
   if exists, PATCH to fill blanks; else create. LinkedIn URL is the stable
   dedup key; fall back to email, then first+last name.

All standard REST reads + writes — no server-side upsert needed.

## 5. LinkedIn scraping (`linkedin-scraper.ts`)

- `content_scripts` matches `https://www.linkedin.com/in/*`.
- Inject a floating "Save to Twenty" button.
- Scrape from the profile DOM: full name (→ split first/last), headline →
  `jobTitle`, current company, location → `city`, and `window.location.href` →
  `linkedinLink`.
- **Known fragility:** LinkedIn's DOM/class names change often and they actively
  discourage scraping. Mitigation: keep all selectors in one file with
  fallbacks, prefer structure/aria over class names, and fail soft (open the
  manual popup pre-filled when a field is missing).

## 6. Generic "any page" capture (popup)

- Toolbar popup with a small form (name, email, company, title, URL),
  pre-filled with the active tab's title/URL and any selected text.
- Same `twenty-client` path as LinkedIn. Also the graceful fallback when
  LinkedIn scraping misses fields.

## 7. Build & load

- `vite build` → `dist/`, loaded **unpacked** via `chrome://extensions` for dev
  (no Web Store needed for personal use).
- Add nx targets (`build`, `lint`, `typecheck`) consistent with other packages.

## Milestones

| # | Deliverable | Est. |
|---|-------------|------|
| 0 | Scaffold package, manifest, options page; confirm an API key round-trips a `POST /rest/people` | ~0.5 day |
| 1 | Background `twenty-client` with find-or-create company + person + dedup | ~1 day |
| 2 | Generic popup capture (works on any page) | ~1 day |
| 3 | LinkedIn content script + scraper + inject button | ~1.5 days |
| 4 | Polish: error/toast states, company logo/avatar, settings validation | ~1–2 days |

**~1 week** for a solid personal-use MVP. Milestones 0–2 give a working
"capture from any page" tool in ~2 days, with LinkedIn layered on after.

## Open items to confirm before coding

1. Company entity's exact field API names (`domainName` shape) — quick check.
2. Whether the API key's role has create permission on People/Companies
   (Twenty has per-role API-key permissions).
3. REST filter syntax for the dedup GETs (`filter=field[eq]:value` vs depth
   params) — verify against `engine/api/rest`.

---

## Why this is low-risk on Twenty's architecture

- The write path already exists: generic REST API at `POST /rest/*path`.
- CORS is not a blocker: an MV3 background service worker with `host_permissions`
  bypasses CORS entirely.
- API keys are a first-class feature (`api-key` module + generator command).

The defensible/hard parts of a CRM (sequences, engagement analytics) are out of
scope here — this is an additive client over the existing API.
