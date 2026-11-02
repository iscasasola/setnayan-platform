# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-12 · refactor(website): event-type-adaptive copy on the host website-management pages (unlock Stage 3)

Owner-decided 2026-07-12 ("unlock all now"). With non-wedding events now rendering + host-managing a public event site, the dashboard website-management pages still hardcoded "wedding" ("your wedding page", "your wedding website", "the wedding day"). This routes all of it through the shared `eventNoun` helper so a birthday/anniversary host reads "event" while **weddings stay byte-identical**.

- **`lib/event-noun.ts`** (new, pure) — `eventNoun(eventType)` → `'wedding'` for weddings/legacy-null, `'event'` otherwise; `eventNounCap` for sentence starts. One source shared by the guest site (Stage 1) and these host pages.
- Generalized ~30 user-facing strings across **7 pages** — `website` (hub), `website/privacy` (15), `website/launch`, `website/dress-code`, `website/widgets`, `website/hero-photo`, `website/editorial`. Each page's event `.select(...)` gains `event_type` where needed; static metadata titles that said "Wedding" became neutral ("Event website", "Who can view your event page").

Left intentionally untouched: code comments, `resolveProfile(… ?? 'wedding')` logic defaults, the branded **"Real Weddings"** showcase name + `/realstories` link (a proper feature name), the event-agnostic "Save-the-Date", and `ceremony_type === 'inc'`-gated liturgy copy. Weddings render byte-identical (`eventNoun('wedding') === 'wedding'`).

Verified: `tsc --noEmit` clean; completeness sweep confirms no user-facing hardcoded "wedding" copy remains on the 7 host pages (only logic/comments/types).

SPEC IMPACT: The host-facing website-management pages are now event-type-adaptive (part of "unlock all now"). No behavior change for weddings. Guest-site copy was Stage 1 (#3207); the surface-flag flip is Stage 2 (#3210). See `DECISION_LOG.md`.
