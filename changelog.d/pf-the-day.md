## 2026-09-22 · fix(day-of): the live photo wall says when it cannot be read

W6 / register LAU-33.

`app/[slug]/_lib/loaders.ts` built the day-of live photo wall inside a `try`
whose failure path was:

```ts
} catch { liveWall = null; }
```

`null` **also** means "this couple does not own LIVE_WALL" and "they turned the
guest mirror off". So an RLS denial, a statement timeout or schema drift rendered
**byte-identically to a deliberate off-state** — the section was simply absent.
The error was not even bound, so there was no log line either: a wall could break
at a wedding and leave no trace anywhere.

🔑 **A LOG LINE NEVER CHANGED A PIXEL.** This follows the precedent set by
`lib/guests-read-is-honest.test.ts` (couple side) and
`app/vendor-dashboard/reads-are-honest.test.ts` (supplier side), and its rule 2
is the one that bites: the measurement has to reach the RENDER. So the change is
in three parts — the loader binds and raises, the value is returned, and
`site-body.tsx` has an arm that draws an honest line at the same anchor id, so
the event-day bar's "Photos" button still lands somewhere that explains itself.

**Why a sibling boolean and not a richer `liveWall`.** Every existing reader
treats it as truthy-or-absent, including `publicAlbumHref`, which routes the
"Photos" button to the inline wall when present and to the album door when not.
Widening that value would move a button on a page nobody asked us to change.

The decision is a pure module, `lib/live-wall-read-state.ts`, so it is EXECUTED
by tests rather than asserted by regex. Two orderings in it are load-bearing and
documented: `off` is checked before `unreadable` (when the mirror is off no read
was attempted, so announcing trouble would cry wolf on the commonest path), and
`unreadable` before `hasData` (a read that failed cannot be trusted to have
produced complete tiles, and half a wall shown as the whole wall is the same lie
in a smaller costume).

⚠ It does not make the wall appear. A failed read is still a failed read. It
stops the failure IMPERSONATING a setting, so a couple whose wall has broken is
told instead of quietly concluding the feature is off.

Proved by sabotage: restoring the bare `catch { liveWall = null }` — the original
defect exactly — turned the loader test red; and deleting the RENDER arm while
leaving the flag computed and returned turned the render test red, which is the
assertion that keeps this from becoming a boolean nobody draws. Restored, 7/7.

SPEC IMPACT: None.

## 2026-09-22 · fix(download): signing is not notarization, and Gatekeeper knows

W6 / register DSK-6.

`/download` told visitors **"Signed & notarized by Apple"**, and its First-launch
card said *"Because Setnayan is notarized by Apple, it opens like any trusted Mac
app — no right-click, no Gatekeeper workarounds."* Both branched on `mac.signed`.

Measured against the live build — the exact file `/api/download/mac` serves:

```
xcrun stapler validate → "does not have a ticket stapled to it"
spctl -a -t open -vv   → "rejected"
                         source=Unnotarized Developer ID
                         origin=Developer ID Application: … (P95JPDWWB3)
```

The build IS signed. It is NOT notarized. `spctl` reports both in the same
breath because they are different facts: signing says who built it, notarization
says Apple scanned it — and **Gatekeeper only stops warning for the second.**

🔑 **ONE BOOLEAN CARRIED TWO CLAIMS, and the copy asserted the stronger one.**
`release.json` says `"signed": true` and nothing else; it never claimed
notarization. The page invented it. Same disease as `liveWall = null` carrying
three meanings (LAU-33, fixed in this same bundle).

What a couple met: *"cannot be opened because Apple cannot check it for malicious
software"*, in their wedding week, on a page that had just promised the opposite
and told them to double-click.

`notarized` is now its own field, **absent ⇒ false**, never inferred from
`signed` — the build workflow does not notarize today, so the page now correctly
shows the honest branch it already had ("Not yet notarized by Apple … right-click
and choose Open").

🪤 **The guard found a second instance I had missed.** I fixed the two badge
claims and the guard still failed: the First-launch INSTRUCTIONS were also gated
on `signed`. Those are the ones a couple actually follows, so they mattered most.

⚠ `stapler` and `spctl` are macOS-only and need the binary; CI has neither. The
guard therefore holds the SHAPE — "notarized" may only appear inside a branch
gated on `notarized`, and the parser must default it false. Flipping the claim
requires setting a field whose docblock says how to verify it first.

Proved by sabotage: re-branching the hero on `signed`; inferring
`notarized: v.signed === true` in the parser; and "fixing" it by deleting the
honest sentence — each turned a different test red. Restored, 5/5.

Also measured, and **already resolved**: register DSK-8 says `/api/download/*`
answers 503. Both routes now 302 to R2 and serve real builds — a 2,823,382-byte
`.dmg` and a 3,076,096-byte `.msi` — and the sizes the page prints are accurate.

SPEC IMPACT: None — the page now says what is true of the file it hands over.

## 2026-09-22 · fix(csp): name what face matching actually loads

W6 / register LAU-10 — whose wording is *"the browser protection can be switched
on WITHOUT BREAKING FACE MATCHING."* This is the thing it meant.

The full policy (`default-src`, `script-src`, `connect-src`) is **report-only**;
only `frame-ancestors`/`frame-src` are enforced. So the question is not "should
we enforce" but "what breaks if we do" — and production has been answering for a
month in `csp_violation_reports`.

Read back, that table says: **the first-party violations are already fixed**
(`pub-…r2.dev` last seen 2026-09-04; `www.setnayan.com` 2026-09-11; the OSM tile
host was named in `img-src` on 2026-09-21). What was still outstanding is
`cdn.jsdelivr.net` — 4 `script-src-elem` violations between 2026-08-22 and
2026-09-18 — which is `lib/face-gate.ts` loading MediaPipe.

⛔ **AND THE REPORT TABLE WAS NOT THE WHOLE ANSWER.** `face-gate.ts` loads TWO
hosts: the wasm runtime from jsdelivr **and the model itself** from
`storage.googleapis.com/mediapipe-models/…/blaze_face_short_range.tflite`. Only
jsdelivr ever reached the table, because the model fetch happens only when face
matching actually RUNS, and it rarely does in production yet.

🔑 **REPORT-ONLY DATA IS A LOWER BOUND ON WHAT BREAKS.** A fix driven by the
table alone names one host and leaves the other to fail later, under
enforcement, on a real event. I made exactly that half-fix; the guard below
caught it, because it reads the hosts out of `face-gate.ts` rather than from a
list I typed.

Both hosts are now named, and jsdelivr is in `script-src` **and** `connect-src` —
not duplication: MediaPipe loads a LOADER SCRIPT and then FETCHES the wasm
binary, and naming one leaves the other failing with a different error.

⚠ This does NOT enforce the policy. It removes two reasons it could not be
enforced. Flipping report-only to enforcing stays an owner decision.

Proved by sabotage: dropping the model host — the one the reports never caught —
turned the guard red; dropping jsdelivr from `script-src` only, the exact
half-fix shape, turned two tests red. Restored, 3/3.

SPEC IMPACT: None.

## 2026-09-22 · fix(types): three errors no test could see

CI's "Typecheck" step caught three faults that every unit test passed straight
through — the class `source-reading guards cannot compile` describes:

1. `liveWallUnreadable` was returned from the loader but never added to
   `LiveLayerData`, so the object literal did not match its own return type.
2. `executeApproved` used `row.initiated_by`, which its parameter type did not
   declare.
3. `reason: payload.reason ?? row.rationale` passed `string | null` where a
   `string` was required — narrowed rather than asserted, so a future nullable
   path cannot put `null` into an audited money record.

And a fourth, found only by re-running after fixing those: the CALL SITE carried
its own inline cast listing the same fields. **A cast that omits a field does
not fail at the cast — it fails at the call, one line later**, which is why
widening the parameter alone left the build red.

🪤 The background wrapper reported **exit code 0** while the log held `tsc
exit=2` and three errors. Read the log, not the wrapper. (Second time this has
been observed; it is in memory as `tsc-full-project-killed-by-sandbox`.)

All five guards added in this bundle re-run green afterwards.

SPEC IMPACT: None.

## 2026-09-22 · fix(contacts): one support address, not one per feature

`support@setnayan.com` was declared **five times independently** —
`ANNIVERSARY_SUPPORT_EMAIL`, `GODCHILD_SUPPORT_EMAIL`, `STD_SUPPORT_EMAIL`,
`RENEWAL_SUPPORT_EMAIL` and `SUPPORT_EMAIL` — and published in the unsubscribe
instructions of anniversary emails, godchild reminders, save-the-dates and
renewal notices.

🔑 **That is the drift `lib/contact-addresses.ts` exists to end, caught in the
act.** The DPO address had drifted the other way — one value, 22 copies, and the
wrong one. This is the same value with five owners, which is how it becomes
wrong in some of them and right in the rest. Each is now a re-export, so every
caller keeps its name and the literal lives in one place.

⚖ **AND A QUESTION THIS MAKES ANSWERABLE rather than answering.** `setnayan.com`
receives mail via iCloud+ Custom Email Domain, and the owner's address list shows
**3 of 3 used** — `live@`, `dpo@`, `noreply@`. There is no `support@`. iCloud+
*can* have a catch-all, so this may still deliver; it may also bounce, in which
case the unsubscribe route in four kinds of email goes nowhere. **Not changed on
a guess** — one place to check now, and one place to change it.

Proved by sabotage: re-declaring the literal in `anniversary-emails-core.ts` —
the exact original shape — turned the guard red (`1 file(s) re-declare`).
Restored, 4/4. `save-the-date-emails-core.test.ts` 8/8 unchanged.

SPEC IMPACT: None.

## 2026-09-22 · track the two-admin promise the help page makes to suppliers

`/help` publishes, live, under **"What needs two-admin approval"**:

> *"Per Vendor Agreement § 9.1: major decisions need two admins. That means
> ad-revenue activation, vendor verification override, a large refund above the
> policy threshold, force-majeure bulk resolution, payment-method config change,
> and any blanket policy update."*

That is a **contractual commitment to suppliers, citing a numbered clause.**

Measured against production's `admin_approval_requests` CHECK — which allows
`grant_internal_account`, `grant_team_pool`, `promote_to_admin`,
`approve_vendor_partnership`, `approve_fraud_wipe_ban`,
`approve_journal_spotlight`, and since this bundle `approve_comp_grant` —
**none of the six is implemented. Zero of six.**

🔑 **The mechanism is real, works, and is enforced in the database**
(`admin_approval_four_eyes`: `decided_by <> initiated_by`). It is pointed
somewhere other than where the contract says it points. Found while following up
the caveat on the comp-grant gate — that refunds and payout-account changes were
still single-admin — which turned out to be a much smaller statement of a much
larger one.

**This does not implement them.** Six approval flows is a body of work, and one
of them cannot even be specified here:

⛔ **THE REFUND THRESHOLD MUST NOT BE GUESSED.** The page itself says *"the exact
refund threshold is set in the Vendor Agreement"* — a number that lives in a
contract, not this repo. `refundOrder` today accepts any amount up to a ₱100M
paste-typo guard, from one admin. Owner ruling 2026-08-31 on a different invented
default: *"don't guess."* Picking one here and labelling it a guess would be the
same mistake with a comment attached.

`TWO_ADMIN_PROMISES` records all six with what implementing each would need, and
`the-two-admin-promise-is-tracked.test.ts` stops the promise and the code
drifting further apart: adding a promise to the copy without a row fails,
implementing one without recording it fails, and **quietly deleting the promise
to make the guard pass also fails** — withdrawing a contractual commitment is an
owner decision, not a copy edit.

🪤 The untracked-phrase test FAILED against correct code on first write: it read
to the end of the article and reported "user lookup" as an untracked PROMISE,
when the sentence it came from says the exact opposite — *"Routine ops (review
moderation, user lookup, manual help reply) stay single-admin."* The window now
ends at the promise sentence, with a note saying why.

Proved by sabotage: adding an untracked promise to the copy, silently deleting
the refund promise, and claiming an `action_type` the CHECK would reject each
turned a different test red. Restored, 4/4.

⚖ OWNER: this is the largest open item found today. Six published commitments,
no mechanism, one of them needing a number only the Vendor Agreement holds.

SPEC IMPACT: none in code; the gap between `/help` and the Vendor Agreement is
now recorded where a session will read it.

## 2026-09-22 · fix: three guards this bundle tripped, none of them a real defect

CI's unit suite went red on three tests. All three were caused by this bundle and
none was a defect in it — worth recording because each failed for a different,
instructive reason.

**1 · `the-page-says-what-is-true.test.ts` pinned a literal that got more correct.**
Written in CTRL-B3 build 8 (earlier today), it asserted the download card was
gated on `mac?.signed` — because that is what the hero read then. DSK-6 repointed
both at `mac.notarized`, because `stapler`/`spctl` proved signed and notarized
are different facts. The test's stated PROPERTY — *"the card must be gated on the
SAME fact the hero reads"* — never stopped holding; only its spelling went stale.

🔑 **Assert the property, never the phrasing.** It now DERIVES the hero's fact
and requires the card to match, which is strictly stronger: it would also catch
the two drifting apart in a direction nobody has thought of yet. Sabotage: making
the card read `signed` while the hero reads `notarized` turns it red.

**2 · `deposit-proofs-are-private.test.ts` fired on the documentation of the
finding.** Its `SELECTS_IT` matches any single-line quoted string containing
`deposit_proof_url` and calls that file a surface reading the receipt. The
`DPO_QUESTIONS` entry added in this bundle NAMES that column in prose — and a
register entry is a record, not a surface.

The guard is right to be blunt: prose is exactly what would slip past a subtler
rule. So the column's exact name now lives in a COMMENT (stripped before the
guard scans, and still greppable) and the prose refers to it descriptively. The
guard stays strict; the record keeps its precision.

**3 · `admin-jobs-are-generated.test.ts` wanted a regenerate.** The money gate
exported `executeVendorSkuComp`, so the admin job map went 319 → 320. Ran
`pnpm --filter @setnayan/web admin:jobs` as the failure message says.

SPEC IMPACT: None.

## 2026-09-22 · fix: two guards met the Redesign wave in CI

`#5876` landed four Redesign builds while this bundle was in flight. The trial
merge was clean — **no conflict** — but CI builds the MERGE RESULT, and two
guards went red there. Neither was a conflict and neither side did anything
wrong; two true facts met.

**1 · The comp executor's "one caller" guard counted a REGISTRY as a door — and
that was mine, not the wave's.** `lib/admin-map/admin-jobs.generated.ts` lists
every exported admin function as DATA (`"name": "executeVendorSkuComp"`), and I
regenerated it an hour earlier after the money gate added that export. My own
guard then read the registry entry as a second way in.

Excluded **by shape, not by filename**: in a `*.generated.*` file the name must
appear only as a JSON value, and a real invocation still fails. Proved both ways
— adding `executeVendorSkuComp(...)` INSIDE the generated file turns it red, and
so does a new importer in ordinary code.

🔑 That assertion is the four-eyes property itself. If the executor is reachable
by a second path, a single admin can still grant a comp and the gate is
decorative — so it was fixed rather than relaxed.

**2 · `/open-shop` is PUBLIC again, so it goes back in the sitemap.** Earlier
today I removed it because `app/open-shop/page.tsx` did
`if (!user) redirect('/login…')` and production served a **307** to a crawler.
The owner's ONE DOOR ruling removed that redirect — the account is created inside
step 3 of the wizard now. Re-measured on production: **200**, with 1,032
characters of the real wizard and no sign-in wall.

🔑 **Both decisions were right against the tree in front of them.** The premise
changed, not the reasoning. The route is restored with that history written
beside it.

**And the guard's self-test is re-anchored.** It proved the matcher worked by
running it against the REAL open-shop page — so when the owner changed that page,
a correct tree went red. **A guard's "can it fail" proof must not depend on a
page somebody is allowed to change.** It now matches three gated samples and
three ungated ones, including the near-misses `if (!user) return null` and an
unconditional `redirect('/login')`. Samples cannot be superseded by a ruling.

Generators re-run on the merged tree: admin jobs (320), unread-error baseline,
exposure baseline (**unchanged, 6442 facts**, header 4749 = body 4749). The four
migration-sensitive db guards pass: anon-rpc 6/6, exposure-freeze 6/6,
ugat-schema-claims 3/3, ugat-concept-coverage 3/3.

SPEC IMPACT: None.
