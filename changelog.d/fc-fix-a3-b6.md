## 2026-11-25 · fix(final check, area 3): failed reads are said, not drawn as empty (E-05, E-16, L-08, I-07, S-05)

From the final check of the staging copy (area 3, lane A). Each page below drew a refused read as a real answer.

- **E-05:** the Maker's "Show, hide & reorder" row reads "Couldn't read" instead of "0 showing"; the Story Maker says when its desk or its day's chapters could not load (the panel used to vanish); Our photos shows the error page instead of bouncing to Home.
- **E-16 (authors):** Stories about your day says "Couldn't read who wrote this" instead of "A Setnayan storyteller".
- **L-08:** Memory lane's counts draw "—" and its mode picker and Flash switch wait for a real read (they read "Auto" and ON); Live Watch's stats say "Couldn't read" and a refused YouTube read no longer offers Connect again (`fetchAddOnStats` gains `readFailed`); cameras, broadcast and the join-card print sheet say a refused read instead of "No cameras yet" / "no join cards".
- **I-07:** the invite panel keeps its requests door on a refused count ("We couldn't count the requests waiting for you"); the invitation print sheet shows the error page on a refused read (was a 404) and says "No guests to print yet." for none (was an empty sheet).
- **S-05:** the Mood Board says it could not load when its inspirations or sign-offs are refused; the playlist says when it could not read your picks or your booked DJ; Setnayan AI says it could not read your planning numbers instead of "0% booked"; guest columns says a refused read instead of "No one has written yet."
- **Left for the next batch:** L-02 rest and L-08 setup (in #8339's files), I-07's invitation / event-qr / QR look (in #8313 / #8357's files), N-08 (in #8313 / #8357's files), S-05's Patiktok and creator pages. **L-08 (owner ruling, Add 45):** on Camera operators a failed plan read says "We couldn’t check your plan, try again." (`PLAN_UNREAD`, lib/plan-unread.ts) and provisions no seats against a guessed tier — no paid limit is drawn from a failed read.
- Guard: `lib/area-3-failed-reads-are-said.test.ts`. No migration, no new server action.

SPEC IMPACT: None. Honest-state fixes on shipped pages.
