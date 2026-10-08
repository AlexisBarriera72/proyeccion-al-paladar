# Proyección al Paladar: design rules

How the site looks, moves and speaks. The brief is `research/BUILD_PROMPT.md` §0; this file records how it is applied and where it was adapted. Business facts and owner questions are in the [README](README.md).

## Adaptations from the brief

The brief was written for a "Sites" builder. These changes are deliberate; everything else in the brief stands.

| Brief                       | Here                                                                                                                          | Why                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Sites hosting and storage   | One Cloudflare Worker serving the built site, plus D1                                                                         | Reuses the account and tooling behind Party Dips                                        |
| Sites authentication        | Cloudflare Access (one-time PIN), verified again inside the Worker; roles in D1                                               | No passwords to store; the Worker never trusts the edge alone                           |
| Framer Motion               | The same library under its current package name, `motion` (`motion/react`)                                                    | Framer Motion is published as `motion` now                                              |
| Modo demostración           | Its own Cloudflare environment and database (`env.demo`, `pap-demo`)                                                          | Demo rows can never reach live data                                                     |
| shadcn/ui calendar          | A custom month grid for guests; native date and time inputs for staff                                                         | Sessions are shown as cards in the grid, which a date picker can't do                   |
| A view for readiness checks | Shared SQL fragments in `worker/rules.ts`                                                                                     | The checks take parameters (now, party size, own seats) that a view can't               |
| A memory store for tests    | The same SQL run on Node's built-in SQLite through a small D1-shaped adapter (`tests/unit/d1.ts`)                             | Tests prove the real statements instead of a second implementation                      |

## Tokens

Defined in `src/styles.css` with Tailwind v4 `@theme`, exactly as the brief gives them. This palette is a proposed interface direction, not the company's brand system.

| Token                  | Value     | Use                                                    |
| ---------------------- | --------- | ------------------------------------------------------ |
| `--color-canvas`       | `#fafaf9` | Page background (light stone)                          |
| `--color-surface`      | `#ffffff` | Panels                                                 |
| `--color-ink`          | `#1c1917` | Text                                                   |
| `--color-muted`        | `#57534e` | Helper text                                            |
| `--color-border`       | `#d6d3d1` | Decorative panel borders (never the only input border) |
| `--color-accent`       | `#b45309` | The one accent: primary actions, selection, focus      |
| `--color-accent-hover` | `#92400e` | Primary action hover                                   |

- **One accent family: amber.** No red, green or blue state colors. Warnings, destructive actions, sold out and confirmed are told apart by text, icon and shape, on neutral contrast.
- **Inputs** use a `stone-500` border (at least 3:1 against white). `tests/unit/contrast.test.ts` checks every pair.
- **Font:** Inter, self-hosted (`public/fonts/inter/`, OFL), falling back to `"Segoe UI", Arial, sans-serif`.
- **Radius:** panels and actions `rounded-2xl`; calendar cells and dividers stay square.
- **Shadow:** only the brief's panel shadow. No glows, blur or gradients.

## Type and layout classes

| Element               | Classes                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Page title            | `text-[32px] md:text-[44px] font-medium tracking-[-0.04em] leading-[1.08] text-ink`              |
| Session/detail title  | `text-[24px] font-medium tracking-[-0.025em] leading-[1.2] text-ink`                             |
| Body / helper         | `text-base leading-6 text-ink` / `text-sm leading-5 text-muted`                                  |
| Dates and times       | `tabular-nums tracking-[-0.01em]`                                                                |
| Customer workspace    | `grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8`                             |
| Main panel            | `rounded-2xl border border-border/50 bg-surface shadow-[0_1px_2px_rgba(28,25,23,0.04),0_8px_24px_rgba(28,25,23,0.06)]` plus `p-4 sm:p-6` |
| Primary action        | `min-h-11 rounded-2xl bg-accent px-4 py-3 text-sm font-medium leading-5 text-white hover:bg-accent-hover` + focus outline |
| Secondary action      | `min-h-11 rounded-2xl border border-stone-400 bg-surface px-4 py-3 text-sm font-medium leading-5 text-ink hover:bg-stone-100` + focus outline |

These live in `src/components/ui/` and `src/lib/styles.ts` so pages don't repeat them.

## The first screen

- **Computers:** a month grid with session cards on the left; a 360px panel on the right. The panel shows the selected session, or a short introduction with the A18 photo when nothing is selected.
- **Phones:** the agenda (a dated list) first, with a month picker and a switch to the grid.
- Before scrolling, at 390×844 and 360×640: the business name, the "Calendario" heading, the month controls, and the first session with its action (or the empty state).
- Empty state when nothing is published: "Aún no hay fechas publicadas. Consulta las próximas experiencias en Instagram." with a link to the official profile only.

## Motion

- Shared spring: `{ type: "spring", stiffness: 300, damping: 30 }` (`src/lib/motion.ts`).
- Page entry: container `staggerChildren: 0.05`; items from `{ opacity: 0, y: 12 }` to `{ opacity: 1, y: 0 }`. Only the header and the main panels stagger; calendar cells never move.
- Buttons: `whileTap={{ scale: 0.98 }}`. Inputs, calendar cells and dense staff rows change color or border only.
- Magnetic pull: only the main CTA, only on a fine pointer with hover, at most 3px, springing back on exit. Never on touch, inputs, cells, destructive actions or staff tables.
- `useReducedMotion()` removes translation, scaling, magnetism and stagger delays. Content renders at once; focus, color and status feedback stay.
- Motion never gates completion, hides an error or shifts layout.

## Feedback wording

The site says only what happened.

| Moment                          | Copy                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------- |
| Inquiry saved                   | "Solicitud recibida. El equipo debe confirmar disponibilidad y condiciones."    |
| Waiting for payment             | "Solicitud recibida. No reserva plazas hasta que el equipo verifique tu pago."  |
| Confirmed by the server         | "Reservación confirmada"                                                        |
| Response lost                   | "No sabemos si llegó tu solicitud. Vuelve a intentarlo; no se duplicará."       |
| Same request ID, different data | "Ya enviaste esta solicitud con otros datos. Revísala y envíala de nuevo."      |
| Terms changed                   | "Las condiciones cambiaron. Revísalas antes de continuar."                      |
| No sender configured            | "No te enviamos ningún mensaje. Guarda este enlace para ver tu solicitud."      |
| Link replaced                   | "Este enlace ya no es válido. Pide uno nuevo al equipo."                        |
| Copying worked / failed         | "Mensaje copiado." / "No se pudo copiar. Selecciona el mensaje y cópialo."      |
| Instagram opened                | "Continúa en Instagram." (never "enviado")                                      |
| A calculated refund             | "calculado, no emitido" until staff record the refund                           |

## Copy rules

- Active voice, eighth-grade reading level, **20 words or fewer per sentence**, in Spanish and English. `tests/unit/copy.test.ts` checks every interface string.
- Never: Seamless, Leverage, Robust, Revolutionize, Unlock, Ecosystem, Cutting-edge, Elevate, nor Spanish equivalents (fluido, aprovechar, robusto, revolucionar, desbloquear, ecosistema, vanguardia, elevar).
- Concrete actions: "Ver fechas", "Reservar plazas", "Solicitar plazas", "Revisar solicitud", "Guardar sesión".
- No emoji or symbol characters that a phone could draw as emoji.
- Puerto Rican Spanish first; English is a toggle (`?lang=en`). Business name and movie titles stay as written.

## Claims

| Claim                                                         | Status                                     | Source                    |
| ------------------------------------------------------------- | ------------------------------------------ | ------------------------- |
| Name, handle, "Cine gastronómico" in Aguada, DM for dates     | **Verified**                               | Profile bio (E01)         |
| Ratatouille, Aguadilla, May 2 and May 30, 2026, sold out      | **Verified**                               | Posters A23, A20          |
| "Cine. Sabores. Emociones."                                   | **Verified** (their wording, to approve)   | Graphic A19               |
| Shrek dates for September–October, at the new Aguada local    | **Advertised** (posters, not inventory)    | A11, A08, A29, A06, A09   |
| Shrek offer: 8 platos, 3 bebidas, ambientación, popcorn, agua | **Advertised** (that offer only)           | A28                       |
| From November 15: full payment; 60% refund with 3 days' notice | **Announced** (applies only if confirmed)  | Policy post A02           |
| "Los primeros en Puerto Rico"                                 | **Company claim**                          | Profile bio (E01)         |
| Address, dates, capacity, prices, menus, policy details        | **Unverified** → "Por confirmar"           | Owner questions (README)  |

## Photos

| Slot          | Source                     | Shows                                         | Caption                                                                                 |
| ------------- | -------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------- |
| `room`        | A18 (1200×1600)            | An earlier event room; people; projected film | "Evento anterior. Fuente: @proyeccionalpaladarpr. Permiso de uso por confirmar."        |
| `table-food`  | A27 (1440×1920)            | Table and food; projected film                | same                                                                                    |
| `food`        | A25 (640×1136)             | Food at a screening                           | same                                                                                    |
| `logo`        | A01 (150×150)              | Their logo                                    | none; shown at 72 CSS px or less                                                        |

- Room photos never stand in for the current Aguada venue.
- Permission is unverified for every use, the pitch included. `npm run launch-check` blocks a public launch while any served photo lacks approval.
- No file is wider than its original. No posters, character art, customer portraits or evidence screenshots are served.
