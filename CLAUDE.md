# Working on Proyección al Paladar

A private pitch for Proyección al Paladar, a _cine gastronómico_ in Aguada, PR. Guests choose a date and reserve for their group; staff manage sessions, reservations and attendance. Spanish first. React, Tailwind CSS v4 and Motion in front; one Cloudflare Worker with D1 behind.

## Read first

- [DESIGN.md](DESIGN.md): tokens, type, layout, motion, feedback wording, claim labels and the adaptations from the brief.
- [README.md](README.md): running, testing, deploying, privacy until launch, the owner questions and the verified facts.
- [research/](research/): the research package, unchanged. It is the content authority. `research/BUILD_PROMPT.md` is the product brief; `research/IMAGE_MANIFEST.json` is the authority for every photo.

## Rules

- **Never invent business facts.** No dates, prices, capacity, addresses, menus, reviews, ratings or photos that the research doesn't support. Unknown values say "Por confirmar". Quote the owners' wording exactly.
- **Label every claim** as verified, advertised, announced (applies only if the owners confirm), company claim, or unverified (DESIGN.md).
- **Feedback says only what happened.** The site never says a reservation is confirmed unless the server confirmed it, and never says a message was sent, a payment made or a refund issued unless a record says so.
- **Demo data lives only in the demo environment and its database**, marked DEMO. Production code has no demo bypass.
- **Photos:** only the slots in `src/photos.ts`, each with its "Fuente" caption. Permission is unverified, including for the pitch. Never add generated, stock or studio artwork.
- **Every write goes through the mutation ledger** (`worker/ledger.ts`). Settled ledger rows are immutable. The rules for each action live in `worker/rules.ts`; don't duplicate them in the client.
- **Deploys, migrations and seeds name their environment** through `scripts/cf.mjs`. There is no default.
- **Never skip, disable or loosen a test to get green.**
- **Keep this repository private**, or remove `research/images/` before making it public.

## Checks before a push

```sh
npm run typecheck
npm run test:unit
npx prettier --check .
npm run build
npm run test:e2e   # Playwright against `wrangler dev --env local` with a fresh local D1
```

Look at the pages at 1440×900, 390×844 and 360×640, in Spanish and English, and with reduced motion.

## Reporting

- Report what actually ran on the commit being reported. Write "Local checks passed." only when every check above passed on it; otherwise name each check that failed or didn't run, and why.
- State hosted CI's status as it is when you report.

## Branches

Work on `claude/zen-cannon-ljc3xm`. Don't open pull requests unless asked.
