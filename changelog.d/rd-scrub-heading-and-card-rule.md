## 2026-10-09 · fix(scrub): the top of the room is one number, the stylesheet's — a long arrival no longer begins under the progress mark

The Scrub engine (`app/[slug]/_components/hub-scrub-engine.ts`) kept its own "top of the room" — 76 px, or 9 % of
the window — while the stylesheet's line (`--hub-pin`, `app/globals.css`) is 100 px on a page with the invitation's
pinned top bar. Measured in Chromium on a page with that bar, a list handing over to a second long list: the
arrival's top stood at 75.6 px (375 × 812), 76.1 (375 × 667), 79.0 (441 × 882) and 75.8 (1280 × 770), against a line
of 100 px, a bar that ends at 65 px and a progress mark that ends at 88 px — so the arrival's first line was 9 to
12 px under the progress mark. Now 99.6 – 100.1 px at all four.

- ONE SOURCE: `--hub-pin`. The armed scenes block carries it as a length (`scroll-padding-top`, on a box that does
  not scroll — it moves and paints nothing) and the engine reads that back in pixels. The engine has no number of its
  own, and a page that does not say its line is not played (it says why, like every other "off").
- The two `--hub-pin` declarations moved OUT of `@supports (animation-timeline: view())` into the plain base, values
  unchanged. Scrub does not need scroll timelines; a browser without them (Safari before 26) would otherwise have no
  line at all. An Auto run reads the same property as before.
- The owner's numbers are untouched (Build out 55 %, the arrival enters at 80 % and runs 22 %, rest 30 %, Held =
  Centred). `SCRUB_OUT_OFFERED` stays `false`.
- Browser check (`scripts/scrub-browser-check.mjs`): a new page (`scrub-check-page.tsx` `bar`) and case 12 — the
  arrival stands ON the stylesheet's line and clear of the bar and the progress mark, at 375 × 812, 375 × 667,
  441 × 882 and 1280 × 770. Unit guard: `lib/scrub-is-a-held-hand-over.test.ts` (9).

NOT WHAT THE iPHONE RECORDING SHOWS. The lab page the owner recorded (`/dev/maker-lab/guest/scrub`) has no pinned top
bar and no list-to-long-list hand-over, so both numbers were already the same there (76 px) and this change moves
nothing on it: measured before and after, the Schedule arrives with its top at 343.7 px (375 × 812) and its heading
is where plain scrolling puts it while row 4 builds — identical to the decimal. In the recording the heading is cut
because the list is being scrolled THROUGH (each row builds as it reaches the centre line, so by row 4 the heading
is most of half a screen above it and passes under the progress mark). That is the approved behaviour ("as you scrub
it scrolls to show the other parts"); keeping a list's heading in view while its rows build would be a new rule and
is not built.

Chromium only. Nothing here was run on iOS Safari.

SPEC IMPACT: None.
