## 2026-11-23 · chore(labs): film-ready lab states, invented names only

Dev-only lab changes used to film the six front-page loops (owner: "Yes, film the six"). Nothing outside `apps/web/app/dev/` changes.

- `budget-lab`: `?state=film` adds an expense and shows the "Added · totals updated" notice on a window event (`LabBudgetFilm`, `labFilmMoney`).
- `guests-lab`: `&faces=1` gives most guests a profile photo. The 18 faces are AI-made, of people who don't exist (`lab-faces.ts`).
- Real-looking names are replaced with invented ones, as the owner asked: "fake names, fake suppliers … just to be safe".
  - In the suppliers, budget and guests labs: a real venue, a real church, two common shop names and one public figure's name.
  - In the bar-lab Memories shop names.
  - Display text only; ids are unchanged.

SPEC IMPACT: None. Lab files only; the clips are not wired into the front page.
