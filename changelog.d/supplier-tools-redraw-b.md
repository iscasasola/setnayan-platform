## 2026-11-21 · feat(supplier-tools): the tool pages redraw, part B — Attributes · Repertoire · Recommend · Segments + Questions

Part B of the owner-approved redraw (DECISION_LOG "11 SUPPLIER TOOL PAGES REDRAW — APPROVED (v3)"; drawing
`Setnayan-specs/prototypes/supplier_tools_redraw_2026-11-21/supplier_tools_redraw_v3_fable.html`), on part A's shared
pieces. Look only: every page keeps what it does, its words and the same server actions.

- **Attributes** — one row per service that opens in place (its fields and Save, the same `saveVendorServiceAttribute`).
  The top-of-page dropdown + Add is the thumb row's ＋, rising a searchable "Add another service" sheet (the same
  `?add=`). **Remove is a swipe left with Undo** (controller 21 Nov) — the same `removeVendorServiceAttribute`, written
  after the Undo window through its StayForm door. **The missing-fields notice names LABELS, not keys** ("Silhouettes,
  Fabric") — `attributes/_components/missing-labels.ts`, held by `attributes/the-missing-notice-names-labels.test.ts`.
  Required is a chip; Filter and "required if" live in the field's ⓘ. Saved / removed are toasts. The dev-only
  `canonical_service … schema vN` line, the Profile ID footer and the raw error block are gone; a failed load says
  "We couldn't load your services." with Try again.
- **Repertoire** — the set list and the library as rows (two columns on a computer, as shipped); a song opens in place
  to edit its video link; search is the thumb row's round icon (Enter searches, no match turns 🔍 into ＋ and opens
  "Add your own" with the words in it). Same actions; swipe-to-remove with Undo unchanged.
- **Recommend** — one line + ⓘ; each add-on opens in place (overlap note, "Why this helps you", Turn on/off, Suggest
  to a couple, Not a fit for me); the three small forms rise as sheets (✕ replaces Cancel). Shop ⚙ shelf line →
  **"Add-ons you'd recommend to your couples."** (controller 21 Nov).
- **Your segments + Questions for the couple** — the pinned row carries the night's length; each segment and question
  opens in place; "Add a segment" is the thumb row's ＋ (a sheet); Not offering / Not asking are folds; segments |
  questions side by side on a computer. The questions block stays the ONE shared component.
- Guards that read the moved code now read the screen files (`the-columns-are-the-system`, `service-picker-anchor`,
  the set-list swipe guard). Field-template baseline: Segments' four boxes became the house form rows (`TypedRow` · `ChosenRow`, −4);
  Repertoire's three became TypedRows (−3).

SPEC IMPACT: None — builds an approved drawing; the shelf line is the controller's ruling already in the DECISION_LOG row.
