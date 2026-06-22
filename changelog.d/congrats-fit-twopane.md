## 2026-06-22 · fix(onboarding): congrats finish fits one screen on desktop + mobile

Owner 2026-06-22: "fix our congrats screen to make it fit on both desktop and mobile… find the
best approach." The congrats "dashboard bloom" was ~840px tall (emotional hero + countdown +
13-row recap + share footer) — far over any laptop or phone, and `.dash-site { overflow:hidden }`
silently CLIPPED the bottom (the share footer was unreachable). Best approach = the same two-pane
move used across onboarding, plus trimming the redundant recap.

- **Recap trimmed** (`onboarding-shell.tsx`): dropped the rows that duplicate the "Services" line
  (Reception/Ceremony/Catering/Photo&Video) + Song list + Shortlisted + the redundant Wedding row;
  removed their now-orphaned computed vars. Recap is the 7 essential facts.
- **Two-pane card on desktop** (`onboarding-desktop.css`): the dash-site splits into `dash-col-l`
  (hero + countdown) and `dash-col-r` (recap + share), so the tall card uses the width and fits a
  laptop. The redundant "cnames" line is dropped (the monogram + headline already name the couple).
- **Mobile** (`onboarding.css`, `@media max-width:1023`): the columns stack; the hero monogram /
  headline / countdown are tightened, the long Services line clamps to 2 lines, and the minor
  "X guests will see this page" note is hidden — so the whole card + the "Go to my dashboard" CTA
  fit a phone with no scroll.

Verified on a standalone preview of the card (real `onboarding.css`/`onboarding-desktop.css`, no
funnel) at **1366×768** (two-pane, share + CTA visible, 0 overflow) and **390×844** (single column,
share clears the CTA, 0 overflow). tsc 0 · `next lint` clean. The funnel itself errors on save in
the local dev (borrowed creds can't write the anon plan) — unrelated to this layout.

SPEC IMPACT iter 0021 congrats / 0016 onboarding (layout only) → CHANGELOG note.
