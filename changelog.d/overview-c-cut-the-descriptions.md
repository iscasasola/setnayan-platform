## 2026-09-22 · feat(overview): the page stops describing what is already on it

**PR 3 of the Overview redesign** (owner-approved 2026-09-22). The owner's complaint that started
this work: *"too much text, too many descriptions, and the flow of use is scattered."* PRs 1–2 fixed
the flow. This is the text.

Eight lines removed, every one of them describing something the reader can already see:

| Removed | Why |
|---|---|
| *"…each one links to its room"* | describes a link that is on screen |
| *"Choices only you can make — everything else keeps moving without you"* | the free-state twin; said nothing the heading does not |
| *"Nothing to decide — just what lands when"* | `Coming up · 6 dates` is the whole sentence |
| *"Your hosts, team, threads, services, and schedule — this is the doorstep"* | lists the five cards printed directly beneath it |
| *"Tap a stage — or use ← → — to walk through your wedding, start to finish"* | instructions for two arrow buttons that are on screen |
| *"N accounts can run this wedding — expand to see who"* | the header already says `Hosts · 1 account` |
| *"2 vendors booked — expand to see your team"* | the header already says `2 of 25 booked` |
| *"3 orders — expand to see them"* · *"N threads have unread messages — open to catch up"* | the count restated, plus an instruction for a visible disclosure |

🔑 **That last group is the shape the 2026-07-12 council already named** — *"a tile that only says
'3 of 21 booked · Manage vendors →' is a status label, not a doorstep."* The fix then was
auto-density; the preview LINE survived it and went on repeating its own header.

### Deliberately kept

- **Every endowed empty state.** *"No vendors booked yet — start with the ones that book out first:
  your venue and catering."*, *"All caught up — when a vendor replies, it lands right here."*,
  *"Nothing ordered yet — the Studio has everything for the day…"*, *"No program yet…"*,
  *"It's just you so far — invite your partner, family, or a coordinator…"* Council Phase 2 shipped
  these on purpose: they carry a fact and a first step. Each is asserted by name below.
- **The masking note** — *"never a personal profile"* is a privacy promise, not description, and is
  council-locked to appear exactly once. Untouched.
- **"Ranked by what closes soonest."** — trimmed 12 words → 5 rather than cut. The ordering is a
  real fact and it is one of Setnayan AI's appearances on the page; deleting it would have removed a
  Sai signal to save five words.
- **"Sai fires a few alerts a week at most."** It sets expectations about a paid feature rather than
  describing the screen. A judgement call, flagged rather than taken.

### Guarded
`lib/the-page-does-not-describe-itself.test.ts` asserts each removed line is absent **and** each
endowed line is present, by name, with counts printed — so a future edit cannot quietly delete a
hopeful empty state while trimming, which is the mistake this PR is one wrong grep away from.

Verified: full unit suite **17,804 tests / 0 failures, run to completion** · `tsc` ✅ · `pnpm lint` ✅ ·
8 guards ✅ including `lint-port-no-lost-controls` (no destination lost) and
`lint-no-engineering-notes-in-ui`.

SPEC IMPACT: None beyond the 2026-09-22 `DECISION_LOG.md` rows already applied.
