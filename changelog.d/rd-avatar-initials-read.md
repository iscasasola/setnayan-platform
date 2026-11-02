## 2026-10-23 · fix(a11y): avatar initials on gold read at AA in both themes

Owner yes (2026-10-23). The shell's initials chips (`.fd-avatar` top bar, `.fd-ava` on Discover / search /
feed cards) drew gold-700 #8C6932 on the gold wash — 4.27:1, recorded as a known failure in the light
contrast baseline; the /dev labs drew a stand-in chip in white on gold-500 — 3.48:1 (what the dark-mode audit
measured). One house pair now: `--sn-initials-bg` (gold-100) under `--sn-initials-ink` (gold-800, the house's
"text on the gold wash") — ≈8:1 light, ≈8.3:1 dark — read by `.fd-avatar`, `.fd-ava` and the shared
`.sn-initials` class the labs now use. Light changes for these chips only (the initials go a step deeper).
Light contrast baseline 46 → 44. Held by `lib/avatar-initials-read.test.ts` (3 sabotages → red).
Initials already on ink, cream or a supplier tile (account trigger, roster, supplier avatar, chat) pass and
are untouched.

SPEC IMPACT: None.
