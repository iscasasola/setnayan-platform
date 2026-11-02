## 2026-06-28 · feat(marketing): link feature pages from homepage grid + footer

The marketing feature pages (`/papic`, `/setnayan-ai`, `/panood`, `/pa3d`,
`/palogo`, `/pawebsite`, `/patiktok`) were live but undiscoverable — the
homepage "Sixteen features. One home." overview rendered every feature label as
plain text, and the footer didn't link them either. Visitors could only reach
these pages by typing the URL.

- **Homepage overview grid** (`FeaturesNarrative` Panel 0): the seven feature
  labels that have a dedicated marketing page are now real `<Link>`s — Seat Plan
  → `/pa3d`, Website → `/pawebsite`, Setnayan AI → `/setnayan-ai`, Papic →
  `/papic`, Monogram → `/palogo`, Panood → `/panood`, Patiktok → `/patiktok`.
  The other nine labels stay as plain text (no dedicated page). Visual design is
  unchanged — same chip footprint, copy, and grid; linked chips add a restrained
  on-brand hover affordance (a trailing arrow that fades in + a subtle lift and
  stronger border, via `--m-*` tokens / inline handlers). No new stylesheet rules.
- **Site footer** (`_SiteFooter`): added an "Explore" link row listing the seven
  marketing pages using their public-facing names (Papic · Setnayan AI · Panood ·
  Pa3D · Animated Monogram · Wedding Website · Patiktok). Matches the footer's
  existing `hover:text-ink` link style; responsive (wraps on mobile).
- No prices anywhere (public-surface hygiene). No top-nav / registry changes.

SPEC IMPACT: None — purely additive navigation/discoverability on existing
marketing surfaces; no SKU, schema, pricing, or copy changes.
