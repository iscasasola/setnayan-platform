# glass-vendor-sections

## 2026-07-15 · feat(vendor): Glass PR-7 — vendor sections sweep (Atelier-Glass rollout § 5 PR-7)

The 52 non-home vendor-dashboard routes move onto the Atelier-Glass language
(App_Wide_Glass_Rollout_Plan_2026-07-15.md § 5 PR-7, per the § 4 coherence
contract + § 1.6 blur budget). Vendor home / shell (PR-6 #3264) and the
inquiry-anonymization data layer (#3266) are untouched — placeholders render
exactly as shipped, only their containers were restyled.

- **My Customers hub recomposed** — the opaque `--m-paper` body wrapper is
  dropped (the ambient wash shows through); the month calendar is one
  `.sn-tile`; the three summary cards are a glass bento (`.sn-eye` eyebrows,
  Space-Mono numerals); the customers list is a `.sn-tile` panel of opaque
  `.sn-row` rows; the Whitelist status pill moves off the retired purple onto
  info-slate warm semantics.
- **My Shop hub + tab surfaces to contract** — stat pulse numerals to mono,
  completeness-ring eyebrow to `.sn-eye`, More-tools grid to flat `.sn-row`
  cards (12+ items — blur banned per § 1.6); ManageTiles tool tiles are glass
  with a flat expanded panel (no nested blur, #3252 behavior kept);
  VerifySection panels to `.sn-tile` (#3254 sequencing kept); Earnings /
  Contracts / Proposals / Payment-options / Manpower surfaces: glass panels,
  `.sn-row` lists, `.sn-eye` labels, mono money.
- **My Performance** — the dark "Business Health" tile retuned to the
  `.sn-tile-dark` obsidian-glass recipe (§ 1.3 sanctioned focal — gradient +
  glass border + blur + mono composite numeral); section eyebrows to
  `.sn-sec`; no serif/`--v-blue`/`.m-label-mono` remain.
- **On the Day** — today's event card is the sanctioned day-of obsidian
  (`.sn-tile-dark` + bloom); console/capture cards to `.sn-tile`; mono
  ALL-CAPS section heads to `.sn-sec`; day-of preview banner + the
  service-adaptive category chips unchanged.
- **Long-tail contract sweep** (reviews, track record, real stories, recaps,
  team, disputes, invite, locked-qr, verify, attributes, repertoire, branches,
  partnerships, subscription + tokens family, clients/[eventId] tree,
  messages/[threadId] chrome, calendar day page, website): `bg-cream`
  (pure-white since the token flip) panels → `.sn-tile`, repeated rows →
  opaque `.sn-row`, dashed empty-states lose their opaque fill,
  `m-card`/`m-label-mono`/`m-eyebrow`/`m-display-tight` → kit
  (`.sn-tile`/`.sn-eye`/`.sn-h1`), rose-* overdue tones → `--sn-danger` warm
  semantics, headline numerals → Space Mono.
- Blur budget honored: mapped/repeated collections (recaps, stories, team
  seats, pool-day cards, gig cards, payday month groups, loading skeletons)
  are flat `.sn-row`, never blurred tiles.

Data sources, actions, routes, copy-facts, and flags unchanged — expression
only.

SPEC IMPACT: None beyond the already-corpus-recorded rollout plan
(App_Wide_Glass_Rollout_Plan_2026-07-15.md § 5 PR-7 — this PR is that plan's
scheduled execution; no pricing/SKU/decision deltas).
