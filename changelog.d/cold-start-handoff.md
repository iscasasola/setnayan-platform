## 2026-08-07 · docs: a self-contained cold-start handoff — the owner is continuing on a NEW Claude account

`~/.claude/.../memory/` does **not** travel between accounts or machines. Everything a fresh session needs is now committed.

**New:** `HANDOFF_RESUME_2026-08-07.md` — verified prod state, the live URL decision, the logo debt, the retention model, the owner-only list, and **every trap inlined rather than linked**, because the linked notes will not exist.

`HANDOFF.md` now points at it (that file was last touched 2026-06-15 and does not know what shipped since).

**Compiled from a verified sweep — 93 candidates gathered, 86 confirmed still open, the rest dropped as already done.** Being handed already-done work is the owner's repeated complaint; each item was checked against live site → shipped code → prod DB before it earned a line.

**Two corrections the sweep made to my own first draft:**
- The **booking fee needs TWO switches**, not one — the feature switch is ANDed with a separate "payment rail is live" switch, and the rail one is off, so setting only the first charges nobody.
- **Eleven processors**, not nine, and the list was reconciled on 2026-08-06 — every one still reads `dpa_on_file: false`.

**Also fixed: five places where the auto-loaded corpus `CLAUDE.md` contradicted shipped code**, which is worse than silence because a cold start reads it first and acts on it:
- *"Don't auto-delete photos within 5 years… we match"* — **false**. Originals drop at **6 months from first capture** and the sweep is default-ON. The live `/privacy` page had already been corrected; this file had not.
- The RA 10173 bullet still said "5-year retention" for photos (it applies to messages).
- **Two** places still capped table-tag fan-out at 10, including a pitfall instructing engineers to *"alphabetize by RSVP'd name and truncate"* — the owner removed the tag limit entirely on 2026-08-06. **Exactly the failure that decision was about: the ruling reached one line and not the others.**
- *"the 0% commission line… is now FALSE"* — the owner reversed that on 2026-08-06 (*"this is not commission. it is a syncing fee/booking fee"*), and the same file already said so 80 lines later. **A file that contradicts itself is read from whichever half you land on.**

SPEC IMPACT: corpus `CLAUDE.md` — cold-start block added; five stale claims corrected in place.
