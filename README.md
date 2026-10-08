# Proyección al Paladar — calendar and group reservations (private pitch)

A Spanish-first website for **Proyección al Paladar**, a _cine gastronómico_ associated with Aguada, Puerto Rico ([@proyeccionalpaladarpr](https://www.instagram.com/proyeccionalpaladarpr/)). It is a pitch to the owners: it runs privately behind Cloudflare Access, in **Modo demostración**, on demo data, and takes no real reservations.

- **Guests** choose a date on a calendar, reserve for their whole group, and get a private link to see their reservation.
- **Staff** (`/equipo/`) create sessions, enter requests that arrive by Instagram by hand, confirm, move or cancel within capacity, record payments and refunds made outside the site, and check guests in.

The product brief and all research are in [`research/`](research/), unchanged ([`BUILD_PROMPT.md`](research/BUILD_PROMPT.md), [`RESEARCH_REPORT.md`](research/RESEARCH_REPORT.md)). The owner pitch is [`docs/propuesta.md`](docs/propuesta.md). Design rules and the adaptations from the brief are in [DESIGN.md](DESIGN.md).

## Status

- Built and tested locally. See [Tests](#tests) for what runs and [Deploy](#deploy) for the steps that need your Cloudflare account.
- Nothing is deployed from this repository yet. No booking, payment or message has been sent to anyone.

## Run locally

_Filled in with the scaffold (milestone 1)._

## Tests

_Filled in with the test suites._

## Deploy

_Filled in with the scripts (milestone 5)._

## Privacy until launch

_Filled in with the scripts (milestone 5)._

## Launch checklist

_Filled in with `npm run launch-check` (milestone 5)._

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

| Status                                                   | Facts                                                                                                                                                                                                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Verified in captured images**                          | Name and handle. Bio (E01): "Cine gastronomico AGUADA/ los primeros en Puerto Rico/para informacion de fechas de eventos: DM". Ratatouille in Aguadilla: May 2, 2026, 7:30 PM, "Sold out!" (A23); May 30, 2026, 3:30 or 7:30 PM, "Sold out" (A20). Tagline "Cine. Sabores. Emociones." (A19). Two Instagram recommendations (`research/REVIEWS.json`). |
| **Advertised programming** (posters, not live inventory) | Rincón July 18 and Moca April 12 (years not printed). Shrek dates for September–October, announced for the new Aguada local (A11, A08, A29, A06, A09). The Shrek offer's inclusions (A28): 8 platos, 3 bebidas temáticas, ambientación, proyección, popcorn, agua — that offer only. |
| **Announced; applies only if the owners confirm**        | Policy post of September 10, 2026 (A02): from "15 de noviembre", experiences are paid in full when reserving; cancelling 3 days ahead refunds 60%. The year is not printed and the top and bottom are cut off.                                         |
| **Company claim**                                        | "los primeros en Puerto Rico".                                                                                                                                                                                                                          |
| **Unverified → "Por confirmar"**                         | Address and arrival, future dates, capacity, prices and IVU, payment methods, menus and allergens, age rules, current policy, staff, contact channels beyond DM, photographers, and permissions for images and recommendations.                         |

No separate website, phone, email, current price or exact street address was verified during the October 8 research. That is a search and access limit, not proof they don't exist.

## Risks to raise with the owners

- **Photos.** Permission is unverified for every use, including this private pitch. A18 shows people, and A18 and A27 show projected film content. The room photos are historical and don't show the current Aguada venue.
- **Film screenings.** A18 shows a streaming app on the screen, and the public-performance license status is unknown. The site only says "inspirada en", adds no separate studio artwork and claims no licensing, though selected photographs contain projected film content.
- **Policy and payments.** The November 15 rule stays a draft until it's confirmed. Prepayment stays off in production until the exception process is approved.
