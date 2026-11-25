## 2026-11-25 · chore(front door): follow-up to #8310 (controller function check)

- `lib/profile-personal-info-patch.ts`: `BIRTHDAY_INVALID` moves above the `PRESENCE_MARKERS` docblock, which it had split
  from its constant. No behaviour change.
- The baselines stay as main has them (controller: main's current `design-rules.baseline.json` and screens map are correct).

SPEC IMPACT: None.
