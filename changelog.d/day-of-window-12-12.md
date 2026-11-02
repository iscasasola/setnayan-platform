## 2026-08-05 · fix(guest-site): day-of mode covers the actual wedding — noon before to noon after

Owner: *"needs to run 12 hours before and 12 hours after."*

The window was `T-1h .. T+8h` from midnight — roughly **11pm the night before to 8am on the day**. A Filipino wedding's reception is in the **evening**, so day-of mode was never on while the wedding was happening: no live photo wall, no day-of banner, no announcements, no "happening now". It switched itself off before the guests arrived.

**Now:** `live` runs `T-12h .. T+36h` — **noon the day before → noon the day after** — with `post` giving a further 24 hours to look back.

### ⚠ Why it is not literally ±12h from T

Midnight ±12h is **noon-to-noon**, which still **ends before an evening reception** and would have fixed nothing. The owner's "12 before and 12 after" is 12 hours either side of the **wedding day**, not of its first instant. Worth writing down, because the literal reading looks right and does not work.

### Why the date and not the ceremony time

A ceremony-time anchor is more precise and was the obvious idea — but **only one event in production has any schedule blocks at all**. Every other wedding would sit on a fallback, so the fallback would be the real behaviour. One rule off the date is simpler, needs nothing from the couple, and covers any reception time.

**Mutation-verified:** restoring `T-1h .. T+8h` fails with *"day-of mode is off during the reception — the photo wall, the banner and the announcements all stay dark while the wedding is actually happening."*

Tests pin the 7pm reception case, that **every hour** of the wedding day is live, and the exact edges (11am the day before is not yet live; 1pm is; 11am the day after still is; 1pm is over).

Builds on the same-day timezone fix — the anchor is midnight in the **venue's** zone, so this window is 12/36 hours around the couple's own day rather than the server's.

SPEC IMPACT: Answers the open owner question logged earlier today in `DECISION_LOG.md`.
