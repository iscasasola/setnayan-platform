/*
  ── THE OBSIDIAN STAGE, MEASURED ───────────────────────────────────────────
  🚨 The app is LIGHT-LOCKED. Every Tailwind theme token resolves to its LIGHT
  value on this dark island and fails silently: `text-ink` is 1.27:1 here and
  `text-mulberry` is 3.81:1. So the stage paints from literals, exactly the way
  `studio/papic/_components/papic-stage.tsx` does, with the ratios written down:

    text  #FBFAF7 on #17160F ... 17.37:1  AAA
    soft  #B6B9BE on #17160F .... 9.22:1  AAA
    gold  #CBA766 on #17160F .... 7.99:1  AAA   ← gold is safe HERE and only here
    cta   #E5794E on #17160F .... 6.20:1  AA    (obsidian label on it: 6.20:1)
    card  #1E2229 raised panel — text 15.29:1 · soft 8.11:1 · gold 7.04:1

  ⛔ NEVER `--pos #4F6B4A` on this ground: 2.7:1. It is a light-ground token.
  ⚠ And the Tailwind slot named `terracotta` is the GOLD; the CTA is `mulberry`.
  These are the `--sn-ob-*` values from globals.css, inlined rather than
  referenced because this panel is obsidian in BOTH themes and a themed token
  would break exactly one of them.

  📦 WHY THIS IS ITS OWN MODULE. It lived in `launch/_components/hub-stage.tsx`
  (which still re-exports it). The shared who×when stage is a `'use client'`
  component, and reaching for a colour table through a server file that imports
  `SlugField` and a server action would drag both into the client graph. Plain
  data, no imports — safe on either side of the boundary.
*/
export const OB = {
  page: '#17160F',
  card: '#1E2229',
  text: '#FBFAF7',
  soft: '#B6B9BE',
  gold: '#CBA766',
  cta: '#E5794E',
  hairline: 'rgba(255,255,255,0.10)',
} as const;
