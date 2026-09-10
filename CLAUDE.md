# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Twenty is an open-source CRM built with modern technologies in a monorepo structure. The codebase is organized as an Nx workspace with multiple packages.

## Key Commands

### Development
```bash
# Start development environment (frontend + backend + worker)
yarn start

# Individual package development
npx nx start twenty-front     # Start frontend dev server
npx nx start twenty-server    # Start backend server
npx nx run twenty-server:worker  # Start background worker
```

### Testing
```bash
# Preferred: run a single test file (fast)
npx jest path/to/test.test.ts --config=packages/PROJECT/jest.config.mjs

# Run all tests for a package
npx nx test twenty-front      # Frontend unit tests
npx nx test twenty-server     # Backend unit tests
npx nx run twenty-server:test:integration:with-db-reset  # Integration tests with DB reset
# To run an individual test or a pattern of tests, use the following command:
cd packages/{workspace} && npx jest "pattern or filename"

# Storybook
npx nx storybook:build twenty-front
npx nx storybook:test twenty-front

# Local mirror: Continue with Email, a mirrored CRM account, password devmirror.
# Synthetic fixture only: use the prefilled credentials.
```

### Browser Automation

Two browser paths are available. Default to Playwright.

- **Playwright MCP** (configured in `.mcp.json`, headless chromium) for all local
  development UI work: verifying a change in the running app, screenshots for a
  pull request, reproducing a frontend bug, reading console and network activity.
  It runs in an isolated browser, so it cannot disturb a developer's own tabs or
  sessions. This also matches `twenty-e2e-testing`, which is Playwright based.
- **Claude in Chrome** only when an already-authenticated session is genuinely
  required, such as the deployed CRM behind Cloudflare Access. It drives the
  developer's real browser, so say so before using it and never use it to reach
  production data for routine verification.

Screenshots must come from fixture or seed data, never mirrored records.

### Code Quality
```bash
# Linting (diff with main - fastest, always prefer this)
npx nx lint:diff-with-main twenty-front
npx nx lint:diff-with-main twenty-server
npx nx lint:diff-with-main twenty-front --configuration=fix  # Auto-fix

# Linting (full project - slower, use only when needed)
npx nx lint twenty-front
npx nx lint twenty-server

# Type checking
npx nx typecheck twenty-front
npx nx typecheck twenty-server

# Format code
npx nx fmt twenty-front
npx nx fmt twenty-server
```

### Build
```bash
# Build packages (twenty-shared must be built first)
npx nx build twenty-shared
npx nx build twenty-front
npx nx build twenty-server
```

### Database Operations
```bash
# Database management
npx nx database:reset twenty-server         # Reset database
npx nx run twenty-server:database:init:prod # Initialize database
npx nx run twenty-server:database:migrate:prod # Run instance commands (fast only)

# Generate an instance command (fast or slow)
npx nx run twenty-server:database:migrate:generate --name <name> --type <fast|slow>
```

### Database Inspection (Postgres MCP)

A read-only Postgres MCP server is configured in `.mcp.json`. Use it to:
- Inspect workspace data, metadata, and object definitions while developing
- Verify migration results (columns, types, constraints) after running migrations
- Explore the multi-tenant schema structure (core, metadata, workspace-specific schemas)
- Debug issues by querying raw data to confirm whether a bug is frontend, backend, or data-level
- Inspect metadata tables to debug GraphQL schema generation issues

This server is read-only — for write operations (reset, migrations, sync), use the CLI commands above.

### GraphQL
```bash
# Generate GraphQL types (run after schema changes)
npx nx run twenty-front:graphql:generate
npx nx run twenty-front:graphql:generate --configuration=metadata
```

## Architecture Overview

### Tech Stack
- **Frontend**: React 18, TypeScript, Jotai (state management), Linaria (styling), Vite
- **Backend**: NestJS, TypeORM, PostgreSQL, Redis, GraphQL (with GraphQL Yoga)
- **Monorepo**: Nx workspace managed with Yarn 4

### Package Structure
```
packages/
├── twenty-front/          # React frontend application
├── twenty-server/         # NestJS backend API
├── twenty-ui/             # Shared UI components library
├── twenty-shared/         # Common types and utilities
├── twenty-emails/         # Email templates with React Email
├── twenty-website/    # Next.js marketing website
├── twenty-docs/           # Documentation website
├── twenty-zapier/         # Zapier integration
└── twenty-e2e-testing/    # Playwright E2E tests
```

### Key Development Principles
- **Functional components only** (no class components)
- **Named exports only** (no default exports)
- **Types over interfaces** (except when extending third-party interfaces)
- **String literals over enums** (except for GraphQL enums)
- **No 'any' type allowed** — strict TypeScript enforced
- **Event handlers preferred over useEffect** for state updates
- **Props down, events up** — unidirectional data flow
- **Composition over inheritance**
- **No abbreviations** in variable names (`user` not `u`, `fieldMetadata` not `fm`)

### Naming Conventions
- **Variables/functions**: camelCase
- **Constants**: SCREAMING_SNAKE_CASE
- **Types/Classes**: PascalCase (suffix component props with `Props`, e.g. `ButtonProps`)
- **Files/directories**: kebab-case with descriptive suffixes (`.component.tsx`, `.service.ts`, `.entity.ts`, `.dto.ts`, `.module.ts`)
- **TypeScript generics**: descriptive names (`TData` not `T`)

### File Structure
- Components under 300 lines, services under 500 lines
- Components in their own directories with tests and stories
- Use `index.ts` barrel exports for clean imports
- Import order: external libraries first, then internal (`@/`), then relative

### Comments
- Use short-form comments (`//`), not JSDoc blocks
- Explain WHY (business logic), not WHAT
- Do not comment obvious code
- Multi-line comments use multiple `//` lines, not `/** */`

### State Management
- **Jotai** for global state: atoms for primitive state, selectors for derived state, atom families for dynamic collections
- Component-specific state with React hooks (`useState`, `useReducer` for complex logic)
- GraphQL cache managed by Apollo Client
- Use functional state updates: `setState(prev => prev + 1)`

### Backend Architecture
- **NestJS modules** for feature organization
- **TypeORM** for database ORM with PostgreSQL
- **GraphQL** API with code-first approach
- **Redis** for caching and session management
- **BullMQ** for background job processing

### Database & Upgrade Commands
- **PostgreSQL** as primary database
- **Redis** for caching and sessions
- **ClickHouse** for analytics (when enabled)
- When changing entity files, generate an **instance command** (`database:migrate:generate --name <name> --type <fast|slow>`)
- **Fast** instance commands handle schema changes; **slow** ones add a `runDataMigration` step for data backfills
- **Workspace commands** iterate over all active/suspended workspaces for per-workspace upgrades
- Commands use `@RegisteredInstanceCommand` and `@RegisteredWorkspaceCommand` decorators for automatic discovery
- Include both `up` and `down` logic in instance commands
- Never delete or rewrite committed instance command `up`/`down` logic
- See `packages/twenty-server/docs/UPGRADE_COMMANDS.md` for full documentation

### Utility Helpers
Use existing helpers from `twenty-shared` instead of manual type guards:
- `isDefined()`, `isNonEmptyString()`, `isNonEmptyArray()`

## Development Workflow

IMPORTANT: Use Context7 for code generation, setup or configuration steps, or library/API documentation. Automatically use the Context7 MCP tools to resolve library IDs and get library docs without waiting for explicit requests.

### Before Making Changes
1. Always run linting (`lint:diff-with-main`) and type checking after code changes
2. Test changes with relevant test suites (prefer single-file test runs)
3. Ensure instance commands are generated for entity changes (`database:migrate:generate`)
4. Check that GraphQL schema changes are backward compatible
5. Run `graphql:generate` after any GraphQL schema changes

### Code Style Notes
- Use **Linaria** for styling with zero-runtime CSS-in-JS (styled-components pattern)
- Follow **Nx** workspace conventions for imports
- Use **Lingui** for internationalization
- Apply security first, then formatting (sanitize before format)

### Testing Strategy
- **Test behavior, not implementation** — focus on user perspective
- **Test pyramid**: 70% unit, 20% integration, 10% E2E
- Query by user-visible elements (text, roles, labels) over test IDs
- Use `@testing-library/user-event` for realistic interactions
- Descriptive test names: "should [behavior] when [condition]"
- Clear mocks between tests with `jest.clearAllMocks()`

## Working on a developer machine

This fork runs the live CRM used by the team. Treat repository and data safety as
part of every implementation task. `AGENTS.md` is a Git symlink to this file;
edit this file to update instructions for both agents, and preserve that link.

### Mandatory sources

Before modifying code, configuration, schema, or deployment files:

1. Read `deploy/LLM-LOCAL-DEV.md` in full.
2. Follow `deploy/TEAM-WORKFLOW.md` as the authoritative human workflow.
3. Follow this file for code conventions and repository commands.
4. Read the applicable environment guide under `deploy/` before touching
   development, staging, or production tooling.
5. For an upstream sync, or any conflict with `twentyhq/twenty`, follow
   `deploy/UPSTREAM-SYNC.md`: it holds the resolution policy, the recurring
   hotspots, and the rules that keep new fork work mergeable.
6. For anything about the **deployed** CRM — the cloud boxes, deploys, backups,
   restores, DNS, or incident response — read the private
   `SpeculativeTechnologies/crm-ops` repository. Production runs on Google Cloud
   behind a Cloudflare tunnel, and none of that is documented in this repository.
   Start with its `deploy/CLOUD-OPS.md`.

Keep detailed procedures in those files. Do not duplicate or silently replace
them here. Operational detail about production belongs in `crm-ops`, which is
private because it describes a live system; this repository is public.

### Operating contract

- The user delegates coding and Git operations to the coding agent. Do not ask
  the user to edit files or run Git commands.
- Explain product decisions, risks, failed checks, and requested approvals in
  plain language. Ask the user when a material product choice is genuinely
  required; do not ask them to resolve routine implementation details.
- Unless the user explicitly requests local-only work, an implementation request
  includes creating a feature branch, implementing and verifying the change,
  committing it, pushing that feature branch, and opening or updating a pull
  request when GitHub access is available.
- Never push directly to `main`. Merging a pull request, deploying to staging,
  and recording a staging check require explicit user approval under the
  delegation below. An implementation request or successful local test alone
  does not authorize these actions.
- Do not initiate production deployment or approve its environment gate under
  this delegation. Production remains a separate owner-controlled decision.
- End implementation work with a clear handoff: branch or pull request,
  verification performed, failures or omissions, risk areas, and what Ben should
  validate on staging.

### Explicitly approved workflow through staging

The user may delegate all or part of this sequence to the coding agent:

1. Review the PR and its exact-head CI results, resolve actionable findings,
   and merge it through GitHub once explicitly approved and all required checks
   and reviews are satisfied. Follow `deploy/TEAM-WORKFLOW.md` and CODEOWNERS
   for review requirements; do not substitute the agent's own review for a
   required independent or production-owner review.
2. Wait for CI to publish and certify the resulting full merge SHA's immutable
   release image. Report its digest and the exact-commit check results.
3. Run **Deploy to staging** for that approved SHA and digest, follow the
   correlated deployment to completion, and exercise the agreed behavior and
   normal CRM smoke-test paths on that recorded staging deployment.
4. Run **Record a staging check** with the deployment ID, the actual pass/fail
   result, and a concrete account of what was exercised. A health check alone
   or local acceptance is not evidence that the staging behavior passed.

Prepare the review, check results, risks, and proposed staging test scope before
requesting approval. Read-only review and CI inspection do not need approval.
Approval must identify the PR and reviewed head SHA, the permitted steps, and
staging as the destination. One explicit approval may cover steps 1-4, including
the immutable artifact produced by merging that approved head and recording the
observed staging result. Carry that approval forward without asking again for
already authorized steps. Editing these instructions is not approval to run
the sequence for a particular PR.

If the PR head, release contents, destination, or test scope changes beyond the
approval, prepare the changed proposal and obtain approval for the affected
action. Never silently deploy a newer moving `main`. If staging changes during
testing, retest the actual deployment before recording its result.

Read `deploy/LLM-LOCAL-DEV.md`, `deploy/TEAM-WORKFLOW.md`, `deploy/STAGING.md`,
and the private `crm-ops` runbook before staging operations. Use the normal
GitHub workflows; preserve environment guards, required reviews, artifact
certification, authentication, and audit records. Approval does not grant
missing credentials or bypass platform restrictions. If an independent review,
human environment approval, or interactive sign-in is required, report that
specific dependency and complete the unblocked work. Never claim an untested
path passed. Stop after recording the staging result and provide the SHA,
digest, deployment ID, tested behavior, and remaining production handoff.

### When working on multiple issues at once

Use parallel subagents when the issues can be implemented independently. Give
each issue its own worktree, feature branch, acceptance checklist, focused
tests, and pull request. Start the branches from current `origin/main` or an
explicitly agreed common base, and keep each pull request independently
reviewable and revertible. Subagents must not share a working tree or edit the
same branch. The coordinating agent owns dependency decisions, integration
testing, merge order, and the final release handoff.

Follow `deploy/LOCAL-DEV.md` in every feature worktree. Its supervisor assigns
separate Postgres, Redis, uploads, ports, and signing secrets. Run the focused
behavior tests and required checks for every issue on its own branch; combined
acceptance testing does not replace per-PR verification or exact-head CI. Avoid
running several heavy builds concurrently, and use `yarn check:local --parallel
1` when other worktrees are compiling.

For one local CRM containing all of the changes, create a temporary integration
worktree and branch from the agreed base, then merge the exact feature-branch
heads into it in the intended order. Run that integration worktree against its
own verified mirror and exercise every issue's acceptance checklist, normal CRM
smoke paths, and interactions between the changes through one local URL. Keep
the feature branches and pull requests separate. Apply fixes to the owning
feature branch, repeat its focused verification, update its PR head, and rebuild
the integration branch from the final heads. The integration branch is normally
local-only and its combined test is additional evidence, not a substitute for
the individual pull requests and their checks.

Database or schema changes remain self-contained in their owning pull request,
including generated instance commands and individual existing-database and
clean-initialization tests. After those pass separately, rehearse the combined
migration order in the integration worktree against a fixed verified mirror.
Resolve migration ordering, GraphQL generation, shared-file conflicts, and
cross-issue behavior before asking to merge the batch.

A batch may move through staging together. Before requesting approval, present
the complete batch: every PR number and reviewed head SHA, their merge order,
required reviews and exact-head CI results, the expected final `main` contents,
risks, and the combined staging test scope. One explicit user approval may cover
merging all named heads in that order, the immutable artifact produced by the
final merge, one staging deployment of that final SHA and digest, testing every
included change plus normal smoke paths, and recording the observed staging
result. Do not include an unnamed PR or later commit. If a PR head, merge order,
final release contents, destination, or material test scope changes, prepare the
updated batch and obtain approval for the affected action.

After merging the approved PRs, wait for CI to publish and certify the final
full `main` SHA. Deploy that exact SHA and digest to staging once, test the whole
batch on its recorded deployment, and run one **Record a staging check** with
the deployment ID, actual pass/fail result, and a concrete account of every
issue and smoke path exercised. The staging check certifies the complete
deployed release, not its individual pull requests. Any later merge or staging
redeployment creates a different release and requires testing and recording the
actual new deployment. If any included issue fails, do not record a pass or
promote it; fix or revert through reviewed PRs, deploy the new final SHA, and
retest the affected behavior and the batch's normal smoke paths.

When local testing ends, stop only the source watchers and containers owned by
each involved worktree, preserve their data unless asked to discard it, and do
not stop another worktree's services. End the staging workflow with the final
SHA, digest, deployment ID, the PRs included, behavior tested, failures or
limitations, and the remaining production handoff. Production deployment and
its environment approval remain outside this delegation.

### Hard safety rules

- Work only in a developer checkout with developer-owned Postgres, Redis, and
  storage. Never develop on a staging or production cloud VM.
- Never point development or staging code at production services, secrets, or
  environment files.
- If an environment guard refuses a command, stop and report the refusal. Do not
  bypass it.
- Never repair schema drift with manual SQL. Schema changes travel through
  committed instance commands and workspace upgrades.
- Never expose mirror records, dumps, names, companies, notes, or screenshots in
  commits, pull requests, issues, logs, or unapproved hosted artifacts. Only the
  reviewed mirror publisher may write verified dumps to the designated private
  mirror store; see `deploy/DEVELOPMENT.md`.

### Data and verification

- When local testing is finished, stop this task's source watchers and Docker
  containers, preserving local data. Leave them running only for explicitly
  requested ongoing local testing. Follow `deploy/LOCAL-DEV.md` for shutdown;
  do not stop other worktrees' services or delete volumes as routine cleanup.
- Always use the verified development mirror for local feature work and user
  testing, including UI changes. Follow `deploy/LOCAL-DEV.md` for isolated
  worktrees; use `bash deploy/local-data.sh mirror` for the standard checkout.
- Synthetic fixtures are reserved for CI, clean initialization, and shareable
  screenshots. Restore/resume the mirror before handing local testing to Ben.
  Fixtures lack this fork's custom fields, layouts, views, and seven custom
  objects, so fixture-only verification cannot establish CRM compatibility.
- For schema changes, test both an existing-database upgrade and clean
  initialization, then retest against mirrored data as required by
  `deploy/LLM-LOCAL-DEV.md`.
- Run the relevant lint, typecheck, and focused test commands from this file.
  Report the commands and actual outcomes; never describe a skipped or failed
  check as passing.
- Pull requests must explain what changed and why, testing performed,
  operationally sensitive areas, rollback, and screenshots for visible UI
  changes. Screenshots must use fixture data, never mirror data.

## Dev Environment Setup

All dev environments (Claude Code web, Cursor, local) use one script:

```bash
bash packages/twenty-utils/setup-dev-env.sh
```

This handles everything: starts Postgres + Redis (auto-detects local services vs Docker), creates databases, copies `.env` files, and initializes the database schema (runs migrations) on a fresh database. Idempotent — safe to run multiple times.

- `--docker` — force Docker mode (uses `packages/twenty-docker/docker-compose.dev.yml`)
- `--down` — stop services
- `--reset` — wipe data and restart fresh
- **Skip the setup script** for tasks that only read code — architecture questions, code review, documentation, etc.

**Note:** CI workflows (GitHub Actions) manage services via Actions service containers and run setup steps individually — they don't use this script.

## Important Files
- `nx.json` - Nx workspace configuration with task definitions
- `tsconfig.base.json` - Base TypeScript configuration
- `package.json` - Root package with workspace definitions
- `.cursor/rules/` - Detailed development guidelines and best practices

### Migration rehearsal and CI follow-through

Use `deploy/MIGRATION-TESTING.md` for the shared local/CI frozen-baseline command.
Run `bash deploy/ci-follow.sh <full-sha>` after pushing each coherent change;
diagnose failures and verify fixes for their exact commit. Follow the bounded
repair policy and completion fields in `deploy/LLM-LOCAL-DEV.md`, under
“Exact-commit follow-through”. Deployment remains subject to the operating
contract above. A green build or successful push is not the completion report.
