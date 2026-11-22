## 2026-11-18 · feat(motion): Phase 4 loading — load rules, the one Sheen, Ghost skeleton, top line, Photo arrives

Motion standard `MOTION_STANDARD_2026-11-18.md` (specs) § 4 #7 Sheen · #17 Load · #20 Photo arrives · § 9 "D · Ghost".
Built on the shared parts, so every `loading.tsx` and every later screen inherits it.

- **Load rules — one helper** (`lib/load-rules.ts`: `LOAD_WAIT_MS` 150 · `LOAD_STAY_MS` 400 · `createLoadGate`, mirrored
  as `--sn-m-load-wait` / `--sn-m-load-stay`). A loader waits 150 ms before it shows; once shown it stays ≥ 400 ms. The
  top line and the route veil (`components/loading-activity.tsx`) go through the gate; every `.skeleton` block waits by
  CSS alone (`sn-load-wait`, fill `backwards`). Neither rule holds content back: the stay applies to the top line (an
  overlay); a route's loading screen is still swapped out by React the moment the page is ready. No request added.
- **One Sheen.** `.skeleton` and the kit's `.sn-skeleton` are one rule: a light strip on `::after`, moved by
  **transform**, `var(--sn-m-sheen)` (1.4 s) linear — the one allowed loop. Retired: `sk-shimmer` (1.5 s,
  background-position), the old background-position `sn-sheen`, `sn-shimmer`, `sn-indet` (animated `left` → the
  `.sn-busy-bar` Sheen), `sn-dots` (owner: "bounce off"), `sd-spin` (the veil's orbits ride the one `sn-spin`).
  Reduced motion: no strip, a still grey block.
- **Skeleton = D · Ghost** (`components/skeletons/index.tsx`): `Ghost` shows what is known as itself, at once, and
  falls back to a grey block; templates take `title` as its own words (or `true` = grey), lists take `names`,
  `SkSection` takes a section `name`. Last visit's names keep coming from the one shipped cache (`LastSeenFallback`) —
  no second cache. Five loaders now show their real title (Find your date · Add a guest · Import guests from a file ·
  Your repertoire · Helpers).
- **Top line** (`app/_components/nav-progress.tsx`): scaled on X by transform (was `width`), Quick · Settle, a quick
  fill then a quick fade; waits 150 (was its own 120), stays ≥ 400.
- **Photo arrives** (`lib/photo-arrives.ts` + `app/_components/photo-arrives.tsx`, mounted once in the root layout):
  a photo carrying `PHOTO_ARRIVES` fades and settles in on load — Move 320 · Settle, opacity + `scale`, fill
  `backwards`. Never hides a photo, never fades the page's first picture, not inside `.sn-editorial`; reduced motion:
  at once. Adopted by `FramedImg`, `MarkedPhoto`, `VendorAvatar`, `ProofImage`.
- **Guards** (each seen red once by sabotage, then restored): `lib/the-sheen-is-one.test.ts` ·
  `lib/the-load-rules-are-one.test.ts` · `lib/the-ghost-falls-back-to-sheen.test.ts` · `lib/photo-arrives.test.ts`.
  `scripts/motion-raw.baseline.json` shrank (globals.css 288 → 286).
- **Left as is:** the `sd-loader` veil and `SubmitButton` (Phase 2); `sn-logo-wait` (the couple's own logo — a capped
  wait, not a motion); `.sn-editorial` and `lib/motion.ts` (the couple's Event Hub).

SPEC IMPACT: None
