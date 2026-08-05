## 2026-08-05 · fix(guest-site): after the wedding, the site no longer disappears

Same defect as the Save-the-Date wall fixed earlier today, in the other direction. That one covered the site **before** the wedding; this one stripped it **after**.

The comment that lived here said the quiet part plainly — *"today's editorial phase strips the whole site."* With `openBrowse` false, which is **every real event**, that stripping was the shipped behaviour, and it silently disabled four things the couple had already set up:

- **The guest's tagged-photo gallery.** The loader deliberately keeps it alive after the day so guests can save their pictures; the section that renders it was never mounted.
- **The notice warning an account-less guest their photo access is closing.** Its only mount is in that body and its condition is exactly this phase, so it could **never render** — the guest lost access about a day after the wedding and was never told it was coming.
- **Five widget types a couple can switch on FOR after the wedding** — `your_photos`, `our_photos`, `special_message`, `our_love_story`, `tier_comparison`. Configurable in the editor, shown to nobody.
- **A thank-you message written for the people who came.**

One flag was answering two questions: *"may this visitor browse the new open site?"* and *"does this visitor get a site at all?"* Only the first is what `openBrowse` decides. The editorial cover still leads — nothing about the archive changes — the site simply persists below it.

**Mutation-verified:** restoring the cover-alone branch fails with *"it strips the guest gallery, the closing-access notice, and the five widget types a couple can switch on for after the wedding."*

Verified: 6515/6515 unit tests, `tsc --noEmit` clean.

SPEC IMPACT: None — this is the council's own §5.1/§5.2 shape ("editorial leads an ARCHIVE"), previously reachable only behind a flag no real event had.
