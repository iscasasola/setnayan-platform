## 2026-08-23 · feat(home): one event card, phone and laptop — owner ruling

The account home rendered every shelf **twice**: a phone composition under `sm:hidden` (a
full-width dark hero for the first event, two-up compact chips for the rest) and a glass-card grid
under `hidden sm:grid`. One card now renders at every width — one column on a phone, two from `sm`,
three from `lg`, four from `xl`.

⚖ **This replaces two owner-approved compositions, which is why it went to the owner.** It arrived
as one of the nine delegated design calls under *"do as you recommend"* — but `GlassEventCard`'s own
docblock reads "One EVENTS glass card (owner-approved final design 2026-07-15)", `MobileEventHero`
cites its prototype by name, and an earlier pass in this same stream had already measured the split
and recorded that *"changing it is a design reversal, not a fix."* A general instruction to use
judgement is not consent to reverse two sign-offs. Asked in plain English; the owner answered yes.
`DECISION_LOG.md` 2026-08-23.

🔑 **Nothing was lost in the collapse, and that was checked rather than assumed.** The surviving
card already carried every signal the phone pair did — the photograph, the monogram, the name and
place, the date, the counter, the progress, the stance — plus the story-page override the Untold
shelf depends on. A guard asserts all five on the card itself.

⚠ **The phone gained the named count.** The two-up chip could not fit a label, so it printed a bare
total ("3 need you"); the card that replaced it renders the count **and what it is about**.

The two phone-only components are **deleted, not unmounted** — this file has twice had a guard pass
on a component nothing rendered. The popover-anchor alternation goes with them: it existed because a
280px menu hung off a 160px left-column chip landed offscreen, and at one column a card is full
width.

### Six guards were written against a two-composition world

They counted card mounts, `unwritten.map(`, `{closedReason}` and the story override to **`>= 2`**,
and enumerated three component names. Every one is **re-anchored to EXACT counts, not relaxed** — a
second composition drifting back now fails, which is precisely what the ruling removed.

🪤 **One was DELETED rather than repointed.** "Every two-up chip grid alternates the popover anchor"
derived its subject list from `<MobileEventChip` mounts. With zero chips it compared 0 to 0 and went
**green** — a vacuous assertion that reads exactly like a guard doing its job. Leaving a hollow
version standing would make it look like two-up chips were already covered if they ever return.

---

### Proof

| mutation | count before → after | result |
|---|---|---|
| a phone-only composition returns | 1 → 2 | RED |
| a grid goes back to two columns on a phone | 0 → 1 | RED |
| a deleted phone card comes back | 0 → 1 | RED |
| a shelf loses its card | 5 → 4 | RED |
| the stance leaves the card | 1 → 0 | RED |
| a second New-event card appears | 1 → 2 | RED |
| a stray `align` alternation survives | 0 → 1 | RED |

- `pnpm typecheck` clean · **9,518 unit tests green under `Asia/Manila`** · ESLint clean
- `lint:port-controls` flagged the two removed components — **deliberate, baseline regenerated**, and
  the regeneration was proved to absorb nothing else: 404 routes unchanged, **zero** destinations and
  **zero** actions lost, the only removals being `MobileEventChip` and `MobileEventHero`.

SPEC IMPACT: `DECISION_LOG.md` row added (owner ruling). No migration, no schema, no price or SKU
change.
