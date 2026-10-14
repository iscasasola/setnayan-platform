## 2026-10-14 · feat(suppliers): the simpler service card maker — first questions, More settings, one Create, the edit sheet, and the 🏷 "add it to what you do" ask

Step 3 of the simpler supplier dashboard (owner ✅ APPROVE 2026-10-14; prototype
`prototypes/supplier_easy_dashboard_2026-10-14_fable.html`, moments "2 · Putting up a service" and "2 · The service
card · every field"). Built on the shipped `CanvasMaker` (Rule 0), not beside it.

- **The maker** (`services/_components/canvas-maker.tsx`): the shipped `ServiceCardFace` on top, painted from the live
  form; ONE status line asked of the publish gate ("Hidden until: a cover photo · a price · what's included" /
  "Ready · couples will see it"); the first questions only — What you offer (rows: "Common for <your type>" first,
  search, Something else, Ask us) · Name (written for you) · Photos · Price ("from") · What's included (one line is
  enough) · Schedule (its own / shares one); every other field under **More settings** in the prototype's fourteen
  folds, opening with defaults by supplier type (church · caterer · studio · photographer · florist · venue ·
  performer). ONE Create (live when the gate is met, else "not shown yet"); the guided pass, the health meter, the
  intro sheet, "Make it richer" and the two submit buttons retired (owner 2026-10-08 Q1/Q3).
- **🔴 Live fault ended by construction:** since 2026-09-07 (a1e6887ceb) the photo, price, gift, what's-included,
  discount, crew and lead-time inputs sat in sheets portalled to `<body>`, OUTSIDE the card `<form>` — they never
  posted, the card never painted them and Publish never opened (proved in the lab on the old code). Every field now
  lives in an in-page fold.
- **The edit sheet** (`/vendor-dashboard/services/[serviceId]`): the same maker for an existing card — name editable
  (Q2), Live switch, Start another from this, Delete (hides if ever booked), saving through `commitVendorService`'s
  UPDATE path. Every list the save replaces is read with its error checked; an unread list blocks Save. The Shop
  list's inline "Edit details" editor and its six Saves retired — the row opens the card; a card outside "what you
  do" says so on its row.
- **One save writes everything:** `commitVendorService` now also writes add-ons, the payment schedule's no-show terms
  (the RPC dropped them), the kind's details, time slots and the card's schedule — each through the SAME body as its
  own per-part action (`lib/service-card-save-parts.ts`, `lib/vendor-service-refinements-write.ts`).
- **🏷 (owner 2026-10-14):** on Create of a card whose kind is not in the shop's coverage, one question — "Add <kind>
  to what you do? Couples will find you there." Yes → `addCoverageForCard` (its own action; the same body as
  `createCoverage`, `lib/vendor-coverage-write.ts`, which runs `syncProfileFromCoverages`) within the plan's family
  cap; over the cap the plan option shows and the card still saves. Not now → the card saves, coverage unchanged.
- **Time slots open to every plan** (owner 2026-10-14 🧑‍🤝‍🧑, call 3): `canPlotTimeSlots` returns true for every tier.
- One loader for the three doors into the maker (`lib/service-card-maker.server.ts`); `/services/new` makes one
  request fewer than before (no `getTaxonomy`, no second coverage read; + the shop's schedules).
- Guards: `lib/the-maker-maps-every-field.test.ts` (every field the save reads is posted; every truth-table row has a
  home), `tests/db/a-card-asks-before-it-adds-what-you-do.db.test.ts` (both answers against the replayed schema), the
  maker's existing guards re-pointed; lab `/dev/card-maker-lab`.

SPEC IMPACT: None to the decisions — builds the approved 2026-10-14 design and the 🏷 ruling. Three build calls are
flagged for the owner in the PR (the Setnayan gift is not pre-filled on; no peso or payment split is pre-filled; the
Portfolio row is read-only words until the per-card album read exists).
