# Proyección al Paladar — calendar and group reservations (private pitch)

A Spanish-first website for **Proyección al Paladar**, a _cine gastronómico_ associated with Aguada, Puerto Rico ([@proyeccionalpaladarpr](https://www.instagram.com/proyeccionalpaladarpr/)). It is a pitch to the owners: it is built to run privately behind Cloudflare Access, in **Modo demostración**, on demo data, and takes no real reservations.

- **Guests** choose a date on a calendar, reserve for their whole group, and get a private link to see their reservation.
- **Staff** (`/equipo/`) create sessions, enter requests that arrive by Instagram by hand, confirm, move or cancel within capacity, record payments and refunds made outside the site, and check guests in.

The product brief and all research are in [`research/`](research/), unchanged ([`BUILD_PROMPT.md`](research/BUILD_PROMPT.md), [`RESEARCH_REPORT.md`](research/RESEARCH_REPORT.md)). The owner pitch is [`docs/propuesta.md`](docs/propuesta.md). Design rules and the adaptations from the brief are in [DESIGN.md](DESIGN.md).

## Status

- **A private pitch.** The demo is built for Modo demostración, on its own database, with dates and guests marked DEMO. It takes no real reservations, charges nothing and sends no messages.
- **Built locally.** Nothing is deployed from this repository yet. No booking, payment or message has been sent to anyone. [Deploy](#deploy) lists the steps that need a Cloudflare account.
- **No hosted CI yet.** The checks in [Tests](#tests) run on a developer's machine. Each report says which of them ran on its commit.
- **Not ready for a public launch, on purpose.** `npm run launch-check` fails until the owners approve the photos, the production account and its Access settings exist, and the pitch's `noindex` is removed ([Launch checklist](#launch-checklist)).

## Run locally

Needs Node 22.18 or later (Node runs the TypeScript scripts directly) and npm.

```sh
npm ci
npx playwright install chromium   # once: the browser tests and `npm run photos` use it
npm run dev                       # http://localhost:5173 (staff area: /equipo/)
npm run dev -- --reset            # the same, from a fresh demo seed
```

What `npm run dev` ([`scripts/dev.mjs`](scripts/dev.mjs)) does:

1. **A local database** under `.wrangler/dev-state`, created on the first run or with `--reset` ([`scripts/lib/local.ts`](scripts/lib/local.ts)):
   - the migrations, and the environment marker `local`;
   - two test staff members: `owner@example.com` (Dueño) and `staff@example.com` (Equipo);
   - the demo seed, with upcoming dates.
2. **The Worker** with `wrangler dev --env local` on `127.0.0.1:8787`, serving `dist/`. It builds `dist/` first if it is missing.
3. **Vite** on `localhost:5173`, with hot reload. Its `/api` proxy signs every call in as `owner@example.com`, so `/equipo/` opens as the owner.

The sign-in works through the local-only `TEST_AUTH` switch (and `TEST_CLOCK` for tests). Both are passed with `--var`, never written in `wrangler.jsonc`. The Worker honors them only when `APP_ENV` is `local` and the host is loopback. A deployed environment with either one set answers 503 to every request.

Other scripts:

| Command                        | What it does                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                | Builds the site into `dist/` (Vite).                                                                                                  |
| `npm run photos`               | Regenerates `public/photos/` and `src/photos.ts` from `research/images/` ([`scripts/photos.mjs`](scripts/photos.mjs), with Chromium). |
| `npm run fonts`                | Copies Inter and its license from `@fontsource-variable/inter` into `public/fonts/inter/`.                                            |
| `npm run format`               | Prettier on the whole repository.                                                                                                     |
| `npm run cf -- local <action>` | The Cloudflare actions ([below](#what-npm-run-cf-does)) on the local database in `.wrangler/dev-state`. Nothing leaves your machine.  |

## Tests

| Command                                                                        | What runs                                                                                                                                                                                                                                                                              | What it proves                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                            | `tsc` on the app (`tsconfig.json`), the Worker (`tsconfig.worker.json`) and the scripts and tests (`tsconfig.node.json`).                                                                                                                                                              | The three parts agree on the shared types.                                                                                                                                                                                                                                                                                                                                                      |
| `npm run test:unit`                                                            | `node --test tests/unit/*.test.ts`. The real SQL runs on Node's built-in SQLite through a small D1-shaped adapter (`tests/unit/d1.ts`). The Worker's `fetch` is called directly.                                                                                                       | The rules by action, the mutation ledger and its triggers, money, locked terms, staff edits and roles, headers, the fail-closed checks, environment isolation in `wrangler.jsonc`, Puerto Rico time and the `.ics` file. Also the copy rules (`copy.test.ts`), color contrast (`contrast.test.ts`), the motion values (`motion.test.ts`), and the deploy scripts' refusals (`scripts.test.ts`). |
| `npm run build`, then `npx playwright test --project=desktop --project=mobile` | Playwright starts [`scripts/test-server.mjs`](scripts/test-server.mjs): a fresh local database under `.wrangler/test-state` (demo seed and the two test staff), and `wrangler dev --env local` on `127.0.0.1:8788` serving `dist/`. One worker, because the tests share that database. | The built site in Chromium at 1440×900 (desktop) and 390×844 with touch (mobile); the first-screen test also checks 360×640. The first screen, the reservation flow and its states, accessibility, the design contract from computed styles, motion, time zones, staff roles and the bundle budget.                                                                                             |
| `npm run test:release`                                                         | [`scripts/release-test.mjs`](scripts/release-test.mjs): builds, prepares a fresh database under `.wrangler/release-state`, starts `wrangler dev --env local` on `127.0.0.1:8789`, and runs `tests/release/*.test.ts` over HTTP.                                                        | What unit tests can't: headers on every response type from the real runtime (workerd), test sign-in only for listed staff, competing bookings on a real local D1, replays, link reissue, the restricted Staff role, and D1 running the ledger's triggers.                                                                                                                                       |
| `npm run launch-check`                                                         | [`scripts/launch-check.mjs`](scripts/launch-check.mjs).                                                                                                                                                                                                                                | What must be true before a public launch. **It fails today, on purpose** ([Launch checklist](#launch-checklist)).                                                                                                                                                                                                                                                                               |

- `npm run test:e2e` is `npm run build` followed by `playwright test`, which runs both projects. `npm test` runs the unit, browser and release tests in turn.
- Ports 8788 and 8789 must be free. `scripts/test-server.mjs` refuses to start without `dist/`.
- A few browser tests run on desktop only: time zones, the bundle budget, calendar cells, and the staff payment (it changes a shared booking).

## Deploy

Every deploy, migration and seed names its environment through [`scripts/cf.mjs`](scripts/cf.mjs). There is no default. The top level of `wrangler.jsonc` has no bindings and answers 503, so a command that forgets the environment can't reach real data.

### The demo, in your existing Cloudflare account

1. **Sign in and create the database.**
   - `npx wrangler login`. `npx wrangler whoami` prints your account id.
   - `npx wrangler d1 create pap-demo`.
   - In `wrangler.jsonc`, under `env.demo`, replace the placeholder `account_id` and `d1_databases[0].database_id`. `cf.mjs` refuses the committed placeholders.
2. **Prepare the database.**
   - `npm run cf -- demo init-db`: applies the migrations and writes the `demo` marker, once.
   - `npm run cf -- demo seed -- --owner <your email> --staff <test email>`: the demo data, you as Dueño and the test address as Equipo. `--staff` takes a comma-separated list. An owner can add more staff later in Configuración.
   - Later, `npm run cf -- demo migrate` applies new migrations.
3. **Put Cloudflare Access on the demo hostname**, `proyeccion-al-paladar-demo.<your-subdomain>.workers.dev`:
   - In Zero Trust, turn on the one-time PIN login method.
   - Add an Access application for the whole hostname, with a policy that allows only the listed emails: yours, the test staff address and the owners'.
   - Copy the team domain (`https://<team>.cloudflareaccess.com`) into `env.demo.vars.ACCESS_TEAM_DOMAIN`, and the application's audience (AUD) tag into `env.demo.vars.ACCESS_AUDS`. Several tags are separated by commas.
   - If the Worker doesn't exist yet, deploy once first so the hostname exists. Until both values are set, the demo Worker answers 403 to every request.
4. **Deploy:** `npm run cf -- demo deploy`. Workers Builds works too ([below](#workers-builds)).
5. **Check it:**
   - Open the URL in a private window. Expect the Access sign-in with a PIN, not the site.
   - `curl -i https://proyeccion-al-paladar-demo.<your-subdomain>.workers.dev/api/public/sessions`. Expect Access to stop it, not JSON.
   - Sign in. Expect the demo banner on every page, and `/equipo/` for the emails seeded as staff.
   - An Access-approved email that isn't on the staff list gets "Sin acceso al área del equipo" at `/equipo/`.
   - `npm run cf -- demo status` prints the marker and the row counts.

### Production, at launch

Only once the owners have answered the [questions](#questions-for-the-owners) and approved the photos. The last step runs `launch-check` and deploys nothing while it fails.

1. The business creates its own Cloudflare account and invites you as an administrator. Production never shares an account or a database with the demo; `cf.mjs` refuses if it does.
2. In that account, `npx wrangler d1 create pap-live`. Put the account id and the database id in `env.production`.
3. `npm run cf -- production init-db`. The database starts empty: `seed` and `reset` refuse production.
4. `npm run cf -- production add-owner -- --email <owner's email>` adds the first owner. Staff can only be added in Configuración by an owner, and `seed` refuses production, so this is how production gets one. `launch-check --db` requires an active owner.
5. Put Access on `/equipo*` and `/api/equipo/*` only, and set `ACCESS_TEAM_DOMAIN` and `ACCESS_AUDS` in `env.production.vars`. Public pages and the public API stay open.
6. Remove the pitch's `noindex` ([Privacy until launch](#privacy-until-launch)).
7. `npm run cf -- production deploy`. Before deploying, it refuses synthetic (DEMO) rows and runs `launch-check --db`.

### Workers Builds

To deploy from the repository, set the Worker's deploy command to `node scripts/cloudflare-build.mjs` and the build variable `PAP_ENV` to `demo` (or `production` at launch).

- Without `PAP_ENV` it exits 1, so a build never falls back to an environment.
- It runs `node scripts/cf.mjs <PAP_ENV> deploy`, with every check below.
- Those checks read the database and list the Worker's secrets, so the build's API token needs that access as well as permission to deploy.

### What `npm run cf` does

`npm run cf -- <local|demo|production> <action>`. Before any action, it refuses:

- a missing or unknown environment or action;
- for demo and production, a placeholder account or database id;
- demo and production sharing an account or a database;
- any `TEST_*` variable written in `wrangler.jsonc`.

| Action      | What it does                                                                                                                                                                                                                                                                                                                 | It also refuses                                                                                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `init-db`   | Applies the migrations and writes the database's environment marker. Says so and stops if it is already done.                                                                                                                                                                                                                | A database marked for another environment.                                                                                                                                                 |
| `migrate`   | Applies new migrations.                                                                                                                                                                                                                                                                                                      | A database with no marker, or marked for another environment.                                                                                                                              |
| `seed`      | `--owner <email>` and optional `--staff <email[,email]>`, then the demo data: sessions, bookings, experiences, a venue and test policies, marked synthetic and labeled DEMO, plus their announced policy, quoted as a draft. The demo settings include a test process for payments without seats, labeled DEMO and approved. | Production, or `DEMO_MODE` other than `1`; a missing or mismatched marker; a missing `--owner` or an address that isn't a plain email; a database that already has sessions (use `reset`). |
| `add-owner` | `--email <email>`: adds that address as an active owner, or promotes and reactivates it. Works in every environment; it is how production gets its first owner.                                                                                                                                                              | A missing or mismatched marker; an address that isn't a plain email.                                                                                                                       |
| `reset`     | Deletes the demo data and seeds it again in one batch. Staff members and the audit history stay.                                                                                                                                                                                                                             | Production, or `DEMO_MODE` other than `1`; a missing or mismatched marker.                                                                                                                 |
| `deploy`    | Builds with Vite, then `wrangler deploy --env <environment>`.                                                                                                                                                                                                                                                                | `local`; a missing or mismatched marker; any `TEST_*` secret on the Worker. For production, also synthetic rows in the database, or `launch-check --db` failing.                           |
| `status`    | Prints the marker and the counts of sessions, bookings, payments, staff members and audit events.                                                                                                                                                                                                                            | Only the checks before any action.                                                                                                                                                         |

## Privacy until launch

- **Access everywhere in the demo.** Cloudflare Access guards the whole `workers.dev` hostname: pages, assets and direct API calls.
- **The Worker checks again.** In the demo, `run_worker_first: true` and `ACCESS_EVERYWHERE=1` make the Worker run on every request, assets included. It verifies the Access token's signature, issuer (`ACCESS_TEAM_DOMAIN`) and audience (`ACCESS_AUDS`) with `jose`, and answers 403 without a valid one.
- **No other way in.** `preview_urls` is off in the demo and production. Staff roles come from `staff_members` in D1, with no demo bypass.
- **Hidden from search engines.** `index.html` says `noindex, nofollow`; `public/_headers` sends `X-Robots-Tag: noindex, nofollow`; `public/robots.txt` disallows everything; the Worker sends `X-Robots-Tag: noindex, nofollow` on every response outside production, and on the API, staff and guest-link responses everywhere.
- **At launch.** Access guards only `/equipo*` and `/api/equipo/*`. `run_worker_first` still covers `/api/*`, `/funciones/*`, `/reservacion/*`, `/equipo` and `/equipo/*`; other assets carry the same headers from `public/_headers`.
- **The repository stays private**, or `research/images/` is removed before it is made public.

## Launch checklist

`npm run launch-check` ([`scripts/launch-check.mjs`](scripts/launch-check.mjs)) lists what blocks a public launch and exits 1 while anything does.

- **Files and configuration:**
  - every served photo in `src/photos.ts` has approved permission;
  - `index.html`, `public/_headers` and `public/robots.txt` no longer hide the site;
  - production has no placeholder account or database id;
  - production's `ACCESS_TEAM_DOMAIN` and `ACCESS_AUDS` are set, so staff can sign in;
  - production's `DEMO_MODE` is `"0"`, and no `TEST_*` variable is written anywhere.
- **With `--db`** (needs `wrangler login` and the production database), also:
  - the database is marked `production` and holds no synthetic rows;
  - there is an active owner;
  - the required contact field is chosen in Configuración;
  - if an approved policy requires payment in full, the owners have approved the process for payments without seats.

**Today it fails, on purpose,** with 11 problems:

- the four photos (A18, A27, A25 and the A01 logo) have no approved permission;
- `index.html`, `public/_headers` and `public/robots.txt` still hide the site;
- production's account id and database id are placeholders;
- production's `ACCESS_TEAM_DOMAIN` and `ACCESS_AUDS` are empty.

`npm run cf -- production deploy` runs it with `--db` and deploys nothing while it fails.

## Adaptations from the brief

The brief ([`research/BUILD_PROMPT.md`](research/BUILD_PROMPT.md)) was written for a "Sites" builder. This build keeps everything else in it and changes these on purpose. [DESIGN.md](DESIGN.md#adaptations-from-the-brief) gives the reason for each.

- **Hosting and storage:** one Cloudflare Worker serving the built site, plus D1.
- **Staff sign-in:** Cloudflare Access with a one-time PIN, verified again inside the Worker. Roles live in D1.
- **Framer Motion:** the same library under its current package name, `motion` (`motion/react`).
- **Modo demostración:** its own Cloudflare environment and database (`env.demo`, `pap-demo`).
- **The shadcn/ui calendar:** a custom month grid for guests, and native date and time inputs for staff.
- **A database view for readiness checks:** shared SQL fragments in `worker/rules.ts`.
- **A memory store for tests:** the same SQL on Node's built-in SQLite.

## Brief §13, mapped to tests

The 18 acceptance checks in [`research/BUILD_PROMPT.md`](research/BUILD_PROMPT.md) §13. Paths are under `tests/`. "Manual" means a person checks it; no automated test does.

| §13 | Check                                                                                 | Automated                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Manual                                                                                       |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 1   | A phone shows a useful list or calendar, local times and the right action at once     | `e2e/first-screen.spec.ts` (1440×900, 390×844, 360×640); `e2e/timezones.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |                                                                                              |
| 2   | The full party is allocated; competing submissions can't overbook; a retry saves once | `unit/rules.test.ts` (the last seats go to one of two); `release/release.test.ts` (six parallel bookings on a real local D1, seats drop by exactly what was confirmed); `unit/ledger.test.ts` and `unit/worker.test.ts` (replays); `e2e/flow.spec.ts` (a lost response is saved once)                                                                                                                                                                                                                                                                                                                                                                                                                                                            |                                                                                              |
| 3   | An inquiry promises nothing; staff confirmation rechecks capacity                     | `unit/rules.test.ts` (an inquiry holds no seats; confirmation fails while any part is missing; a confirm short of seats); `e2e/flow.spec.ts` (a request is never called confirmed, and its `.ics` is tentative); `e2e/staff.spec.ts` (payment, then confirm)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                                                                                              |
| 4   | Cancelling and resizing count once; a failed move leaves the original                 | `unit/rules.test.ts` (cancellation releases seats once; resize leaves out its own seats; a failed move); `unit/ledger.test.ts` (parallel replays apply once; a retry after another edit)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |                                                                                              |
| 5   | Staff can't publish missing terms, cut capacity below bookings, or overlap silently   | `unit/admin.test.ts` (publish only when checks pass; capacity not below confirmed seats; overlap refused; a stale edit refused)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |                                                                                              |
| 6   | Past, cancelled or unpublished sessions take no bookings; a stale view is rechecked   | `unit/rules.test.ts` (draft, cancelled, archived and past sessions refuse reservations and requests; every rule is checked inside the write); `unit/worker.test.ts` (the public view never offers what the server would refuse)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | No browser test submits a stale page.                                                        |
| 7   | Times and `.ics` follow Puerto Rico from any device time zone                         | `unit/time.test.ts`; `unit/ics.test.ts`; `e2e/timezones.spec.ts` (Los Angeles and Madrid see Puerto Rico time; the API instant is UTC)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                                                                                              |
| 8   | Authorization on the server; no guest reads another's booking                         | `unit/worker.test.ts` (Access everywhere in the demo; listed staff only; roles; test sign-in ignored off loopback; a wrong link gets nothing; reissue); `release/release.test.ts` (test sign-in only for listed staff; the Staff role can't change settings or capacity, or reset the demo; reissue); `e2e/staff.spec.ts` (unlisted email gets 403)                                                                                                                                                                                                                                                                                                                                                                                              | The guest page has no booking id in its address; its token is the only key.                  |
| 9   | Images and quotes match their sources; nothing fabricated                             | `e2e/honest.spec.ts` ("por confirmar"; photo source and permission; no reviews, ratings or checkout); `e2e/disclosure.spec.ts` (the announced policy's label stays in view while its quote waits behind a button); `unit/scripts.test.ts` (`launch-check` lists the photos without permission)                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Each photo against `research/IMAGE_MANIFEST.json`, each quote against `research/SOURCES.md`. |
| 10  | Keyboard, screen readers, phones, contrast, enlarged text, errors, empty, interrupted | `e2e/a11y.spec.ts` (axe on 12 pages, the open reservation dialog, a staff booking page with its open "Más acciones" menu, and the guest page with its request sheet; a keyboard path; text spacing; 200% zoom); `e2e/flow.spec.ts` (dialog focus, the terms error, lost response, offline); `e2e/disclosure.spec.ts` (the phone menu, the note, "Cambiar" on the review step, the Instagram handoff); `e2e/staff.spec.ts` ("Más acciones" returns focus to its button; the "Secciones" sheet; Configuración tabs); `e2e/states.spec.ts` (empty, error, a replaced link, an empty month that offers and opens the next date); `e2e/design.spec.ts` (layout shift ≤ 0.02); `unit/contrast.test.ts` (4.5:1 text, 3:1 field borders and focus rings) | Listening with a real screen reader.                                                         |
| 11  | Bookings survive a refresh and another device; demo data stays isolated               | `e2e/flow.spec.ts` (the booking opens from its link; the draft survives a reload); `unit/worker.test.ts` (the link works on its own; fail-closed on another environment's database); `unit/config.test.ts`; `unit/admin.test.ts` (reset only in demo or local); `unit/scripts.test.ts` (`cf.mjs` refuses no environment, placeholder ids and deploying local)                                                                                                                                                                                                                                                                                                                                                                                    | Opening a link on a second device.                                                           |
| 12  | No screen claims an email, message, charge or refund that didn't happen               | `e2e/flow.spec.ts` ("No te enviamos ningún mensaje…"; a request never says confirmed, paid or sent); `e2e/disclosure.spec.ts` (the Instagram message reads cleanly and is only copied when asked); `e2e/staff.spec.ts` (a recorded payment and the net received)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Staff wording such as "Calculado, no emitido".                                               |
| 13  | The November 15 policy isn't activated on guesses; configured terms are checked       | `e2e/honest.spec.ts` (labeled announced; the terms in force); `unit/admin.test.ts` (approved only with every rule, then fixed); `unit/rules.test.ts` (prepaid requests hold no seats; paid without seats; exception resolution; refunds; locked terms)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | The cutoff is a written rule that staff apply; the site doesn't compute it.                  |
| 14  | React, Tailwind v4, Motion and Lucide used consistently and completely                | `npm run typecheck`; `npm run build`; `e2e/design.spec.ts` (Inter and the type scale)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Reading the components.                                                                      |
| 15  | One amber accent, neutral statuses, no banned effects or hero                         | `e2e/design.spec.ts` (one accent family, no blur, gradients, glows or colored shadows on four pages); `e2e/first-screen.spec.ts` (no centered title); `unit/contrast.test.ts` (the neutral and amber tokens)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Status treatments read by text, icon and shape.                                              |
| 16  | Direct copy, 20 words or fewer, no banned terms; sample records marked and isolated   | `unit/copy.test.ts` (Spanish and English share keys; 20 words or fewer per sentence; no banned word; no emoji); `unit/admin.test.ts` (the demo seed loads); `unit/config.test.ts` (demo and production share nothing)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Directness and reading level.                                                                |
| 17  | Spring, stagger, hover, focus and press; reduced motion removes movement              | `unit/motion.test.ts` (spring 300/30, stagger 0.05, entry from y 12); `e2e/motion.spec.ts` (reduced motion shows content in place at once); `e2e/design.spec.ts` (calendar cells never move)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Hover, focus and press states.                                                               |
| 18  | Magnetic pull only on the main CTA with a fine pointer; cells, inputs, touch stable   | `e2e/motion.spec.ts` (up to 3px with a mouse, none on touch, the hit area never moves); `e2e/design.spec.ts` (calendar cells never move)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |                                                                                              |

## Ideas beyond the brief

**Built:**

- **Instagram DM handoff.** On the result screen, behind the "Avísales por Instagram" button, "Copiar mensaje y abrir Instagram" copies a message with the reference ("Mensaje copiado."), then opens `ig.me/m/proyeccionalpaladarpr` ("Continúa en Instagram."). The site reads and sends no Instagram messages; staff still enter or match the request by hand.
- **Their own words in the intro.** "Cine. Sabores. Emociones." heads the introduction, labeled "Su frase en Instagram." It is their wording, pending their approval.
- **Esta noche** (`/equipo/esta-noche/`). Today's confirmed reservations as a check-in list sized for a phone, with how many people have arrived.
- **Staff reply helper.** "Armar respuesta" on a booking's page opens a draft DM reply built from the booking's real status, with "Copiar". Staff review it before sending.
- **Google Calendar link** next to the `.ics`. A request that holds no seats is titled "Solicitud pendiente: …".
- **Link previews.** The Worker writes a published or cancelled session's title and date into its `/funciones/:id/` page for crawlers (`worker/meta.ts`).
- **Progressive disclosure.** Each page leads with its main task; secondary and rare features wait behind a button, a sheet, a menu, a tab or a disclosure, and required facts and honesty labels stay in view ([DESIGN.md, "Behind a button"](DESIGN.md#behind-a-button)).
- **Bundle budget.** The staff area, the reservation flow, the guest page and the terms page load as separate chunks. `tests/e2e/bundle.spec.ts` keeps the first visit at 160 KB of gzipped JavaScript or less, without the staff or flow chunks.
- **Prepayment and exceptions.** The pending-payment and paid-without-seats flows exist in case the owners confirm the November 15 rule. The demo shows them on the test session `demo-prueba-b` (a US$1.00 test price, paid in full). The Worker refuses to approve a policy that requires payment in full until the owners approve the process for payments without seats (in Configuración), in every environment. Before a production deploy, `launch-check --db` checks the same thing again.

**Not built:**

- The "Así ha sido" history strip. So A24 (service, faces visible) is not served.
- The private events form. It waits for the owners' answer (question 12).
- schema.org `Event` data. It belongs to the launch, built from approved fields only.
- Online payments (ATH Móvil Business or Stripe) and seat holds. Phase 2, after comparing their APIs and fees.

## Versions

Exact pins from `package.json`; `package-lock.json` is committed. Every pin was published at least two weeks before October 8, 2026, when the lockfile was committed (`npm view <package> time`). `npm ls --all` reports no invalid or missing peer dependency; only platform-specific optional packages are absent.

| Package                      | Version        | Use                                                               |
| ---------------------------- | -------------- | ----------------------------------------------------------------- |
| `react`, `react-dom`         | 19.3.0         | Interface                                                         |
| `motion`                     | 13.4.2         | Motion (`motion/react`)                                           |
| `lucide-react`               | 1.47.0         | Icons                                                             |
| `radix-ui`                   | 1.6.7          | Dialog, select, checkbox, radio group and toggle group primitives |
| `class-variance-authority`   | 0.7.1          | Component variants                                                |
| `clsx`                       | 2.1.1          | Class names                                                       |
| `tailwind-merge`             | 3.7.0          | Class names                                                       |
| `zod`                        | 4.6.5          | Request validation (`shared/schemas.ts`)                          |
| `@date-fns/tz`               | 1.5.0          | Puerto Rico time                                                  |
| `jose`                       | 6.2.12         | Access token verification                                         |
| `tailwindcss`                | 4.3.3          | Styles                                                            |
| `@tailwindcss/vite`          | 4.3.3          | Styles                                                            |
| `vite`                       | 8.3.0          | Build and dev server                                              |
| `@vitejs/plugin-react`       | 6.1.1          | Build                                                             |
| `typescript`                 | 6.0.3          | Type checks                                                       |
| `@types/react`               | 19.3.0         | Types                                                             |
| `@types/react-dom`           | 19.3.0         | Types                                                             |
| `@types/node`                | 22.20.4        | Types                                                             |
| `@cloudflare/workers-types`  | 5.20260923.1   | Types                                                             |
| `wrangler`                   | 4.137.0        | Local Worker, D1 and deploys                                      |
| `@playwright/test`           | 1.56.1         | Browser tests and the photo pipeline                              |
| `playwright-core`            | 1.56.1         | The peer that `@axe-core/playwright` needs                        |
| `@axe-core/playwright`       | 4.13.0         | Accessibility checks                                              |
| `@fontsource-variable/inter` | 5.3.0          | Inter, self-hosted                                                |
| `prettier`                   | 3.9.9          | Formatting                                                        |
| Node                         | 22.18 or later | Runs the TypeScript scripts directly                              |

## Questions for the owners

Things only the owners can answer. The site shows "Por confirmar" or a labeled example for each until then.

1. The exact address in Aguada, how to get there, parking and access.
2. Upcoming dates and how long each experience lasts. Can two run at once?
3. Capacity, group limits and shared tables. The May 30 caption mentions 42 spaces at the earlier venue.
4. Price per person, what's included, whether IVU is included, and payment methods.
5. The November 15 policy:
   - Which year?
   - Does it apply to bookings made from that date, or to experiences held from that date?
   - How are the 3 days counted?
   - What happens with less notice, a no-show, a date change, or a cancellation by the business?
   - What does the cut-off part of the graphic say?
   - What applies until then?
6. How reservations are confirmed today, and by whom.
7. Allergies and diets, minimum age, children, alcohol, and the film's language or subtitles.
8. Which logo is official: A01 (the filmstrip and table) or A19 (the reel, cloche and fork)? A high-resolution or vector file.
9. Who took A18, A27 and A25? Can the site use them? Did the people shown agree? Photos of the Aguada local.
10. Can the site show the two Instagram recommendations? Was either visit gifted? @almodovar.e wrote "por regalarnos una experiencia".
11. Do they want the "los primeros en Puerto Rico" claim on the site?
12. Do they offer private events?
13. Staff emails and roles.
14. A public phone, email or WhatsApp besides DM?
15. If someone pays and the seats run out before confirmation: another date, a refund, or the guest's choice? How much is refunded, and how fast?
16. May staff record a guest's acceptance of terms given by DM, or must the guest accept on the site?
17. When a group grows, do the added seats keep the original price?

## Verified business information

From the research package (October 8, 2026). Image IDs resolve in [`research/IMAGE_MANIFEST.json`](research/IMAGE_MANIFEST.json); source IDs in [`research/SOURCES.md`](research/SOURCES.md).

| Status                                                   | Facts                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Verified in captured images**                          | Name and handle. Bio (E01): "Cine gastronomico AGUADA/ los primeros en Puerto Rico/para informacion de fechas de eventos: DM". Ratatouille in Aguadilla: May 2, 2026, 7:30 PM, "Sold out!" (A23); May 30, 2026, 3:30 or 7:30 PM, "Sold out" (A20). Tagline "Cine. Sabores. Emociones." (A19). Two Instagram recommendations (`research/REVIEWS.json`). |
| **Advertised programming** (posters, not live inventory) | Rincón July 18 and Moca April 12 (years not printed). Shrek dates for September–October, announced for the new Aguada local (A11, A08, A29, A06, A09). The Shrek offer's inclusions (A28): 8 platos, 3 bebidas temáticas, ambientación, proyección, popcorn, agua — that offer only.                                                                   |
| **Announced; applies only if the owners confirm**        | Policy post of September 10, 2026 (A02): from "15 de noviembre", experiences are paid in full when reserving; cancelling 3 days ahead refunds 60%. The year is not printed and the top and bottom are cut off.                                                                                                                                         |
| **Company claim**                                        | "los primeros en Puerto Rico".                                                                                                                                                                                                                                                                                                                         |
| **Unverified → "Por confirmar"**                         | Address and arrival, future dates, capacity, prices and IVU, payment methods, menus and allergens, age rules, current policy, staff, contact channels beyond DM, photographers, and permissions for images and recommendations.                                                                                                                        |

No separate website, phone, email, current price or exact street address was verified during the October 8 research. That is a search and access limit, not proof they don't exist.

## Risks to raise with the owners

- **Photos.** Permission is unverified for every use, including this private pitch. A18 shows people and projected film content. The original A27 shows the projected film and the screen's brand too; the served crop leaves both out and shows the table, the food and balloons. The room photos are historical and don't show the current Aguada venue.
- **Film screenings.** A18 shows a streaming app on the screen, and the public-performance license status is unknown. The site only says "inspirada en", adds no separate studio artwork and claims no licensing, though the A18 photo contains projected film content.
- **Policy and payments.** The November 15 rule stays a draft until it's confirmed. A policy that requires payment in full can't be approved until the owners approve the process for payments without seats, and a production deploy checks this again.
