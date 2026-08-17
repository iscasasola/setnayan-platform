## 2026-08-17 · feat(doors): one designed door for every way into Setnayan

Ten token-gated entry pages — the Alaga claim, the supplier claim and its
finalize step, the four `/join` steps, both Papic doors and the Samahan
invite — carried **six different hand-rolled page wrappers** between them, plus
a local `Shell()` re-declared independently in four files. Each was reasonable
alone; together a guest, a supplier and a photo-crew member each met a
different product before they ever got inside.

They now render through one `<DoorShell>`, which reproduces the register the
app already locked for the one door that WAS designed — the sign-in card
(`.sn-signin-terra`): paper card, 3px terracotta top edge, terracotta eyebrow,
exactly one terracotta action, and the wordmark as the way out.

**A real AA failure fixed on the way.** In this repo the Tailwind slot named
`terracotta` is the atelier GOLD `#A9834B`; the CTA terracotta `#C24E25` lives
in the slot named `mulberry`. The names are inherited and backwards, so
`text-terracotta` looks like the safe brand colour and is the unsafe one.
**Ten eyebrows and inline links across the doors were painted in it — measured
3.37:1 on cream, below the 4.5:1 AA floor.** Now 0. Gold on an ICON is left
alone (3.37 clears the 3:1 non-text bar). Same defect family as design#6's
`#9A8F86`.

`DoorShell` also splits **threshold** from **dead end**: an expired or revoked
link does not wear the action colour, because painting "act on me" on a screen
with nothing to act on is a lie told to somebody who has just been refused.

New guard `doors-are-designed.test.ts` (7 assertions, mutation-checked with
occurrence counts) pins: no gold text on a door · no door hand-rolls a page
wrapper · a positive control that the shell is actually imported · the shell
keeps the locked action colour, the neutral dead-end edge and the way home.

⚠ **Two claims in the brief did not survive checking.** `/login` is NOT
undesigned — it already renders the owner-locked shared sign-in card
(2026-07-18 "we only want 1 login"), so it is untouched. `/signup` is not
undesigned either: it is a full two-column marketing-register page. And the
brief's 12-file scope OMITS `/forgot-password` + `/reset-password` while
promising "resetting a password" — both exist and are left in their (coherent)
marketing register; moving them is a product call, not a port.

SPEC IMPACT: None — visual/port only. No schema, no flags, no copy decisions
beyond type-neutral nouns already ruled on (2026-07-31 "the couple" is wrong on
15 of 16 event types).
