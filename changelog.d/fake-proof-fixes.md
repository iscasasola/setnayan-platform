## 2026-11-23 · feat(trust): fake proof fixes A–D — only arm's-length events move stars, medals and events done

Owner ruling 2026-11-23 (specs DECISION_LOG b89e2420, "FAKE PROOF FIXES"). A controller audit found a supplier could farm stars, most card medals and "events done" alone, with extra couple accounts made from their own emails. Every gate asked only whether the reviewer was the shop's owner or one of its team.

- **Migration `20271361301072_fake_proof_counts_only_arms_length_events.sql`** (`do-not-auto-merge`; controller GO after SHIP):
  - **A.** `service_card_badge_facts` reads only interests the couple raised. The shop's own offered card (`vendor_offered`) no longer counts as an inquiry answered inside the hour (Quick Responder), and no longer pads Trending Now.
  - **B.** "Different couples" counts couple accounts (`event_couple_key`), not events. Applies to Hot Booking, Generous Giver (now asks for 5 different couples too, `lib/card-badges.ts`) and Trending Now.
  - **C.** One rule, `vendor_event_proof_route(shop, event)`:
    - `found_on_setnayan`: a Setnayan fact on the event, the fee rule agrees, and the shop was verified before its first contact.
    - `real_guests`: at least N distinct guests RSVP'd or captured Papic. N is `platform_settings.proof_real_guests_min`, nullable, no default; while it is blank this route never counts.
    - Cached for the public views in `vendor_proof_events`. Read by the shop's stars, each card's stars, events done (which also reads a Shortlist QR booking as the supplier's), the track record, and Rave Reviews.
    - Reviews that don't count still show on the shop with the shipped "Verified booking" pill (the supplier's own client), through the new service-role view `vendor_reviews_public.counts_as_proof`.
    - A deleted celebration keeps its answer: a new BEFORE DELETE trigger stamps `proof_at_delete` on its surviving review and booking. Rows orphaned before this migration have no stamp and do not count.
  - **D.** A review with an open or confirmed `review_fraud` flag is held out of every public count and list. Only an admin's Dismiss on `/admin/integrity-watch` releases it. No second queue. The screener now runs before the review submit returns, not in an `after()` task.
  - **Fee billing is unchanged.** The `booking_fee_*` functions are read, never replaced.
- **Admin › Settings** gains the "real guests" field (blank = not set), folded into `saveBusinessIdentity`. A trigger re-reads the counts on save.
- **Shop page / supplier sheet** read `vendor_reviews_public` (`fetchReviewsForVendor({ publicOnly })`). A service card never quotes a review its own number leaves out.
- Guards:
  - `tests/db/fake-proof-counts-only-arms-length.db.test.ts`: A–D, billing unchanged, grants. 4 SQL sabotages, one per fix, each red.
  - `lib/fake-proof-fixes.test.ts`: the app half.
  - `tests/db/service-card-badges.db.test.ts`: fixture events now carry a couple account.
- Server actions: no new export.

SPEC IMPACT: Load-bearing. Stars, medals and events done now count only arm's-length events. The "real guests" number N is the owner's to set; until then, reviews of the supplier's own clients don't count. Generous Giver's rule now reads "from 5 different couples". DECISION_LOG row b89e2420 already records the ruling.
