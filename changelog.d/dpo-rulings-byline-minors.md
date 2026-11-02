## 2026-08-06 · change(privacy): the DPO's five rulings — and the two that change what a guest sees

The owner ruled on all five open lawful-basis questions, as data protection
officer. Three record what already ships. **Two change behaviour, and both are
here.** `guest_columns` holds **zero rows in production**, so both are free to
make today and impossible to make later.

### Ruling 03 — a guest's name is published only if they asked

The byline is the guest's ROSTER name, typed by the **couple**. Publishing it on
the open web beside the guest's own words is a disclosure the guest never made
about themselves. Hidden is now the default; being named is the opt-in.

🚨 **THIS WAS NOT A DEFAULT FLIP, AND READING IT AS ONE WOULD HAVE UNPUBLISHED
EVERY MESSAGE.** `author_publicly_hidden` sounds like a byline switch and is not:
all seven read paths filter `author_publicly_hidden = false`, so setting it
removes the **whole message** from publication. Flipping its default — the
obvious implementation, and the one the filing draft's own wording implies —
would have silently hidden every guest message rather than anonymising it, and
the ruling would have looked delivered. **The product had no way to publish a
message without a name at all.** That capability is the new
`author_named_publicly`; the two columns answer different questions, and both now
carry a `COMMENT` saying which.

The rule lives in ONE helper (`bylineFor`), because four surfaces each hand-roll
their own guest-name lookup and one of them deciding the opt-in differently is
exactly how a name gets published by accident.

### Ruling 04 — a guest we already know to be a child may not author one

Enforced by a **trigger on the table**, not a check in the route or a fork of the
100-line submit RPC: the route is one caller, the table is every caller including
ones not written yet.

🔑 **Scoped to `status = 'pending'`, the submit/edit path.** Withdrawal writes
`user_deleted`, so a child who somehow already has a row can **still take it
down**. A privacy rule that blocked its own takedown would be the opposite of the
ruling.

🔑 **Unknown age is NOT treated as a child.** A guest record holds no age at all;
the signal is an active stewardship marked `is_minor` — the same one that already
refuses a child's selfie. The ruling explicitly declined to start collecting
birthdays: collecting ages to protect ages enlarges the risk being managed.

### 🚨 The repo's own scanner caught a real bug I introduced

A first pass also changed `auto-recap.ts` and `live-wall.ts`, because they filter
`author_publicly_hidden` too. **They query `photo_messages` — a different feature
that happens to share the column name.** `select-column-scan.db.test.ts` failed:
naming a phantom column makes PostgREST reject the WHOLE query with 42703, so
`.data` returns null and **the public recap and the venue projection wall would
have gone silently empty**. Both reverted. 🔑 **Grepping a column name finds a
name, not a table.** Whether the same ruling should extend to photo messages was
never put to the DPO and is not decided here.

**Two more of my own errors, both caught rather than shipped:** a guard that
matched `/birthday/` anywhere failed on this migration's own comment explaining
why we do *not* collect birthdays (checks the DDL now, not the prose); and a
scripted import insertion produced syntactically broken files that 6,901 passing
unit tests did not notice — `tsc` did.

**Verified:** 9 new tests, each mutation-checked (opt-in weakened · public page
bypassing the helper · refusal blocking takedown · trigger dropping edits · each
public query dropping the opt-in) — all go red. Full suite 6,901 pass under
`Asia/Manila`. Scoped `tsc` clean. All 13 lint scripts clean.

SPEC IMPACT: `DECISION_LOG.md` + `ROPA_Drafted_Rows_2026-07-30.md` § 4 action 1 —
all five rulings recorded. The two owed public `/privacy` sections ship
separately and are NOT auto-merged (legal copy is opened for review).
