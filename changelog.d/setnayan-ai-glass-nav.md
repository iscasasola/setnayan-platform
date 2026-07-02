## 2026-07-02 · fix(marketing): Setnayan AI in the HOMEPAGE glass nav

Follow-up to #2634 — that PR added "Setnayan AI" to the shared marketing top-nav
(`site-nav.tsx`, which serves the non-homepage pages), but the HOMEPAGE renders a
separate glass pill nav (`HomeReskin.tsx` · Prices · Download · Vendors · Sign in),
so the link didn't appear on `/`. Adds a "Setnayan AI" link (first, before Prices)
to the homepage glass nav → `/setnayan-ai`. Styled automatically — `.hr-links a`
already matches the sibling overlay buttons; `Link` was already imported.

SPEC IMPACT: None.
