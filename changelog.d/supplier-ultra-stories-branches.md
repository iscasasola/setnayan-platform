## 2026-11-14 · feat(supplier-plans): Ultra story pages · Team "Whole branch" · Copy a card to another branch

The three feature pieces of the APPROVED simpler supplier plans (specs DECISION_LOG 2026-11-14 "SIMPLER SUPPLIER
PLANS — APPROVED AS DRAWN, AND THE PLANS ARE NAMED PLUS · PRO · ULTRA", items 8–10; drawing artifact
Eiwc64wF1VHLfZ52Sjbs8c §§ 5–7). Names and prices are the sibling build's (`claude/supplier-plans-simple`); no file of
theirs is touched.

- **(8) Ultra story pages.** On an Ultra shop's page, each "Featured in these stories" card now reads "Our story of
  this day →" and opens `/v/<shop>/story/<event slug>` — the shop's own page for that event, on the shop's address:
  its photos from the day (only media the host ACCEPTED onto their published story), What we did (the booked card's
  title), In our words (the shop's own note), What they said (the couple's existing review), then the couple's full
  story, Check your date and Back to the shop. Free · Plus · Pro keep "Read their story". The page exists only for a
  celebration the host published (the shop page's own gate: paid bookings, unlisted events left out, consent, slug,
  past the 30-day wait) and only while the shop's EFFECTIVE plan is Ultra. The note is written under each story in
  Shop › Promote › Share your work (`lib/ultra-story-pages.ts`, `lib/ultra-story-pages.server.ts`).
- **(9) Whole branch.** Shop › Team › Who works what names every service by its card title, groups services under
  their branch, and — when the shop has two or more usable locations — offers "Whole branch" above them: every service
  there, and any added later. A ticked branch's services show as included and are unticked by unticking the branch.
  Stored in `vendor_team_members.whole_branch_keys`; the person is still scoped by `vendor_service_agents` (every
  existing read unchanged) and a trigger adds the row for each card filed at that branch later.
- **(10) Copy to another branch.** In the card's "Live · delete · copy" fold, beside "Start another from this" — only
  when there is another usable location. The sheet asks the branch and the price there. The copy
  (`copy_vendor_service_to_branch`) keeps the authored words, inclusions, add-ons, discounts, payment schedule and
  time slots, references the SAME photos, gets its own price, its own calendar (a new schedule pool) and no team, and
  is marked `branch_copy_of` so the create gate and the plan picker do not count it as a card. A new service, or one in
  another category, still uses a card.
- ONE add-only migration `20271346029832` (new table `vendor_event_story_notes`, RLS at CREATE; two new columns with
  explicit column grants, because both tables grant `authenticated` column by column in production).
- ONE new server action (`supplierPlanExtra`, op = story_note | branch_copy) — 1,245 → 1,246 of the 1,251 ceiling.
- Shared files also edited by open PRs, with hunks kept clear of theirs: `app/v/[slug]/page.tsx` (#7667),
  `team/_components/helpers-view.tsx` · `team-screen.tsx` · `team/actions.ts` (#7635),
  `services/actions.ts` (#7553 · #7678), `services/_components/canvas-maker.tsx` (#7553 · #7544),
  `lib/ugat/screens.generated.json` (regenerated; many PRs).

SPEC IMPACT: None — builds DECISION_LOG 2026-11-14 items 8–10 as drawn. Open for the owner: the copy keeps the
original's on/off state (a live card's copy is live at once, with its own empty calendar).
