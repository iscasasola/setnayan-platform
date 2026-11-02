## 2026-09-19 · fix(supplier): result-dropped-silently, SUPPLIER tier batch 1/4 (S41c)

The `result-dropped-silently` class from S26's both-ends baseline (#5625): a
Supabase read whose `error` picks a branch that records nothing — a REFUSED
read renders byte-identical to a genuine EMPTY result.

**RULE 0** — exists: the reads-are-honest pattern (`lib/guests.ts` +
`guests-read-is-honest.test.ts`, `vendor-dashboard/reads-are-honest.test.ts`)
and `logQueryError` in `lib/supabase/error-detect.ts`; S41's MONEY tier
(#5650) and BOOKING tier (#5656) already applied it. Missing: these 17
SUPPLIER-tier sites. Delta: a kept reason (`logQueryError`) at every drop
point, batch 1 of 4.

**Shape chosen: log-only for all 17.** Every candidate site was either (a) an
`app/**/actions.ts` / same-named `-actions.ts` file, where an absence already
correctly DENIES the action (11 of 17 sites), (b) a read whose caller already
had a deliberately-documented, safe fail direction (the Storyteller doorway's
0-degrade, the favorites badge's fail-soft-hide, the partnership nag card's
suppress-instead-of-nag, the market-pool "0, never fabricated" recap stat),
or (c) a read with a large downstream blast radius (the Shortlist card
enrichment join) where a new render state risked more than it fixed. One
site, `app/dashboard/[eventId]/website/stories/page.tsx`, had ALREADY shipped
the distinct honest-render state before this batch — this PR only adds its
missing log line.

**Per site — what a person saw on a refused read / what is logged now:**

| site | table/rpc | before | now |
|---|---|---|---|
| `app/_components/frontdoor/data.ts` (searchLiveShops + loadLiveShops) | `vendor_profiles.select` | silent empty result / null count | reason logged |
| `app/[slug]/venue/_components/use-live-scene.ts` | `rpc:public_venue_scene` | silent (by design: "a failed call is not news") | reason logged |
| `app/admin/corrections/actions.ts` (`loadOpenRequest`) | `vendor_correction_requests.select` | silent `null` | reason logged |
| `app/admin/event-types/actions.ts` (`setFolderEventTypeOffered`) | `service_categories.update` | silently skipped, no count, no reason | reason logged |
| `app/admin/verify/actions.ts` (`resolveDeepSearchInputs`) | `vendor_profiles.select` | "Vendor not found." (same for refused vs deleted) | reason logged |
| `app/dashboard/(launcher)/page.tsx` | `creator_chapters.select` | silent 0 (documented, accepted cost) | reason logged |
| `app/dashboard/[eventId]/story/desk-actions.ts` (`heldBackNow`) | `editorial_vendor_media.select` | silent withhold (fail-closed, correct) | reason logged |
| `app/dashboard/[eventId]/vendors/page.tsx` (card enrichment + market-pool count) | `vendor_market_stats.select` ×2 | silent strip-to-initials / silent 0 | reason logged |
| `app/dashboard/[eventId]/website/stories/page.tsx` | `creator_chapters.select` | already had a distinct "couldn't load" render; the log line was the only thing missing | reason logged |
| `app/panood/program/[eventId]/page.tsx` (`fetchProgramChannels`) | `live_studio_roam_zones.select` | silently skips the paywall gate | reason logged |
| `app/v/[slug]/page.tsx` (favorites badge + packages) | `rpc:count_saves_for_vendor`, `vendor_packages.select` | silent 0 / silent empty Packages section (both documented fail-soft) | reason logged |
| `app/vendor-dashboard/clients/[eventId]/production-sheet/actions.ts` (`addPortionRule`) | `vendor_portion_rules.insert` | `?rule=error` with no server-side trace | reason logged |
| `app/vendor-dashboard/instagram-actions.ts` (`syncInstagramMedia`) | `vendor_ig_media.upsert` | silently skipped from the sync count | reason logged |
| `app/vendor-dashboard/performance/page.tsx` | `vendor_partnerships.select` | silent (documented: maps to 99 to suppress a nag, never to "none") | reason logged |
| `app/vendor-dashboard/shop/inline-docs-actions.ts` ×3 | `vendor_profiles_self.select`, `vendor_profiles.select` ×2 | silent "not on file" / silent "not sent yet" (collides with the genuine-empty state) | reason logged |

**Proof:** new `lib/s41c-supplier-batch-a-reads-are-honest.test.ts`, 8/8 green —
1 behavioral test exercising `logQueryError` itself (mocked `console.error`,
asserts the call site + error shape), 1 test re-proving the pre-existing
honest-render ordering on the website/stories site, and 6 source-position
tests anchoring each `logQueryError(...)` call between its query and the
point the error used to be dropped (never a bare identifier match — each
asserts relative position, and for the two loop sites asserts the success
counter only increments in the `else` branch). Sabotage-proven locally:
reverting the `searchLiveShops` hunk turned the frontdoor test red (7/8);
restored, back to 8/8. Existing siblings re-run clean: `app/_components/frontdoor/*.test.ts`
(139/139), `app/vendor-dashboard/*.test.ts` (13/13),
`app/vendor-dashboard/shop/*.test.ts` (20/20 combined with story/vendors
siblings), `app/v/[slug]/**/*.test.ts` (22/22), `app/**/clients/kept-notes-have-a-reader.test.ts`
(3/3), `app/**/story/*.test.ts` (7 files, all green), `app/**/vendors/marketplace-mini-tour.test.ts`,
`app/admin/verify/the-reviewer-can-open-the-paper.test.ts`.

SPEC IMPACT: None.
