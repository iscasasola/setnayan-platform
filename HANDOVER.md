# HANDOVER — rd/features-pages-refresh · started 2026-10-18 ~16:20 PHT by the controller

Owner 2026-10-18 list item 3 ("The features pages refresh, which still describe early October") + "Continue as it
becomes available". Ship-on-green authorised through 19 Oct. DL 2026-10-08 "FEATURE PAGES MOVE INTO LEVEL 1": real
screenshots, TRUE CLAIMS ONLY (memory: /features must say what ships; guard app/features/features-page-says-what-ships.test.ts).
EXISTS: lib/feature-pages/* = 18 pages (papic, live-watch, patiktok, alaala, real-stories, budget, guest-list, seat-plan,
3d-plan, schedule, event-hub, logo-maker, music-maker, groups, mood-board, marketplace, compare, setnayan-ai), EN + TL,
written 2026-10-01; sitemap-features.xml; /help/[slug].
STALE vs what ships now (verify each against origin/main code, not memory): nothing for the Studio/Maker stages, the
Suppliers page (Find · Build · Booked), Budget redo, Guests Setup / Event access, Home quick setup, Prints, Dress code /
attire + call times, Wedding March, RSVP open/close, E-Gifts wish list, Cover Scene + Veil, effects, two hosts editing,
supplier dashboard (Today/Schedules/Asking…). Pro ◆ = all Animate/effects/Style/accents (2026-10-16 ruling, #6623).
BUILD: update the 18 pages' words to what ships TODAY (EN + TL twins), add pages only where a shipped feature has no page
and the house pattern supports it (list them; keep it to the clear ones: Suppliers, Prints, Dress code, Wedding March,
E-Gifts). Screenshots: real 375 px captures from the lab (never the owner's cale-ice); prices only from
platform_retail_catalog_v2 (read-only), never typed. Say "Event Hub", never "website"/"site"; say "event", never
"celebration". The guard must stay green and cover every new claim. NOTE: other builds land today (onboarding for 20
types, Budget B3, Logo L2–L4, in-app purchase, Maker photos) — describe only what is on main when you write; name the
pages whose screenshots must be retaken after those land.
Files: apps/web/lib/feature-pages/*, app/features/*, /tl twins, help pages, sitemap. Own walk folder (scratchpad/features-walk/).
Shots → ~/Documents/Claude/Projects/shots-2026-10-18/<pr>/. Fragment changelog.d/rd-features-pages-refresh.md.

## BUILDER LOG (rd/features-pages-refresh)
- 16:20 read spec. Five read-only fact sweeps run (Maker/Pro · RSVP/dress/march/gifts/prints · Suppliers/supplier dashboard/AI · Budget/Guests/Home/Seats · Papic/Live/others).
- Prod readings (2026-10-18, read-only): `platform_settings.setnayan_ai_paywall_enabled = true` → Setnayan AI is PAID. Catalogue: COUPLE_WEBSITE_PRO ₱5,000 one_time (the budget-lab fixture's ₱2,499 is stale → never show that row in a shot). Vercel prod SETS (values encrypted): MAKER_STAGES_STUDIO, LOCK_HANDSHAKE, EXPLORE_REPLAN (memory: "true"), PAPIC_GAMES_V1, REGISTER_GATES — so copy avoids claims that depend on an unknown value (handshake, Stages|Studio-only tools, Papic Challenges, no-sign-up preview).
- False/unprovable claims found in the 2026-10-01 copy: Setnayan AI "weekly digest" (no caller) · Memories "leave a message" (no surface) · Music Maker / Patiktok "cleared for sharing" (licence not in code) · Logo Maker "describe the feel" (it is a layered editor) · Mood Board "free" (renders cost credits) and rooms/ceiling now live in Seat plan · "invitation site" / "celebration" wording.
- Walk: lab dev server on :3617 (walk lane `walk:features-pages`), scripts in scratchpad/features-walk/.
- 17:30 copy refreshed (all 18 pages EN+TL) + 5 new pages (suppliers, dress-code, wedding-march, e-gifts, prints); hub who's-who + FAQ wording; help `plus-ones`; guard extended (6 bans + site/celebration + orphan-shot check), sabotage 3 red → restored green; targeted guards 57/57 + neighbours green. Rendered pages walked at 375 (public pages draw light in both schemes).
- Screenshots to RETAKE after today's builds land: budget (B3/B5 #6633), papic/live-watch/event-hub prices & buy flow (IAP #6637), logo-maker (L2–L4 #6638, no shot yet), event-hub (Maker photos #6634). Pages with NO shot yet (lab could not open the item at 375): dress-code, e-gifts, prints, papic, live-watch, patiktok, mood-board, logo-maker, marketplace, compare, 3d-plan, setnayan-ai, music-maker, groups, alaala, real-stories.
- NEXT: open draft PR, label, disable auto-merge, CI loop.
