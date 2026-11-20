# What's-included presets — research notes (2026-11-17)

Input: `setnayan-specs/prototypes/whats_included_presets_2026-11-17.json` (281 services, 160 `norms`).
Output: `whats-included-presets-reviewed-2026-11-17.json` (same folder as this file). 62 norms services marked `reviewed: true` /
`source: "norms_checked"`. 98 norms services stay `reviewed: false` / `source: "norms"`.
`owner` and `fields` services are byte-identical to the input.

## ⚠ How strong this evidence is — read first

**Not one supplier page loaded.** WebFetch could not reach any site from this session. These
hosts failed with `getaddrinfo ENOTFOUND` (the session's network allowlist blocks them):
`eventnest.ph`, `knowledgebase.stpeter.com.ph`, `www.venuerific.com`. After three different hosts
failed the same way I stopped trying to fetch.

So **all evidence below comes from WebSearch result summaries**: short quoted snippets from the pages
listed, picked out by the search tool. I did not read any of these pages in full. The URLs are the
pages those snippets came from. Treat them as "search-snippet evidence", not as pages I read.
EventNest (a supplier marketplace blog) and Executive Gourmet (one caterer) make up a large share of
the snippets. That is a narrow base. To get real verification, allow `eventnest.ph`,
`brideandbreakfast.ph`, `kasal.com` and the hotel PDF hosts, then re-run the review.

No prices were added. No `amount` fields. No `basis` changed, except the one new choice row
(Catholic church aircon, `flat`).

---

## 1 · Venues & Simbahan — VERIFIED (partly)
Sources (search snippets): waterfronthotels.com.ph/wp-content/uploads/2025/07/Wedding-Packages-2025.pdf ·
summithotels.ph/…/Summit Ridge Tagaytay Packages 2025.pdf · sitecore-cd.shangri-la.com (Makati Shangri-La, Mactan) ·
eventnest.ph/blog/metro-manila-hotel-weddings-package-inclusions-vs-hidden-fees ·
scribd.com/document/574894946/WEDDING-RATES-DOCUMENTS-RULES · nuptials.ph · brideandbreakfast.ph/2019/08/26/guide-to-planning-a-civil-wedding/ ·
cebudailynews.inquirer.net/748570/civil-wedding-in-ph-requirements-process-and-steps-explained
- Venues usually bundle tables, chairs and linen. Hotels add an overnight bridal suite with breakfast for two,
  a one-tier cake, and a corkage WAIVER for a set number of bottles. A bad-weather plan is something couples ask about.
- Parish fees often cover use of the church plus lights and sound. Aircon and choir are often charged extra, and
  some parishes publish a rate with aircon and a rate without. At a civil wedding the couple brings two witnesses,
  and the officiant's office files the certificate with the LCR.

Changed:
- Hotel ballroom · Corkage → Waived corkage (set bottles) · a fee is not an inclusion. The packages include a waiver.
- Hotel ballroom · Bridal suite → Overnight bridal suite · this is how the hotel packages word it.
- Hotel ballroom · (new) Table linens · the hotel supplies linen.
- Garden reception · Corkage → removed · this is a charge, and no source shows a waiver for a garden venue.
- Hotel stay · Bridal suite upgrade → removed · an upgrade is an add-on, not an inclusion.
- Catholic church · Air conditioning or fans → Aircon (choice: Without aircon / With aircon, flat) · parish rate sheets price it both ways.
- Catholic church · (new) Church lights and sound · parish fees are quoted "inclusive of … lights, sound system".
- Civil (judge / mayor) · Witness arrangement → Filing with Local Civil Registrar · couples bring their own witnesses.

Not verified: Mosque · Garden/Beach ceremony · Christian/Born Again · INC kapilya · Aglipayan · Other place of worship ·
Villa · Guesthouse. No source covered them.

## 2 · Coordinators — NOT VERIFIED
Date / feng shui consultant: no search was run and nothing was found. Left unchanged.

## 3 · Catering & Cakes — VERIFIED (thin)
Sources: executivegourmet.ph/packed-meals-packages · executivegourmet.ph/kiddie-party-catering-packages-in-metro-manila/ ·
eventnest.ph/supplier/cake-studio · waterfronthotels.com.ph/…/Menu-2024_Jade-Emerald-Lauriat-Wedding-Package · okadamanila.com (Chinese banquet) ·
help.jollibee.com.ph/hc/en-us/articles/12483619255695
- Packed meals: rice, a viand, bottled water, and a disposable spoon and fork. Kids' parties: a party host, and a
  mascot appearance with every Jollibee Kids Party. Lauriat: a multi-course set menu and centrepieces.
- Cake sources were mostly US vendors (they say only "delivery, setup, tasting vary"). The cake rows are unchanged.

Changed: Packed meals · Drink → Bottled water · Utensils → Spoon and fork. Crew meal packs · Drink → Bottled water.
Not verified: Wake catering.

## 4 · Styling, Flowers & Lights — VERIFIED (partly)
Sources: dfa.gov.ph/images/BAC/2023/AMP/BAC2023-175_RFQ.pdf and _TOR.pdf · bidding.owwa.gov.ph (2025 LED wall RFQ) ·
eventnest.ph/blog/cold-pyro-fog-machines-and-special-effects-lights-at-filipino-weddings-a-complete-guide/ ·
eventnest.ph/blog/how-much-does-a-wedding-fireworks-display-cost-in-the-philippines/ · decor.lazada.com.ph (balloon guide)
- LED wall: the panel comes with a processor or switcher, a playback laptop, a video operator, delivery and
  installation, and a truss.
- Cold sparks: 2–10 units placed at the entrance or exit and fired on cue, with an operator on larger packages.
  Some suppliers fold in permits (BFP and LGU clearances).
- Balloons: only non-PH vendor lists were found (garland, columns, delivery and setup).

Changed: LED video wall · (new) Processor and switcher · (new) Truss or stand.
Not verified: Mandap · Tea set styling · Proposal setup · LED dance floor · Chairs & tables · Lounge set · Stage & truss · Ribbon-cutting.

## 5 · Hosts, Music & Program — VERIFIED (partly)
Sources: executivegourmet.ph/kiddie-party-catering-packages-in-metro-manila/ · eventnest.ph/blog/cotillion-de-honor-a-complete-guide-to-the-traditional-debut-dance/ ·
lightandsoundrental.blogspot.com/2026 · yugatech.com/feature/watch-grand-videoke-symphony-3-pro · cdn-storage.okadamanila.com (Playful Celebrations Birthday Package)
- Kids' packages: two clowns, party hosting, a magic show, a puppet show, balloon twisting, a sound system, and game prizes.
- Choreographer: a set number of rehearsals, help choosing the music, and costume or prop guidance. Music editing
  is NOT described as standard. Videoke unit: the main unit, 2 wireless mics, a remote, and a song list. Delivery is
  often a small extra fee.

Changed: Cotillion & 18 roses · Song mixing → Music selection help · editing is not a standard inclusion.
Not verified: Orchestra · Father-daughter dance · Lion dance (it appears only as a couple's own story) · Fire dancers · Speaker/talent ·
Booth builder · Team-building · Inflatables (only retail and foreign sources) · Face painting · Bubble show.

## 6 · Photo & Video — NOT VERIFIED
Toga & class photos: no search was run. Unchanged.

## 7 · Gowns, Barong & HMUA — VERIFIED (narrow)
Sources: brideandbreakfast.ph/2024/07/10/ultimate-guide-to-wedding-essentials/ · eventnest.ph/supplier/haydee-garcia ·
eventnest.ph/supplier/regine-tolentino-atelier · ue.edu.ph/mla/?p=34537 (toga rental)
- Ceremony essentials: arrhae (13 coins), candles, veil, cord, rings, and a Bible. The ring pillow was not confirmed.
  Gown rental: one designer includes minor alterations and dry cleaning.

Changed: Debut gown · (new) Dry cleaning.
Not verified: Sari/Lehenga · Qipao · Sherwani · 18 roses attire · Baptismal gown · Costumes · Cord/Veil/Candles/Bible/
Ring pillows/Rosary item-level rows · all Shoes services.
⚠ Structural, left for the owner: **Shoe rental has 2 rows and Rosary has 3**, below the 4-row minimum. No source
supported a row to add, so I did not invent one.

## 8 · Booths, Food Carts & Bars — VERIFIED (partly)
Sources: eventnest.ph/supplier/the-flashbox · eventnest.ph/supplier/moments-lab · eventnest.ph/supplier/fotograb-photobooth ·
narra-tree.vercel.app/iloilo-photobooth · eventnest.ph/blog/how-a-scent-bar-works-at-a-filipino-wedding-reception… ·
eventnest.ph/supplier/mitsa-co · weddingessentials.mb.com.ph/2019/12/30/6137/ · eventnest.ph/blog/things-to-consider-for-food-carts-and-stations-at-weddings-in-the-philippines
- Photobooths: unlimited prints, props, an on-site attendant, a digital gallery, a free personalised layout, a
  backdrop, and setup and teardown.
- Perfume bar: a bar setup, bottles, a choice of scents, two attendants, and custom labels. Food carts: a set
  number of servings, a 3–4 h service window, attendants or operators, and the machine or cart.

Changed: Mirror photobooth · Instant prints → Unlimited prints · (new) Backdrop. Perfume bar · Blending attendant → Bar attendants.
Not verified: Juice bar · Massage station (only couple's-spa perks found) · Henna · Hair touch-up · Nail bar · Donut · Sorbetes ·
Kakanin · Sari-sari · Popcorn · Fishball · Ice scramble · Churros · Shawarma · VR · Arcade · Live art (3) · Make & Take items
other than Candle making. No terrarium or massage guest-station source was found.

## 9 · Invitations & Prints — NOT VERIFIED
I searched for tarpaulin printing and toga rental and got only templates and procurement notices. All 6 left unchanged.

## 10 · Gifts, Giveaways & Souvenirs — VERIFIED (thin, no changes)
Sources: eventnest.ph/blog/things-to-consider-when-choosing-wedding-giveaways-and-favors-in-the-philippines ·
eventnest.ph/supplier/sage-and-ivory-gifting-studio · stationery.lazada.com.ph (souvenir tags guide)
- Packaging, ribbon, tags and printing are often quoted separately. Custom labels are designed from the couple's
  palette. Nothing contradicted the draft rows.
Not verified: Angpao · Apparel · Shoes · Home & appliances · Gadgets · Plants · Tissue & napkins · Raffle prizes.

## 11 · Bridal Cars & Transport — VERIFIED (Airport transfer only)
Sources: klook.com/activity/6567-private-car-charter-manila/ · ph.limoscanner.com/partner-vehicle/12394-toyota-hiace-van/ ·
magpie.travel (Private Manila Van Rental) · lokalee.app/en/tours/metro-manila-car-rental-and-transportation-with-driver
- The usual inclusions are the van, the driver and fuel, sometimes with water and snacks. Tolls are often paid to
  the driver, and parking is usually excluded.

Changed: Airport transfer · Fuel and tolls → Fuel · (new) Bottled water.
Not verified: Boat / ferry charter · Motorcycle / scooter.

## 12 · Guest experiences — VERIFIED (Tours only, no changes)
Sources: onthegotours.com/Philippines/Philippines-First-Time-Discovery-10-days · expedia.com.ph (10 Days Boracay…) · lokalee.app (12-day island hopping)
- Entrance fees, a guide, the listed meals, and pickups. These are multi-day tours, not day tours. No changes.
Not verified: Tour Guide.

## 13 · Dining extras — NOT VERIFIED
Restaurant (Reservation): no search was run. Unchanged.

## 14 · Logistics & safety — VERIFIED (partly, no changes)
Sources: tri-med.netlify.app · form.jotform.com/redstaff/event · sites.google.com/redcross.org.ph/prc-ss/ems-unit ·
osg.gov.ph (TOR Security Services FY2026) · forms-legal.com/philippines/employment/contracts/security-guard-contract-philippines
- Medic: first aiders or EMTs, medical equipment, a report for every patient treated, and an optional standby ambulance.
- Guards: licensed (PNP-SOSIA), in uniform, carrying a handheld radio. The draft rows match.
Not verified: Referees / Officials · Event staff & ushers.

## 15 · Insurance & protection — VERIFIED (Event only, thin, no changes)
Sources: global.lockton.com/ph/en/products-services/event-stage-exhibition · pioneer.com.ph/?p=1760 (Packaged Events Insurance)
- Event cover splits into liability (bodily injury and property damage) and cancellation. "Vendor no-show cover"
  was not confirmed, but I left it.
Not verified: Personal Accident · Travel Insurance (no search was run).

## 16 · Specialty — NOT VERIFIED
Reveal Element: no direct source. The cold-spark and fireworks snippets do not cover confetti or smoke reveals. Unchanged.

## 17 · Funeral & Memorial — VERIFIED
Sources: gmanetwork.com/news/lifestyle/content/1006800/… · cebudailynews.inquirer.net/?p=981 · goldenhaven.com.ph/?p=133762 ·
stpeter.com.ph/pdf/St_Peter_Cremation_Plan__1_.pdf · scribd.com/document/541536294/laws-columba · asianews.network (RA 12309)
- Funeral packages: a casket, embalming and preparation, transport or hearse (often within about 25 km), wake
  equipment, chapel use or viewing days, a lights-and-candles setup, and sometimes flowers.
- Cremation: the permit, an urn, and pickup within 25 km. Niches come with a memorial plaque and flower holder.
  Columbaria must keep a perpetual-care fund.

Changed: Wake package · Candles and altar → Lights and candles setup. Columbarium niche · (new) Flower holder.
Not verified: Body repatriation · Urn (item rows).

---

## Totals
22 row edits across 15 services: 9 renames, 1 row replaced by a choice, 10 additions, 2 removals.
Groups with no verification at all: Coordinators · Photo & Video · Invitations & Prints · Dining extras · Specialty.
All other groups were verified only in part, and only from search snippets (see the warning at the top).
