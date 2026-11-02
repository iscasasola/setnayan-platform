# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-04 · feat(profile): reserved "Legacy contact" row — Phase 0 slice 3 (person-spine)

Bakes in the person-spine **legacy / memorialization** slot ahead of the flow itself, so the setting has its permanent home. Reserved / inert — no action wired. Part of the locked person-spine plan (`03_Strategy/People_Graph_and_Lifelong_Identity_2026-07-04.md`, Phase 3).

- **`app/dashboard/(account)/profile/page.tsx`** — adds a "Legacy contact" row inside the existing **Privacy & Data (RA 10173)** section (after Export-my-data): *"Choose who inherits your memories. You decide, while living, who your archive passes to. Coming soon."* with an inert "Not set" chip. The real *designate-while-alive* → memorialization → inheritance flow ships in **Phase 3, behind PH counsel**. No new heading (respects the no-eyebrow-kicker rule).

Reconciliation note (surfaced to owner, no code change): the profile page already carries an **account-level face-profile** feature (`faceProfileFlagOn`, opt-in, off-by-default, DPO-gated, "only ever used to find *you*") — the server-side Model B from the 2026-07-04 face-recognition boundary. It's dormant and consistent with that boundary (permitted-but-gated), though the boundary preferred *on-device*. Left untouched.

SPEC IMPACT: None new — reserved settings slot for Phase 3 of the locked person-spine plan; inert, no schema.
