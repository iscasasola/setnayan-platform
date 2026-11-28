## 2026-11-27 · fix(find): one name for Lights & Sounds, and an empty Find category says one line

Lane OLD-SMALL (MASTER-PLAN B18).

- **"Lights & Sounds", one name everywhere.** The taxonomy says "Lights & Sounds" (owner-approved `TAXONOMY_PH_FULL_2026-11-07.md`, `WEDDING_TILE_LABEL.lights_sound`, the live `service_categories` label). Find read that, while other screens typed "Lights & Sound".
  - It was a bug, not only a word. The Hub-tools seed (`lib/hub-tools.ts`) and the Toolkit templates (`lib/toolkit-templates.ts`) match by name, so a Lights & Sounds supplier got the "Everything else" tools, and no payment-plan template read as "for you".
  - Also changed to the one name: the plan group, the vendor-category label, the onboarding picker, the Today/checklist/wizard task titles, the inspiration-slot lines and the supplier-print "suits" lines.
  - Guard: `lib/lights-and-sounds-is-one-name.test.ts`.
- **An empty Find category says one line** (owner R3: no explaining copy). The line is "No {category} supplier on Setnayan yet." (`findNoneListedWords`, `lib/explore-info-copy.ts`).
  - The open category on Find had three empty lines; now it has one. "Nobody asked yet." is gone, an empty "Liked ideas" draws nothing, and there is no list heading over nothing. Its action stays the thumb row's ＋, Find's one add (owner 2026-10-13).
  - The search sheet no longer promises "we'll show them the moment they join".
  - The category page drops "Check back soon" and gains one "Add your own" button. It opens the category on Find (`routes.dashboard.vendors.findCategory`).
  - A brand-new event's Find says "No suppliers yet." without the explaining paragraph.
  - Guard: `vendors/find-empty-is-one-line.test.ts`.
- **Not in this PR:**
  - The 3D booth sign (`plan3d/kit/booth-templates.ts`) sits beside the seat plan, so it is handed to the NEW account.
  - Database rows that still say "Lights & Sound": `budget_planner_config_benchmarks`, `planning_deadlines`, and checklist tasks already saved on events. They need a data migration, which this lane does not add.

SPEC IMPACT: None. The corpus taxonomy already says "Lights & Sounds", and owner rule R3 is logged (DECISION_LOG 2026-11-27).
