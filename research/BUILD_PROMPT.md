# Proyección al Paladar — Sites build prompt and booking specification

Prepared as a future build brief. This file does not authorize sending customer messages, charging payments, or publishing an app now. Pair it with the research report, source index, image manifest, and review evidence in the delivered package.

## Copy-and-paste build prompt

You are an elite Frontend Architect and UI/UX Designer. Build intentional, tactile, human-crafted interfaces with **React, Tailwind CSS v4, Framer Motion, and Lucide**. Follow the design contract below throughout the calendar, reservation flow, and staff workspace. The project is already defined in this brief; proceed with it when a build is requested. Ask only for missing decisions that affect the requested work, and continue independent implementation where those decisions are not required.

Build a polished, mobile-first calendar and reservation web app for **Proyección al Paladar**, a movie-themed dining experience associated with Aguada, Puerto Rico, and the Instagram account **@proyeccionalpaladarpr**. Use **Sites** for the eventual implementation. Read and follow the installed Sites building and hosting workflows when a build is requested. Use the capability path because reservations need persistent records and the staff area needs authentication. The primary product is an event calendar with party-seat reservations and a staff scheduling workspace.

Use the accompanying research report, sources, captured images, asset manifest, and review evidence as the content authority. Resolve contradictions in favor of the original primary source, record the conflict, and do not invent missing business facts. The package is research evidence and a proposed product specification; its screenshots and downloaded files do not by themselves establish permission for public reuse.

### 0. Frontend design contract

**Critical directive: strictly avoid generic AI aesthetics and copy.** The interface must feel designed for a small cinema-dining business. Dates, party size, food imagery, and clear booking status should establish its character. Visual polish must support the actual scheduling task.

**Banned visual and layout patterns**

- No purple or blue glowing orbs or gradients. No generic dark mode with heavy glassmorphism.
- No floating abstract 3D/isometric shapes, particle networks, arbitrary glowing borders, or decorative animated backgrounds.
- No centered promotional heading, subtitle, two pill buttons, and oversized dashboard screenshot as the opening composition.
- Use an asymmetrical scheduling workspace: a larger calendar or agenda alongside a narrower session-detail panel. Use editorial spacing and real approved imagery.
- Use a bento arrangement only when it groups distinct operational tasks. Do not turn every detail into a decorative card.
- Keep the mobile agenda direct and compact. Do not use scroll effects, sticky overlays, or large image treatments that hide dates or controls.

**Copy and data**

Write product copy in active voice at an eighth-grade reading level. Keep each generated interface sentence to **20 words or fewer**, in Spanish and English. Customer and staff labels, helper text, errors, empty states, and confirmation messages follow this rule. Preserve an approved quotation exactly; select a shorter excerpt or an attributed summary when necessary, rather than rewriting a quote to fit.

Do not use these words in generated interface copy, regardless of capitalization: **Seamless, Leverage, Robust, Revolutionize, Unlock, Ecosystem, Cutting-edge, Elevate**. Avoid equivalent promotional filler in Spanish. Prefer concrete actions such as **Ver fechas**, **Reservar plazas**, **Revisar solicitud**, and **Guardar sesión**. Do not imply that a request is confirmed before the server confirms it.

Do not invent satisfaction percentages, user totals, ratings, sold-out labels, or scarcity. Use only verified live operational counts. Any sample data must stay inside the isolated **Modo demostración** described below. Use small, practical examples, such as a party of two or four and a few sample reservations. Mark every sample session **DEMO**. Do not invent plausible business prices, real customer identities, policies, or testimonials.

**Component quality and stack**

Use React components, Tailwind CSS v4 utilities and theme tokens, Framer Motion, and consistent Lucide icons. Use accessible shadcn/ui primitives for dialogs, sheets, forms, selects, and other suitable controls. Preserve their keyboard, focus, and screen-reader behavior.

Study **Magic UI** and **Aceternity UI** for animation composition; **Motion Primitives** and **React Bits** for measured micro-interactions; and **Opensource UI** for tactile component finishes. Apply their interaction quality and component structure only where they serve this app. Filter every reference through the banned patterns above. These are quality references, not a requirement to install every library or copy its showcase effects. Reuse the selected starter's compatible dependencies and avoid duplicate motion packages.

**Precise visual system**

Use a light stone palette with charcoal text and **exactly one bold accent family: amber**. The palette is a proposed interface direction, not a verified company brand system. Natural colors in approved photographs remain intact. Do not add red, green, or blue semantic accent palettes. Identify warning, destructive, sold-out, and confirmed states with explicit text, consistent icons, shape, and neutral contrast.

Define these Tailwind CSS v4 tokens in the app stylesheet:

```css
@import "tailwindcss";
@theme {
  --font-sans: "Inter", "Segoe UI", Arial, sans-serif;
  --color-canvas: #fafaf9;
  --color-surface: #ffffff;
  --color-ink: #1c1917;
  --color-muted: #57534e;
  --color-border: #d6d3d1;
  --color-accent: #b45309;
  --color-accent-hover: #92400e;
}
```

Use Inter only when it is available or properly loaded; the fallback stack must remain usable. Use these exact starting classes and adjust only for a documented layout or accessibility need:

| Element | Required starting classes |
| --- | --- |
| Page title | `text-[32px] md:text-[44px] font-medium tracking-[-0.04em] leading-[1.08] text-ink` |
| Session/detail title | `text-[24px] font-medium tracking-[-0.025em] leading-[1.2] text-ink` |
| Body and helper text | `text-base leading-6 text-ink` and `text-sm leading-5 text-muted` |
| Calendar dates and time | `tabular-nums tracking-[-0.01em]` |
| Desktop customer workspace | `grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8` |
| Main panel | `rounded-2xl border border-border/50 bg-surface shadow-[0_1px_2px_rgba(28,25,23,0.04),0_8px_24px_rgba(28,25,23,0.06)]` |
| Panel padding | `p-4 sm:p-6` |
| Primary action | `min-h-11 rounded-2xl bg-accent px-4 py-3 text-sm font-medium leading-5 text-white hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` |
| Secondary action | `min-h-11 rounded-2xl border border-stone-400 bg-surface px-4 py-3 text-sm font-medium leading-5 text-ink hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` |

Use subtle 1px panel borders and the restrained layered shadow above. Keep app panels and action surfaces at `rounded-2xl`; do not mix arbitrary radius values. Calendar cells and dividers can remain square for alignment. Never add harsh shadows or glows. Use at least 44px touch targets where controls need them. Verify text, controls, focus indicators, and meaningful boundaries meet accessible contrast requirements; a faint decorative panel border is not sufficient to identify an input.

**Animation physics and micro-interactions**

Use Framer Motion spring physics for structural movement. Define the shared transition as `{ type: "spring", stiffness: 300, damping: 30 }`. Do not use default linear CSS transitions for moving panels, dialogs, calendar changes, or expanding sections.

Keep every enabled interactive control responsive through hover, focus, active, loading, and disabled styling. Use a restrained background shift on hover and `whileTap={{ scale: 0.98 }}` on action buttons when motion is permitted. Keep focus and hit targets stable. Inputs, calendar cells, and dense staff rows should respond through color, border, or icon changes without moving their targets.

For page entry, use explicit variants: a container with `staggerChildren: 0.05`, and items entering from `{ opacity: 0, y: 12 }` to `{ opacity: 1, y: 0 }` with the shared spring. Stagger only the compact page header and main panels. Do not stagger every calendar cell or delay access to booking controls.

Use a spring to change the selected-session indicator and open the detail panel without shifting the calendar unexpectedly. Preserve selected dates and focus through month changes. Announce changes through accessible state, rather than relying on animation.

Add a subtle magnetic effect only to a suitable primary CTA, on a fine pointer with hover support. Bound translation to 3px in either direction and spring back on pointer exit. Keep its hit area fixed. Do not apply magnetism to touch controls, form inputs, calendar cells, destructive actions, or dense staff tables.

Use `useReducedMotion()` and pointer capability checks. Under reduced motion, remove translation, scaling, magnetism, and stagger delays. Render content immediately and keep all focus, color, and status feedback. Motion must never gate completion, obscure an error, cause layout shift, or restart the reservation flow.

**Output and implementation requirements**

When asked for an individual **section or page**, return its complete, single-file React component. Include all imports, types where used, exact Tailwind classes, event handlers, and Framer Motion variants in that file. State any required installed dependencies and existing theme tokens. Do not leave styling notes, unfinished handlers, pseudocode, or invented successful server responses. Any preview data follows the demo rules.

When asked for the **complete app**, implement the real routes, server operations, authentication, database records, and capacity rules in this brief. Keep each requested page component complete, but do not force backend services or secrets into a client component. A single-file visual component alone does not complete an operational reservation app.

Aim for the editorial care and interaction quality of premium Awwwards/Vercel examples. Judge the result by usable scheduling, readable content, deliberate spacing, accessible controls, and polished real states. Do not substitute decorative spectacle or generic marketing copy for those requirements.

Technical references: [Tailwind CSS theme variables](https://tailwindcss.com/docs/theme), [Motion for React animation](https://motion.dev/docs/react-animation), [reduced-motion handling](https://motion.dev/docs/react-use-reduced-motion), and [shadcn/ui documentation](https://ui.shadcn.com/docs).

### 1. Evidence and assumptions

Treat these as the currently supported facts, as established by RESEARCH_REPORT.md and SOURCES.md:

- The public Instagram account is `https://www.instagram.com/proyeccionalpaladarpr/`.
- Its profile describes a gastronomic cinema experience associated with Aguada.
- The profile directs people to direct messages for information, dates, and events.
- Observed profile highlights include **Customers**, **Platos**, and **Feedbacks**.
- Captured posts support movie-themed experiences including **Shrek**, **Ratatouille**, and an earlier **Cloudy with a Chance of Meatballs** poster. (The April 12 Moca poster does not print the year.) They are examples of observed programming, not guaranteed future events.
- Any statement that the company is the first of its kind in Puerto Rico is a **company claim**, not an independently established fact.
- A captured pinned policy graphic in [this primary Instagram post](https://www.instagram.com/proyeccionalpaladarpr/p/DdIb7sxoOoR/) says that **from November 15**, experiences must be paid in full when reserving, and cancellation with **three days' advance notice** returns **60% of the total paid**. The graphic does not print the year. The observed post timestamp falls on September 10, 2026 in Puerto Rico, but that timestamp does not resolve every policy ambiguity. Preserve the image and exact wording as evidence and have the business confirm the effective year/date and interpretation before enforcing the rule.

Treat everything else as either a sourced fact explicitly cited in the final package or a **proposed setting**. In particular, do not assume the current address, event availability, prices, taxes, deposits, staff, capacity, business hours, phone number, payment processor, age rules, accessibility arrangements, dietary guarantees, the policy that applies before the announced November 15 change, treatment of cancellation with less than three days' notice, or private-event availability. Do not silently translate “three days” into exactly 72 hours; the owner must confirm the cutoff, counting method, and business-zone application.

Do not reuse follower counts, post counts, or engagement figures as timeless promotional facts. Do not turn historical promotional dates into currently available sessions. Do not invent star ratings, review totals, customer quotes, names, or awards. Never create a fake customer testimonial to fill an empty layout.

The Shrek offer in A28 / S08 (September 22, 2026) lists eight movie-inspired dishes, three themed drinks, themed ambience, film projection, popcorn and water. This is specific to that advertised offer. The customer in S07 personally mentions ten dishes; do not assume the same session, a universal dish count, or that either source verifies future inclusions. Keep menus editable by experience/session. Promotional October dates in A29 and sold-out graphics A06/A09 are evidence of event scheduling, not current inventory.

Source and image mapping for this brief:
- A01: actual logo, only 150 x 150; request the owner's larger original for production.
- A18, A24, A27: strongest real event-room, service and table/food references respectively.
- A03 and E06: cinema dining atmosphere from a customer-authored/company-featured post/story.
- E05 and A25: actual plated food / served food, dish identities and ingredients unverified.
- A02 / E02 / S02: policy announcement; confirm its effective year and cutoff semantics.
- A28 / A29 / S08: Shrek offer inclusions and additional date graphic.
- E03 / S07 and E04 / S03: verified captions from two customer-authored recommendations.
- See IMAGE_MANIFEST.json for exact filenames, dimensions, source links and limits. All supplied captures are research references; public reuse approval is unset.

Use REVIEWS.json with aggregate rating unset. There are exactly two documented customer-authored recommendations, featured by the company, with sponsorship unknown and booking/visit verification unavailable. Label approved social content **Recomendaciones en Instagram**, keep its original public author/date/source, and do not style it as a five-star review or count E06 as a third review. Do not automatically publish either customer's portrait. Omit unapproved social content from the live app while preserving it in this research handoff.

### 2. Product and language

The public flow should let customers **choose a dining experience, select a scheduled session, and reserve seats for their party**. This is not a professional-services appointment app with arbitrary 30-minute slots. The staff area should let the business create and manage event sessions, capacity, bookings, schedule changes, and manually received reservations. Treat the requested appointment function as these scheduled reservations. A separate private-event consultation or arbitrary appointment service is optional and disabled until the owner confirms that service and its staff availability; do not advertise it as an existing company offering.

Use Spanish as the initial customer language, with natural Puerto Rican wording. Support an optional English toggle if translations can be maintained consistently. Preserve the business name and proper movie titles. Set the business time zone to **America/Puerto_Rico**. Store absolute event start and end instants and the business zone; display all customer-facing event times in the business zone with a clear local label. Do not derive event times from the visitor's device time zone. Use an accessible locale-aware calendar and calendar export that retains the correct zone or absolute instants.

Use guest booking by default. Customers should not need a new account to reserve. Protect any booking-management link with an unguessable, revocable token, and never expose a customer record through a predictable booking ID. Require authenticated staff access for all administrative data and changes.

### 3. First screen and layout

Open on a useful schedule: the business name, **Calendario** heading, month controls, a switch between calendar and list views, and available or demonstration sessions. Put the main scheduling action in the first viewport. Use a compact visual introduction and a relevant approved company photo without making users scroll past a large promotional hero to reach the calendar.

Desktop: a readable month grid with event cards and a session detail panel. Mobile: a chronological agenda as the initial view, with a month picker and a usable calendar option. Avoid a cramped desktop grid copied into a narrow phone screen. Include a clear empty state when no sessions are published: **“Aún no hay fechas publicadas. Consulta las próximas experiencias en Instagram.”** Link that action only to the verified official profile unless another contact channel is confirmed.

Use the section 0 visual system: charcoal type, a light stone canvas, warm approved food imagery, and one amber accent. The proposed palette must not be described as an official brand system. Keep warnings and destructive actions clear through neutral contrast, explicit labels, and icons. Do not make decorative film references compete with dates, remaining seats, or booking status. Do not create fake company photography, fake customer scenes, or invented film-property graphics.

### 4. Customer calendar and experience details

Each published session must show its experience title, local date, start time, duration or end time if confirmed, location or location instructions, availability state, and booking action. Show an actual amount only when staff have entered an approved price and currency. If price is unknown, show **“Precio por confirmar”** and use an inquiry flow; do not display `$0`, a made-up discount, or a fake checkout.

Calendar/list controls should support previous and next month, **Hoy**, and opening a session. Keep filters minimal: an experience filter only when there is more than one experience to choose from. Clearly distinguish **Disponible**, **Pocas plazas** only when a configurable threshold is satisfied, **Agotado**, **Cancelado**, and **Fecha por confirmar**. Never imply scarcity without real inventory. A cancelled or past session must not offer new bookings.

The session detail should contain an approved cover image; experience description; date and time; known menu or meal notes; venue information; approved price and inclusion notes; party-size limits; any sourced age or accessibility information; and the currently applicable booking/cancellation policy. Unknown operational details must remain explicitly unconfigured in staff settings, not become confident customer-facing claims. Give each published session a stable shareable page or deep link, but do not add unrelated marketing sections.

Use historical Shrek or Ratatouille material only where the report confirms it and clearly identify historical events. Do not publish those titles as scheduled offerings unless the business schedules a new session. Do not describe films, character art, logos, soundtrack use, or movie screenings as officially licensed partnerships unless documentation supports that claim.

### 5. Reservation flow

Use a short flow: **Sesión → Tu grupo → Datos de contacto → Revisar → Confirmación**.

1. Open a specific published session and show live availability.
2. Choose a party size bounded by the session's configured minimum/maximum and remaining capacity. Make clear that one reservation can cover several people.
3. Collect the lead guest's name and the business's configured contact channel. Ask only for information needed to administer the reservation. If both email and phone are offered, make the required field configurable and do not assume the business uses SMS or WhatsApp.
4. Allow an optional dietary/accessibility note only if staff can receive and review it. Explain **“Cuéntanos lo que debemos considerar. El equipo confirmará qué solicitudes puede atender.”** Do not promise allergen-free preparation or accommodations that have not been confirmed. Limit free text and avoid collecting medical histories.
5. Display a complete summary: session, date, local time, party size, verified location, approved amount and any configured deposit, contact details, applicable policy, and the next step.
6. Submit through a server-side operation with duplicate-submission protection. Revalidate the session, availability, and policy version when committing the reservation.
7. Return a distinct confirmation or inquiry acknowledgement with a reference, date/time, party size, status, and exactly what happens next. Offer **Añadir a mi calendario** with a correct `.ics` file and a safe **Ver mi reservación** link if booking management is implemented.

Support two explicit operational modes per session:

- **Confirmed booking:** enabled only after the business has entered capacity, date/time, required customer information, price/inclusion terms if charging, and approved booking policies. A successful commit reserves the requested seats and returns **Reservación confirmada**.
- **Inquiry/manual confirmation:** for sessions that require staff review or lack confirmed terms. Return **Solicitud recibida. El equipo debe confirmar disponibilidad y condiciones.** A request alone does not guarantee or reserve seats. Staff can convert the request into a confirmed booking through the same atomic capacity check. Never label an inquiry “confirmed.”

Do not add online payment collection to the core build unless the business explicitly chooses a provider and approves its price, full-payment/deposit requirements, refund, and tax configuration. Store the announced full-payment rule as a sourced policy draft with an owner-confirmed effective date; do not invent a pre-change deposit policy. When a full-payment policy is active, do not confirm a live reservation before payment is verified by the provider or authorized staff record a verified external payment. If a provider is not configured, use the inquiry/manual workflow and explain the actual next step. If online payment is requested, use the provider's supported secure checkout and verified server-side confirmation; do not store card details, treat a browser redirect as proof of payment, or add a fake successful payment state.

Implement effective-dated policy versions. Attach the approved version and displayed terms to each booking, preserve the customer's accepted version, and have staff explicitly resolve how a scheduled policy change applies to already-booked sessions. Once the owner confirms the announced cancellation rule, compute the 60% refundable portion from the actual applicable paid amount using consistent currency rounding. The source does not establish processing-fee treatment, refund timing, cancellation inside the three-day window, rescheduling rights, or a refund for business-initiated cancellation; keep those unresolved until approved. A calculated refund is not an issued refund.

If online payment is enabled, allocate an atomic expiring seat hold before opening checkout, calculate the amount on the server, and associate the checkout with the hold and policy version. On a verified provider event, consume that hold and confirm the booking exactly once. Define the expired-hold/late-payment outcome explicitly: do not confirm an over-capacity booking or silently retain a payment without a booking; flag the case for the approved refund/reconciliation workflow. Provider events and staff payment verification need an audit trail. Simulate these cases only in an isolated demo environment.

Notification integrations must be real before the interface promises an email, SMS, or WhatsApp confirmation. Without a configured sender, provide the in-app confirmation and downloadable calendar record and say that no message has been sent. Staff-entered email text or a simulated message log is not a working delivery integration.

### 6. Capacity and scheduling correctness

Persist sessions and reservations in a database. Browser storage may hold display preferences or a draft, not authoritative inventory, bookings, staff identity, or policy acceptance.

Use a transaction or equivalent atomic server-side operation to validate capacity and create/update a confirmed booking. Calculate available seats as configured session capacity minus confirmed party seats minus any explicit active seat holds minus staff capacity blocks. Reject negative inventory and avoid overbooking under concurrent requests. Decide whether a party must remain together and whether tables matter only from the business's configuration; default to seat-based capacity until table rules are confirmed.

Use a unique idempotency key for each submit intent. Repeated clicks, network retries, or duplicated provider events must not create multiple bookings or release seats twice. Recheck server-side dates and counts; never trust client-provided price, status, remaining seats, staff role, or total.

Do not add short-lived seat holds unless the implemented flow needs them. If holds are necessary, use an explicitly configured duration, server timestamps, expiry cleanup, and a clear countdown/expiry message. A proposed initial duration can be configured in staff settings, but is not a researched business policy. Expired holds release inventory once. An inquiry does not silently create an indefinite hold.

Changing party size or moving a booking must be atomic: validate the destination and any additional seats, commit the revised allocation, and only then release the previous allocation. A failed change leaves the prior booking intact. Decreasing party size or cancelling releases exactly the prior active seat allocation. A cancelled booking cannot be counted again unless staff explicitly restore it with a fresh capacity check.

Staff must not reduce capacity below existing confirmed allocations. Show the conflict and require a deliberate resolution. Prevent overlapping sessions for a configured venue or resource when overlap is disallowed. Whether multiple events can run concurrently is a configurable setting, not an inferred fact.

Cancellation or rescheduling of an entire session should identify affected bookings and require a deliberate staff action. Keep a record of the change. Do not silently relocate customers, claim refunds were issued, or send notifications through an unconfigured provider. Expose affected reservations for staff follow-up and report actual notification results.

### 7. Customer booking management

Let a guest open the protected management link to view their own booking or inquiry. Show current status, session details, party size, and permitted actions. Make cancellation and change requests reflect the business's approved policy and cutoffs. Do not let a demo policy control live reservations.

If no cancellation/change policy has been approved, provide a clear contact/request action and staff handling instead of promising automatic refunds or unrestricted changes. A customer's change request does not change the original seat allocation until staff approve it through the capacity rules. Keep booking status separate from payment status.

### 8. Staff scheduling workspace

Use authenticated roles: **Owner/Admin** can manage staff and settings; **Staff** can manage the operational schedule and reservations. Add narrower read-only permissions only if needed. Enforce roles on the server, not by hiding buttons. Customer pages must never return other guests' details or staff-only notes.

Provide these core views:

- **Calendario:** month/week/list scheduling and opening session records.
- **Experiencias:** create/edit approved titles, descriptions, images, meal notes, and reusable event templates without creating fake public programming.
- **Sesiones:** draft, schedule, publish, cancel, or archive a dated experience; set date/time, venue/resource, capacity, party limits, booking mode, approved amount, and policy.
- **Reservaciones:** search/filter by session and status; view party totals and lead contact; create a staff-entered reservation from a DM or other verified channel; update/cancel through capacity checks; record check-in; and export only authorized operational data.
- **Configuración:** business time zone, known contact channels, venue, policy versions, sender integrations, currency/price display, and explicit seat/overlap rules.

A session form must validate end after start, positive capacity, valid party limits, required approved content, and the booking mode's required settings. Include a publishing checklist driven by actual missing fields. Save unfinished sessions as drafts. Never treat placeholders as publishable content.

Record who created or changed operational records and when, with prior/new status or essential values. Keep staff notes separate from customer-visible text. Mark manual entries with a source such as **Instagram DM**, but never scrape DMs or assume permission to access private messages. Warn about possible duplicate manual entries using matching contact/session information while letting staff inspect and resolve them.

Cancellation, rescheduling, deleting operational records, or removing staff access should use a clear confirmation describing the actual consequence. Prefer archiving sessions/bookings needed for history over erasing active records. Do not add a generic marketing CRM, loyalty program, subscriptions, AI concierge, analytics suite, recurring automation, or waitlist unless requested later.

### 9. Content, images, references, and reviews

Use the supplied image manifest to choose relevant real company imagery. Every selected file should retain an asset ID, source URL, capture date, description, image dimensions, intended use, and reuse status. Keep references outside public assets where they contain browser chrome, private information, unrelated accounts, or customer names/faces without approved publication use. If a screenshot includes multiple posts or UI elements, do not present a crop as a standalone official photo without noting the transformation in the manifest.

For public app imagery, prioritize owner-supplied originals or assets with confirmed use permission. Captured Instagram post images are useful research/design references; do not automatically publish every captured screenshot. If the approved asset set is incomplete, use a deliberate text-first design with the approved images that exist and list the outstanding asset need. Never replace factual business images with generated art masquerading as company material.

Use a relevant approved food/experience image in the customer interface and approved session images where available. Supply useful alt text based on visible content, keep decorative images empty-alt, preserve aspect ratio, reserve layout dimensions, and crop without cutting essential dishes or embedded informational text. Optimize served copies while retaining originals and provenance in the research package. Do not hotlink unstable authenticated social-media image URLs as the production source.

Include customer feedback only when the final report supplies an attributable, accurately transcribed quote or approved summary. Distinguish public third-party reviews, reposted customer feedback, captions written by the business, and unverified promotional claims. Do not label an Instagram testimonial as an independently verified Google review. Do not infer star ratings from positive comments. If no usable review evidence is available, omit testimonial cards and state that no verified review content has been approved for publication in the implementation handoff.

Place source/reference links in a concise credits or reference area when helpful and appropriate. Keep research caveats in the handoff, while customer content accurately reflects what is known. Do not show internal source IDs, implementation details, or unconfigured-provider diagnostics inside the booking flow.

### 10. Accessibility, security, and reliability

Use semantic controls and landmarks, labelled inputs, keyboard access, visible focus, readable type and contrast, and touch-friendly controls. Calendar sessions must be reachable without a mouse; offer an equivalent list view. Do not convey status by color alone. Error messages should identify the field and correction, preserve valid input, and move focus appropriately. Announce booking outcomes and relevant dynamic updates to assistive technology. Respect reduced-motion preferences. Test small screens and 200% text enlargement.

Use server-side validation, authorization, protected staff sessions, parameterized database access, rate limiting for public submissions, and secrets kept outside client code. Avoid logging sensitive notes or management tokens. Minimize personal data, expose a clear contact/privacy notice using business-approved terms, and configure retention/export controls for staff rather than inventing a legal retention period. Backups and recovery should fit the actual storage deployment. This specification does not claim that an unreviewed app satisfies a named law or certification.

Handle loading, network failure, stale inventory, lost availability, invalid management links, expired holds if implemented, unpublished/cancelled sessions, and empty calendars. When the server rejects capacity, retain the customer's non-sensitive draft and offer available sessions without showing a false success screen. Do not silently queue a reservation as confirmed while offline.

### 11. Initial content and demonstration data

When no future dates have been approved, ship an explicit **Modo demostración** environment with sample sessions whose titles include **DEMO** and a persistent banner: **“Demostración: estas fechas y reservaciones no son reales.”** Use clearly fictitious guests such as **Cliente de prueba 01** and reserved example contact domains. Keep demo records out of the live dataset and prevent real notification/payment actions in demo mode. Avoid placing demo sessions in production search results or creating public scarcity claims from demo counts.

The production public calendar must initially show only approved published sessions, or the honest no-dates empty state. Provide a staff setup view for missing facts. Unknown address, price, phone, menu, or policies must not be filled with plausible guesses. Historical experiences can inform templates but must not become available sessions automatically.

### 12. Data structure

Use an implementation equivalent to these entities:

- **Experience:** id, approved title/description, approved asset references, verified historical/current status, optional menu/notes, created/updated metadata.
- **Venue/resource:** id, approved name/address/instructions, allowed overlap behavior, active flag.
- **Session:** id, experience id, venue/resource id, start/end instants, business time zone, capacity, party limits, booking mode, nullable approved price/currency, applicable policy version, draft/published/cancelled/archived state, change metadata.
- **Policy version:** id, approved text, source link/asset reference, effective window in the business zone, applicability rule, required payment fraction, cancellation cutoff semantics, approved refundable fraction, owner approval metadata. Unknown semantics remain unset and prevent automatic enforcement.
- **Booking:** id/reference, session id, party size, lead guest name/contact, optional limited customer note, inquiry/confirmed/cancelled/fulfilled/no-show state, source channel, idempotency key, policy version/acceptance timestamp where applicable, protected management-token digest, created/updated metadata.
- **Seat hold:** only if needed; id, session id, party size, expiry instant, idempotency link, consumed/released status.
- **Payment:** only if requested; booking id, provider reference, amount/currency, verified pending/paid/refunded state, provider event deduplication. Never card details.
- **Staff membership:** authenticated identity, role, active/revoked state.
- **Audit event:** actor, record/type, action, essential previous/new values, timestamp.
- **Asset/source:** asset id, relative file path, source URL, capture date, description, dimensions, permitted-use status, transformations.

Separate record status from display labels. Use appropriate constraints, indexes, and uniqueness so the documented capacity/idempotency rules hold in the deployed database. The eventual builder can choose concrete names and storage details consistent with the Sites capabilities.

### 13. Acceptance criteria

The completed app must meet these checks before handoff:

1. A mobile visitor immediately sees a useful event list/calendar, local dates/times, and the appropriate reservation/inquiry action.
2. A party booking allocates its full seat count. Two simultaneous submissions competing for the last seats cannot both overbook. Retry of the same submission produces one record.
3. Inquiry mode never promises a confirmed reservation or seat allocation. Staff confirmation rechecks capacity.
4. Cancellation and party-size changes update capacity exactly once. A failed transfer leaves the original booking intact.
5. Staff cannot publish missing operational terms, lower capacity below allocations, or violate configured overlap restrictions silently.
6. Past/cancelled/unpublished sessions cannot be newly booked. A stale browser view is revalidated on submit.
7. All customer-facing event times and exported calendar events correspond to the Puerto Rico schedule, including when viewed from a different device time zone.
8. Staff pages and customer booking records enforce authorization server-side. One guest cannot read another guest's booking using a modified ID or link.
9. Every public image and quote matches its approved source record; no fabricated review, current date, price, address, or license claim appears.
10. Keyboard, screen-reader announcements, mobile layout, contrast, text enlargement, form errors, empty states, and interrupted submissions are checked.
11. Persisted sessions/bookings survive refresh and access from another device. Demo records remain clearly isolated from production data.
12. No screen claims an email, message, charge, or refund occurred unless a working integration reports it. If an integration is unavailable, the limitation is accurately visible in the appropriate receipt/staff state.
13. The announced November 15 policy is not activated with a guessed year or guessed 72-hour rule. Once configured, applicable full payment, policy versions, cutoff calculation, refund amounts, and any payment/seat-hold race have been checked.
14. React, Tailwind CSS v4, Framer Motion, and Lucide are used consistently. Requested section/page outputs contain complete components, exact classes, and explicit motion variants without styling TODOs.
15. The UI uses one amber accent family and neutral status treatments. It contains none of the banned visual effects or generic promotional hero patterns.
16. Generated product copy uses direct wording, sentences of no more than 20 words, and none of the banned terms. All sample records are clearly marked, modest, and isolated from live data.
17. Spring motion, short entry staggering, hover/focus feedback, and button press states are checked. Reduced motion removes movement and stagger delays without hiding content or actions.
18. Magnetic movement is limited to an appropriate primary CTA on a fine pointer. Calendar cells, input targets, keyboard focus, and touch interactions remain stable.

Use focused functional and integration checks for these booking, permission, and time-zone risks. Avoid tests that only mirror markup or implementation details. Provide a concise handoff with the implemented scope, validation results, any unresolved owner settings, and any limitation that affects real bookings. Do not describe a static mockup as a completed operational booking system.

## Owner decisions required before accepting live reservations

These are configuration needs, not assumed business policies:

| Decision | Why it matters | Safe unresolved behavior |
| --- | --- | --- |
| Exact venue and arrival instructions | Customers need a correct destination | Keep sessions draft or use an approved inquiry flow |
| Future session dates and duration | Calendar must represent actual events | Public calendar has no invented dates |
| Capacity, party limits, and table rules | Prevents accepting incompatible groups | No confirmed booking until configured |
| Price, inclusions, currency, and any deposit | Customer must understand commitments | Display price pending and use inquiry mode |
| Booking confirmation method | Determines whether a submission reserves seats | Explicit inquiry mode |
| November 15 policy year/effective date, three-day cutoff semantics, and terms outside the stated rule | Determines when full payment and the sourced 60% refund rule apply | Preserve the announcement as evidence; request handling by staff; no invented automatic refunds |
| Confirmed contact and message sender | Enables accurate confirmations | In-app receipt; do not claim delivery |
| Dietary, age, access, and filming policies | Avoids unsupported promises | Omit unconfirmed claims and route specific requests to staff |
| Staff identities and roles | Protects operational/customer records | No publicly accessible admin actions |
| Image and feedback publication approval | Research capture does not establish reuse permission | Keep unapproved files as internal references |

