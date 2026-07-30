## 2026-07-30 · feat(papic): the face-enroll prompt follows its privacy control, and coordinators see Papic's numbers

Two owner rulings from the gaps/security pass, plus a correction to reasoning I gave earlier.

### ⚠ Correction first: auto face-matching is NOT dormant

I told the owner (and wrote it into PR-D and PR-F) that auto face-matching was dormant for want of a hosted model. **That was wrong, and it came from the spec register rather than the code.**

`lib/face-match.ts` is a working matcher. It needs no hosted model because **the descriptors are extracted client-side and posted with the capture** — `api/papic/guest-capture/route.ts:244` parses `faceVectors`, and line 540 calls the matcher whenever any arrived. Patiktok's booth does the same via `matchPatiktokFace`. The matcher's own gates are the `face_enrollment` data-privacy control and `mode_a`; **that control has been `active` with an approver since 2026-07-16.**

So an enrollment does buy the guest something today, which makes the owner's "widen it" plainly right.

### #2 · The enrollment ask now follows the capability, not a purchase

The prompt required an active `PAPIC_GUEST` pack. Since every event runs on the free pool, that meant a guest whose photos *were being taken* was never offered enrollment.

It is now gated on **`isDataPrivacyControlActive('face_enrollment')`** — the very control `face-match.ts:52` checks before it will match or persist a descriptor. That keeps the ask and the use in lockstep: a selfie is solicited only where a selfie can be used, and **a DPO revocation retires the prompt on its own** rather than leaving a surface collecting RA 10173 § 13(b) data for a switched-off feature. Disclose-then-enable, mechanised instead of hand-held.

Both call sites moved together — `[slug]/_lib/loaders.ts` (the long page) and `[slug]/hub/page.tsx` (the day-of hub). `faceMode` still shapes the ask downstream (christening/debut are forced `mode_b`), and consent is captured by the enroll UI itself.

### #3 · Coordinators may see Papic's numbers

Papic's home tile + nudge shipped **couple-only** yesterday — the conservative default, because widening couple-only capture data was a privacy call to make deliberately rather than in passing. The owner has now made it: **yes.** A delegated coordinator runs the event and already sees the guest list, schedule and vendors, so an aggregate shot/photo **count** sits inside that remit.

`['couple', 'coordinator']`, mirroring the membership test the day-of launcher and galleries hub already use.

**⚠ Note precisely what did and did not widen.** Coordinators see the **numbers on home**. The RLS on the three capture tables is **untouched** — no coordinator gained access to a photo. And because the counts come from the service-role client, that membership test **is** the authorisation, which is why the flag has no default in the lib and defaults `false` at the component boundary.

`isCoupleMember` → **`canViewPapicCounts`** throughout: the old name became a lie the moment coordinators were admitted, and a flag that guards a service-role read is the last place to leave a misleading name.

### Guards, both mutation-tested

- `papic-face-mode-gate.test.ts` — the enroll prompt in **both** files must check `isDataPrivacyControlActive('face_enrollment')`. Sits directly beneath the existing guard that pins the same control on the *matcher*, so the ask and the use are now guarded as a pair.
- `papic-home-tile.test.ts` — the viewer test must admit `['couple', 'coordinator']` and must stay a real membership test, not a bare truthy. **Probed:** reverting to `.eq('member_type', 'couple')` fails *"coordinators may see Papic counts — the owner ruling, pinned"* by name; restored → 16/16.

**Verification:** `tsc --noEmit` clean · `next lint` clean · `lint:retired` OK · **`test:unit` 5,452/5,452 pass**. Control states read from prod `data_privacy_controls`, not assumed.

SPEC IMPACT: `Papic_Promotion_Surfaces_BUILD_SPEC_2026-07-29.md` §2-D/§2-G + §5-11 amended (0d/0e reframed — the DPO console already holds these), and `DECISION_LOG.md`. No price, SKU, schema, flag or **RLS** change.
