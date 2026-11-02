## 2026-08-10 · fix(live-studio): the OTHER way a camera goes missing now reaches the host — in the host's own words

`provisionRoamBroadcasts` loses cameras **two** ways and only one was ever
reported. The cap increments `skippedOverCap`, which becomes `notice`. A YouTube
refusal sets `youtubeError` and **breaks the loop**, so every remaining zone is
neither created, nor reused, nor counted anywhere — the result comes back
`ok: false` with `notice: null`, and `goLivePanood` read only `.notice`. A host
could set up six cameras, press Go live, see a plain green tick, and have four
never appear. `hostNoticeFromProvision` now puts the whole result through one
place, so neither way can be wired up without the other.

**And the count is real.** `ProvisionResult` gains `notStarted` — the zones the
loop walked away from (`zones.length - created - reused - skippedOverCap`),
filled at all four return sites. Nothing counted them before, which is why the
refusal path had nothing to say.

**⛔ `detail` IS ADMIN COPY AND IS NEVER SHOWN TO A COUPLE.** The first cut of
this repair folded `provisioned.detail` in verbatim, on the reasoning that it was
"already written host-safe". The type says otherwise one screen up — documented
"safe to show an admin" — and two of the five real strings prove it: one sends
the reader to **"Admin → Live Studio channels"**, a screen a couple cannot open,
and one names `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED`. An impossible instruction
is worse than the silence it replaced: silence leaves them asking, an instruction
leaves them trying. The host sentence is now built by
`provisionFailureSentence(reason, notStarted)` — numbers and a reason in, one
plain sentence out — the same shape as `cameraDropNotice` beside it, with nothing
to keep in sync with an admin string.

**The guard asserted the defect — twice.** It required the host banner to contain
the admin text (`/Reception/`) and to contain the **machine token**
(`new RegExp(reason)`, i.e. the couple reads the words `no_channel_available`).
A test that demands the bug will never report it. § 2c now asserts the property:
no `detail` string can reach the host under any reason, and host copy may not
name an admin screen, an env flag, a table or a machine token. **The admin
strings are harvested from source, not typed into the test** — the same lesson as
the admin queue guard the same week: a hand-typed list is silent about whatever
nobody typed into it.

Mutation-tested, baseline green and every sabotage verified applied: fold
`detail` verbatim (7 fail) · drop the fold entirely, the pre-fix shape (5) ·
`notStarted` always 0 (1) · post-zones failures forget the count (1) · remove the
`no_zones`/`flag_off` silence (1) · fold on success (5) · **scope control** —
banned words in a comment, correctly stayed green (0).

SPEC IMPACT: None — the promise that a host is told when a camera drops was
already the decision; one of the two ways it could drop never reached them.

### Also: a sibling guard that measured character distance

`lib/live-studio-channel-pool.test.ts` asserted the roam flag gate with
`/if \(liveStudioRoamEnabled\(\)\) \{[\s\S]{0,1400}provisionRoamBroadcasts/` —
"the call appears within 1400 characters of a gate." Adding a comment above the
call broke it, failing a change that moved nothing; a guard that fails on prose
trains you to loosen it, which is how the real assertion gets thrown away.

Worse, `goLivePanood` has **two** `liveStudioRoamEnabled()` blocks, and the
regex anchored on the first — the token lookup — then matched 1400 characters
straight out the other side of it. **It would have passed with provisioning
ungated entirely.** It now brace-matches every gate and requires one to CONTAIN
the call. Mutation-tested: replacing the provisioning gate with `if (true)` —
exactly what the old proxy allowed — turns it red.
