## 2026-11-08 · feat(card-checks): service card checks run in the maker — fix before Create

Owner 2026-10-26: *"when there is something they need to change, they must fix it before the service card is created.
this way, we do not need to integrity watch them one by one. and they resolve it by themselves"* · *"once a photo is
used. it technically cannot be used on another service card."* · *"ok then remove the price integrity issue"*. Rebuilt
fresh on the release branch from the stale draft #6956 (its schema was the starting point; its migration never reached
main and is not reused).

The checks run LIVE inside the SHIPPED service card maker (`canvas-maker.tsx` — extended, not redrawn). Each problem is a
plain line on its own row with the why inside the ⓘ, and Create (Save on an edit) stays waiting until it is fixed. The
save (`commitVendorService`) asks the same functions again before the card is written and refuses. No card is created
and then held; there is no per-card review queue. Exactly three checks, and **no price check of any kind**:

1. **Claim words** (Name · What's included · Extras) — whole word, any case, from the admin list `card_claim_words`
   (seeded: guaranteed · #1 · best in · lowest price · official · 100%). An admin may allow ONE word for ONE shop
   (`card_claim_word_allowances`).
2. **The card matches its service** (Name row) — the name says another trade, by the live taxonomy's labels and its
   reviewed aliases, and nothing on the card says its own. A new card is offered "Move to <that service>" in place; an
   edit (its service is fixed) is offered "Make a <that service> card".
3. **One photo = one service card** (Photos row) — the shipped pHash, across every shop and within one: a photo already
   on another card blocks until it is replaced. Another shop is never named. "It's mine — report it" sends a ≤200-char
   note to admin, shown as a LIST on the shipped `/admin/repost-watch`; the card stays blocked.

- Migration `20271328838140_service_card_checks_fix_before_create.sql`: `card_claim_words` + `card_claim_word_allowances`
  (admin-only RLS at CREATE); repost-watch surface CHECKs learn `service_showcase` (re-listed in full);
  `vendor_image_hashes.vendor_service_id` (→ vendor_services SET NULL, indexed, backfilled for existing cover hashes);
  `vendor_image_flags.supplier_reported_at` + `supplier_report_note`.
- The save now hashes the SHOWCASE photos too (they went unhashed), names the card on every hash, and frees a photo the
  card dropped (`releaseCardPhotos`).
- `/admin/repost-watch`: "Suppliers who say a photo is theirs" (list) + "Claim words on service cards" (add/remove words,
  allow a word for one shop).
- Mapped: Ugat joint J68 (J66 went to notifications on main, J67 to #7405); erasure / export guardrails + export-completeness decide both new tables; exposure baseline,
  user-FK map and ugat screens regenerated.
- In-app only — nothing here sends an email.

SPEC IMPACT: None new — implements DECISION_LOG 2026-10-26 "SERVICE CARD CHECKS — FIX BEFORE CREATE", "CARD CHECKS — NO
PRICE BAND; ONE PHOTO, ONE SERVICE CARD", "NO PRICE CHECK ON SERVICE CARDS AT ALL" (prototype
`prototypes/service_card_checks_2026-10-26/`). Built-state note for the corpus: the claim-word list and allowances are
edited on `/admin/repost-watch` (not `/admin/settings` as the #6956 comment said).
