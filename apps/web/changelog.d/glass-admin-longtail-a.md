## 2026-07-15 · feat(admin): Glass PR-9a — tabbed-studio surface sweep

Atelier-Glass rollout **PR-9a** (rollout plan § 5 PR-9 / § 3.4 — the lightest,
mechanical admin pass; split A of two). Applies the § 4 coherence contract to the
bodies of the six tabbed **studios** — Accounts · App Performance · Pricing ·
Settings · Studio · Ugat — i.e. every `*/_surfaces/*.tsx` body (plus the
`settings/payment-methods` standalone that lives under the settings tree). This
is the same PR-8 idiom (payments/verify/disputes), applied mechanically; no
recomposition beyond contract normalization.

- **Headings/eyebrows** — `m-eyebrow`/`m-display-tight`/`m-display` page heads →
  `.sn-eye` + `.sn-h1`; uppercase `m-mono`/`m-label-mono` section labels →
  `.sn-eye`.
- **Wrappers off `bg-cream`** — opaque `rounded-{xl,2xl,lg} border border-ink/1x
  bg-cream` panels → a single glass `.sn-tile`; `<table>`/`divide-y` wrappers →
  ONE `.sn-tile !p-0` (rows stay **opaque** — no per-row blur, no row animation,
  per § 1.6 / R4); dashed empty states + small `rounded-md` boxes/inputs → white
  wash (`bg-white/70` + `border-white/60`), so the ambient shows through.
- **Status pills → warm semantics** — genuine one-off `violet-*`/`purple-*`/
  `blue-*` → info-slate (`--sn-info`), `red-*` → danger (`--sn-danger`),
  matched-pair badges → the `--sn-*-soft`/solid tokens. `terracotta`/`warn`/
  `success` (name-preserving remaps that already resolve to warm gold/sage) are
  left in place per rollout R6 (post-PR-9 mechanical rename).

Fences honoured: the studio **host** tab-rails (nav chrome) + `admin-nav-*`/
sidebar/layout + all non-admin surfaces untouched; no data-source, action, route,
copy-fact, or flag change. Gates: typecheck + ESLint + `lint:radius` + local
production build all green.

SPEC IMPACT: None — visual contract sweep only (rollout plan § 5 PR-9).
