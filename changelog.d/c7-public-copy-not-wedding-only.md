## 2026-08-31 · fix(copy): the front door and llms.txt stop selling one event type out of seventeen

**The defect, measured on the live database, not on a document.** `event_type_vocab` in
production (project `njrupjnvkjkitfctetvi`) carries **seventeen rows and every one is
`status = 'active'` AND `enabled = TRUE`** — wedding, debut, gender reveal, birthday,
celebration, travel, corporate, tournament, christening, anniversary, graduation, reunion,
gala night, simple event, date, hangout, wake. Meanwhile the two surfaces that describe the
whole product described a seventeenth of it:

- `app/page.tsx` — `HOME_TITLE` read *"Plan your Filipino wedding free"*, and the
  SoftwareApplication JSON-LD called Setnayan *"The Philippines-first wedding platform"*.
  That JSON-LD paragraph is the machine-readable answer an LLM quotes when asked what
  Setnayan is, on the one URL an answer engine grounds the entire brand on.
- `lib/llms-txt.ts` — the lead paragraph told AI crawlers the other event types arrive
  *"as those event types unlock"*. They were already unlocked when it said so.

Neither could fail, throw, or typecheck red. **A true sentence about a smaller product is a
valid sentence.**

**What changed.** The title, description, keywords and JSON-LD on `/`; the lead blurb, the
"what it's becoming" section, and the couple-only framing in `llms.txt`. Weddings are still
named first everywhere and still lead `keywords` — widening a claim is not the same as
dropping the strongest query the brand ranks for.

**Three judgements worth keeping:**

- ⚠ **"event", not "celebration", and the reason is `wake`.** A wake is a live enabled event
  type and it is not a celebration. The house word in the corpus is "celebration"; on the
  strings that must cover all seventeen it would be false.
- ⚠ **No COUNT is written anywhere, and a guard enforces that.** A numeral goes false the day
  the eighteenth row ships — silently, in a machine-readable field. A list that has not been
  extended merely UNDER-describes, which is the safe direction.
- ⚠ **The list is written ONCE.** `LIVE_EVENT_TYPES` + `liveEventTypesPhrase()` are exported
  from `llms-txt.ts` and interpolated; the guard asserts the rendered sentence IS the one the
  constant produces, so a second hand-typed copy fails rather than drifts.

**Also fixed, found on the way:** `llms.txt` linked `/weddings`, which has 308-redirected to
`/realstories` since the 2026-06-14 rename (`next.config.ts`) — verified live, `/weddings` →
308, `/realstories` → 200. It now links the destination. Both stay allow-listed.

**Newly permitted, and taken up:** the per-guest Papic limit shipped (#5024 merged
2026-08-30), so `llms.txt` may now describe it. It is described as the live schema and the
merged promotion page describe it — a **ceiling**, not a reservation
(`papic_guest_spend_ceilings.ceiling_points`, `events.papic_guest_spend_ceiling_*`): nothing
is carved out of the pot, so an unspent credit is still there for everyone else. **No number**
— the host chooses it.

**The proof.** `lib/public-copy-is-not-wedding-only.test.ts` (12 assertions) asserts none of
the do-not-claim strings reach the rendered output or the homepage metadata, that the figures
still resolve from catalog rows rather than literals, and that no count of event types is
written into either surface. Home-page assertions run against **comment-stripped** source, per
`home-brand-name.test.ts` — this file's own comments quote the strings a naive grep would look
for.

**MUTATION — every assertion sabotaged, occurrences printed before → after.** Baseline
`# pass 12 # fail 0`; every row below reports `# pass 11 # fail 1`, and the baseline was
re-run green with a clean tree afterwards.

| Sabotage | Occurrences before → after | Result |
|---|---|---|
| `HOME_TITLE` restored to the wedding-only string | `/wedding/i` in the title **0 → 1** | ✅ RED |
| an "Avatar Maker" product line added to the prose | `avatar (maker\|builder\|creator)` outside the denial lines **0 → 1** | ✅ RED |
| a "browse other couples" feed section added | `browse other couples` **0 → 1** | ✅ RED |
| `₱2,500` typed in place of `${R('PAKANTA')}` on the Pakanta line | literal `2,500` in the source **0 → 1** | ✅ RED |
| a literal count re-added ("Seventeen event types are already open") | `[Ss]eventeen event types` **0 → 1** | ✅ RED |
| the `- No avatar maker.` denial bullet deleted | that bullet **1 → 0** | ✅ RED |
| the interpolated list replaced by a typed second copy | `liveEventTypesPhrase()` call sites **2 → 1** | ✅ RED |

⚠ **The second row was re-measured before it was written down.** A whole-file `grep -c
"avatar maker"` reported **1 → 1** — because the *denial* bullet contains the phrase — which
would have recorded a sabotage as unmeasured while the test was in fact going red for the right
reason. The count above is taken in the same region the guard scans.

🪤 **Two guards failed honestly on their first cut and both fixes are in the file.** The
do-not-claim scan matched **its own denial** — "No public feed and no social channel" contains
`public feed` — so it now excludes lines shaped `- No …` *wherever they appear*, never the
whole section, which would have made that section a hiding place. And the reprice assertion
first said "the old figure is gone from the file", which is **set membership** — ₱2,500 is also
the Thank You Video's price — the exact shape `llms-txt.ts`'s docblock exists to kill. It is
anchored to `**Pakanta** — ₱…` now.

**Refactor, deliberately narrow:** the hand-typed catalog fixture moved out of
`llms-txt.test.ts` into `lib/llms-txt-guard-input.ts` so the second guard imports it instead of
pasting a **third** copy of the catalog. Every warning in its original comments moved with it.

SPEC IMPACT: None. No decision changed — the seventeen event types were already ruled live and
enabled; this makes the public copy agree with them.

**OWNER QUESTION (not resolved here):** the session brief forbids advertising **multi-camera
Live Studio** (finished, but cannot start until YouTube is reconnected — P0-a). It is
advertised on `main` today and **a copy edit cannot remove it**: `LIVE_STUDIO` is
`is_active = TRUE`, and `llms-txt.test.ts`'s *"every ACTIVE retail price is quoted somewhere in
the file"* goes red the moment its prose line goes. Taking the claim down means taking the SKU
off sale. That is an owner decision, and it is recorded in the guard rather than silently
skipped.

---

## 2026-08-31 · fix(guards): the llms.txt fixture stops describing a product that does not exist

**Flagged by a peer oversight session while this PR was armed; verified against the live
catalogue before anything was changed. The substance held and was WIDER than reported.**

`apps/web/lib/llms-txt-guard-input.ts` — the fixture this PR promotes into a shared, named
module with a second consumer — was measured against `platform_retail_catalog_v2` (project
`njrupjnvkjkitfctetvi`, read 2026-08-31):

| | Fixture said | Production says |
|---|---|---|
| Papic ladder, all **17** rungs | ₱50 for 100 … ₱11,200 for 50,000 | ₱70 for 100 … ₱15,000 for 50,000 — **~40% higher** |
| Papic titles, all 17 | "add N **shots**" | "add N **credits**" |
| Setnayan AI ladder | 1499 / 899 / 499 / 99 | **2499 / 1499 / 899 / 199** — a whole rung out |

`llms-txt.test.ts` hard-coded that same stale AI ladder, so **the assertion and the fixture
agreed with each other and with nothing else** — the shape this repo spent the day clearing.

🔑 **NOTHING SHIPPED WAS WRONG, AND THAT IS THE ENTIRE POINT.** Every figure in `llms-txt.ts`
resolves from the catalogue at render, and `AI_TIER_FALLBACK_PHP` in
`setnayan-ai-type-pricing.ts` matches production exactly. The defect was never a wrong price on
the page — **it was a guard that could not detect one**, because its reference reality was a
reprice behind and a vocabulary behind.

⚠ **The vocabulary is an owner ruling, not a preference** (2026-08-29, commit `32df56e81`).
**Only the CURRENCY meaning moved** — a photograph is still "a shot", and the vendor's shot list
is deliberately untouched. A product you BUY is the currency meaning.

**Two of the peer's claims did NOT hold, were checked, and are not acted on:**
- *"new in your PR"* — **no.** The fixture is on `main` inside `llms-txt.test.ts`; this PR
  **moved** it, and `git show origin/main:…llms-txt.test.ts | grep -c PAPIC_GUEST` is `17`
  before and after. It was inherited, not authored.
- *"your fixture has 8 rows; production has 17"* — **it has 17.**

**Also fixed, in genuinely rendered copy:** the homepage JSON-LD `featureList` sold *"paid
top-ups for more shots"*.

**Added so this cannot rot silently again:** provenance on the fixture (date, project, the exact
query); a guard rejecting the retired currency word in rendered copy **and in every active
fixture title**; and an explicit note that the `is_active: false` rows are **NEGATIVE fixtures**
— most no longer have a catalogue row at all, and "correcting" them to match production would
gut the retired-SKU guards.

**MUTATION (baseline `pass 14 / fail 0` + `pass 13 / fail 0`):**

| Sabotage | Before → after | Result |
|---|---|---|
| retired currency word restored to the homepage JSON-LD | `more shots` in page.tsx **0 → 1** | ✅ RED |
| one ACTIVE fixture title reverted to the retired word | active titles using it **0 → 1** | ✅ RED |
| `SETNAYAN_AI` fixture price reverted to the stale ₱1,499 | **2499 → 1499** | ✅ RED |

🪤 **A trap this session walked into, recorded because it cost real work.** The first mutation
run used `git checkout -- <file>` to undo each sabotage on files that were **not yet committed**
— so it silently reverted the fixture correction itself, and the "restored baseline" came back
RED with two failures. The changelog table above was re-run **after** committing. The repo's own
rule already says this (*"commit before you mutate"*); it applies to the mutation harness, not
just to bulk rewrites. **`git checkout --` cannot tell your sabotage from your work.**

SPEC IMPACT: None.
