## 2026-11-16 · feat(partnerships): Invite a supplier v3 — one link per shop, "+ Add", Trusted by gathers every tie

Step 7 of the supplier walkthrough ("refer a supplier"), built as the owner-approved drawing (specs cb1affde,
`prototypes/invite_a_supplier_2026-11-16/`; DECISION_LOG 16 Nov "Invite a supplier v3 APPROVED").

- **Shop › Partnerships** gains "Add a preferred supplier" at the top: **Add** (search Setnayan shops → the shipped
  propose → accept, origin `added`, served-together check lifted) and **Invite** (the shipped `QrCard`: one link per
  shop, `/i/<slug>`, no cap) · "N joined through your link".
- **`/i/<slug>`** — the claim door's shape with a supplier as the inviter: Create my free shop (→ the shipped shop
  setup with one "Invited by" line) · I already have a Setnayan shop (sign in → join; never counted).
- **Joining is the accept**: one accepted `vendor_partnerships` row, origin `invited`; a shop CREATED through the link
  carries `brought_new_shop` — the record the Invites badge counts (#7753 / #7808 said nothing recorded it).
- Rows say where each tie came from ("Invited · joined through your link · 16 Nov", "Added by you · Waiting for them
  to accept", "Added you as a preferred supplier", "Worked together · N events"); swipe left = Remove, either side.
- **Trusted by** on the shop page reads both directions, the adder's own pending adds, and (automatically) the shops
  it served a past event with; the chip is the tie's tag (Worked together · Added · Invited); line "Suppliers <shop>
  works with."
- Migration `20271350444634`: `origin` + `brought_new_shop` (pinned by the immutable-columns trigger), the
  served-together trigger skips `added`/`invited`, an insert guard (invited only accepted), `supplier_invite_join`
  (service_role), `join_supplier_invite(slug)` (authenticated), `shop_worked_with_counts` (service_role).
- 2 new server actions (`joinSupplierInvite`, `removePartnership`); "+ Add" reuses `proposePartnership`.

SPEC IMPACT: Corpus `FEATURE_REGISTER.md` needs a row for the new route `/i/[slug]` (the corpus-only register check
names it). The prototype's builder note "two accepted rows, one each way" is not buildable on the shipped schema
(`vendor_partnerships_unordered_pair_uidx` allows one row per pair per kind) — built as ONE row read in both
directions; flagged for the owner in the PR.

- **Fix (controller audit):** a refused "worked together" read (`shop_worked_with_counts`) now returns the
  UNREADABLE sentinel, so the shop page says it couldn't load Trusted by instead of drawing the list as empty. Held by
  a new case in `lib/s41c-supplier-batch-d-reads-are-honest.test.ts` (mutation-checked).
- **Owner answers (16 Nov, after the PR opened):** Q1 one row per handshake, the unique index stays · Q4 "+ Add" takes
  only VERIFIED shops (the search already did; the action and the database now refuse anything else,
  `ADD_NEEDS_A_VERIFIED_SHOP`) · Q5 "Worked together" is automatic for shops booked on the same past event, verified
  shops only (`shop_worked_with_counts`), and each shop can hide any row from its OWN Trusted by — new
  `vendor_trusted_by_hidden` (RLS at create, owner-only), a Hide/Show toggle inside each row's existing fold in
  Partnerships, +1 server action (`toggleTrustedByHidden`). Q3: the Invites count line WAITS ON the badge-rewards owner —
  flipping `invites` to measured makes the reward ladder pay; `readInvitesCount` + `invitesCountLine` are ready.
