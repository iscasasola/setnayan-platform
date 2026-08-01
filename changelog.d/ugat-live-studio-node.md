## 2026-08-01 · feat(ugat): Live Studio — one node over two prefixes, and the RA 10173 gap the codebase already asserts about itself

Fifth map-backlog cluster. Backlog **27 → 25**. Nodes **19 → 20**.

### One node, because the two prefixes are a rename

`panood_*` and `live_studio_*` are the **same system**. The product was renamed on 2026-06-29 and the tables were not. The proof is a **composite foreign key** — `live_studio_roam_zones.(camera_operator_id, event_id) → panood_camera_operators.(id, event_id)` — which is also the family's only inbound bond, and it crosses the prefix line. Three `live-studio-*.ts` modules read `panood_*` tables directly.

Drawing two nodes would map the rename instead of the system, and hide that bond across a node boundary.

**This is the third cluster where a name prefix under-captured a concept** — after the calendar tables that don't match `vendor_schedule_%`, and the emcee script that doesn't match `event_schedule_%`. A prefix is a naming convention, never a boundary. That is now written on the node.

### 🔴 The RA 10173 gap, asserted by your own test suite

`panood_camera_operators.claimer_user_id` is a data-subject key with **no foreign key** — verified across every schema, not just `public` — and the subject-rights plumbing does not cover this table:

- `export-coverage-guardrail.test.ts` classifies it verbatim as `TODO(RA10173-backlog): operator assignments naming the subject.`
- the erasure guardrail lists it in `UNDECIDED_BACKLOG`, a ratchet whose own header reads *"NOT A CLEAN BILL OF HEALTH — the opposite"*

So a data-subject export or erasure today omits it **by design**, and the guardrails are the thing that knows. Recorded on the node rather than left in a test file.

⚠ **Do not drop this table on a name grep.** It is a live canary in two security suites — the exact shape that broke ten assertions when `households` was dropped earlier today.

### Two more, both verified

**The broadcast ledger has never recorded anything.** `panood_broadcasts` has held zero rows for its entire existence while `panood_control_state` carries two rows with `first_live_at` stamped — the control room has been driven live **twice** and no broadcast was ever created. Its only writer sits behind three YouTube API calls that must all succeed, so zero rows is *positive evidence* the YouTube leg has never completed in production. Whether the suspended Google Cloud Identity account is the cause was **not verified and is not asserted**.

**Camera identity is free text.** `program_source` / `preview_source` hold `'cam' || camera_index` with no FK and no CHECK (verified), so nothing at the database level keeps a routed source pointing at a camera that exists. **Latent, not live:** all 16 live moments were joined against the operators and every one resolves on its own event. It stays latent only because both allocators ever append — `camera_index` is never renumbered and never hard-deleted.

**The channel pool is Setnayan-owned** (owner-locked 2026-07-26, reversing the couple-owns-the-channel model). `checked_out_event_id` SET NULLs on event delete, returning the channel to the pool rather than orphaning it — the right behaviour for a shared resource.

Verified: **all six Ugat guards green on the first run**, including both `no_fk` claims proved schema-agnostically · **full DB suite 720/720** · 68 `lib/ugat` unit tests · `tsc --noEmit` clean.

SPEC IMPACT: None — mapping and recorded traps.
