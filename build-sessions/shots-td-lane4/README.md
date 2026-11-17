# Lane 4 shots — the event-day and after-the-day Home (Now beside Proposed)

**These are LAYOUT-HARNESS shots, not the live app.** A cloud session has no database, so the real Home cannot render
its day-of or after state. `gen.py` builds the page from the REAL wrapper class lists (Now = `origin/main` @ 2524ccec,
Proposed = this branch) and the real shell padding (`px-4 sm:px-6 lg:px-8`, rail 72px from 701 and 240px from 1280).
Each component is a labelled placeholder tile. The CSS is the repo's own `tailwind.config.ts` compiled over `app/globals.css`.

- `*-390.png` — the phone: **pixel-identical** in both states (checked with an image diff, and written in the header).
- `*-768.png` — from the `tab:` line: the wide column, one stack with a gap; the Watch opens on arrival.
- `*-1280.png` — from `lg`: a second column is added; the planning tools span both.

Re-shoot: `python3 gen.py`, compile `out.css` with the tailwind CLI, then `node shoot.cjs` (Playwright, scale 2).
A real-data walk on a day-of/after event is still owed and needs a signed-in session against prod or a seeded preview.
