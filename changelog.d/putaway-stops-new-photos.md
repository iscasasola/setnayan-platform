## 2026-08-16 · feat(papic): a celebration put away stops taking new photos

Owner, 2026-08-16, asked directly and answered **yes**: *"cameras and the photo wall go quiet.
Everything already taken stays untouched."* The second half of the put-away decision; the
first (a put-away event still counts on the supplier's record) is PR #4475.

**What changes for a person:** once a host puts a celebration away, a camera pointed at it is
refused with a sentence that names the way back, and the wall mirrored onto guests' phones goes
dark. **Nothing already captured is touched** — the gallery, the photos and the delivery are
exactly as they were, and one press brings the whole thing back.

🪤 **THE OBVIOUS SINGLE CHOKEPOINT IS NOT ONE.** Both capture paths converge on the credit
reservation `papic_reserve_capture_split`, which reads like the perfect home for this rule.
It is not: `recordSeatCapture` **skips that call entirely** for an event holding the "Unlock
all of Papic" pass, so a gate placed there would have been **silently absent on exactly the
events that paid the most.** The rule sits beside the capture-WINDOW gate instead — which every
seat capture passes — and again in the guest route, which shares no code with it. A test pins
the gate's POSITION relative to that branch, because moving it looks like tidying up.

⚖ **THREE NEIGHBOURING GATES, THREE FAILURE DIRECTIONS, EACH CHOSEN BY WHAT IT COSTS — do not
"make them consistent".**
- **Capture fails OPEN** on an unreadable row. A few photographs landing on a tidied
  celebration is a tidiness problem; a camera refusing during a live wedding is the one
  irreversible failure in this product — **the day does not happen twice.**
- **The wall fails CLOSED.** A wall still playing a celebration somebody put away is precisely
  what the couple believed they had stopped.
- The **metering** gate beside them already fails closed, because it is money.

🔑 **The wall check rides the read it ALREADY makes** — one extra column on an existing select,
no second query on a feed that re-asks every 25 seconds. 🔒 The **venue projection is untouched**
(owner-locked 2026-06-11); this governs the mirror onto guests' phones only.

🪤 **THE RULE HAD TO BE SPLIT OUT TO BE TESTABLE AT ALL.** `server-only` is **not installed in
this repo**, so a test importing the module that reads the database fails with
MODULE_NOT_FOUND. The judgement now lives in a boundary-free module and is exercised against
every shape the database can return; only the read stays behind the boundary. A rule that
cannot be run is a rule verified by reading, and reading is what keeps going wrong here.

🐛 **A REAL BUG CAUGHT WHILE WIRING IT:** my first cut reused an `admin` client that lives
inside an `if (!cameraTier)` block fifty lines above and is long out of scope — it would not
have compiled. It now builds its own, wrapped, so an unavailable admin client takes the same
fail-OPEN branch as an unreadable row.

🔬 **Four mutations, each caught by exactly the right test, restored 9/9 green:**
M1 guest route loses the gate (1→0) · M2 wall stops closing on put-away (1→0) · M3 capture
fails CLOSED instead of open (1→0) · M4 the plausible refactor — gate moved inside the
`if (!unlocked)` branch — caught by the position test.
✅ **Every restore verified BY CONTENT, not by the copy command's exit code** — on the previous
PR a restore silently failed and left the sabotage in the file.

SPEC IMPACT: None — no migration, no column, no permission, no price change.

## 2026-08-18 · fix(papic): the refusal reaches the person, and stops congratulating them

Seven fixes from an adversarial review pass, run before merge. The server half
of this PR was right; **every client surface absorbed its refusal into a message
that meant something else**, and the one sentence written to explain the refusal
had no readers at all.

**🚨 A PUT-AWAY REFUSAL REACHED THE GUEST AS A CONGRATULATION.** The route
answers `409`, and the guest camera reads *every* 409 as "you are out of shots":
it called `setRemaining(0)`, which disables the shutter for the rest of the
session, and painted *"That's all {total} photos, {guestName}! … They'll treasure
these."* over a photo that had been refused before it was ever stored. With guest
buying on, the "Add shots" sheet then auto-opened and offered to sell them more
shots that also could not be taken.
🔑 **A REFUSAL THAT REUSES ANOTHER REFUSAL'S STATUS CODE INHERITS ITS COPY.** The
status field is what separates them, so it has to be asked FIRST. Both capture
sites in that file are fixed, and the guard asserts the ordering **per
occurrence** — a check on the first index alone passes while the second is wrong,
which is exactly how this shipped.

**🚨 THE SEAT CAMERA QUEUED SHOTS THAT COULD NEVER LAND.** `event_put_away` was
missing from `PAPIC_TERMINAL_ERRORS`, so a refused shot fell to the queue branch,
where the optimistic count is deliberately NOT rolled back ("ownership transfers
to the queue — the shot WILL land") and the photographer is told *"A shot will
finish uploading once you're back online."* They are online. Every drain replays
presign → R2 PUT → the same refusal, up to 50 times, until the 7-day TTL evicts
it silently. They finish the night believing they captured dozens of photos that
do not exist. The generic terminal copy was wrong too — *"tap it in the roll to
retry"* instructs somebody to retry what can never succeed.

**🔑 THE SIXTH GATE WITH NO HANDLE, IN A NEW COSTUME: THE COPY.**
`EVENT_PUT_AWAY_CAPTURE_COPY` — written deliberately client-side so a surface
could render it, and even naming the way back — was imported by **nothing**.
Declaration and re-export only. A refusal nobody can read is the same shape as a
switch nobody can press. It now has three readers, and a guard that asserts they
exist.

**⚖ THE GATE WAS SCOPED TO A SKU ALLOW-LIST.** It sat inside `if (cameraTier)`,
so a seat outside `PER_CAMERA_SKUS` (the legacy `PAPIC_SEATS` pack) skipped it
entirely, while the function's own docblock claims the rule covers
`recordSeatCapture` unqualified. Latent, not live — checkout refuses that retired
SKU — and hoisted anyway.
🪤 **The existing position test could not see it.** Asserting
`indexOf(gate) < indexOf('if (!unlocked)')` is satisfied by the buggy placement:
an ORDER check says nothing about which conditional you are nested inside. The
new guard measures **indentation**.

**🛡 TWO GUARDS PINNED A SPELLING; BOTH NOW ASSERT THE RULE.** The existing
`live-wall-guest-mirror` assertion pinned `.select('live_photo_wall_visibility')`
exactly, so widening that same select to add `archived` — same query, same keys,
no behaviour change — **reddened CI**, and this PR's own two new pins reproduced
the identical cause. All three are re-anchored inside the select string literal,
which keeps the property that made the original valuable (a column merely
MENTIONED in the type cast still fails) while surviving column order and extra
columns. Measured: `.select('event_id')` fails, `.select('*')` fails, the
near-miss `live_photo_wall_visibility_backup` fails, and a
behaviour-preserving reorder-plus-rename passes.

🪤 **TWICE IN ONE SESSION A GUARD'S MATCH WINDOW SHRANK BECAUSE SOMEBODY
DOCUMENTED THE CODE.** A `[\s\S]{0,600}` window between two anchors failed against
correct code once the explanatory note was written between them — `stripComments`
blanks a comment while preserving its length. Both are re-bounded by what the
thing IS (slice to `]);`, slice by brace) rather than by a character budget.

Seven mutations across both guard files, each measured by occurrence count, all
red; baseline green before and after.

SPEC IMPACT: None.
