## 2026-11-07 · fix(search): "band" never leads to Cake — a word or a prefix beats a letter run, and a typo needs a real one

The one shipped service ranker (`lib/taxonomy-search-rank.ts` — the sign-up service picker, Explore, Admin ›
Categories, the Maker's trade search all call it) is fixed in place; no new ranker.

- **Ranked tiers, highest first:** the label/alias IS the query → starts with it → a WORD of it starts with it
  ("cake" → Wedding Cake) → a word of the canonical KEY starts with it → contains it mid-word ("Crepe Pancake") →
  the key contains its snake form → squashed match **from a word start only**. Before, "cake" ranked Crepe Pancake
  Station above Wedding Cake (both "contains", alphabetical tie) and the squashed tier matched letter runs ACROSS
  words ("mc" → Ice Cream Cart).
- **Close matches (typos):** no fuzzy under 4 letters; 4–5 letters = 1 edit with the same first letter; 6–7 = 1
  edit; 8+ = 2. Filler words ("and", "of", "the"…) never match. Before, "band" was a close match for any
  "Cakes **and** Pastries" (one dropped letter from "and"), and "catring" reached "Choir String Quartet".
- **#7355 (taxonomy v2) renames `live_band` to "Music"** — the key-word tier keeps "band" / "live band" finding it.
  No synonym is written into code; aliases stay in `canonical_service_aliases` (Admin › Categories search words),
  which the open-shop picker already passes in. No alias rows added.
- **Guard:** `apps/web/lib/band-never-leads-to-cake.test.ts` — query → expected top (band, live band, dj, cake,
  photo, video, host, mc, emcee, lechon, florist), typos (catring, bnad, fotographer), query → must-never-appear
  (ranked or close) against the real taxonomy plus three hostile labels, the #7355 "Music" relabel, the alias path,
  and a source read that the ranker carries no trade-word literals. `closeMatchBudget` test updated to the new rule.

SPEC IMPACT: None — search behaviour only; no ruling changed.
