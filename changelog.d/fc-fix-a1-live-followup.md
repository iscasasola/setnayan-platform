## 2026-11-25 · chore(front door): follow-up to #8310 (controller function check)

- Restores `apps/web/lib/design-rules.baseline.json` and `apps/web/lib/ugat/screens.generated.json` to their state
  before #8310: the regenerated baseline that rode in with it dropped rows unrelated to that PR. The Ship controller
  regenerates once per batch; the one row #8310 really paid down is `app/help/[slug]/page.tsx` 1 → 0
  (`every-back-goes-home`).
- `lib/profile-personal-info-patch.ts`: `BIRTHDAY_INVALID` moves above the `PRESENCE_MARKERS` docblock, which it had split
  from its constant.

SPEC IMPACT: None.
