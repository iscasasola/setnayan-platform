## 2026-08-07 · fix(ci): the "do not auto-merge" label now actually disarms

`auto-merge.yml` arms auto-merge on every non-draft PR. A hold was added earlier
the same morning (#4210) — a label, a title string, draft. **The label was only
ever consulted at `opened`, and nothing undid an arming afterwards.**

Measured, same day:

```
label `do-not-auto-merge` created ....... 04:17:20Z
#4186 opened ............................ 2026-08-06 11:46:40Z   (16h EARLIER)
#4209 opened ............................ 04:02:57Z              (14m EARLIER)
both labelled ........................... 04:17
both MERGED ............................. 04:28:43 / 04:28:46
```

Neither PR could have been opened carrying a label that did not exist yet. Both
were armed at open, **wore the hold label for eleven minutes, and merged anyway**
— one of them the public privacy notice published in the owner's name as DPO,
the exact document the hold was invented to protect.

### The fix's own lesson, applied one level down

#4210's thesis was *"a convention that lives in someone's head is not a control."*
It then documented the recovery step — `gh pr merge <#> --disable-auto` — **in a
comment**. A comment is a convention. Until this change, `--disable-auto`
appeared in the file exactly once, inside prose.

Now it runs. A `disarm-on-hold-label` job fires on `labeled`, scoped to that one
label, and executes `--disable-auto`. **The label works at any time, including on
a PR that is already armed.**

### The dangerous half

Adding `labeled` to the triggers means the arming job could now see it too — and
labelling a PR that ARMS it would be strictly worse than before. So
`enable-automerge` explicitly opts out with `github.event.action != 'labeled'`.
Removing the label still does **not** re-arm; that stays deliberate, with
`gh pr merge --auto --merge` as the manual way back.

### Guarded, and sabotage-tested three ways

`apps/web/lib/hold-label-actually-disarms.test.ts` pins the wiring, not the
wording. Each sabotage fails exactly one assertion, by name:

| Sabotage | Assertion that fired |
|---|---|
| arming job stops excluding `labeled` | **LABELLING A PR CAN NEVER BE WHAT ARMS IT** |
| `labeled` removed from triggers | the workflow listens for `labeled` at all |
| `--disable-auto` demoted into a comment | a disarm job exists and actually runs `--disable-auto` |

The third is the one that matters most: it asserts `--disable-auto` appears on a
**non-comment** line, because prose is exactly how this failed the first time.

### Not done here

The two PRs that merged early are **left in place**. The privacy notice change is
correct — it replaced a 5-year photo-keeping promise the code never honoured
(originals go at 6 months). Reverting would republish a false statement on a legal
page, which is worse than publishing a true one early. Flagged to the owner to
read and keep or reverse; that is his call as DPO, not a code decision.

SPEC IMPACT: None.

### The existing guard had to change too — by tightening, not weakening

#4210 also shipped `apps/web/scripts/lint-automerge-hold.mjs`, which asserted
**"`labeled` must not be a trigger at all."** That was correct for its design,
where the arming job was the only job — but it forbids the very mechanism that
makes the label work at any time, so it went red on this PR. Its own error text
says *"Restore them rather than weakening this check."* Agreed, so it was not
weakened.

It now asserts the **property instead of the proxy**: `labeled` may be a trigger
**only if** the arming job explicitly opts out of it, **and** a disarm job exists
that runs `--disable-auto` as a command rather than mentioning it in a comment.
That is strictly stronger than before — it still forbids the backwards case, and
additionally rejects a half-done version of this change.

Sabotage-tested both new branches:

| Sabotage | Guard's message |
|---|---|
| `labeled` trigger, arming job does not opt out | *"…would itself ARM the PR, which is exactly backwards"* |
| disarm job removed | *"…nothing disarms on it… must run `--disable-auto` as a COMMAND, not mention it in a comment"* |

⚠ The first CI run also showed `playwright e2e` red. It was **cancelled**, not
failed — collateral from the lint job going red. No test failed.
