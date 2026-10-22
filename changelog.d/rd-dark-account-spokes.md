## 2026-10-23 · feat(dark): B2 — the account spokes and the sign-in cards are the first screens on DARK_READY

Batch B2 of `prototypes/dark_mode_rollout_2026-10-22.html`, stacked on B1 (the shell). With the ready-list
non-empty the Appearance pill (Light · Dark) shows in Preferences by itself (`appearanceSwitchShown`).

- `DARK_READY` = `/dashboard/people · library · life-flash · year · profile · notifications · create-event ·
  samahan`, `/login`, `/signup`, `/forgot-password`, `/reset-password`. Not `/dashboard` — it covers the whole
  event tree and opens with B3 (one prefix rule, no exception list). `lib/appearance.test.ts` (c) pins which
  paths may and may not paint dark (sabotage: `/dashboard` on the list → red).
- The sign-in card's ✕: a #fff disc with the card's ink, which is near-white in dark — the disc takes the card
  #232019 and the × the ink. The You card's @name verdict (inline #2F6B35 / #8A3418, ~2:1 on the dark card)
  and the Google address door (`bg-white` under ink) get dark pairs.
- The seven home-reskin dark pairs, and the create-event / samahan pairs (white on terracotta → the page
  colour in dark; ink on white → the raised card). Every other light card on these routes (`bg-white`,
  `bg-white/40–60`, `hover:bg-white/70`) gains `dark:bg-raised`; `text-red-700` gains its dark tone.
  Dark-contrast baseline 287 → 271 (removals only). Light: every change is a `dark:` class or an
  `html.dark` rule, so light does not move.

SPEC IMPACT: None — implements the approved plan (DECISION_LOG 2026-10-13 calls 1–10).
