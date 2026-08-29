## 2026-08-30 · feat(papic): the couple names guests and sets the numbers

Session **S3** of the shots-per-guest program (`WHATS_NEXT_Shots_Per_Guest_SESSIONS_2026-08-28.md`,
spec § 6a). S1 merged as PR #5002; **S2 — the storage and the gate — is being built in parallel.**

⛔ **THIS MUST NOT MERGE BEFORE S2.** Gate the write, not the button. A control that saves a number
nothing enforces is the `papic_uploads_open` defect this tree has already paid for once. Auto-merge
is deliberately NOT armed on this PR.

### What landed so far

- **`lib/papic-guest-allotments.ts`** — the split, written once: named guests first, everyone else
  divides the remainder equally, the indivisible remainder is spare. No imports, so the guard can
  EXECUTE the rule rather than match its text (same discipline as `papic-guest-cap.ts`).
- **`ALLOTMENT_STORAGE`** — every column name this feature writes, collected in one object, so
  adopting S2's real names is an edit to one file instead of a half-landed rename.
- **Sponsors default to a bigger share** — a role MULTIPLIER (principal 3×, cord/veil/coin/candle
  2×) over the ordinary share, never a hard-coded amount: "give a ninong 60" is extravagant at a
  40-guest civil ceremony and insulting at a 400-guest reception. It is a suggestion the couple
  edits, and a saved number always wins.

### Three findings that changed the work

1. **The vocabulary moved under the spec.** `32df56e81` (2026-08-29) made the currency unit a
   **credit** everywhere a customer reads it. The spec says "shots" throughout. Currency copy now
   reads credits — but a **photograph is still a shot** ("take the shot", "Next shot", the vendor's
   shot list were deliberately untouched), so this is not a sweep.
2. **`points` on the wire, `credits` on the screen** — an existing deliberate convention (212
   `points` occurrences in the migrations against their own "credit" comments), not drift. The
   contract module is where the translation lives, and it says so.
3. 🚨 **Three numbers call themselves "per guest", and two of them are 150.**
   `papic_event_pool_config.points_per_guest` (default 150) SIZES the pot —
   `pool = clamp(guest_count × points_per_guest, floor_points, ceiling_points)`.
   `GUEST_CAPTURE_CREDITS = 150` is what one guest may SPEND. They are different quantities holding
   the same value, so they have never visibly disagreed, and the pool migration's own comment
   conflates them outright (`20270826385580:20`). This control adds a **third** per-guest number,
   and the moment a couple sets it to anything but 150 all three diverge. The copy therefore never
   says a bare "per guest", and a guard asserts it.

### Proof

- **TESTS:** `lib/papic-guest-allotments.test.ts` — 8 tests, 8 passed, 0 failed (non-zero).
- **MUTATION:** 9 sabotages, every one RED, occurrence counts before → after:
  `Math.floor→Math.ceil` 1→0 (4 tests red) · blank-box-collapses-to-zero 1→0 · over-commitment
  clamped 1→0 · explicit number uncapped 1→0 · `principal: 3→1` 1→0 · `credits each`→`shots each`
  2→0 · storage borrows `points_per_guest` 1→0 · unnamed=0 early return deleted 1→0.
  ⚠ Two sabotages first reported GREEN and **both were broken sabotages, not surviving guards** —
  one perl escape never landed (before=1 after=1) and one replaced a docblock instead of the code
  (before=2 after=1). Re-run properly, both are RED. This is why the count is printed.

### Corrections to the corpus

- `WHATS_NEXT_Papic_Build_Order_2026-08-29.md:154` says nothing acts on `lib/event-sponsors.ts`.
  **Measured on origin/main: four non-test importers** — `sponsors/page.tsx`, its `actions.ts`,
  `add-sponsor-modal.tsx`, `pair-target-picker.tsx`. There is a shipped sponsors dashboard and the
  roles are real, user-authored data. Routed to the corpus owner.

SPEC IMPACT: The build order's "Nothing acts on it" claim for `lib/event-sponsors.ts` is false and
is being corrected by the session that owns that document. The shots→credits vocabulary shift needs
applying to both `WHATS_NEXT_Shots_Per_Guest_*` files, whose copy examples still read "shots".

### Next concrete step, if this session ends here

The sheet itself: a `SettingRow` in "Set once, change any time" wrapping the switch, the number for
everyone else, the guest picker, the live summary line and the "open the rest to everyone" button.
Copy `uploads-open-choice.tsx` exactly — including its absence rule (`eventPapicGuestActive` → the
row does not render on a celebration where guests cannot shoot). Outcome params must be
`allotment_set` / `allotment_error` — **`shots_set`/`shots_error` are taken by `setCameraShots`** —
and wired THREE ways or `outcomes-are-shown.test.ts` fails: the searchParams type, the render, and
the banner bail-out. Raise that guard's `KEYS.length >= 19` floor to 21 deliberately.
