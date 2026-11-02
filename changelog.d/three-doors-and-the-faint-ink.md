## 2026-09-10 · fix(story): the faint ink on the live page, and the two doors the database left open

Three defects found by a 30-agent verification pass over the finished Story build, each then
**re-measured by hand** before anything was written. All three were the same shape in different
costumes: *the thing that should have caught it was looking somewhere else.*

### 1 · Ten pieces of text on the live published story are below the readable floor

Measured in the live DOM of `/movie-night`, compositing each element over its REAL background:
`text-ink/40` → **2.54:1**, `text-ink/45` ×8 → **2.92:1** (one of them the **Share** control, at
**9px**), and the action colour → **4.01:1** — all against this module's own 4.6 muted floor and
plain AA.

⚠ **MY OWN FIRST TWO MEASUREMENTS WERE WRONG**, both in the optimistic-for-drama direction: they
counted white-on-dark date stamps and selected pills as failures because the walker skipped
semi-transparent ancestors. **13 → 10 real**, and the number in the verification report should not
be quoted. *A contrast sweep that does not composite the full ancestor stack is not a measurement.*

Fixed: 21 sub-60 alphas under the light wrapper raised to `MUTED_ALPHA`; `text-mulberry` → `-600`
(**4.01 → 4.69** on the story's own tinted ground — the gold-has-no-headroom lesson, now for the
action colour); the 9px/10px share labels → `text-xs`.

🔴 **AND THE GUARD THAT EXISTS FOR EXACTLY THIS SCANNED ONE DIRECTORY.** `story-light.test.ts` read
`readdirSync(STORY_DIR)` — `_components/story/`, non-recursive — where /60 genuinely is the
faintest. The `[data-story-light]` wrapper is OPENED in the SIBLING directory, in
`editorial-content.tsx`, which carried all 21. The module's docblock claimed the alpha is *"derived
from the markup, never trusted to have stayed put"* — **it derived from the wrong markup.** *A
hand-scoped guard is a list of the files somebody thought of.*
The scan set is now **derived from the wrapper itself**. 🪤 And widening it made the guard fail on
its own locator: TWO files name the attribute, and only one DECLARES it (`story-light.tsx` merely
selects it). **Fixing the locator was the answer; relaxing the count was the tempting wrong one.**

### 2 · A story could be published with no consent tick · 3 · a withdrawn wish could be re-approved

Both read out of production: `authenticated` holds UPDATE on `event_editorial.status` AND
`.publish_consent_at`, the policy is PERMISSIVE `FOR ALL` to the couple, and the only triggers were
the edition stamp and `updated_at`. `photo_messages` had **no triggers at all**. So a signed-in host
could PATCH `status='published'` with no consent recorded — and `/[slug]` renders on that column
alone — and could put a guest's withdrawn words (`status='user_deleted'`) back to `'approved'`,
after which all three public-read filters pass and they render again.

**The app refused both. The app was not the fence.**

⛔ **WHAT IS DELIBERATELY NOT ENFORCED, and it is the judgement call in this PR.** The desk's other
rule — *publish is impossible while an item is undecided* — is NOT in the trigger. A **held-back**
item (whose tagged guest opted out of photos) is un-acceptable by design and stays `pending`
FOREVER; the desk renders a lock chip and no control. A database rule of "no pending rows" would
make publishing **permanently impossible** for any celebration holding one, with nothing on screen
to say why — **a worse defect than the one it closes.** The app keeps that half; the database keeps
the half that can always be satisfied.

### Measurement

**Dry-run against PRODUCTION inside `BEGIN … ROLLBACK`** (the replay runs as superuser and cannot
prove grants), then confirmed the rollback left nothing — 0 triggers, 0 `photo_messages` rows, the
one published story untouched:

```
DOOR1_FORCED=REFUSED(story:publish_needs_consent) | DOOR1_WITH_CONSENT=ACCEPTED(GOOD)
DOOR2_REAPPROVE=REFUSED(story:withdrawn_stays_withdrawn) | DOOR2_REJECT_STILL_OK=ACCEPTED(GOOD)
```

🔑 **EVERY REFUSAL HAS A CONTROL BESIDE IT.** A guard that only proves something is refused cannot
tell *the door is shut* from *the room is bricked up* — and this repo has shipped exactly that.

`TSC_EXIT=0` **and** `ERROR_LINES=0`. 16 tests across two suites, counts non-zero. Every
`scripts/lint-*.mjs` passes. **Mutation-tested, all three RED:**

| sabotage | result |
|---|---|
| the consent branch made unreachable (`IF FALSE`) | 6 pass → 5 pass, 1 fail |
| the withdrawn-status check deleted | 6 pass → 5 pass, 1 fail |
| the publish trigger renamed away from its table | 6 pass → 5 pass, 1 fail |

🪤 **The first sabotage LEAVES THE `RAISE EXCEPTION` STRING IN PLACE** — an occurrence-count guard
would have read 1 → 1 and proved nothing. Only a behaviour test catches a branch made unreachable.

🪤 Two seeding traps paid for: an `event_editorial` row is **auto-created by a trigger for every
event** (inserting one dies on the unique key — and that auto-creation is why an unpublished story
was once readable by anybody), and `guests` needs `first_name`/`last_name`/`side`/`group_category`.

`SPEC IMPACT`: None — no pricing, no new product surface.
