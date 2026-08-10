## 2026-08-10 · feat(papic-games): 16 more story questions — and the picker that makes them reachable

Owner 2026-08-10, after the first four shipped: *"make more. something to uplift the groom, bride, and as a couple. questions that are fun to share but still memorable and safe enough to share."*

Library 44 → **60**. Every one answered to camera in ten seconds, like 41–44.

**Two kinds, and between them they cover all three of the owner's asks:**

- **`stories` (45–52)** carry the `{who}` side token — a bride-side guest is asked about *the bride*, a groom-side guest about *the groom*. 🔑 **This IS "uplift the groom" and "uplift the bride"**: each guest is asked about the half they actually know. A fixed *"praise the bride"* handed to the groom's college roommate produces a polite non-answer — the opposite of memorable. Targeting by side beats targeting by name. *(Brag For Them · Three Words · The Best At · The Kindest Thing · Set It Straight · First Impression · Made You Laugh · Proud Of Them)*
- **`stories_couple` (53–60)** carry no token and are always about the two of them — and this is the **only** way to get "as a couple": a both-side guest resolving `{who}` to "the couple" happens by accident of their side, not by design. *(When You Knew · Better Together · Advice For The Years · Different Together · Ten Years From Now · The Best Day · Their Song · One Day, Their Kids)*

**"Safe enough to share" is a constraint on the WORDING, not a disclaimer.** The §2.2 blocklist stops *dares*; it does not stop tactlessness, and a question whose honest answer embarrasses someone in front of both families is unsafe even though every word passes the filter. So: every question points at something good (proud of, kindest, best at, made you laugh, what people get wrong) — **none** asks for the wildest, the most embarrassing, the secret, or the story they've never told. Those read as fun on a planning screen and land as a problem on a projector, permanently. The two that could tip — the funny one and the first-impression one — carry their steer (*"keep it kind"* / *"Be nice"*) **inside the prompt where the guest reads it**, not in a policy nobody sees. Guarded both in the unit suite (literals) and the db suite (the real table, so a later wording edit is caught).

**Only two of the sixteen take a guaranteed board slot (ranks 15–16), on purpose.** The board is 20. Ranks 11–14 are the first four stories; ranking all sixteen would leave **zero errands**, and the errands are what walk a guest to the paid line items the couple actually spent on (§9: *"the library IS the spend-maximizer"*). Default board is now **10 heroes + 6 stories + 4 errands**. Both chosen are `stories_couple`, because 41–44 are all side-token ones — without them the default board never asks about the two of them together at all. A db test asserts the count is exactly 6, so growing it is a decision someone makes on purpose.

**🔑 THE OTHER FOURTEEN NEEDED A PICKER, OR THEY WOULD HAVE BEEN FOURTEEN DEAD ROWS.** The previous migration documented exactly this trap; shipping unranked rows without a way to reach them would have been committing it deliberately. So this PR also builds the couple's story picker — the first thing anywhere that lets a couple choose a *library* challenge. It groups the two kinds with copy that says which is which (*"Share a story about the couple"* and *"…about the bride"* look like the same question on that screen and are not), hides what they already have, and warns at 10 picks that the couple lane caps there.

**`addLibraryChallengeAction` — two things it must get right, both silent if wrong:**
1. **It carries `library_id`.** `createCoupleChallengeAction` copies free text and leaves it NULL, which is right for something the couple wrote. Copying a *library* prompt that way looks identical on screen and is wrong underneath: the board resolver dedupes the Setnayan auto-fill against *couple picks WHERE library_id = …*, so a library-less copy is invisible to that check and **the same question lands on the board twice** — once as theirs, once as ours.
2. **The prompt is read from the library, never from the form.** The form posts an id. A client-supplied prompt would be free-text authoring wearing a library label — bypassing nothing, but letting any posted string inherit a library row's dedup identity.

Also: `is_active` re-checked at submit (a row can retire between page load and tap), an idempotency check so a double-submit can't add twice, and — because **a rejected Supabase read resolves with `{ error }` and a null row rather than throwing** — the picker suppresses itself when either read fails instead of `?? []`-ing into an empty list that reads exactly like *"you've added them all"*.

⚠ The db test previously named *"every story carries a rank"* was renamed to *"the four ALWAYS-ON stories each carry a guaranteed rank"* — its filter only ever saw those four, so under the expanded set the old name asserted something **false about the feature while passing**.

Tests — 31 unit + 13 db (all against the full replayed schema). **Three new guards, each mutation-tested:** putting `{who}` into a couple story turns the token test red; ranking a seventh story turns the board-budget test red; dropping `library_id` from the picker insert turns the source guard red. Typecheck clean, all 20 `lint-*.mjs` green, migration-timestamp guard green (1083).

⚠ The picker guard is a **source scan**, and narrowly so — the action is a cookie-bound server action, so the db test replicates the row it writes rather than invoking it. That proves the shape works, not that the action still writes it; the scan closes that one gap for the field whose loss is silent.

SPEC IMPACT: `0012_papic/Papic_Games_and_Vendor_Missions_Spec_2026-07-21.md` §9.2b (the set is 20, two kinds, the safety rule, the 6-on-board budget) + the couple picker as a §9.3 capability. `DECISION_LOG.md` rows added 2026-08-10.
