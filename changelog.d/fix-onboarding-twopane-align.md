## 2026-06-28 · fix(onboarding): align answers with the question on the desktop two-pane role/kind/faith screens

On desktop (≥1024px) the onboarding role/kind/faith screens render a two-pane
editorial layout — eyebrow + question + hero image on the LEFT, answers on the
RIGHT. The hero was set to FILL the left column top-to-bottom, which pinned the
eyebrow+question to the very top while the short answer stack stayed vertically
centred in the right column. Result: the question and its answers read as
detached, floating apart (owner-reported "the texts are not properly aligned").

Fix (`onboarding-desktop.css`): cap the hero on these three screens to a centred
4:5 portrait (`flex: 0 0 auto; aspect-ratio: 4/5; max-height: min(56vh, 540px)`)
instead of full-fill. The left column's eyebrow+question+image group now centres
vertically (`.viewzone` is already `justify-content: center`) and lines up with
the centred answers as one balanced composition — no float, no void.

Scope: role/kind/faith only. pax/budget keep the full-fill hero (their tapzone
holds a tall slider/number control, so the filled hero stays balanced there).
Mobile/tablet (<1024px) is untouched — this rule lives inside the desktop
`@media (min-width:1024px)` block only.

SPEC IMPACT: None (desktop-only CSS polish; no schema, copy, pricing, or flow
change). The 2026-06-21 "hero fills the left column top-to-bottom" note is
refined for the three option screens — surfaced to the owner for sign-off.
