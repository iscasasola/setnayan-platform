## 2026-07-15 · feat(home): the Alaala bento — obsidian Life-Flash tile with lenses · The Watch · Spaces rows

Second owner review pass ("doesn't look like the prototype"): the polish (#3241) fixed the skin but not the COMPOSITION. This lands the prototype's bento:

- **AlaalaTile** (new) — the obsidian focal tile: "Alaala · Life-Flash" eyebrow, headline, real face-orb + who-line from the moment graph (fetched only when `NEXT_PUBLIC_LIFE_STORY` is on — no new query for flag-off envs), gold "Play Life-Flash" pill (flag-on only, no dead door), and the five **LENSES** (Recent · Owned · Attended · People · With me) — server-rendered bodies with REAL state (owned events list, real attended guest-membership count with graceful-null, face row, honest with-me line), swapped client-side by the new AlaalaLenses island.
- **The Watch** — "Setnayan AI · The Watch" tile: the summed needs-you total + per-event rows (busiest first) + "Everything else — quiet". Deterministic sums (Rule 1), same data as the hero stat.
- **Spaces** — the standalone card grid becomes compact rows in the bento's right column (SpaceCard → SpaceRow), plus a muted "Samahan · Communities — coming soon" note (communities are the next build; note, not a fake door).
- "This year" strip + Memories Hub Expandable continue full-width beneath; the strip's glass panel moved inside the component so the no-moments null never leaves an empty frame.
- The People Expandable is absorbed by the People LENS (face row + the same suggested/confirmed copy + coming-soon note); Memories Hub keeps its inline PhotosTab.

SPEC IMPACT: None new — full-fidelity implementation of the already-logged owner-approved final design (`User_Home_Redesign_Council_Verdict_2026-07-14.md`; DECISION_LOG 2026-07-15 rows).
