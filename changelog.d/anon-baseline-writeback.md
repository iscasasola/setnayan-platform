## 2026-08-01 · chore(sec): the anon-RPC backlog was 181 because nobody wrote the answers down — 130 of them were already known

The `anon-rpc-surface.baseline.txt` debt figure read **181 unreviewed**. That number was wrong in the same way as every other hand-maintained count today: **130 of those functions had already been read.**

Two audit passes examined 211 bodies between them and recorded, per function, what actually gates it. Only the nine that got *closed* were removed from the baseline; the other 130 kept their `unreviewed —` placeholder while their real answer sat in a workflow journal.

This writes them back. No new analysis, no agents.

**181 → 51.**

### 21 of them carry a corrected reason, not the original suspicion

Those functions were flagged during a sweep and then **died under adversarial refutation**. Recording them by what raised the flag would leave a baseline full of frightening sentences about things that turned out to be fine. Each of those lines instead records *why the suspicion was wrong* — `flagged, then REFUTED on re-reading: …`.

That distinction is the difference between a baseline someone reads and one they learn to skim.

### What is actually left

**51 functions** neither pass examined. A sweep over exactly those is running as this lands, so this number is expected to go to zero shortly. Its work-list was derived from the journals rather than typed — which matters, because the first attempt at that sweep was handed a hand-written list of function names, fourteen of sixteen of which did not exist.

### The guard did its job twice today

The abort added after that failure — *refuse to summarise an empty result* — fired on the very next run when the same argument-serialisation bug recurred. Previously that bug produced the sentence *"All 189 were correctly filtered. Zero exceptions."* This time it produced `ABORTED: true` and zero agents.

A guard whose first live firing catches the exact defect it was written for is worth more than the finding that prompted it.

Verified: the anon-surface guard is 5/5 against the rewritten baseline — including the check that every line carries a real reason rather than a placeholder.

SPEC IMPACT: None — documentation of an existing surface.

---

## …and the remaining 51, which closes the walk

The sweep over the 51 landed. **52 bodies examined, 51 classified, 8 flagged, 2 died under refutation, 6 survived and are closed by migration `20271030…`.**

**The backlog is now zero**, and the `unreviewed` escape hatch is retired in the guard — a marker that was honest while 190 bodies genuinely hadn't been read becomes, the moment the debt clears, a way to add new debt quietly. That is precisely how the map-backlog count and the joint count both drifted today.

### The two that died are the important ones

`vendor_claim_locked_qr` and `papic_record_guest_capture` are gated on **128-bit and 122-bit random tokens**. A guest has no session; the token *is* the credential. Revoking those would have broken the guest surface to fix nothing. They are recorded as safe with the corrected reason.

### The six that survived

**`papic_reserve_camera_points` / `papic_release_camera_points`** — the per-camera twins of the two closed this morning. Same shape, same argument-as-credential flaw, adjacent in the same file. One anon call floors `points_used` at 0 and a guest shoots without limit.

**This is the third time today one fix turned out to be one instance of a class** — after the `vendor_ig_oauth_state` foreign key (21 of them) and the default-ACL grant (203 functions). Fixing the instance in front of you and moving on is the recurring defect, not any individual hole.

**`vendor_worked_with_ids` / `vendors_worked_together`** — the argument is a vendor id, a *public join key*, and it is anon-enumerable from an anon-readable matview. A scraper reconstructs the marketplace's whole co-booking graph, which RLS on `event_vendors` otherwise protects. Kept for `authenticated` — the hint is shown in-product and is deliberately not self-scoped.

**`respond_creator_offer`** — gated on `auth.uid()` matching the addressed creator, which is correct and meaningless for a NULL uid. No token credential exists, so anon has no legitimate identity here at all.

**`live_studio_guest_rtc_can_access`** — TRUE for three properly scoped classes and a fourth that isn't: any session at all, including a native-anonymous one, while a roam zone is live. Someone holding an event id from a guest URL can watch the ceremony. No caller in the codebase.

Verified: migration guard green (1023) · **full DB suite 721/721** · anon-surface guard 6/6 including the new closed-hatch assertion.
