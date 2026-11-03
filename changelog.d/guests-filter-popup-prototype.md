## 2026-11-03 · docs(guests): prototype — the filter popup, re-presented (for owner approval)

Owner, 3 Nov: "also refine the filter popup on how to present them properly". Prototype only, no app code changed:
`docs/prototypes/guests_filter_popup_2026-11-03.html` — BEFORE is the shipped ≡ popup captured at 390 px from
`/dev/guests-lab?part=screen` (light + dark; dark forced, as `/dashboard/[eventId]` is not on `DARK_READY` yet).
AFTER keeps all 18 options and re-presents them: a bottom sheet; Show · +1s · Group by · Sort each ONE dropdown;
Select… · Save as Excel · From your people · Import a file as framed "Do more" actions; dividers between topics;
title + one line with details in ⓘ; "N applied" in the title; Clear all + "Show N guests" at the foot.

SPEC IMPACT: None until approved — on approval it changes `guests/_components/guests-filter-menu.tsx`.
