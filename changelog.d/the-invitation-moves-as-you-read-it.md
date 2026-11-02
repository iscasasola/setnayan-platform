## 2026-09-14 · fix(invitation): the public page moves as you read it

Owner: *"also make it fully animated."*

🔑 **This adds a marker, not an animation.** The §6 scroll choreography has
shipped since 2026-07-25 — sections fade up 22px as the reader reaches them —
with a careful fail-visible contract in `pahina-motion.tsx`. What was missing was
the opt-in.

🔴 **THE MARKER EXISTED ON THE GUEST TREE ONLY.** `site-body.tsx` renders two
subtrees and there was exactly one `data-pahina-chapters` in the file, in the
signed-in-guest branch. So a guest opening their personal link got the
choreography, and **the page everyone else sees got none of it** — a shared link,
a QR scan, and the couple's own preview all render the anonymous tree. One page,
two behaviours, decided by whether the reader happened to hold a cookie.

⛔ **It wraps the CONTENT, not the chrome.** The fixed `SiteMenuBar` stays
outside deliberately: it is pinned to the viewport and never scrolls into view,
so an IntersectionObserver that never fires for it would leave the entire bottom
navigation at `opacity: 0` — the page looking perfect above the fold with no way
to navigate. Same shape as the rest of today's defects: present, cancelled,
invisible.

🔒 **No new safety to get wrong.** Adding only the marker means it inherits the
existing contract verbatim: a missing `IntersectionObserver`, a reduced-motion
preference, or the 2-second self-heal each drop `.pahina-js`, and every section
is instantly visible and static.

⚠ Verified on a Vercel PREVIEW deployment, not on a local dev server — this page
needs the production environment to render, and a passing test cannot tell a
working fade from a section that never appears.

SPEC IMPACT: None — the design (2026-07-25 §6) already specified this; only one
of the two trees was wired to it.
