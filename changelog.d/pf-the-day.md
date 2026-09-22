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
