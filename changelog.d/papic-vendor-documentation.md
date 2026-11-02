## 2026-07-22 · feat(papic): free 50-pt vendor documentation + compile into event gallery

Owner 2026-07-22: every booked vendor gets a FREE 50 Papic-point documentation
allowance per event (photos + 10s video), and those captures compile into the
couple's event gallery. Two app-code changes + one RLS policy; stays behind the
counsel-gated vendor-capture control (`data_privacy_controls.vendor_papic_capture`,
default inactive — the whole lane is DPO-gated).

- **`lib/vendor-papic-tier.ts`** — the free `lite` tier goes **20 → 50 points** and
  **photos-only → photos + video** (matches the couple free-pool grant of 50 pts).
  ⚠ ladder note: video is no longer a paid differentiator — the paid `ltd` tier now
  only adds +20 pts; re-tier the paid ladder if desired. Tests updated (15/15).
- **`lib/papic-gallery.ts`** — `fetchPapicGallery` now unions a third **vendor**
  source (`vendor_papic_captures`), **photos only** in v1 (vendor clips have no
  poster derivative to tile — follow-up). Vendor captures store no geo (stripped at
  capture), so the original is safe to serve to the couple's own gallery; no save
  route yet (`saveUrl` null for vendor rows).
- **Migration** `20270912273927` — a couple/coordinator read policy on
  `vendor_papic_captures`: the couple reads a vendor capture of their event when it
  is `nsfw_checked` AND `hidden_at IS NULL` (the `consent_basis <> 'pending_dpo_ruling'`
  clause is a defensive backstop — the capture route stamps `event_consent`, so
  nothing is pending on the live path). Additive to the vendor-own read policy.

⚠ DPO NOTE (corrected after review): the DPO gate for this lane is the **whole-lane**
admin control `vendor_papic_capture` (default inactive) — no capture exists until the
DPO flips it live; it is **not** a per-capture human clearance. Once approved, a
vendor's documentation of the event compiles into the couple's gallery. The migration
+ gallery comments were corrected to say this (they had overstated a per-capture gate,
which is compliance-load-bearing for the NPC packet).

SPEC IMPACT: DECISION_LOG-worthy (owner pricing/scope) — the free vendor allowance
is 50 pts + video and vendor documentation compiles into the event gallery. Still
**DPO-BLOCKED** on the whole-lane `vendor_papic_capture` control. `tsc --noEmit`
clean; tier tests 15/15.

Follow-ups (surfaced): vendor-clip gallery tiling (needs a poster pipeline); a
full-res save route for vendor gallery rows; re-tiering the paid ladder now that
video is free.
