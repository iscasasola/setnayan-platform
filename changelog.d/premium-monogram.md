### feat(marketing): premium-UI pass on /monogram

Restrained premium-UI motion pass on the public `/monogram` lead-magnet tool page,
following the 2026-06-25 Premium UI Standard. The live Monogram Studio (which mounts
imperatively via innerHTML and is remount-sensitive) was left completely untouched —
all new motion lives on page siblings above and below it, never around
`PublicMonogramStudio`.

- **New client motion island** `apps/web/app/monogram/_monogram-motion.tsx`
  (`'use client'`): imports the shared read-only premium primitives. The page stays a
  `force-static` Server Component; GSAP is isolated to the client island.
  - `MonogramHeadline` — above-the-fold H1 gets a one-shot serif line-reveal via
    `useLineReveal({ trigger: 'mount', duration: 0.8 })` (NOT IO-gated, so the tool
    stays instantly reachable). Reduced-motion → static; opacity-only, SSR text intact.
  - `StepsReveal` — the 3-step "how it works" `<ol>` gets a restrained staggered rise
    (`useReveal`); each `<li>` marked `data-reveal-item`. No thread.
  - `ClosingCta` — **the signature**: the closing "Make it official" CTA card gets a
    single champagne `<PanelThread tone="light"/>` up its left gutter via
    `usePanelIntro`, stitching up as the card's serif headline (`data-premium-headline`)
    resolves in lines — thread draw + headline land together (a monogram = two strokes
    interlocked). Body paragraph + CTA button marked `data-premium-item` for the quiet
    rise. CTA route/copy untouched. Card made `position: relative` + `overflow-hidden`
    so the absolutely-positioned `.sn-thread` anchors to it.

- **`apps/web/app/monogram/page.tsx`** (stays a Server Component): wires the three
  islands; the live studio section + its in-studio card and the register-gate sign-up
  card are unchanged in behaviour. Palette hygiene — value-equivalent hardcoded-hex →
  `--m-*` token swaps throughout: `#8C6932→--m-orange-2` (text), `#C5A059→--m-orange`
  (hairline), `#5C2542→--m-mulberry` (CTAs), `#FBF6EA→--m-orange-4`, `#1E2229→--m-ink`,
  `#5F5E5A→--m-slate-2`. Gold stays hairline/eyebrow only; exactly ONE PanelThread (the
  closing card); mulberry CTAs only.

Gold-budget discipline: exactly one PanelThread on the surface (the closing card); the
hero owns no thread (the studio is the hero); steps have no thread.

The closing "Make it official" card renders in BOTH register-gate branches — it sits
outside the `gated ?` ternary, so it shows whether the studio is live or replaced by
the sign-up card.

Note — two intentional, value-near token shade shifts (both prerequisite,
accepted as value-equivalent per the plan): `#8C6932 → --m-orange-2 (#A88340)` for
eyebrow/numbers text, and `#5F5E5A → --m-slate-2 (#6A6E76)` for body/secondary text.
Both are slight on-token shade normalizations, not new colours. `#FBFBFA` (CTA button
text on mulberry) has no mandated token and is left as-is.

typecheck: pass · lint: pass (no new warnings) · prod build: pass (`/monogram`
prerendered as static HTML, `force-static` intact).

SPEC IMPACT: None — additive motion + value-equivalent token swaps only. No copy,
route, IA, CTA, metadata, or logic change; pricing/SKUs untouched.
