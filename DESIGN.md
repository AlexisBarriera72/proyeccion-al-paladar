# Proyección al Paladar: design rules

How the site looks, moves and speaks. The brief is `research/BUILD_PROMPT.md` §0; this file records how it is applied and where it was adapted. Business facts and owner questions are in the [README](README.md).

## Adaptations from the brief

The brief was written for a "Sites" builder. These changes are deliberate; everything else in the brief stands.

| Brief                       | Here                                                                                              | Why                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Sites hosting and storage   | One Cloudflare Worker serving the built site, plus D1                                             | The demo runs in the existing Cloudflare account; one deploy serves pages, API and data |
| Sites authentication        | Cloudflare Access (one-time PIN), verified again inside the Worker; roles in D1                   | No passwords to store; the Worker never trusts the edge alone                           |
| Framer Motion               | The same library under its current package name, `motion` (`motion/react`)                        | Framer Motion is published as `motion` now                                              |
| Modo demostración           | Its own Cloudflare environment and database (`env.demo`, `pap-demo`)                              | Demo rows can never reach live data                                                     |
| shadcn/ui calendar          | A custom month grid for guests; native date and time inputs for staff                             | Sessions are shown as cards in the grid, which a date picker can't do                   |
| A view for readiness checks | Shared SQL fragments in `worker/rules.ts`                                                         | The checks take parameters (now, party size, own seats) that a view can't               |
| A memory store for tests    | The same SQL run on Node's built-in SQLite through a small D1-shaped adapter (`tests/unit/d1.ts`) | Tests prove the real statements instead of a second implementation                      |

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

| Element              | Classes                                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Page title           | `text-[32px] md:text-[44px] font-medium tracking-[-0.04em] leading-[1.08] text-ink`                                                           |
| Session/detail title | `text-[24px] font-medium tracking-[-0.025em] leading-[1.2] text-ink`                                                                          |
| Heading in a panel   | `text-base font-semibold leading-6 text-ink` (`sectionTitle`), so panel headings never compete with the page title                            |
| Body / helper        | `text-base leading-6 text-ink` / `text-sm leading-5 text-muted`                                                                               |
| Dates and times      | `tabular-nums tracking-[-0.01em]`                                                                                                             |
| Customer workspace   | `grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8`                                                                          |
| Main panel           | `rounded-2xl border border-border/50 bg-surface shadow-[0_1px_2px_rgba(28,25,23,0.04),0_8px_24px_rgba(28,25,23,0.06)]` plus `p-4 sm:p-6`      |
| Grouped facts        | `rounded-2xl bg-stone-100 p-4` (`inset`), the third surface level inside a panel                                                              |
| Flush list           | `divide-y divide-border/70` (`rows`): rows divided by hairlines, never a card inside a card                                                   |
| Primary action       | `min-h-11 rounded-2xl bg-accent px-4 py-3 text-sm font-medium leading-5 text-white hover:bg-accent-hover` + focus outline                     |
| Secondary action     | `min-h-11 rounded-2xl border border-stone-400 bg-surface px-4 py-3 text-sm font-medium leading-5 text-ink hover:bg-stone-100` + focus outline |

These live in `src/components/ui/` and `src/lib/styles.ts` so pages don't repeat them.

- **Layout:** one 1280px container for the demo band, header, main and footer. Single-column pages (terms, the guest's page, a session on a phone) are left-aligned, not centered.
- **Surfaces:** three levels only: the canvas, a panel, and the stone-100 inset. Sections inside a panel are divided by a hairline, not boxed again.
- **Date stub:** a 56px column with the weekday, the day number (tabular) and the month, beside the text it dates (`src/components/DateStub.tsx`), with no border or fill so it never looks tappable. It is hidden from screen readers, because the full date is in the text or the heading next to it. Below 22rem it lies flat on one line.
- **Facts** (Cuándo, Dónde, Precio, Grupo) are rows divided by hairlines, each label with its Lucide icon (CalendarDays, MapPin, Tag, Users). "Cuándo" stays the first fact, with "(hora de Puerto Rico)" in it.

## Statuses

Every status is an icon and a word. Shape carries weight; color never does.

- **Availability** (`AvailabilityBadge`): "Disponible" is quiet (icon and word, no outline). "Pocas plazas", "Agotado" and "Cancelado" are outlined in ink and semibold. "Fecha por confirmar" has a light outline; past dates are muted. An undated session in a list sits under one "Fecha por confirmar" heading instead of repeating it.
- **A guest's booking** (`BookingStatus`): Hourglass for "Solicitud recibida" and "Pendiente de pago", CircleCheck for "Confirmada", TriangleAlert for "En revisión del equipo", CircleX for "Cancelada", History for "Completada", UserX for "No asistió". Ended states are muted.

## Behind a button

Secondary and rare features wait behind a button, so each page leads with its main task. Facts a guest needs to decide, and every honesty label, stay in view.

| Page              | Behind a button                                                                                             | Always in view                                                                                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header (phones)   | "Menú": Calendario, Condiciones, Instagram and the language, opening in the page flow (not an overlay)      | The business name and logo                                                                                                                                                                                                    |
| A session         | "Leer el texto de su publicación": the announced policy's exact quote and its source link                   | When, where, price, group limits, the action, and the label "Anunciada; fecha de efectividad…"                                                                                                                                |
| Reservation sheet | "Añadir una nota (opcional)", opening by itself when the draft has a note                                   | The session's name and date in the sheet's fixed header on every step, the receipt included; Atrás, Continuar and the submit in the footer. A missing acceptance moves focus to its checkbox, and a problem scrolls into view |
| Receipt           | "Avísales por Instagram": the message to copy and "Copiar mensaje y abrir Instagram"                        | The result, the link, "Añadir a mi calendario", "No te enviamos ningún mensaje…", and "Ver mi reservación" as the footer's one action. "Hacer otra…" is a quiet button at the end                                             |
| The guest's page  | "Pedir un cambio o una cancelación" (a sheet); "Retirar mi solicitud" (a confirmation); the full terms text | The status, any proposal waiting for acceptance (first), the session, the accepted price                                                                                                                                      |
| Terms             | "Ver versiones anteriores (N)"                                                                              | "Vigentes", with the announced quote open                                                                                                                                                                                     |

Guest pages build these with `src/components/ui/disclosure.tsx` (a button with `aria-expanded`, no Radix), so the first-visit bundle stays small. Dialogs and sheets load lazily.

## The first screen

- **Computers:** a month grid with session cards on the left; a 360px panel on the right. The panel shows the selected session, or, when nothing is selected, the "Próxima fecha" card (with "Ver detalles") first, as a fixed-height inset, then the A18 photo (120px) beside their motto, its caption, and their wording, all above the fold. While the dates load, the card's place is kept at the same height, so nothing shifts. The panel is sticky without a scrollbar of its own.
- **Phones:** the agenda (a dated list) first, with a month picker and a switch to the grid. The calendar sits on the page, not inside a panel; each day's cards sit beside a date stub, and every card puts the status and the price on lines of their own.
- **Header:** the logo and name, then the links. On phones the links wait behind "Menú" (its word is read but not shown below 23rem); from 768px they are inline, with "Calendario" first and marked current on the calendar and its sessions.
- **Footer:** the business name, the source line and a labeled nav (Calendario, Condiciones, Instagram). It sits at the bottom of short pages.
- Before scrolling, at 390×844 and 360×640: the business name, the "Calendario" heading, the month controls, and the first session with its action (or the empty state).
- Empty state when nothing is published: "Aún no hay fechas publicadas. Consulta las próximas experiencias en Instagram." with a link to the official profile only.
- **The demo banner is there from the first paint.** In the demo the Worker marks the page's HTML (`<html data-demo="1">`), so the banner never arrives after the dates and pushes the page down.

## Calendar controls

- **Phones, in three rows:**
  1. The month, with "Mes anterior" and "Mes siguiente" on either side.
  2. "Hoy" and the Calendario/Lista switch.
  3. The experience filter. It appears only when the dates loaded include more than one experience.
- **Phones open on Lista,** the agenda. Their Calendario view is a compact month: days with sessions are buttons, and choosing one filters the agenda below. "Ver todo el mes" clears the choice. A session opens on its own page.
- **Computers:** the same controls on one row, with the filter (12rem) at its end. The filter appears after the dates load, and because the row has room for it, it doesn't push the calendar down; `tests/e2e/design.spec.ts` holds layout shift to 0.02 or less.
- "Mes anterior" is off on the current month. The month name is announced politely when it changes.
- The chosen view lasts for the browser tab (session storage), and nothing depends on it.

## Staff workspace

- `/equipo/` is its own chunk, loaded only there, with the same tokens, type and actions as the guest pages. It reads as a quiet work ledger: the main task leads each page, and rare or destructive actions wait behind a button.
- **Header, computers (1024px and wider):** "Proyección al Paladar · Equipo", then "Ver el sitio", the language and an account menu (the role, with the signed-in email inside). Below it, the nine sections in three groups divided by rules: Calendario, Esta noche, Sesiones, Reservaciones | Excepciones, Pedidos | Experiencias, Configuración, Historial. The current one is filled with ink. Excepciones and Pedidos show an outline count only when something is waiting, from the existing staff endpoints.
- **Header, below 1024px:** one row with the name over "Equipo · Dueño" (or "Equipo"), and "Secciones". It opens a sheet (from the bottom on phones, from the right from 640px) with the same three groups, the counts, the account, "Ver el sitio" and the language. When cases wait, the button shows an ink dot and says so to screen readers ("Hay casos por atender.").
- **Demo band:** in the demo, a dark band at the top says "Demostración: datos de prueba. Nada aquí es real."
- **Panel headings** use body size (`sectionTitle`), a density adaptation for staff, so they never compete with the page title. The 24px detail title stays for dialog and sheet titles.
- **Lists** are flush rows divided by hairlines inside one panel, with column headers on computers and two-line rows on phones. Rows change color on hover; nothing moves. Count chips and nav counts of zero are hidden; panel headings and filters show their count, zero included ("Por resolver (0)").
- **Statuses** (`StatusPill`): a 14px icon and a word, with shape for urgency. Needs action, solid ink: Pendiente de pago, En revisión del equipo (an exception). Normal, an outline: Borrador, Publicada, Solicitud recibida, Confirmada, Completada. Ended, a muted outline: Cancelada, Archivada, No asistió. The DEMO tag is dashed, with no icon, and comes first. On the month grid, a chip names its state only when the session isn't simply published, as the guest grid does.
- **Seats** read "8 de 24 plazas", with a 4px ink-on-stone track that never animates.
- **Esta noche** is a check-in list sized for a phone: today's confirmed reservations grouped by session, how many people have arrived, and a Por llegar / Llegaron / Todas switch.
- **Readiness:** a session's checklists ("Lista para publicar", "Lista para confirmar en línea", each with "n de m listos") show the server's own checks. Each missing item reads "Falta:" with a CircleX and stays in view; ready items read "Listo:" with a CircleCheck, behind "Ver lo que está listo (n)".
- **Owner-only controls** stay visible but disabled for the Equipo role, under one "Solo un dueño puede cambiar la configuración." notice. The server refuses them anyway. The Equipo and Demostración tabs, which only owners can use, are not shown to that role.
- **Dialogs and sheets** return focus to the button that opened them, including those opened from "Más acciones". Form sheets are 520px wide on computers and rise from the bottom on phones, with the save action in a footer that doesn't scroll.
- **Refusals** name what failed and what to do, from the server's reason codes. A failed exception resolution says "No se pudo resolver. La excepción sigue igual."
- "Restablecer demostración" exists only in the demo, for owners, on Configuración's Demostración tab. Its dialog says what it deletes, that it recreates the DEMO data, and that the history and the team stay.
- Dense rows and tables change color or border only, as in [Motion](#motion).

### Staff: what sits behind a button

| Page            | In view                                                                                                                                                                                                                                                                                                         | Behind a button                                                                                                                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calendario      | Month arrows, "Hoy", a Calendario / Lista switch and the experience filter; a month grid (computers) or a list (phones); on computers, a 360px preview of the chosen or next session with its first 5 reservations and "Abrir sesión"                                                                           | "Nueva sesión" and "Entrar solicitud a mano" open sheets                                                                                                                                                                                  |
| Sesiones        | A state filter with counts, and the sessions                                                                                                                                                                                                                                                                    | "Nueva sesión" (a sheet; `/equipo/sesiones/nueva/` opens it over the list)                                                                                                                                                                |
| One session     | State, date, seats and price; "Publicar" on drafts; the reservations; both checklists' missing items; a read-only "Datos" panel (place, capacity, blocked seats, group, mode, price, terms, the "Pocas plazas" threshold)                                                                                       | "Editar sesión" (a sheet with Cuándo, Lugar y plazas, Reservación y precio); "Más acciones": Volver a borrador, Archivar, Descargar CSV, then Cancelar sesión; the ready checks                                                           |
| Reservaciones   | The search, and the reservations                                                                                                                                                                                                                                                                                | On phones, "Filtros" (a sheet) with removable chips; "Entrar solicitud a mano" (a sheet; its route stays)                                                                                                                                 |
| One reservation | Status, reference, session, contact, open guest requests with "Marcar como atendido", the payments with "Calculado, no emitido", accepted terms and proposals, and the status's next step ("Confirmar", the exception's two confirmations, "Registrar llegada" or "Deshacer llegada", "Marcar como completada") | "Registrar movimiento" (a dialog); "Armar respuesta" (a dialog with "Copiar"); "Más acciones", with only the actions the status allows: resize, move, send terms, edit details, new link, no-show, then Cancelar reservación; the history |
| Excepciones     | The cases and their three resolutions                                                                                                                                                                                                                                                                           | "Ver proceso aprobado" (when approved; when not, an open callout links to Configuración); "Confirmar en otra sesión" (a dialog)                                                                                                           |
| Pedidos         | Each request, clamped to two lines                                                                                                                                                                                                                                                                              | "Ver todo"                                                                                                                                                                                                                                |
| Experiencias    | The list                                                                                                                                                                                                                                                                                                        | "Editar" and "Nueva experiencia" (a sheet with Español / Inglés)                                                                                                                                                                          |
| Configuración   | Tabs synced to `?tab=` (`reglas`, `lugares`, `condiciones`, `equipo`, `demostracion`), a vertical 220px list on computers: Reglas (the default, opening with "Datos fijos"), Lugares, Condiciones, Equipo (owners), Demostración (owners, demo only)                                                            | Place and terms editors (sheets), team members (a dialog), approved terms read-only behind "Ver"                                                                                                                                          |
| Historial       | The latest 200 changes as readable actions grouped by day, with a "Tipo" filter                                                                                                                                                                                                                                 | "Ver cambios": only the changed fields, as Campo, Antes and Después                                                                                                                                                                       |

## Motion

- Shared spring: `{ type: "spring", stiffness: 300, damping: 30 }` (`src/lib/motion.ts`).
- Page entry: container `staggerChildren: 0.05`; items from `{ opacity: 0, y: 12 }` to `{ opacity: 1, y: 0 }`. Only the header and the main panels stagger; calendar cells never move.
- Buttons: `whileTap={{ scale: 0.98 }}`. Inputs, calendar cells and dense staff rows change color or border only.
- Disclosures open on the shared spring (height and opacity); the reservation sheet's steps slide 12px on it. Under reduced motion both change at once.
- Magnetic pull: only the main CTA, only on a fine pointer with hover, at most 3px, springing back on exit. Never on touch, inputs, cells, destructive actions or staff tables.
- `useReducedMotion()` removes translation, scaling, magnetism and stagger delays. Content renders at once; focus, color and status feedback stay.
- Motion never gates completion, hides an error or shifts layout.

## Feedback wording

The site says only what happened.

| Moment                          | Copy                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------ |
| Inquiry saved                   | "Solicitud recibida. El equipo debe confirmar disponibilidad y condiciones."   |
| Waiting for payment             | "Solicitud recibida. No reserva plazas hasta que el equipo verifique tu pago." |
| Confirmed by the server         | "Reservación confirmada"                                                       |
| Response lost                   | "No sabemos si llegó tu solicitud. Vuelve a intentarlo; no se duplicará."      |
| Same request ID, different data | "Ya enviaste esta solicitud con otros datos. Revísala y envíala de nuevo."     |
| Terms changed                   | "Las condiciones cambiaron. Revísalas antes de continuar."                     |
| No sender configured            | "No te enviamos ningún mensaje. Guarda este enlace para ver tu solicitud."     |
| Link replaced                   | "Este enlace ya no es válido. Pide uno nuevo al equipo."                       |
| Copying worked / failed         | "Mensaje copiado." / "No se pudo copiar. Selecciona el mensaje y cópialo."     |
| Instagram opened                | "Continúa en Instagram." (never "enviado")                                     |
| A calculated refund             | "calculado, no emitido" until staff record the refund                          |

## Copy rules

- Active voice, eighth-grade reading level, **20 words or fewer per sentence**, in Spanish and English. `tests/unit/copy.test.ts` checks every interface string.
- Never: Seamless, Leverage, Robust, Revolutionize, Unlock, Ecosystem, Cutting-edge, Elevate, nor Spanish equivalents (fluido, aprovechar, robusto, revolucionar, desbloquear, ecosistema, vanguardia, elevar).
- Concrete actions: "Ver fechas", "Reservar plazas", "Solicitar plazas", "Revisar solicitud", "Guardar sesión".
- No emoji or symbol characters that a phone could draw as emoji.
- Puerto Rican Spanish first; English is a toggle (`?lang=en`). Business name and movie titles stay as written.

## Claims

| Claim                                                          | Status                                    | Source                   |
| -------------------------------------------------------------- | ----------------------------------------- | ------------------------ |
| Name, handle, "Cine gastronómico" in Aguada, DM for dates      | **Verified**                              | Profile bio (E01)        |
| Ratatouille, Aguadilla, May 2 and May 30, 2026, sold out       | **Verified**                              | Posters A23, A20         |
| "Cine. Sabores. Emociones."                                    | **Verified** (their wording, to approve)  | Graphic A19              |
| Shrek dates for September–October, at the new Aguada local     | **Advertised** (posters, not inventory)   | A11, A08, A29, A06, A09  |
| Shrek offer: 8 platos, 3 bebidas, ambientación, popcorn, agua  | **Advertised** (that offer only)          | A28                      |
| From November 15: full payment; 60% refund with 3 days' notice | **Announced** (applies only if confirmed) | Policy post A02          |
| "Los primeros en Puerto Rico"                                  | **Company claim**                         | Profile bio (E01)        |
| Address, dates, capacity, prices, menus, policy details        | **Unverified** → "Por confirmar"          | Owner questions (README) |

## Photos

| Slot         | Source          | Served as                                    | Shows                                                                                   | Caption                                                                          |
| ------------ | --------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `room`       | A18 (1200×1600) | The whole frame, 3:4                         | An earlier event room; people; projected film                                           | "Evento anterior. Fuente: @proyeccionalpaladarpr. Permiso de uso por confirmar." |
| `table-food` | A27 (1440×1920) | 4:3, from the bottom of the frame, 1440×1080 | Table, food and balloons. The crop leaves out the projected film and the screen's brand | same                                                                             |
| `food`       | A25 (640×1136)  | 4:3, 640×480                                 | Food at a screening                                                                     | same                                                                             |
| `logo`       | A01 (150×150)   | The whole frame                              | Their logo                                                                              | none; shown at 72 CSS px or less                                                 |

- **Where they appear.** `room` leads the introduction: the side panel on computers, below the calendar on phones. `table-food` and `food` appear in the session details of the experiences that use them (the panel or the session's page). Staff choose an experience's photo in Experiencias; the demo gives `table-food` to Ratatouille and `food` to Shrek.
- **How they are made.** `npm run photos` (`scripts/photos.mjs`) sets each slot's crop shape and vertical focus. `table-food` uses focus 1, the bottom edge. It writes `src/photos.ts`, which records for each photo its source, whether people or film content are visible (`table-food`: `filmVisible: false`), and `reuse: 'not_verified'`.
- Room photos never stand in for the current Aguada venue.
- Permission is unverified for every use, the pitch included. `npm run launch-check` blocks a public launch while any served photo lacks approval.
- No file is wider than its original. No posters, character art, customer portraits or evidence screenshots are served.
