## 2026-06-20 · fix(tour): add /tour CTA to the LIVE scroll-scrub hero

Follow-up to #1921. That PR added "See a real wedding →" to the `_sections.tsx`
fallback Hero, but the live homepage renders the admin-uploaded **scroll-scrub
video hero** (`HeroVideoScrub`) whenever a hero video is published (it is, in
prod) — a different component whose end-of-scroll CTA is "Start your wedding
planning here — free". Verified live: the #1921 CTA wasn't showing because that
fallback path isn't the active one.

Added a subtle secondary "or see a real wedding first →" link to `/tour` beneath
the scrub hero's primary CTA (styled for the dark video end-card). The homepage
now surfaces the tour on BOTH hero paths (video-published and fallback).

SPEC IMPACT: None (public marketing CTA wiring only).
