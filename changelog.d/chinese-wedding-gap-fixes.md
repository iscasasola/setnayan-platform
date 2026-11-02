## 2026-06-28 · fix(weddings): close Chinese-wedding overlay gaps across the couple + vendor journey

A gap-audit (7 dimensions, adversarially verified) found the overlay model — the
common Tsinoy *church-primary + Chinese-secondary* case — wasn't fully wired
through the journey. This closes the verified, in-scope gaps. No migration; every
change is byte-identical for non-Chinese events and derives from the shared
`isChineseWedding` / `isChineseOverlay` predicate (never an inline `=== 'chinese'`).

- **/paperwork** now renders the **full Chinese traditions body** (tea ceremony,
  betrothal gifts, hair-combing, lauriat) for overlay couples — previously they
  saw only the primary rite's (e.g. Catholic) guide with Chinese links bolted on.
  When Chinese is the overlay, a second `TraditionsGuide` renders alongside the
  primary one and carries the tea-ceremony + specialist links. Chinese-primary
  and non-Chinese events render exactly as before.
- **Guided date flow** (four-question → `suggestMeaningfulDates`) now threads the
  `chineseTradition` flag, so the lucky-8/6/9 · avoid-4 · Ghost-Month · BaZi
  advisory appears in date *suggestions*, matching the direct picker (was silently
  dropped for every Chinese couple).
- **"Consult a date specialist" nudge** is now a live deep-link to
  `/explore?category=date_fengshui_consultant` (matching /paperwork) — was dead copy.
- **Onboarding mixed-ceremony** now preserves the Chinese overlay order-independently
  (`deriveMixedColumns` → `ceremony_type='mixed'` + `secondary_ceremony_type='chinese'`)
  — previously the second faith was dropped depending on chip-tap order.
- **Post-create ceremony editor** (Details) gains `chinese` as a primary option and a
  "We're also holding a Chinese tea ceremony" overlay toggle that round-trips
  `secondary_ceremony_type` (validated against the registry set; clears on untick;
  no CHECK violation — `is_mixed_ceremony` untouched). This is the first user-facing
  way to set the overlay outside onboarding.
- **Vendor leaves are now claimable** — the profile services picker surfaces the
  Chinese tradition/specialty leaves (`date_fengshui_consultant`, lauriat caterer,
  tea-set styling, ang-pao, lion dance, + the 2 pre-existing) as canonical checkboxes
  (DB-driven from `getTaxonomy()`); `parseServices` accepts them verbatim into
  `vendor_profiles.services[]` (tight allowlist, no arbitrary-string injection). So the
  `date_fengshui_consultant` tile + the specialist CTA resolve real vendors instead of
  an empty category.
- **Couple-facing label parity** — `chinese` added to three readable-label maps
  (`wedding-plan-groups`, `personalized-menu`, `ceremony-type-chip`) so copy no longer
  leaks lowercase "chinese".
- **Cross-feature wins** — a Chinese budget info card (ang pao / lauriat, mirrors the
  Muslim Mahr card) and a red/gold mood-board palette *suggestion* for Chinese events
  (suggest-not-force; Save stays the only writer).

Verification: `tsc --noEmit` clean; unit tests pass; lint clean on changed files;
adversarial review found no blockers (CHECK-safety, injection, and double/zero-guide
all confirmed clean).

SPEC IMPACT: None new — completes the wiring of the already-recorded overlay model.
Deferred (real but larger, logged in DECISION_LOG): per-Chinese-vendor identity on
tile drill-in, day-of/editorial/monogram/STD 囍 variants, schedule tea-ceremony beat,
plan-group Chinese hint copy.
