## 2026-09-27 · perf(fonts): a guest's phone downloads the faces its page sets, not every face we ship

A plain guest page (`/[slug]`) sent 36 font preloads — every face in the root
layout plus every theme's faces from `site-skin.tsx` — to set text in four of
them. Measured on a production build at 390×844 over a throttled phone link
(150 ms RTT, 1.6 Mbps): 1,066 KB of fonts, the last one landing ~8 s in.

- `app/layout.tsx`: only Hanken Grotesk (the UI face), Fraunces (the couple's
  names and date on every guest page) and Cormorant Garamond (the House theme's
  headings, monogram and Save-the-Date) stay preloaded, each now saying
  `preload: true` in so many words. Every other face says `preload: false` —
  including the seven monogram/script faces whose `preload: false` was dropped in
  3b1fade66 while the comment claiming it stayed.
- `app/[slug]/_components/skins/site-skin.tsx` and the three invite doors
  (`invite/_components/themes/{velvet,galeriya,abaca}.tsx`): `preload: false` on
  every theme face. next/font cannot preload per theme (the theme is data, the
  preload is a build-time property of the declaration), so a theme face now
  downloads only on a page that wears that theme. The door and the page agree,
  so one file keeps one URL (`.p.woff2` vs `.woff2`) and is never fetched twice.
- New guard `apps/web/lib/fonts-preload-only-the-first-paint.test.ts`: every
  `localFont` in `app/` and `lib/` must say `preload: false` and
  `display: 'swap'` unless it is on the measured first-paint allowlist (which
  must say `preload: true` explicitly and must still exist), and a file declared
  twice must say the same `preload` both times. Sabotage-proven 7 ways.

SPEC IMPACT: None
