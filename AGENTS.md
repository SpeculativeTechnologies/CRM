# Speculative Technologies CRM agent instructions

This fork runs the live CRM used by the team. Treat repository and data safety
as part of every implementation task.

## Mandatory sources

Before modifying code, configuration, schema, or deployment files:

1. Read `deploy/LLM-LOCAL-DEV.md` in full.
2. Follow `deploy/TEAM-WORKFLOW.md` as the authoritative human workflow.
3. Follow `CLAUDE.md` for code conventions and repository commands.
4. Read the applicable environment guide under `deploy/` before touching
   development, staging, or production tooling.

Keep detailed procedures in those files. Do not duplicate or silently replace
them here.

## Operating contract

- The user delegates coding and Git operation to the coding agent. Do not ask
  the user to edit files or run Git commands.
- Explain product decisions, risks, failed checks, and requested approvals in
  plain language. Ask the user when a material product choice is genuinely
  required; do not ask them to resolve routine implementation details.
- Unless the user explicitly requests local-only work, an implementation
  request includes creating a feature branch, implementing and verifying the
  change, committing it, pushing that feature branch, and opening or updating a
  pull request when GitHub access is available.
- Never push directly to `main`, merge a pull request, initiate staging, or
  initiate production deployment. Ben, the production owner, controls
  promotion.
- End implementation work with a clear handoff: branch or pull request,
  verification performed, failures or omissions, risk areas, and what Ben
  should validate on staging.

## Hard safety rules

- Work only in a developer checkout with developer-owned Postgres, Redis, and
  storage. Never develop in `/Users/ben/Deploy/twenty`.
- Never point development or staging code at production services, secrets, or
  environment files.
- If an environment guard refuses a command, stop and report the refusal. Do
  not bypass it.
- Never repair schema drift with manual SQL. Schema changes travel through
  committed instance commands and workspace upgrades.
- Never expose mirror records, dumps, names, companies, notes, or screenshots
  in commits, pull requests, issues, logs, or hosted artifacts.

## Data and verification

- Use `bash deploy/local-data.sh seed` for UI, copy, frontend state, and
  isolated utility work.
- Use `bash deploy/local-data.sh mirror` for entities, instance commands,
  workspace upgrades, views, search, permissions, or any migration.
- For schema changes, test both an existing-database upgrade and clean
  initialization, then retest against mirrored data as required by
  `deploy/LLM-LOCAL-DEV.md`.
- Run the relevant lint, typecheck, and focused test commands from `CLAUDE.md`.
  Report the commands and actual outcomes; never describe a skipped or failed
  check as passing.
- Pull requests must explain what changed and why, testing performed,
  operationally sensitive areas, rollback, and screenshots for visible UI
  changes. Screenshots must use fixture data, never mirror data.
