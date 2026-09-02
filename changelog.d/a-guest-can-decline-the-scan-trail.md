## 2026-09-02 · feat(privacy): a guest can decline the scan trail — and only one door can still write it

`guests.scan_tracking_opt_out` has existed since **2026-05-13**, added by `20260513050000_iteration_0002_invitation.sql` in the same migration as `scan_events` itself and captioned there *"RA 10173 per-guest opt-out"*. Measured against `origin/main` on 2026-09-02 it had **zero application references — no reader and no writer**. The repo half-knew: it sits in `apps/web/tests/db/gates-have-handles.baseline.txt` as `NOT INVESTIGATED (never mentioned). Reads like a guest privacy opt-out — worth checking before the others.`

A privacy switch nobody can flip violates nobody's consent today. The risk ran the other way: the next consent feature would have added a **fifth** guest flag beside a column built for exactly this choice, and two mechanisms that disagree about one fact each pass their own tests. Adopted, not retired.

**The defect class this had to beat is silent omission.** Four separate files inserted into `scan_events`, and all four kinds are live in production (measured 2026-09-02: 22 `invite_link` · 4 `personal_qr_scan` · 1 `self_join` · 1 `self_join_bound_seed`, across 5 guests). Honouring the flag at three of them ships a switch that is **stored and ignored** — from the guest's side identical to never building it, and worse, because the control says it works.

**So the trail now has ONE door.** `lib/scan-trail.ts` · `recordScan()` is the only place in the tree that creates a `scan_events` row. All four call sites route through it:

- `app/[slug]/redeem/route.ts` — `invite_link`
- `app/[slug]/seat/claim/route.ts` — `personal_qr_scan`
- `app/[slug]/welcome/actions.ts` — `plus_one_onboarded`
- `app/join/[eventId]/actions.ts` — `self_join` · `self_join_bound_seed` · `account_join` (its `recordJoinScan` is now a header-reading wrapper)

**And a guard makes the fifth door impossible to add quietly.** `lib/every-scan-goes-through-one-door.test.ts` fails if any other file pairs `from('scan_events')` with a row-creating verb, **and** if any file outside a named, reasoned allowlist mentions the table at all — the second net catching the shapes `lib/gate-writers.ts` documents a single regex missing (helper wrappers, assembled payload variables, 600-character windows). It also asserts the door still inserts and still reads the flag, because "nobody writes the table" is equally satisfied by deleting the trail.

**The fail direction is "do not record".** A row is written only on a **positive `false`**. An unreadable flag, a missing guest row, or a thrown client all return without inserting — `?? false` would have turned a failed read into consent, the exact shape already corrected once on the couple-side faceblock notice. The cost of the safe direction is bounded and stated: the trail's **only** reader in the product is the first-arrival greeting in `app/[slug]/_lib/loaders.ts`, whose own comment already records that no evidence means "Hi again".

**The handle.** `setGuestScanTracking` (`app/[slug]/actions.ts`) mirrors `setGuestFaceBlock` — guest-session pinned to BOTH the event and the guest, so a guest can only move their own switch. `_components/scan-trail-notice.tsx` renders it for **every recognised guest**, deliberately *not* behind the `photo_source === 'selfie'` test that gates `FaceDataNotice`: every guest leaves a scan trail, selfie or not. The OFF state names the cost — *"This page will greet you the same way every time."*

⚠ **GUEST-ONLY, unlike faceblock.** Owner ruling 3 of 2026-08-17 lets either side move `faceblock_enabled`. No host-side writer is added here: a host un-setting a data subject's own RA 10173 objection is not a defensible flip, and no host screen has ever shown this flag. **Flagged for the owner, not decided by default.**

⚠ **`guest_checkins` IS DELIBERATELY NOT COVERED.** It carries `method = 'qr_scan'`, so it is literally a scan write path. It is excluded on purpose: it is the host's own door desk marking a guest arrived, it drives that guest's arrival greeting, and a guest declining to be *tracked* should not silently vanish from the check-in desk at their friend's wedding. **If the owner reads the opt-out more broadly, say so** — the change belongs in `recordScan`'s neighbours and the guard is where it gets enforced.

🐛 **AN UNTRUNCATED IPv6 ADDRESS WAS BEING STORED, IN THE COLUMN THAT EXISTS TO TRUNCATE IT.** All three copies of the anonymizer did `ip.split('.').slice(0, 3).join('.') + '.0'`. An IPv6 address contains no dots, so that returns it **whole** and appends `.0` — while `scan_events.ip_anon`'s own comment reads *"first 3 octets only per RA 10173"*. Consolidating the three copies into `anonymizeIp()` fixed it: IPv6 now keeps three hextets (a /48, the /24 analogue) and nothing else. Found by the consolidation, not looked for.

**Baseline cleared, not appended to.** The `guests.scan_tracking_opt_out` line is **deleted** from `gates-have-handles.baseline.txt` — that guard fails on a stale line once a column acquires a writer, so the removal is the proof the handle is real, not a claim about it.

`/privacy` now states the control exists, under the automatic-collection bullet that already disclosed the scan data. We shipped the FaceBlock control after the notice had promised it for months; this is the same promise made in the correct order.

**Verified:** `tsc --noEmit` exit 0 · 24 new assertions green (16 lib + 8 component) · every guard mutation-tested — each protection sabotaged individually and confirmed red before restoring.

SPEC IMPACT: `WHATS_NEXT_Papic_Build_Order_2026-08-29.md` § 6 — the fourth flag is **adopted**, not retired, and item 6 must now build on it rather than add a fifth. `DECISION_LOG.md` row added.
