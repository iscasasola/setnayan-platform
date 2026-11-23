## 2026-11-24 · feat(trust): a partner is Trusted only after one completed, paid event served together

Builds the owner's 21 Nov rulings "TRUST NEEDS ONE COMPLETED, PAID EVENT THE TWO SHOPS SERVED TOGETHER" and "TRUSTED SHOPS RANK HIGHER IN SEARCH". It replaces the closed #8087 and keeps its one-reader shape.

- **Migration `20271361607663_trust_needs_one_completed_paid_event_served_together.sql`:**
  - `booking_counts_for_trust(booking)` decides whether ONE booking counts: completed, paid through Setnayan, arm's length (`vendor_event_proof_route`). Refunded, cancelled, disputed, deleted, sample, test and internal-couple bookings never count.
  - `vendor_served_together_rows`, the ONE "served together" definition, now needs both shops' bookings on the event to count. Every reader of it (the propose gate, "Partners you served with") follows.
  - `shop_trust(ids)` is the one trust reader. Per partner it returns the kinds, origins, events together, `trusted` and `counts`. A new shop brought in by the link is trusted at once and counts after its first counted booking.
  - `shop_trust_counts(ids)` returns trusted, waiting and counted, plus the search step.
  - `platform_settings.trust_search_step` is the owner's number (2–10). It is left blank, and blank lifts nobody.
  - `shop_worked_with_counts` is dropped. It was Trusted by's old automatic half, and nothing calls it now (Ugat both-ends).
  - All of these are server-only (no anon or authenticated EXECUTE).
- **One reader, every surface:** `lib/vendor-trusted-by.ts` (`fetchShopTrust`, `fetchTrustCounts`, `fetchTrustSearchSteps`) feeds:
  - the shop page's Trusted by: trusted partners only, with no pending adds and no un-partnered "worked with";
  - the Partners list: a Trusted tag, or "Waiting for your first event together" on the shop's own page only, and a notice when the read is refused;
  - the Invites badge count;
  - Explore, Find and the bench search box.
- **Search:** trust sorts right after fit (`lib/trust-rank.ts`, `compareTrust`). It never adds a shop that doesn't fit. A sort the couple picked stays theirs; trust only breaks its ties. Paid placement still sits above trust in Find.
- **Admin › Settings:** a new field, "Trust in search — how much more trust each step needs".
- **Copy:** the invite page for an existing shop now says the trust starts once you have served an event together.
- Guards:
  - `tests/db/trust-needs-one-completed-paid-event-together.db.test.ts` (9 tests);
  - `lib/trust-has-one-reader.test.ts`: one caller of the reader, every surface uses it, a `vendor_partnerships` reader allowlist, no strength number in code, the WAITING copy in one place;
  - the existing partnership DB tests now mark their shared events completed and paid (`tests/db/counts-for-trust.ts`).
- Server actions: no new export (the setting folds into the existing settings save).

SPEC IMPACT: None. It builds the 21 Nov DECISION_LOG rows as written. The search-step value is left for the owner in Admin › Settings.
