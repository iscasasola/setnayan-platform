## 2026-08-05 · fix(guest-site): the page below the Save-the-Date film gets its side margins back

**SPEC IMPACT:** None (layout).

The whole Save-the-Date phase runs `fullBleed`, and the shell's fullBleed branch
returns a bare `<main>` with no padded column — correct for a film that plays
edge to edge. But once the real site started rendering **underneath** that film
for every event, the site inherited the film's no-column treatment: every card,
heading and paragraph ran into both edges of the phone, and the rounded cards
looked broken at the sides.

**This was live on both real couples' pages.** A wedding more than ~90 days out
sits in exactly this phase — which is nearly every wedding, for most of its life.

The column is restored in `std-film-handoff.tsx`, wrapping `{children}`, using
the exact class string `invitation-shell.tsx` uses everywhere else so the page
reads the same before and after the film — a different column here would be a
visible jump at the handoff. Wrapping there rather than at the call site means
anything mounted beneath the film in future gets it too.

⚠ Deliberately NOT fixed by turning `fullBleed` off: that would put the Setnayan
header and footer back over a paid full-screen film.

Verified no double-padding — `site-body.tsx` carries no column of its own.
Guarded in `std-film-handoff.test.ts`, mutation-verified, including a check that
no second unwrapped `{children}` render appears.
