## 2026-10-22 · fix(people): a claimed shop becomes its owner's business alaga

Owner 2026-09-30 (DECISION_LOG "ONLY PEOPLE CAN BE INVITED…"): "if you create a business. it
also creates a beloved that is your business." Shipped for open-shop only (inline in
`becomeVendor`). A shop that became the account's through the CLAIM flow
(`/vendor/claim/[token]/finalize` — couple's link via `claim_ready_the_shop`, admin pre-staged
transfer, stub create, existing shop connecting) never got the record, so its owner could not pick
"For · <shop>" when creating an event. Same for a vendor sign-up's trigger-opened EMPTY shop first
named on My Shop (the rename only renamed an existing record).

- New `lib/business-alaga-ensure.ts` · `ensureBusinessAlaga(admin, { ownerUserId, vendorProfileId,
  shopName })` — the ONE writer: People gates (`NEXT_PUBLIC_DEPENDENT_PEOPLE` +
  `dependent_minor_profiles`), read-then-insert against `dependents_owner_vendor_profile_key`,
  23505 = success, refused read writes nothing, an existing record follows the name
  (`syncBusinessAlagaName`, ungated as shipped), never throws or redirects.
- Callers: `becomeVendor` (inline block replaced), claim finalize (new step 1b, name read back from
  the shop row, owner = session user only when the row says so), `updateVendorProfileField` and
  `applyCorrectionRequest` (were `syncBusinessAlagaName`).
- Guards: `lib/business-alaga-ensure.test.ts` (behaviour via fake client; TS scan — every file that
  gives `vendor_profiles` a non-null `user_id` or calls a shop-opening RPC must call
  `ensureBusinessAlaga` after its last such write; SQL scan — every migration function that opens,
  re-owns or names a shop is either TS-called or opens it nameless). `business-alaga-sync.test.ts`
  now requires `ensureBusinessAlaga` at every `business_name` writer.
  `a-shop-becomes-a-record.test.ts` reshaped to the one-writer call.
- Prod (read-only count): 0 claimed shops exist (0 claimed invites), so no backfill. 2 owned named
  shops lack a record — both `is_demo` shops from July, not claimed; left alone.

SPEC IMPACT: None
