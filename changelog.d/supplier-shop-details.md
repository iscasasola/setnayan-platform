## 2026-10-29 · feat(supplier): Shop › Details as approved (v13) — Where you work, Get verified, two "since" lines, Deep Search + its PDF

Owner approved the supplier dashboard prototype v13 on 2026-10-29 ("Approved."). This is builder S2's area, Shop ›
Details (`/vendor-dashboard/profile`), each item an extension of what shipped:

- **Where you work** — the live Coverage reach (`shop/_components/service-radius-fields.tsx` under `ReachMap`),
  restyled, not redrawn: the map moved into the part so it redraws as the distances move; it now draws the HQ as a map
  pin, the inner ring (green, "Free transpo · N km") and the outer ring (dashed, "Covers · N km"). The two number
  fields + "Save distances" became −/＋ steppers that save in place through the same `updateServiceRadius` (debounced,
  a refusal puts the saved value back and says why). ＋ past the plan's farthest does not save: it says the next plan's
  reach (`nextPlanReach`, read from `TIER_CAPS`); the ⓘ carries the ladder (`reachLadderWords`) and the shipped
  "Show farther" sentence. "Your pin · Move" opens the shipped Company address row (its draggable pin picker). The
  starting values are the plan-clamped ones couples see. An unread plan says so instead of drawing 0 km.
- **Free = 0 km because unverified** — instead of `return null`, the ONE shared line
  `vendor-dashboard/_components/get-verified-line.tsx` (`GetVerifiedLine`): "Couples can't find you by distance yet ·
  You show up once you're verified · [Get verified]", map and rings greyed. [Get verified] lands on `#docs`: the fold
  opens, `VerifySection` opens its papers step, and `VerifyPairs` marks the FIRST missing paper ("Missing · the one
  that holds you back") and brings it into view. The same line blocks Deep Search for an unverified shop; S3–S6 reuse it.
- **"Since" is two lines** — the year field ("EST") is now labelled **In business since** ("2023 · 3 years", help
  "Your own start year — shown on your page") and a read-only **On Setnayan since** row (the shop row's `created_at`,
  "Oct 2026") sits beside it in Name and logo. No schema: both columns already existed.
- **Deep Search, explained** — a new fold on Your details, "See what the web says about your shop": the five findings
  (Business summary · Services we found · Prices we found · Where you show up · Things to double-check, one list in
  `lib/deep-search-findings.ts` that the result and the PDF share), the shipped `DeepSearchRunner` mounted, the band in
  the ⓘ built from the source the run charges (the 2026-07-25 matrix while the tiered flag is on, else the catalogue
  row — never a typed ₱), the last search and "All your Deep Searches". The page and the card now share ONE resolver,
  `lib/vendor-deep-search-offer.ts` (moved from `deep-search/page.tsx`, rules unchanged). Not drawn in the App Store /
  Play Store shell, which refuses Deep Search; Today's setup skips its reads.
- **Every search has a PDF** (owner with the approval: "run search would also create a pdf file of the search
  created") — `lib/deep-search-pdf.ts` on the shared engine (`lib/share-pdf.ts`, Paper ▾), served by
  `GET /api/vendor/deep-search-pdf?dossier=` behind the shop's own gate (use row via RLS, then the result re-checked),
  drawn from the kept result so it lives exactly as long as the search (`DEEP_SEARCH_KEEP_DAYS`, the retention
  sweep's own number). Share is on a fresh free run's result, the latest result, every kept history row and the
  card's last search.

Guarded by `apps/web/app/vendor-dashboard/profile/shop-details-v13-holds.test.ts`.

⛔ **Not built — needs a migration (stopped per brief):** the "Nationwide on request" switch (owner note 3). No column of
`vendor_profiles` holds "couples outside my range may still ask"; it needs one, plus the couple's "Show farther" read to
honour it.

SPEC IMPACT: Supplier dashboard v13 Shop › Details built (DECISION_LOG 2026-10-29 "LAST ROUND OF OWNER NOTES" items
1–4 + the v13 approval's PDF note). Deviations for the owner: Deep Search says "you choose what to use", not "accept each
fact" — the shipped result has no per-fact Accept and none was added; "Nationwide on request" not built (migration).
