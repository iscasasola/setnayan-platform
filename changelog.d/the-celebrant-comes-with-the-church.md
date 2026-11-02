## 2026-08-27 · fix(planning): the officiant comes with the church — and three of the seven Essentials buttons were dropping couples into the whole marketplace

⚖ **Owner ruling 2026-08-27, verbatim:** *"for priest (there are rules) so this needs to be under their church (which is at the ceremony venue)."* Asked whether officiants should become bookable suppliers, the answer is **no** — a priest is not shopped for, they come with the parish, and the parish is the ceremony venue.

**That ruling was already the architecture, and the couple-facing surface contradicted it.** `lib/officiant-auto-resolve.ts` has shipped since 2026-05-30 and does exactly what he describes: when the locked ceremony venue implies the officiant it renders *"The priest from your parish officiates the sacrament"* instead of a picker. Nothing there was rebuilt. But the **fallback** — every couple whose rite is not one of the four framings (`catholic_parish` · `civil_registrar` · `inc_chapel` · `muslim_mosque`), and every couple who has not locked a venue yet — got a card reading **"Officiant · Browse officiants"**.

🚨 **That button could never have worked, in two independent ways.**

1. **There is no officiant marketplace and never has been.** All 20 officiant services are `marketplace_hidden` under the 2026-05-31 lock. Even a perfect link would have shown zero results.
2. **The link named a folder that does not exist.** It pointed at `/explore?folder=ceremony`. `ceremony` is a *tile* word, not a folder word — a leftover from the 12-folder model the 2026-05-31 shrink replaced with 15 folders keyed `venue` · `feast` · … `/explore` validates `?folder=` against that list and, finding no match, **drops the scope silently**.

🚨 **And it was not one button — it was three.** Sweeping every `folder=` literal in `app/` and `lib/` found the same mistake in the two biggest cards on the same screen:

| button | pointed at | folder exists? |
|---|---|---|
| Browse venues | `?folder=reception` | ❌ (it is a tile) |
| Browse caterers | `?folder=catering` | ❌ (it is a tile) |
| Browse officiants | `?folder=ceremony` | ❌ (nothing at all) |

**Measured on `www.setnayan.com` before the fix, not inferred** — counting rendered `<h2>` sections:

```
?folder=feast      → 1 section   (scoped, correct)
?folder=venue      → 1 section   (scoped, correct)
?folder=catering   → 28 sections (the entire marketplace)
?folder=reception  → 28 sections
?folder=ceremony   → 28 sections
```

So a couple pressing **"Browse caterers"** on their own dashboard was handed all 28 categories — venues, DJs, photo booths, insurance — with no error and no clue anything had gone wrong. Three of the seven Essentials, live, for as long as the 15-folder model has been in place.

🔑 **The class: a query param that reads perfectly and means nothing.** The validator fails **open** by design, which is right for a stranger's typo'd share link and is exactly what hides a wrong link we ship ourselves. Same family as the phantom column, the phantom enum value and the phantom RPC argument — *rejected, not thrown*, and the only symptom is an absence. Here the absence is of **narrowing**, which looks like a page that works.

**What changed**

- `Browse venues` → `?folder=venue`, `Browse caterers` → `?folder=feast`.
- The officiant essential now reads *"Your priest, pastor, imam or judge usually comes with the ceremony venue. Lock the church or hall and the officiant follows."* and its button is **"Choose ceremony venue"** → `/explore?folder=venue&tile=ceremony-venue`. **Verified live**: that URL renders the single scoped "Venues & churches" section, and `?tile=` **alone** does not scope the folder (it returns all 28) — so carrying `folder=venue` is load-bearing, not belt-and-braces.
- 🔑 **The word stays "officiant", never "celebrant".** In Filipino English a celebrant is the person being celebrated; [#4896](https://github.com/iscasasola/setnayan-platform/pull/4896) landed *this month* to keep those two apart, and reusing the word here would undo it.
- The plan group is **deliberately unchanged** (`planGroups: ['officiant']`). Re-pointing it at `ceremony_venue` would make this card resolve off the Venue card's pick — that changes progress accounting, and the ruling was about where a priest belongs, not about how the checklist counts.

🛡 **New guard `apps/web/lib/browse-links-resolve.test.ts`, 4 cases.** It checks every essential's rendered `primaryHref` — but the load-bearing case is the third, which **sweeps every hardcoded `folder=` in `app/` and `lib/`**: guarding only the file where the bug happened to live is how the next one ships from a different file. Two floors (≥7 essentials with ≥3 scoped; >500 files scanned and >0 literals matched) so a refactor cannot turn it into a pass over nothing. It **strips comments first** — eight of the nine surviving `folder=reception` / `folder=ceremony` occurrences in this repo are stale prose describing the old model, and a raw-source match reports the defect it just fixed. A fourth case pins the owner's ruling: the officiant CTA must scope to the ceremony venue and must not offer to browse officiants.

**Found, not fixed** (reported rather than churned): `ghostBoothExploreHref` in `lib/ghost-booths.ts` builds `/explore?tile=…` and has **zero non-test callers** — its own tests pass it `'photo booth'`, which is not a tile slug. A helper nothing calls, on a surface outside this change.

SPEC IMPACT: None on price, SKU or schema. Records the 2026-08-27 owner ruling that officiants are not a bookable supplier category and belong to the ceremony venue — `DECISION_LOG.md` row same date.
