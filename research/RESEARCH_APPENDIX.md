# Proyección al Paladar — sourced business research

Research date: **8 October 2026**. This file is working research for the final evidence pack. Primary Instagram observations were made by the root researcher in the live browser; this subtask used web search and public page retrieval, and did not control that browser. No messages were sent to the business.

## Evidence and confidence

| Finding | Source | Status and limits |
|---|---|---|
| The business uses the name **Proyección al Paladar** and Instagram handle **@proyeccionalpaladarpr**. | [Official Instagram profile](https://www.instagram.com/proyeccionalpaladarpr/) | Verified by root's live profile inspection. |
| It offers a Spanish-language cinema-and-dining experience in Aguada, Puerto Rico. Food seen on screen is part of its experience positioning. | [Official Instagram profile](https://www.instagram.com/proyeccionalpaladarpr/); [FindGlocal Aguada restaurant directory](https://www.findglocal.com/PR/Aguada/1493588-7/genre/273819889375819/Restaurantes/2) | Primary profile observation, corroborated at a basic level by a third-party directory. The directory lists Aguada, 00602 and an incomplete street value, “Oeste.” That is **not** an exact visitor address. |
| Customers are directed to DM for dates/reservations. | [Official Instagram profile](https://www.instagram.com/proyeccionalpaladarpr/) | Verified by root's live profile inspection. Do not claim a verified website or online booking provider. |
| No external bio link, public phone number, or email was visible during the live inspection. | [Official Instagram profile](https://www.instagram.com/proyeccionalpaladarpr/) | Observation about the inspected profile, not proof that no other contact channel exists. |
| A new Aguada venue is announced, with posts saying September events begin at that new local. | [New venue announcement](https://www.instagram.com/proyeccionalpaladarpr/p/DcWr5esFhUx/); [September schedule](https://www.instagram.com/proyeccionalpaladarpr/p/Dce2W6ploRC/) | Historical announcement verified visually by root. Exact address, accessibility, parking and seat capacity remain unverified. Use the captured source for exact dates and wording. |
| A posted policy describes full payment when booking and a 60% refund for cancellation with three days' notice. Its graphic refers to November 15 without an explicit year. | [Pinned policy post](https://www.instagram.com/proyeccionalpaladarpr/p/DdIb7sxoOoR/) | Verified visually by root. Root observed a post timestamp corresponding to 10 September 2026 in Puerto Rico (machine datetime 2026-09-11T03:24:29Z). **The effective date/year is ambiguous. Do not assume this policy is already active on 8 October 2026.** Make policy version/effective date configurable and obtain owner confirmation before live use. |
| Additional Shrek dates are promoted. | [Shrek dates post](https://www.instagram.com/proyeccionalpaladarpr/p/DdmB1Aglk-U/) | Primary promotion verified visually by root. A posted date or “limited seats” statement is not live inventory. Capture exact event details from the image/caption; do not infer future availability. |

## Known unknowns to preserve in the build prompt

- Legal company name, owner/team names, founding date and company registration.
- Exact venue address and map pin; whether previous and new venues should appear as separate resources.
- Current screening calendar, live seat inventory, seat/table layout and capacity per showing.
- Current prices, taxes, payment fees and accepted payment methods.
- Included courses and drinks; menus per movie; age restrictions; dress code; film language/subtitles.
- Current refund/rescheduling/no-show/late-arrival rules and the year/effective date of the November 15 policy.
- Confirmed dietary accommodation/allergen handling; collecting an allergy note must not imply accommodation is guaranteed.
- Public website, third-party booking integration, phone, email, WhatsApp and operational staffing hours.
- Rights/owner permissions for reusing public Instagram images and film art in a published commercial app.
- Independently verified review rating, review count, review platform and individual visit verification.

## Search method and limitations

Searches covered exact accented and unaccented company names, the Instagram handle, Puerto Rico/Aguada, booking/reservations/pricing/menu, cinema dining, news and Facebook. Search results for the company were extremely sparse; the meaningful indexed match was the FindGlocal Aguada directory. Unrelated “Paladar” restaurants and anatomy/academic results were discarded. No company-specific news article or separately verifiable standalone booking website was found in these searches.

The direct business directory page was identified by the reviews researcher as [FindGlocal company page](https://www.findglocal.com/PR/Aguada/971076846099111/Proyecci%C3%B3n-al-Paladar). Web open/click failed. A normal shell request failed due to restricted DNS; an escalated read-only HTTP request reached the directory but received a Cloudflare access block. No detail-page claims were extracted and no access protection was bypassed.

Web text retrieval for the official Instagram profile and the four posts above returned cache misses. This does **not** mean the pages do not exist. The primary evidence is root's live browser reading and screenshots/assets, which should be bundled with exact source URLs and a capture date.

## Separate reference businesses — inspiration only

These examples may inform interaction design. They are **not affiliated with Proyección al Paladar**; none of their pricing, menus, capacity, contact details, policy or reviews may be attributed to the target business.

1. [Cinema Exquisito — Pulp Fiction event](https://www.cinemaexquisito.com/event-details/capitulo-dos-pulpfiction). Its primary event page shows film-themed dining, a fixed session, location, ticket types and synchronized courses. Research capture 8 October 2026. The page labels an event on 8 November 2026 yet also says registration/sale has ended; use it only as interaction inspiration, never proof of current availability. Useful pattern: movie → session → ticket quantity/type → reservation.
2. [CinePatio Puerto Rico](https://cinepatio.com/). Its primary website describes a choose-date → deposit → event workflow for private cinema events. Research capture 8 October 2026. It is an outdoor cinema production company, not the target business. Useful pattern: separate private-event inquiry from public seat booking.
3. [Sabor Arte Picnic on OpenTable](https://www.opentable.com/r/sabor-arte-picnic-san-juan). Its venue-managed listing distinguishes a base cinema/picnic reservation from optional date-specific experiences and add-ons. Research capture 8 October 2026. It is a separate San Juan business. Useful pattern: show inclusions and optional extras before checkout.
4. [Caribbean Cinemas VIP](https://caribbeancinemas.com/VIP/). Its primary page describes numbered seats with dining tables. Research capture 8 October 2026. Useful pattern: implement seat selection only if the target owner confirms an actual seat map; otherwise use simple attendee capacity.

## Implications for a correct calendar/reservation app

Treat public experiences as **fixed showings with limited attendee capacity**, rather than generic open-ended restaurant appointments. That is a recommended product model inferred from the business's cinema-dining promotion; final scheduling/capacity rules require owner confirmation.

Separate public showings from a private-event inquiry/consultation flow. The latter should be clearly marked a proposal if private-event services have not been verified. An inquiry state must never look like a confirmed reservation.

Use Spanish as the primary interface language, make English an optional translation, and store event times in the venue timezone **America/Puerto_Rico**. Do not use the researcher's America/La_Paz timezone as the venue timezone.

Store source URL, evidence date, explicit year, venue and verification status alongside imported event content. Historical social flyers can populate an **archive/reference** view, not a live bookable calendar. Only owner-published future showings and server-confirmed inventory should become bookable.

Support policy version/effective date and a per-booking record of accepted policy. Show the admin-configured terms before any payment. Keep payment mode simulated until credentials/integration, actual prices and current policy are supplied. Do not accept real payments in a research prototype.

Never fabricate reviews, star ratings, company facts, menu items, current inventory, prices or owner contact details. For missing fields, use explicit “Por confirmar”/“Pendiente de confirmar” states or omit the section. Public promotional photos should remain sourced research references until the owner provides publication-ready assets and permissions.
