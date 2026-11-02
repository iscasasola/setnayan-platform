## 2026-07-11 · fix(life-flash): safety + dignity gate before the prod flip — moderation, self-memoriam, high-trust memoriam, correctness

Pre-flip hardening for Life-Flash (built, flag-OFF). An adversarial QA-readiness audit found two hard safety blockers plus correctness bugs that would embarrass on real couples' media. All fixed here; the flip itself stays an owner action (build-time `NEXT_PUBLIC_LIFE_STORY` + redeploy).

**Safety (the two blockers):**
- **Moderation gate** — `fetchMomentGraph` filtered only `hidden_at`, so the fullscreen auto-playing flash + reel would surface `nsfw_blocked`, `unscreened`, and RA 10173 `consent_withheld` / `faceblock_withheld` opt-out media. Added `.eq('moderation_state','clean')` to BOTH `papic_photos` and `papic_guest_captures` queries — the same allowlist every other guest surface uses. Violated the "NSFW cannot be disabled" invariant otherwise.
- **Self-memoriam** — the self-claim trigger stamps `created_by_user_id = self` on the account holder's own person node, so the ✦ "remembered" toggle would appear on themselves and (being most-recurring) open their own flash on a memorial orb. Now excluded in BOTH `page.tsx` (`canEdit`) and the `markPersonInMemoriam` server action (defense in depth, via `claimed_by_user_id`).

**Dignity + correctness:**
- **High-trust memoriam** — the memoriam beat + the reel ✦ marker now read a new `peoplePresentHighTrust` (individual-QR / hand-picked tags only), never table-QR fan-out or low-confidence auto-face — so a deceased person is never captioned "here" on a photo they aren't in.
- **Multiple deceased honored** (owner 2026-07-11) — `memoriam_hold` now carries `people[]`; every remembered person is named (grouped when they share a frame), bounded by the beat budget. Was: only the first was named, the rest silently dropped.
- **Guest clips render correctly** — added `media_type` to the guest-capture query + assembly (was hardcoded `'photo'` → guest 5s clips showed as broken `<img>`).
- **Names on the right photo** — `page.tsx` now presigns with an index/null-preserving resolver; `displayUrlsForStoredAssets` compacts nulls and slid a different event's hero / a caption onto the wrong face.
- **Perf** — the live-`<video>` mount window narrowed from `|i-cur|<=1` (3 concurrent) to current+next (≤2, the module's own contract).
- **Strict-`clean` mitigation** — opening Life-Flash now fires `reScreenStuckCaptures` (`after()`) for the couple's events, healing fail-open/stuck `unscreened` rows so they flow back in rather than staying invisible forever.

Tests: `life-story-beats.test.ts` +3 (low-trust exclusion, multi-deceased across frames, shared-frame grouping); memoriam assertion + `Moment` test builders updated for `peoplePresentHighTrust`. Typecheck + lint clean; full lib suite **1464 green**. Analytics naming reconciled in the spec (kept the shipped `life_flash_*` code names; the plan's `life_story_*` predated the rename and never emitted).

SPEC IMPACT: 03_Strategy/Life_Story_Build_Plan_2026-07-08.md line 146 — PostHog event names corrected `life_story_*` → the shipped `life_flash_*`. No SKU/schema/pricing change.
