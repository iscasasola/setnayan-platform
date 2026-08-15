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
