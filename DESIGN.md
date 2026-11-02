# Proyección al Paladar: design rules

How the site looks, moves and speaks. The brief is `research/BUILD_PROMPT.md` §0; this file records how it is applied and where it was adapted. Business facts and owner questions are in the [README](README.md).

**The look is "Sala y boleto"**, chosen by the repository's owner on October 30, 2026 (a proposal, not the business's approved brand): a dark cinema band (the sala) for the header, each page's title and the footer, with film grain and Fraunces titles, over warm paper where the calendar, forms and sheets live. It takes its night palette, grain and serif titles from the MelanieCreations site, and its tickets, marquee band and big type from the Party Dips PR site, two other projects in the same account. It replaces the brief's visual rules (light stone palette, Inter only, no texture); every other rule in the brief stands, including one accent family, honest feedback, real photos only and the accessibility rules.

## Adaptations from the brief

The brief was written for a "Sites" builder. These changes are deliberate; everything else in the brief stands.

| Brief                       | Here                                                                                              | Why                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Sites hosting and storage   | One Cloudflare Worker serving the built site, plus D1                                             | The demo runs in the existing Cloudflare account; one deploy serves pages, API and data      |
| Sites authentication        | Cloudflare Access (one-time PIN), verified again inside the Worker; roles in D1                   | No passwords to store; the Worker never trusts the edge alone                                |
| Framer Motion               | The same library under its current package name, `motion` (`motion/react`)                        | Framer Motion is published as `motion` now                                                   |
| Modo demostración           | Its own Cloudflare environment and database (`env.demo`, `pap-demo`)                              | Demo rows can never reach live data                                                          |
| shadcn/ui calendar          | A custom month grid for guests; native date and time inputs for staff                             | Sessions are shown as cards in the grid, which a date picker can't do                        |
| A view for readiness checks | Shared SQL fragments in `worker/rules.ts`                                                         | The checks take parameters (now, party size, own seats) that a view can't                    |
| A memory store for tests    | The same SQL run on Node's built-in SQLite through a small D1-shaped adapter (`tests/unit/d1.ts`) | Tests prove the real statements instead of a second implementation                           |
| Light stone palette, Inter  | "Sala y boleto": a dark band over warm paper, Fraunces titles over Inter text, still film grain   | The repository's owner chose it on October 30, 2026; the business's photos are dark and warm |

## Tokens

Defined in `src/styles.css` with Tailwind v4 `@theme`. This palette is a proposed interface direction, not the company's brand system.

| Token                   | Value     | Use                                                                                  |
| ----------------------- | --------- | ------------------------------------------------------------------------------------ |
| `--color-canvas`        | `#f8f2e9` | Paper: the page under the band                                                       |
| `--color-surface`       | `#fffcf7` | Panels, sheets and dialogs                                                           |
| `--color-ink`           | `#1c1612` | Text on paper                                                                        |
| `--color-muted`         | `#5b5047` | Helper text on paper                                                                 |
| `--color-border`        | `#dccfbf` | Decorative panel borders and perforations (never the only input border)              |
| `--color-accent`        | `#b45309` | The one accent on paper: primary actions, selection, focus, stub dates               |
| `--color-accent-hover`  | `#92400e` | Primary action hover                                                                 |
| `--color-wash`          | `#fcf4e6` | Insets, tickets inside a panel, calendar chips                                       |
| `--color-wash-strong`   | `#f7e6c6` | A calendar chip on hover                                                             |
| `--color-ticket`        | `#fbf6ee` | A ticket on the dark band                                                            |
| `--color-sala`          | `#17110d` | The dark band: header, page band, footer, the dialog overlay (60%)                   |
| `--color-sala-raised`   | `#231a14` | Hover on the band                                                                    |
| `--color-sala-line`     | `#3e3128` | Hairlines on the band                                                                |
| `--color-on-sala`       | `#f4ebdf` | Ivory text on the band; the selected staff section                                   |
| `--color-on-sala-muted` | `#c4b29f` | Secondary text on the band                                                           |
| `--color-brass`         | `#e2a13f` | The accent on the band: the current link, focus, the demo banner, the marquee's mark |
| `--color-brass-hover`   | `#f0b65a` | Brass hover                                                                          |

- **One accent family: amber, with brass as its light on the dark band.** Every saturated color, the warm paper and the band's browns included, sits between hue 15 and 45. No red, green or blue state colors: warnings, destructive actions, sold out and confirmed are told apart by text, icon and shape. `tests/e2e/design.spec.ts` checks the computed colors.
- **Inputs** use a `stone-500` border (at least 3:1). `tests/unit/contrast.test.ts` checks every text pair (4.5:1) and every border and focus ring (3:1), on paper and on the band.
- **Fonts:** Fraunces for titles (upright with its optical-size and weight axes; an italic for the motto only) and Inter for everything else, both self-hosted (`public/fonts/`, OFL; `npm run fonts`), falling back to Georgia and `"Segoe UI", Arial, sans-serif`. Figures are lining and tabular wherever dates and numbers line up.
- **Texture:** only on the band. A still film grain on the header and footer; the page band adds one soft amber glow behind its title row, centered low so it never meets the header's edge. Elements with texture carry `data-texture`; nothing else draws a background image or a gradient. No blur, glows on controls or colored shadows.
- **Radius:** panels, tickets and actions `rounded-2xl`; on phones the paper rises over the band with a 28px edge; calendar cells and dividers stay square.
- **Shadow:** one neutral panel shadow (`rgba(28,25,23,…)`), slightly deeper for dialogs.

## Type and layout classes

| Element               | Classes                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Page title (band)     | `font-display text-[40px] md:text-[64px] font-medium tracking-[-0.02em] leading-[1.04]` (`pageTitle`), ivory on the band                      |
| A session's own page  | `font-display text-[32px] md:text-[48px] font-medium tracking-[-0.015em] leading-[1.1]` (`sessionTitle`), for long titles                     |
| Staff page title      | `font-display text-[32px] md:text-[40px] font-medium tracking-[-0.015em] leading-[1.1] text-ink` (`workTitle`), on paper                      |
| Panel and sheet title | `font-display text-[28px] font-medium tracking-[-0.01em] leading-[1.15] text-ink` (`detailTitle`)                                             |
| Heading in a panel    | `text-base font-semibold leading-6 text-ink` (`sectionTitle`), so panel headings never compete with the panel's title                         |
| Kicker                | `text-xs font-semibold uppercase leading-4 tracking-[0.14em]` (`kicker`): "Próxima fecha", a stub's weekday and month                         |
| Motto                 | `font-display text-[24px] italic leading-[1.25] md:text-[28px]` (`motto`), with "Su frase en Instagram." under it                             |
| Body / helper         | `text-base leading-6 text-ink` / `text-sm leading-5 text-muted`                                                                               |
| Dates and times       | `tabular-nums lining-nums tracking-[-0.01em]`                                                                                                 |
| Customer workspace    | `grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8`                                                                          |
| Main panel            | `rounded-2xl border border-border/70 bg-surface shadow-[0_1px_2px_rgba(28,25,23,0.05),0_12px_32px_rgba(28,25,23,0.08)]` plus `p-4 sm:p-6`     |
| Grouped facts         | `rounded-2xl bg-wash p-4` (`inset`), the third surface level inside a panel                                                                   |
| Flush list            | `divide-y divide-border/70` (`rows`): rows divided by hairlines, never a card inside a card                                                   |
| Primary action        | `min-h-11 rounded-2xl bg-accent px-4 py-3 text-sm font-medium leading-5 text-white hover:bg-accent-hover` + focus outline                     |
| Secondary action      | `min-h-11 rounded-2xl border border-stone-400 bg-surface px-4 py-3 text-sm font-medium leading-5 text-ink hover:bg-stone-100` + focus outline |
| On the band           | `onSala` (ivory text, raised hover) and `brass` (brass fill, sala text), with a brass focus outline                                           |

These live in `src/components/ui/` and `src/lib/styles.ts` so pages don't repeat them.

- **Layout:** one 1280px container inside the full-width band, header, sheet and footer. Single-column pages (terms, the guest's page, a session on a phone) are left-aligned, not centered.
- **The band and the sheet** (`src/components/Band.tsx`): each guest page opens with its band (the title, and on the calendar their phrase), then the paper sheet. From 640px the sheet's first panels overlap the band's last 64px, like a ticket on a table; on phones the paper rises over the band with a rounded edge. The band is a plain block, not a landmark; the sections below carry the names.
- **Surfaces:** three levels on paper: the canvas, a panel, and the wash inset. Sections inside a panel are divided by a hairline, not boxed again.
- **Tickets** (`src/components/Ticket.tsx`): a stub with the date (weekday, a large Fraunces day number, the month; hidden from screen readers, since the full date is in the text or a heading) and a body, divided by a dashed perforation with two notches. The notches are a mask on an inner element, so the band shows through and a focus ring is never cut. Below 16rem (200% zoom on a phone) the stub lies flat above the body, with no notches. Used for the next date, every agenda row and a confirmed reservation; a request or a reservation waiting for payment never gets one.
- **Facts** (Cuándo, Dónde, Precio, Grupo) are rows divided by hairlines, each label with its Lucide icon (CalendarDays, MapPin, Tag, Users). "Cuándo" stays the first fact, with "(hora de Puerto Rico)" in it.

## Statuses

Every status is an icon and a word. Shape carries weight; color never does.

- **Availability** (`AvailabilityBadge`): "Disponible" is quiet (icon and word, no outline). "Pocas plazas", "Agotado" and "Cancelado" are outlined in ink and semibold. "Fecha por confirmar" has a light outline; past dates are muted. An undated session in a list sits under one "Fecha por confirmar" heading instead of repeating it.
- **A guest's booking** (`BookingStatus`): Hourglass for "Solicitud recibida" and "Pendiente de pago", CircleCheck for "Confirmada", TriangleAlert for "En revisión del equipo", CircleX for "Cancelada", History for "Completada", UserX for "No asistió". Ended states are muted.

## Behind a button

Secondary and rare features wait behind a button, so each page leads with its main task. Facts a guest needs to decide, and every honesty label, stay in view.

| Page              | Behind a button                                                                                             | Always in view                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Header (phones)   | "Menú": Calendario, Condiciones, Instagram and the language, opening in the page flow (not an overlay)      | The business name and logo                                                                                                                                                                                                                                                                                                                                                                 |
| A session         | "Leer el texto de su publicación": the announced policy's exact quote and its source link                   | When, where, price, group limits, the action, and the label "Anunciada; fecha de efectividad…"                                                                                                                                                                                                                                                                                             |
| Reservation sheet | "Añadir una nota (opcional)", opening by itself when the draft has a note                                   | The session's name and date in the sheet's fixed header on every step, the receipt included; Atrás, Continuar and the submit in the footer. A missing acceptance moves focus to its checkbox, and a problem scrolls into view                                                                                                                                                              |
| Receipt           | "Avísales por Instagram": the message to copy and "Copiar mensaje y abrir Instagram"                        | The result; on a confirmed ticket, "Tu número para la entrada" large with "Muéstralo en la entrada al llegar."; the link, "Añadir a mi calendario", the message line ("No te enviamos ningún mensaje…", or what the text provider answered), and "Ver mi reservación" as the footer's one action. "Hacer otra…" is a quiet button at the end, not offered once the session can't be booked |
| The guest's page  | "Pedir un cambio o una cancelación" (a sheet); "Retirar mi solicitud" (a confirmation); the full terms text | The status; for a confirmed booking, the door number large, with the text's result when one was asked for; any proposal waiting for acceptance (first), the session, the accepted price                                                                                                                                                                                                    |
| Terms             | "Ver versiones anteriores (N)"                                                                              | "Vigentes", with the announced quote open; "Próximas", for approved terms that start later (never listed as in force)                                                                                                                                                                                                                                                                      |

Guest pages build these with `src/components/ui/disclosure.tsx` (a button with `aria-expanded`, no Radix), so the first-visit bundle stays small. Dialogs and sheets load lazily.

## The first screen

- **The band:** "Calendario" in Fraunces, and from 640px their phrase "Cine. Sabores. Emociones." in Fraunces italic with "Su frase en Instagram." On phones the band holds the title alone, so the agenda stays in the first screen; the phrase follows the agenda, with the photo.
- **Computers:** a month grid with session chips on the left; a 360px panel on the right. The panel shows the selected session, or, when nothing is selected, the "Próxima fecha" ticket (with "Ver detalles") first, at a fixed height, then the A18 photo cropped to 4:3 with its caption, and how to choose. While the dates load, the ticket's place is kept at the same height, so nothing shifts. The panel is sticky without a scrollbar of its own.
- **Phones:** the agenda (a dated list of tickets) first, with a month picker and a switch to the grid. Each ticket puts the time and the status on one line, then the title, then the price, so every ticket has the same shape.
- **Header:** the logo on an ivory disc and the name in Fraunces, then the links. On phones the links wait behind "Menú" (its word is read but not shown below 26rem, so the name keeps to one line) and open as large Fraunces words; from 768px they are an inline row, the current one underlined in brass.
- **Footer:** their phrase moving slowly as a marquee, then the business name, the source line and a labeled nav (Calendario, Condiciones, Instagram). It sits at the bottom of short pages.
- Before scrolling, at 1440×900, 390×844 and 360×640: the business name, the "Calendario" heading, the month controls, and the first session with its action (or the empty state). Grid rows are 96px, so a session in the month's fifth week still fits on computers.
- Empty state when nothing is published: "Aún no hay fechas publicadas. Consulta las próximas experiencias en Instagram." with a link to the official profile only.
- **The demo banner is there from the first paint,** in brass with dark text. In the demo the Worker marks the page's HTML (`<html data-demo="1">`), so the banner never arrives after the dates and pushes the page down.

## Calendar controls

- **Phones, in three rows:**
  1. The month, with "Mes anterior" and "Mes siguiente" on either side.
  2. "Hoy" and the Calendario/Lista switch.
  3. The experience filter. It appears only when the dates loaded include more than one experience.
- **Phones open on Lista,** the agenda. Their Calendario view is a compact month: days with sessions are buttons, and choosing one filters the agenda below. "Ver todo el mes" clears the choice. A session opens on its own page.
- **Computers:** the same controls on one row, with the filter (12rem) at its end. The filter appears after the dates load, and because the row has room for it, it doesn't push the calendar down; `tests/e2e/design.spec.ts` holds layout shift to 0.02 or less.
- "Mes anterior" is off on the current month. The month name is announced politely when it changes.
- **At the end of a month:** when no date is left this month, the calendar opens on the next date's month, once, and the line under the controls says "No quedan fechas este mes. Te mostramos {mes}." (announced politely). "Hoy" still goes back to this month, which is empty, says so, and offers "Ver próxima fecha". The same line always carries "Horas en hora de Puerto Rico."
- The chosen view lasts for the browser tab (session storage), and nothing depends on it.

## Staff workspace

- `/equipo/` is its own chunk, loaded only there, with the same tokens, type and actions as the guest pages. It reads as a quiet work ledger: the main task leads each page, and rare or destructive actions wait behind a button.
- **The calm version of the look:** the header is the dark band (grain, no glow); page titles are Fraunces at 32/40px (`workTitle`); lists, forms and tables stay on quiet paper, so daily work stays fast to scan.
- **Header, computers (1024px and wider):** "Proyección al Paladar · Equipo" in Fraunces, then "Ver el sitio", the language and an account menu (the role, with the signed-in email inside), all in ivory. Below it, the nine sections in three groups divided by rules: Calendario, Esta noche, Sesiones, Reservaciones | Excepciones, Pedidos | Experiencias, Configuración, Historial. The current one is an ivory pill with dark text. Excepciones and Pedidos show an outline count only when something is waiting, from the existing staff endpoints.
- **Header, below 1024px:** one row with the name over "Equipo · Dueño" (or "Equipo"), and "Secciones". It opens a sheet (from the bottom on phones, from the right from 640px) with the same three groups, the counts, the account, "Ver el sitio" and the language. When cases wait, the button shows a brass dot and says so to screen readers ("Hay casos por atender.").
- **Demo band:** in the demo, a brass band at the top says "Demostración: datos de prueba. Nada aquí es real."
- **Panel headings** use body size (`sectionTitle`), a density adaptation for staff, so they never compete with the page title. Dialog and sheet titles use the 28px Fraunces title.
- **Lists** are flush rows divided by hairlines inside one panel, with column headers on computers and two-line rows on phones. Rows change color on hover; nothing moves. Count chips and nav counts of zero are hidden; panel headings and filters show their count, zero included ("Por resolver (0)").
- **Statuses** (`StatusPill`): a 14px icon and a word, with shape for urgency. Needs action, solid ink: Pendiente de pago, En revisión del equipo (an exception). Normal, an outline: Borrador, Publicada, Solicitud recibida, Confirmada, Completada. Ended, a muted outline: Cancelada, Archivada, No asistió. Configuración and a reservation's side column use the same pills: a place's approval, the terms' states, a member's role and access, a proposal's state and a handled request. The DEMO tag is dashed, with no icon. In lists it sits beside the title or name; on a record's page it comes first in the meta row. On the month grid, a chip names its state only when the session isn't simply published, as the guest grid does.
- **Seats** read "8 de 24 plazas", with a 4px ink-on-stone track that never animates.
- **Esta noche** is the door, sized for a phone. It opens with **Recepción**: one field, "Número, nombre o teléfono", that finds any of today's reservations by its number (with or without "PAP-", any case or spacing), part of the name (accents ignored) or four or more digits of the phone, with one-tap "Registrar llegada" in each result. Beside it, "Llegó sin reservación" opens the walk-in sheet. Below: how many people have arrived, a Por llegar / Llegaron / Todas switch, and today's reservations grouped by session, in every status but cancelled (a request or a pending payment shows its pill instead of the button). On phones each row stacks: the name, the group and the number on one line, the note on up to two lines, then a full-width "Registrar llegada". After a check-in, focus moves once the list shows it: to the row's other button, or to the next guest.
- **Walk-ins** ("Llegada sin reservación", a sheet): today's sessions that can confirm anyone, each with its free seats; the group, name and contact; the session's price and terms (the text behind "Leer las condiciones"); and "El cliente leyó y aceptó estas condiciones en persona.", required. The server applies a reservation's rules (seats, limits, contact, unchanged terms) on the session's own day, even after it started. The result is the number, large, under "Número para la entrada", then "Confirmada. Llegada registrada a las…" or, under terms that ask for full payment first, "Pendiente de pago…". The acceptance is recorded as made in person.
- **The door number** is the booking's reference (`PAP-` and six characters), shown in `doorNumber` (Fraunces at 28px on the narrowest phones, 32px from 380px, 40px from 640px, lining figures; it breaks only after "PAP-", never inside the code) on the confirmed receipt, the guest's page and the walk-in result. It is the same number staff search, the text carries, and the calendar file names.
- **Readiness:** a session's checklists ("Lista para publicar", "Lista para confirmar en línea", each with "n de m listos") show the server's own checks. Each missing item reads "Falta:" with a CircleX and stays in view; ready items read "Listo:" with a CircleCheck, behind "Ver lo que está listo (n)".
- **Owner-only controls** stay visible but disabled for the Equipo role, under one "Solo un dueño puede cambiar la configuración." notice. The server refuses them anyway. The Equipo and Demostración tabs, which only owners can use, are not shown to that role.
- **Dialogs and sheets** return focus to the button that opened them, including those opened from "Más acciones". Form sheets are 520px wide on computers and rise from the bottom on phones, with the save action in a footer that doesn't scroll. A refusal shows in that footer, beside the button, so it is in view after a send; a possible duplicate in "Entrar solicitud a mano" shows there too.
- **Refusals** name what failed and what to do, from the server's reason codes. A failed exception resolution says "No se pudo resolver. La excepción sigue igual."
- "Restablecer demostración" exists only in the demo, for owners, on Configuración's Demostración tab. Its dialog says what it deletes, that it recreates the DEMO data, and that the history and the team stay.
- Dense rows and tables change color or border only, as in [Motion](#motion).

### Staff: what sits behind a button

| Page            | In view                                                                                                                                                                                                                                                                                                                                                                   | Behind a button                                                                                                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Calendario      | Month arrows, "Hoy", a Calendario / Lista switch and the experience filter; a month grid (computers) or a list (phones); on computers, a 360px preview of the chosen or next session (draft or published) with its first 5 reservations, "Entrar solicitud a mano" for that session and "Abrir sesión"; a month with no dated session says so                             | "Nueva sesión" and "Entrar solicitud a mano" open sheets                                                                                                                                                                                                                       |
| Sesiones        | A state filter with counts, and the sessions                                                                                                                                                                                                                                                                                                                              | "Nueva sesión" (a sheet; `/equipo/sesiones/nueva/` opens it over the list)                                                                                                                                                                                                     |
| One session     | State, date, seats and price; "Publicar" on drafts; the reservations; both checklists' missing items; a read-only "Datos" panel (place, capacity, blocked seats, group, mode, price, terms, the "Pocas plazas" threshold)                                                                                                                                                 | "Editar sesión" (a sheet with Cuándo, Lugar y plazas, Reservación y precio); "Más acciones": Volver a borrador, Archivar, Descargar CSV, then Cancelar sesión; the ready checks                                                                                                |
| Esta noche      | Recepción's search and its results, the arrival count, the switch and today's list                                                                                                                                                                                                                                                                                        | "Llegó sin reservación" (a sheet); the terms text inside it, behind "Leer las condiciones"                                                                                                                                                                                     |
| Reservaciones   | The search, and the reservations, today and later first; a list cut at 500 says so                                                                                                                                                                                                                                                                                        | On phones, "Filtros" (a sheet) with removable chips; "Entrar solicitud a mano" (a sheet; its route stays)                                                                                                                                                                      |
| One reservation | Status, reference, session, contact (with the text's result, or "Pidió su número por texto…"), open guest requests with "Marcar como atendido", the payments with "Calculado, no emitido", accepted terms and proposals, and the status's next step ("Confirmar", the exception's two confirmations, "Registrar llegada" or "Deshacer llegada", "Marcar como completada") | "Registrar movimiento" (a dialog); "Armar respuesta" (a dialog with "Copiar"); "Más acciones", with only the actions the status allows: resize, move, send terms, edit details, new link, no-show, then Cancelar reservación; the history (when there is none, a line says so) |
| Excepciones     | The cases and their three resolutions                                                                                                                                                                                                                                                                                                                                     | "Ver proceso aprobado" (when approved; when not, an open callout links to Configuración; when the settings fail to load, it says so, with a retry); "Confirmar en otra sesión" (a dialog)                                                                                      |
| Pedidos         | Each request, clamped to two lines                                                                                                                                                                                                                                                                                                                                        | "Ver todo"                                                                                                                                                                                                                                                                     |
| Experiencias    | The list                                                                                                                                                                                                                                                                                                                                                                  | "Editar" and "Nueva experiencia" (a sheet with Español / Inglés)                                                                                                                                                                                                               |
| Configuración   | Tabs synced to `?tab=` (`reglas`, `lugares`, `condiciones`, `equipo`, `demostracion`), a vertical 220px list on computers: Reglas (the default, opening with "Datos fijos"; each setting's help sits under its select, with "Guardar" beside it from 640px and after the help on phones), Lugares, Condiciones, Equipo (owners), Demostración (owners, demo only)         | Place and terms editors (sheets), team members (a dialog), approved terms read-only behind "Ver"                                                                                                                                                                               |
| Historial       | The latest 200 changes as readable actions grouped by day, with a "Tipo" filter; sessions are named by date and title, and new reservations, walk-ins, requests and texts count as Reservaciones. A "Confirmar" that found money but no seats reads "Confirmación sin plazas: pasó a Excepciones". Team changes are shown to owners only                                  | "Ver cambios": only the changed fields, as Campo, Antes and Después                                                                                                                                                                                                            |

## Motion

- Shared spring: `{ type: "spring", stiffness: 300, damping: 30 }` (`src/lib/motion.ts`).
- Page entry: container `staggerChildren: 0.05`; items from `{ opacity: 0, y: 12 }` to `{ opacity: 1, y: 0 }`. Only the header and the main panels stagger; calendar cells never move.
- Buttons: `whileTap={{ scale: 0.98 }}`. Inputs, calendar cells and dense staff rows change color or border only.
- Disclosures open on the shared spring (height and opacity); the reservation sheet's steps slide 12px on it. Under reduced motion both change at once.
- Magnetic pull: only the main CTA, only on a fine pointer with hover, at most 3px, springing back on exit. Never on touch, inputs, cells, destructive actions or staff tables.
- `useReducedMotion()` removes translation, scaling, magnetism and stagger delays. Content renders at once; focus, color and status feedback stay.
- Motion never gates completion, hides an error or shifts layout.
- **The marquee** (the footer's band of their phrase) drifts slowly (60 seconds a cycle). It is decoration, hidden from screen readers; it stops while hovered, has a pause button with `aria-pressed` (WCAG 2.2.2), and under reduced motion it stands still and the button is gone.
- **Popcorn** bursts once, for about 1.5 seconds, only when the server has just confirmed a reservation: never for a request, a reservation waiting for payment, a copied message or a reopened receipt, and never under reduced motion. It is hidden from screen readers and takes no clicks.

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
| No text sent                    | "No te enviamos ningún mensaje. Guarda este enlace para ver tu solicitud."     |
| Text the provider accepted      | "Te enviamos tu número por texto al ••• 0142. Guarda este enlace…"             |
| Text the provider refused       | "No pudimos enviarte el texto al ••• 0142. Guarda tu número y este enlace."    |
| Text with no answer             | "No sabemos si el texto llegó al ••• 0142. Guarda tu número y este enlace."    |
| A number that can't take one    | "Ese número no puede recibir textos, así que no te enviamos ninguno…"          |
| The door                        | "Tu número para la entrada" · "Muéstralo en la entrada al llegar."             |
| Link replaced                   | "Este enlace ya no es válido. Pide uno nuevo al equipo."                       |
| Copying worked / failed         | "Mensaje copiado." / "No se pudo copiar. Selecciona el mensaje y cópialo."     |
| Instagram opened                | "Continúa en Instagram." (never "enviado")                                     |
| A calculated refund             | "calculado, no emitido" until staff record the refund                          |

## Text messages

- **Off until set up.** With no SMS provider configured (Twilio secrets, README), the guest form offers no text, nothing is queued, and the receipt says "No te enviamos ningún mensaje…".
- **Only with consent.** The guest ticks "Envíame mi número de reservación por texto cuando se confirme." (shown only for a phone, and only when texts are on); staff tick "El cliente aceptó…" in manual entry, a walk-in or an edit. One text, once the booking is confirmed, never again for the same booking while one was sent or its result is unknown.
- **What it says:** the business, "reservación confirmada", the number, the date and time (Puerto Rico time) and "Muéstralo en la entrada.", in the language the guest booked in. Never the private link: a text can be read by someone else.
- **Only +1 numbers** (Puerto Rico, the U.S. and the rest of the North American plan): anyone can book, and an international or premium number would cost the business.
- **Only what happened.** A text is queued inside the confirming write, then claimed, sent and its answer recorded, each through the ledger. Its status is what the provider answered: sent, failed, or unknown when no answer came back. A text whose booking stopped being confirmed before it went out is skipped, never sent.

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

| Slot         | Source          | Served as                                     | Shows                                                                                   | Caption                                                                          |
| ------------ | --------------- | --------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `room`       | A18 (1200×1600) | The whole file, shown cropped to 4:3 (center) | An earlier event room; people; projected film                                           | "Evento anterior. Fuente: @proyeccionalpaladarpr. Permiso de uso por confirmar." |
| `table-food` | A27 (1440×1920) | 4:3, from the bottom of the frame, 1440×1080  | Table, food and balloons. The crop leaves out the projected film and the screen's brand | same                                                                             |
| `food`       | A25 (640×1136)  | 4:3, 640×480                                  | Food at a screening                                                                     | same                                                                             |
| `logo`       | A01 (150×150)   | The whole frame                               | Their logo                                                                              | none; shown at 72 CSS px or less                                                 |

- **Where they appear.** `room` leads the introduction: the side panel on computers, below the agenda on phones. `table-food` and `food` appear in the session details of the experiences that use them (the panel or the session's page). Staff choose an experience's photo in Experiencias; the demo gives `table-food` to Ratatouille and `food` to Shrek.
- **How they are made.** `npm run photos` (`scripts/photos.mjs`) sets each slot's crop shape and vertical focus. `table-food` uses focus 1, the bottom edge. It writes `src/photos.ts`, which records for each photo its source, whether people or film content are visible (`table-food`: `filmVisible: false`), and `reuse: 'not_verified'`.
- Room photos never stand in for the current Aguada venue.
- Permission is unverified for every use, the pitch included. `npm run launch-check` blocks a public launch while any served photo lacks approval.
- No file is wider than its original. No posters, character art, customer portraits or evidence screenshots are served.
