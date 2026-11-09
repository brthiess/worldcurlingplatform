# Local application setup

WCP-001 delivers the persisted public scorecard, event/game detail, and four scoped demo personas. Node 20.19+, npm 10.8+, and PostgreSQL 13+ are required. Packages are pinned in `package-lock.json`. No crawler process, paid provider, or external database is needed.

## Database and configuration

Use a dedicated database. On this Windows review machine, PostgreSQL 13 runs in the project-local cluster at `C:/Users/brthi/Projects/world-curling-platform-2/.runtime/wcp001/pgdata`, listening only on `127.0.0.1:55431`. This cluster was created specifically for the application; it is independent of the installed PostgreSQL service.

To reproduce that isolated cluster from the repository root, use a new empty directory:

```powershell
New-Item -ItemType Directory -Force .runtime/wcp001 | Out-Null
& 'C:/Program Files/PostgreSQL/13/bin/initdb.exe' -D "$PWD/.runtime/wcp001/pgdata" -U wcp_local --auth=trust --encoding=UTF8 --locale=C
& 'C:/Program Files/PostgreSQL/13/bin/pg_ctl.exe' -D "$PWD/.runtime/wcp001/pgdata" -l "$PWD/.runtime/wcp001/postgres.log" -o '-h 127.0.0.1 -p 55431' start
& 'C:/Program Files/PostgreSQL/13/bin/createdb.exe' -h 127.0.0.1 -p 55431 -U wcp_local wcp001
```

From the application checkout:

```powershell
Copy-Item .env.example .env
npm ci
```

Set `DATABASE_URL` to your dedicated PostgreSQL database. Generate a unique `BETTER_AUTH_SECRET` with at least 32 characters and a `DEMO_PASSWORD` with at least 12 characters in `.env`. Keep `BETTER_AUTH_URL` consistent with `HOST`/`PORT`; the default is `http://127.0.0.1:3100`. The launcher sets the correct standard Node environment automatically. No secret has a default in the application or public UI.

```powershell
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://127.0.0.1:3100`. A production run is `npm run build`, then `npm start`. Start the background process separately with `npm run worker`; Ctrl+C/SIGTERM drains work before closing database connections. `npm run worker:probe` starts an in-process worker and a separate producer, then verifies completion and returned output through pg-boss's API.

For concurrent worktrees, share the isolated PostgreSQL server while using a separate database, for example `wcp002`, and a separate app port, for example `3101`. Set each checkout's `DATABASE_URL`, `PORT`, and `BETTER_AUTH_URL` independently. Tests read that checkout's environment. Do not point them at another ticket's scenario.

## Fictional scenario and reset

`ALLOW_DEMO_SEED=true` explicitly enables the seed. The original Prairie scoring-review scenario retains its representative games, completed/live/scheduled/empty draws and private second edition for scope checks. A separate main demonstration now operates the complete stored16-team triple-knockout graph; it does not replace or rewrite that earlier evidence.

The sign-in page offers `administrator`, `organizer`, `scorekeeper`, and `reviewer`; their emails are respectively `<role>@demo.invalid`. All use the local operator's `DEMO_PASSWORD`. The administrator has platform scope; the organizer has its explicitly seeded editions; the read-only reviewer retains Prairie scope. The scorekeeper has the original Prairie game2 plus one explicit main-demo B05 game assignment. A separate unassigned test account supports the role-grant API verification.

The original seed transaction and each main-scenario entry/graph/schedule/scoring command are atomic. An initialization audit marker preserves subsequent main-scenario operation. Seeding is repeatable: existing scores, password hashes, sessions, and later commands are preserved. Existing non-demo events at the fixture IDs cause refusal. To reset without affecting other data, create a **new dedicated database**, change only `DATABASE_URL`, and run migrate/seed again. The prior database remains available. To change seeded passwords, use a new scenario database; rerunning seed intentionally does not silently rotate credentials.

## API boundary

### Main16-team review workflow

Open the homepage's **Main16-team triple knockout** link or `/?event=main-triple-2026`. The separate fictional edition is `main-triple-2026`, division `main-triple-sixteen`. At first seed, the current/latest draw is B01 and the next scheduled draw contains B05, Fictional T16 against Fictional T05. The published bracket/list follows stored sources; select T16 to see its A01 loss, B01 win and actual next B05 assignment. The chosen event/draw and bracket team/view/path selections remain in their URLs.

The complete graph has40 actual games, including33 qualification games and7 fixed playoff games. The initialized prefix has18 actual confirmed A/B results. Only A01, B01, B05 and C04 have explicitly assigned session times; other times remain unknown. Every fictional entry declares four fictional players. Defaulted game lineups retain their evidence label and do not claim independent verification of stone delivery.

The scorekeeper can operate its assigned B05 at the game link from the workspace. The organizer can operate the remaining games and schedule them through `/admin/schedule?event=main-triple-2026`. For the independently reviewed complete literal results and expected T16 A/B/C championship path, use `docs/draws.md`; follow dependencies before starting games. The initial scenario itself does not claim that future fixture results already happened. A new isolated database provides a fresh coherent reset while retaining the old database's immutable history.

Create another draw from `/admin/draws`: explicitly select the triple profile and16 admitted entries, save/review the complete preview, then publish. Replacing a published graph or repairing already-played downstream games remains outside this bounded command. See `docs/api/draws.md` for the command/replay/privacy contract.

| Endpoint | Behavior |
|---|---|
| `GET /api/v1/public/events/:id` | Explicit public event/draw/score projection; unpublished/unknown event returns 404. |
| `GET /api/v1/public/games/:id` | Published game detail with its event and venue time context. |
| `/api/auth/*` | Better Auth email/password sign-in, database sessions and sign-out. Public registration is disabled for this local demo slice. |
| `GET /api/v1/workspace` | Requires a valid database session; returns only games allowed by current grants. |
| `GET /api/v1/games/:id/access` | Returns server-derived read/score/manage decisions; unassigned games return 403. |
| `POST /api/v1/role-grants` | Current global administrator only; same-origin JSON `{id,userId,role,eventId,gameId}`. Roles: organizer/reviewer for an event, scorekeeper for a game in that event. Validates resource scope, applies grant/audit atomically, supports identical request-ID retries, rejects conflicting IDs. Does not issue global administrator grants. |

Every application route checks the actual database session and current role grants. Neither client role labels nor cookie presence confers authority. Role grant writes recheck administrator authority inside the transaction. Public score projections exclude people, credential records, internal jobs and audit payloads. Local demo email addresses are not delivery-capable. Hosted registration/recovery and email delivery remain outside this first slice.

## Verification

Run against your isolated seeded database and running application:

```powershell
npm test
npm run test:coverage
npm run typecheck
npm run test:api
npm run worker:probe
npx playwright install chromium
npm run test:browser
npm run build
```

The browser suite uses real API data and PostgreSQL. It delays a network request to exercise loading, then uses browser offline mode for interruption/retry. It does not mock persistence. API tests exercise real sign-in and leave one explicit read-only grant on the separate test account. Credential routes limit sign-in to 10 attempts per minute; allow the window to expire before rapidly repeating suites. The full dependency audit reports zero advisories after updating the test runner to a release with patched esbuild.

Evidence, observed failures/fixes, screenshots, coverage limits and exact commands are in `docs/verification/WCP-001.md`.
# Local accounts and player claims (WCP-012)

Set `ACCOUNT_EMAIL_ADAPTER=local-file` with a loopback `BETTER_AUTH_URL`. Visit `/account` to register, sign in, resend verification or request recovery. Registration creates an unverified account with no role or player authority. The local adapter writes actual verification/recovery links to the ignored `.runtime/mail` directory, outside `public/`; there is deliberately no web inbox. The local operator reads a recipient's private messages with `npm run account:mail -- exact-recipient@example.invalid`. Do not share its output, tokens, browser traces or development access logs. Links expire after one hour; successful recovery is single-use and revokes existing sessions. On Windows the directory inherits the operator's filesystem permissions; on POSIX the adapter requests directory/file modes 0700/0600.

This transport is a local test inbox, not internet email delivery. It refuses a non-loopback host, and self-registration stays disabled without this configured loopback adapter. Hosted verification/recovery delivery credentials and its transport remain a WCP-045 deployment input; no provider delivery is claimed here.

`/players` reads explicit public sport fields. `/account/profile` shows only the signed-in account's claim history and approved profile; the global World Curling administrator can review all claims there. Demo persona sign-in remains at `/admin`. Claim reviews need a reason; final decisions are retained. A player and an account each have at most one approved link. Competing pending claims can be reviewed, but a conflicting approval returns 409 without partial changes. Ownership permits only biography (500 plain-text characters) and left/right/unknown handedness, with current-version protection. It confers no team, organizer, scoring or grant authority.

The repeatable local seed includes independent fictional `demo-player` (Alex Demo) and `demo-player-other` (Morgan Demo) records with blank biography/unknown handedness. Fresh seed records have no account link. Re-seeding preserves later claims, profile edits and photos; use a fresh isolated database for a fresh scenario.

## Private photo review (WCP-013)

Set `MEDIA_STORAGE_ROOT` to an absolute durable directory outside the checkout and any `public/` directory. On this machine WCP-013 uses `C:/Users/brthi/Projects/world-curling-platform-2/.runtime/wcp013-media`; it survives disposable worktree removal and is ignored by Git. Only the application process and local operator should access it. No media belongs in Git or public static files. The controlled local filesystem adapter is a real durable transport for local acceptance; hosted storage, domain, TLS and email remain WCP-045 inputs.

An approved player owner uploads PNG/JPEG/WebP at `/account/profile`. Limits: 5 MiB, minimum 64px each dimension, at most16 megapixels, one frame. The server fully decodes, strips metadata and re-encodes PNG up to1200px; it discards the original. Exclusive file creation and synced writes precede database submission. A failed database commit may leave an unreachable private orphan; automatic garbage collection and disaster recovery are outside this slice. Do not modify files in place: immutable database digests are checked on every read and review, and mismatches fail closed. Windows files inherit the operator's directory ACLs; POSIX mode requests are0700/0600.

Global administrators see current/submitted comparisons and review history on the same page. Approval requires the exact reviewed digest and current public-image reference, records actor/time/reason, and changes the public reference in the same PostgreSQL transaction as decision/audit. Rejection retains the previous approved image. Final decisions are immutable; new submissions have new asset IDs. One pending submission per player prevents silent replacement during review. An uncertain upload can be retried using the same request ID/content after refreshing status.

| Endpoint | Behavior |
|---|---|
| `POST /api/v1/players/:id/photos` | Same-origin, linked owner only; raw image body, exact MIME type, `X-Request-Id` (1–80 letters/digits/hyphens). Identical request retries return the original immutable asset; changed content returns409. |
| `GET /api/v1/photos` | Own submission history; current global administrators see all. No storage paths or original bytes. |
| `GET /api/v1/photos/:id/preview` | Processed PNG for the submitting owner or current global administrator only. Private/no-store; others404/anonymous401. |
| `POST /api/v1/photos/:id/review` | Same-origin global administrator; `{decision,reason,digest,currentAssetId}`. Exact content/comparison check; decisions approved/rejected; final retries must match actor/reason. |
| `GET /api/v1/public/photos/:assetId` | Current approved processed asset only; pending/rejected/previous assets404. Public player projection includes its safe `photoUrl` or null. |

Use only clearly synthetic geometric fixtures for local screenshots/tests. No invented player portraits are supplied. Evidence: `docs/verification/WCP-013.md`.
