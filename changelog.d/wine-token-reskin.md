## 2026-07-09 · style(theme): flip the mulberry token family to wine (#5C2542) — app-wide "Energy, not skin" reskin

Turns every primary CTA / mulberry accent across the app from Deep Obsidian to
**Rich Mulberry wine**, at the token — one change, whole-app effect (the "one
shared token system" of the Energy-not-skin direction).

- **globals.css**: `--color-mulberry{,-600,-700}` → wine #5C2542 / hover #7A3157
  / deep #3F1A2E (light mode); dark mode → wine-bright #8F2C54 / #A5426A /
  #5C2542 so the CTA reads on the obsidian dark background.
- **tailwind.config.ts**: the raw `mulberry.{50..400,800,900}` tint ladder →
  wine tints (500/600/700 already track the `--color-mulberry` vars).

Effect: `.button-primary`, `bg-mulberry*`, `text-mulberry*`, `border-mulberry*`,
and the focus-outline color all become wine. **Legibility preserved** — wine has
~the same luminance as obsidian, so white-on-CTA and CTA-text-on-light contrast
are unchanged.

REVERSES the "Clean Editorial 2026-05-29" lock that set mulberry→obsidian
(owner-authorized 2026-07-09, "roll wine out app-wide"). One-file-ish, trivially
revertable. Best reviewed on the Vercel preview.

NOT in this PR: the fuller "Energy, not skin" density work (progress rings, bento
tiles, sparklines, per-surface serif display headings) — that's a further phase.
This PR is the color foundation; the 2026-07-09 home hub (PR #2929) was the first
surface and used page-scoped wine, which now matches the token.

SPEC IMPACT: None (theme token values).
