## 2026-08-26 · feat(papic): the switch for whether photos may be added by hand

Owner 2026-08-26: *"a toggle will set if they will allow people to upload photos manually as well"* and *"uploading can depend on the toggle for photo upload."*

⛔ **IT WAS DELIBERATELY NOT BUILT UNTIL THE PICKER EXISTED.** A switch with nothing behind it is a gate with no handle — this codebase has found **five** of those, including a column that sat unread for seven weeks while the feature it controlled was believed to be running. Build the door, then the lock.

## ⚖ It defaults OPEN, and that is a stated choice

Papic's purpose is now *"the source where they collect media files for that event"*. A library that refuses the most obvious way to put something in it would be **closed against its own point** — and an upload costs a credit exactly as a shot does, so **an open door is not a free one**. A couple who wants only what was caught in the moment can shut it, and the off state says so on screen.

⚠ **Its siblings default differently, and that is not an inconsistency.** `papic_guest_capture_early` defaults FALSE because it hands a capability to **other people**, and a wedding must never quietly acquire one. `papic_vendor_challenges_enabled` defaults TRUE for the same reason this does: it governs something the couple already owns.

## What it governs today, and what it will

Today the only manual-upload path in the product is the couple's own picker, so this is the couple's switch over their own library. **When guests and suppliers gain an upload path, they read the same column.**

🔑 **AND THE SERVER MUST READ IT THEN, NOT JUST THE SCREEN.** Hiding the picker is enough while the only holder of the Uploads camera is the couple — a couple bypassing their own preference harms nobody. The moment somebody **else** can upload, **a hidden control is not a closed door**. This project has paid for that distinction: the live photo wall mirrored to every guest's phone while the only "off" switch closed the venue screens. **Gate the write, not the button.** The limit is written into the guard, not just the migration.

## Details that are not cosmetic

**⚠ An absent column means OPEN.** The column lands in this migration; on a pre-migration database the read falls back to `true` rather than closing the library's most obvious door on everybody because a column is not there yet.

**⚠ Two explicit buttons, never a flip.** A control that toggles *"whatever it last read"* lands on the **opposite** of what somebody pressed when the page is stale or they double-tap — and this one decides whether a wedding's gallery can be added to. The form posts the value it **wants**.

**⚠ The copy says what it costs.** *"Allow uploads"* reads like a free door; every upload spends a credit, and a couple deciding this should decide it knowing that. The **off** state says what it means too — a switch whose off position is unexplained gets left on.

**🛡 Guard `_lib/the-uploads-switch-is-real.test.ts`** — 6 rules: the switch exists on all three layers and **the control is MOUNTED** · **it actually governs the picker** · an absent column means open · **the control posts explicit intent and the action does not negate what it read** · the copy carries the cost and the off-state meaning · **saving it is confirmed, never silent**.

**Mutations**, counts printed before → after: the switch governs nothing (1→0) 🔴 · an absent column closes the door (2→1) 🔴 · posts no explicit intent (1→0) 🔴 · saves in silence (1→0) 🔴.

**Verified locally:** `tsc --noEmit` exit **0**, full unit suite **10,162 tests / 0 failures**, four lints pass.

**SPEC IMPACT:** None — under the purpose lock in `DECISION_LOG.md` 2026-08-26.
