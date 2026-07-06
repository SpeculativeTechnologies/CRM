# Team workflow — SpeculativeTechnologies/CRM

How multiple people work on this fork without breaking the live instance.

## The three copies of the code

| Copy | Where | Purpose | Rule |
|---|---|---|---|
| GitHub fork | `SpeculativeTechnologies/CRM` | Source of truth | All changes land on `main` via PR |
| Deploy clone | `~/Deploy/twenty` (Ben's Mac) | Runs the live stack (backend :3000, worker, frontend :3010) | Only ever `git pull origin main` — never edit here |
| Dev clones | each developer's machine | Where work happens | Feature branches, own local DB |

## Day-to-day development

1. Clone the fork, set up your environment:
   ```bash
   git clone git@github.com:SpeculativeTechnologies/CRM.git twenty && cd twenty
   bash packages/twenty-utils/setup-dev-env.sh   # postgres/redis, .env files, DB init
   cp deploy/git-hooks/post-merge .git/hooks/    # auto-sync DB after pulls
   yarn start                                    # front :3001, back :3000, worker
   ```
   You develop against your **own local database** (seeded demo data), never the
   production one.
2. Branch from up-to-date `main`: `git switch -c yourname/short-description`
3. Commit, push, open a PR against `main` on the fork.
4. CI ("CI Fork" workflow) runs automatically: typecheck + lint + unit tests on
   affected packages. The PR can't merge until `ci-fork-status-check` is green.
5. Get a review (see below), merge on GitHub.

## PR rules

- `main` is protected: no direct pushes, no force-pushes; PRs need CI green.
- Anything touching these needs Ben's review before merge (highest blast
  radius — they run against the production database):
  - `*.entity.ts` files or migrations/instance commands
    (`packages/twenty-server/src/database/**`)
  - `deploy/**` (the scripts that run the live stack)
- Entity changes MUST include a generated instance command in the same PR:
  `npx nx run twenty-server:database:migrate:generate --name <name> --type <fast|slow>`
- Never edit the `up`/`down` of an already-merged instance command.
- GraphQL schema changes: regenerate frontend types in the same PR
  (`npx nx run twenty-front:graphql:generate`).

## Syncing with upstream twentyhq/twenty

One person (Ben) owns this; nobody else touches `upstream`.

```bash
git fetch upstream
git switch -c sync/upstream-$(date +%Y-%m-%d) main
git merge upstream/main        # resolve conflicts with our custom commits
# open as a PR like any other change; CI validates it
```

After an upstream-sync PR merges, every developer should pull and run
`bash deploy/update-after-merge.sh` (the post-merge hook does it automatically
when schema files changed) — otherwise you get the blank-screen
"Cannot return null for non-nullable field" boot failure.

## Deploying to the live instance

The live stack serves from `~/Deploy/twenty` and is supervised by
`deploy/keepalive-public.sh` (or the launchd plist). To deploy what's on `main`:

```bash
cd ~/Deploy/twenty
git pull origin main           # post-merge hook runs update-after-merge.sh if needed
bash deploy/publish-frontend.sh   # only if frontend changed (backend hot-reloads)
```

Backend changes hot-reload (the server runs in watch mode); frontend changes
require the publish step. A full stack restart is only needed if
`deploy/serve-public.sh` itself changed — see the restart procedure in
`deploy/README.md` / serve-public-stack ops notes (kill ALL process patterns,
verify :3000/:3010 are free, let keepalive relaunch).
