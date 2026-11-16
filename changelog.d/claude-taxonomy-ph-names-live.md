## 2026-11-16 · feat(taxonomy): T1 part 1 — the owner-approved Philippine taxonomy goes live

Owner, 16 Nov: *"this is not my taxonomy"* · *"make the taxonomy go live now"*. The approved tree
(`TAXONOMY_PH_FULL_2026-11-07.md`, "the ONE spec for build T1") was never built: PRs #7348/#7355 were
closed on 7 Nov to make way for it, and prod still showed the older names.

One data migration (`20271349668764_taxonomy_ph_t1.sql`), using only what Admin › Categories
already does:

- **Names in Philippine terms** — 11 groups (Venues & Simbahan · Catering & Cakes · Coordinators ·
  Photo & Video · Gowns, Barong & HMUA · Styling, Flowers & Lights · Hosts, Music & Program ·
  Booths, Food Carts & Bars · Invitations & Prints · Bridal Cars & Transport · Funeral & Memorial),
  44 categories, 185 services (Prenup shoot, SDE, Lechon, Lights & Sounds, Photobooth, HMUA, …).
- **New group: Gifts, Giveaways & Souvenirs** (`gifts_giveaways`) — the souvenirs category moves
  out of Prints.
- **67 new services** (✚ in the spec): kids' party entertainers, Make & Take booths, food carts
  (taho, kakanin, sari-sari store booth, …), gifts by item, event staff & security, and the
  additions the events need.
- **41 folds (⇢)** through `merge_canonical_service` — every holder moves in one transaction and
  the old key stays as a hidden tombstone, so a printed QR still resolves.
- **15 services hidden (⛔)** — boudoir, garter, chuppah, the US-only visa logistics, the dental /
  nutrition / fitness / dermatology add-ons, silhouette, poetry typewriter, tarot, palmistry — and
  the emptied Tarot category.
- The souvenir scanner's list (`supplier_scan_is_souvenir` + `SOUVENIR_SERVICES`) takes the new
  gift items, as its guard requires.
- The migration refuses to commit unless the new group, every new service and every fold check out.

Code: `lib/taxonomy.ts` (the fallback copy the labels guard compares) gains the group and mirrors
every name, fold, hide and new service; the five per-group maps get a Gifts entry; tests that pinned
the old words (Ceremony essentials items, Photoman, Host / MC, Food Cart, folder counts) now pin T1's.

**NOT in this part — T1 part 2:** the category MERGES (Men's → Entourage & Sponsors, Wedding Singer →
Live Band & Singers, Mocktail → Mobile Bar, Dessert + Food Truck → Food Carts, Nail bar / Perfume /
Henna → Pampering, Outdoor / Fireworks / Dance floor → Rentals & Special Effects, Transfers → Van /
Coaster, AV → Speakers & AV). Mood-board parts, the attire boards and the Suppliers rows are keyed on
today's categories, and moving services out broke them in the unit tests — they move together in
their own change. Also part 2: the tags/filter rename, the ~6 new inspiration parts, Officiants
visible for house blessings and novenas.

Judgement calls, flagged for the owner: the generic "Ceremony Venue" is renamed
"Garden / Beach ceremony"; event staff and security guards sit in Logistics under the Medic
category, renamed "Medic, Staff & Security"; sponsor and inaanak tokens stay as their own services
under Gifts.

SPEC IMPACT: `DECISION_LOG.md` row — T1 part 1 live, part 2 listed; `TAXONOMY_PH_FULL_2026-11-07.md`
unchanged (this implements it).

**CI follow-up (same PR):** inspiration parts now follow the tree — a part that linked a category whole is
re-expanded (new services in; folded and hidden ones out; a hand-picked folded link moves to its destination);
Hotel stay keeps the wedding reach of the `accommodation` leaf it absorbed; `services_make_a_coordinator` and
`COORDINATOR_TRADE_SERVICES` drop the folded `gender_separated_reception_coordinator`; three stale
`KNOWN_UNFILLABLE` pairs now fill and leave the allowlist; tests that pinned "Host / MC", "Reception", the ten
Filipiniana keys and the old Chairs & tents leaves pin T1's.
