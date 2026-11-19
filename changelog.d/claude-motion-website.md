## 2026-11-18 · feat(motion): the public pages on the motion standard — Reveal, Timeline, Hero settle, Scroll-away, Emphasis and one Drift (Phase 5)

Owner, 18 Nov 2026: *"start phase 5 website now"*. Standard: specs `MOTION_STANDARD_2026-11-18.md` § 6 (Part D of the
prototype). Built on Phase 1's tokens (`--sn-m-*`). Pages: `/`, /for-suppliers, /for-coordinators, /features and a shop
at /v/… (/pricing has no motion of its own and is unchanged).

**The six named motions — one source.** `app/globals.css` gains the `sn-w-*` block: seven tokens (`--sn-w-rise` 12 px ·
`--sn-w-stagger` 60 ms · `--sn-w-reveal-span` 64 px · `--sn-w-hero-gap` 80 ms · `--sn-w-hero-from` 1.06 ·
`--sn-w-away-fade` 0.4 · `--sn-w-away-lift` −24 px) and twelve one-ended keyframes. A CSS module cannot read a global
keyframe, so the three module sheets carry copies under the same names; a guard holds every copy equal.

- **Reveal** — 12 px up and a fade, Move on Settle, neighbours 60 ms apart, the first six only. Where the browser runs
  an animation on the scroll (`animation-timeline: view()`), the part rides the scroll and nothing is hidden by a class;
  elsewhere each page keeps its one IntersectionObserver, retimed. Replaced: `.fl-reveal` 0.6 s / 14 px, `[data-rv]` and
  `.fc-rv` 0.8–0.9 s / 26 px, the shop's `fadeUp` 700 ms / 18 px and `cardUp`, the features story's `up` / `fade`.
- **Timeline** — for-suppliers and for-coordinators ("Starting → Growing → Established", the three questions): the line
  follows the scroll, dots answer in Quick on Spring, words in Move on Settle; the clock fallback is 3 × Rise instead
  of 2.3–2.8 s. The features story's `prog` (width), `grow` (height) and `nowline` (top) now move by transform.
- **Hero settle** — the picture from 1.06 in Rise: the shop (was 1600 ms from 1.12; the name's words 80 ms apart, was
  900 ms / 110 ms), the front page's slide (was a 6 s zoom), the two pitch pages' hero slides (was 8 s from 1.14).
- **Scroll-away** — the hero's words fade to 40 % and lift 24 px with the scroll: the shop and the front page. Both
  heroes clip their own overflow, which makes the hero itself the nearest scroller for an anonymous `view()` — a
  timeline that never moves — so the timeline is named on the hero. (The shop's shipped exit fade was inert for that
  reason; measured in Chrome 157.) The shop photo's separate parallax is retired.
- **Emphasis** — the underline in Move on Settle (shop kicker, the pitch pages' beat heads); a stamp in Quick on Spring
  (shop badges, the features story's stamp). Replaced the shop's `drawX` / `stamp` / `pop`.
- **Drift** — at most ONE endless loop a page, never at 640 px or narrower, never under reduced motion: `/` keeps the
  event-type strip (a still, hand-swiped row on a phone) and the supplier strip stops looping; the pitch pages keep the
  close's photo and lose the button glow; the scroll hint and the slider's pulse play three times, not forever;
  /features keeps the run of show's "now" line.

**Content is visible without script or animation.** for-coordinators hid its three questions, its promise and its
timeline in the base style, and the features story hid every moment's parts; both now hide a waiting part only behind a
marker their own script sets (`data-fc-motion`, `data-motion`), with `from`-only keyframes filled `backwards`.

**Also:** the blur entrances lose their filter (`sn-bloom`, `sn-lens-in`; `sn-blur-in` had no user and is gone).
`lint-motion-raw` baseline 1479 → 1322.

**Guard — `apps/web/lib/the-website-moves-by-the-standard.test.ts`** (seven tests). Each seen RED on 18 Nov, then
restored: a second endless loop on `/` · for-suppliers' Drift without its 641 px floor · for-coordinators' Drift under
reduced motion · `top` back in the `nowline` keyframe · a `filter` in the Reveal keyframe · an un-gated `opacity: 0`
(features list; for-coordinators promise) · the shop's copy of Hero settle changed · `both` on the front page hero ·
`--sn-w-rise` off 12 px · the scroll-driven Reveal outside its reduced-motion fence.

**Not verified:** iPhone Safari (Spring's `linear()` on the dots and stamps; `view()` needs Safari 26), dark mode, the
pages in a running app (the scroll-driven patterns were measured in a headless Chrome 157 harness, not on the pages).

SPEC IMPACT: None
