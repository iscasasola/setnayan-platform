## 2026-10-24 · feat(home): Setnayan AI gets its own card, and every "needs a param" face opens its exact item (PR-E)

Owner-approved ("ok") `prototypes/home_control_center_2026-10-24_fable.html` (corpus 10067d39) — the second step of
its build plan. Stacked on PR-D (`rd/home-control-row`).

- **Setnayan AI's own card** (`home-cards/home-planner-card.tsx`, "Planner · Setnayan AI"): closed — "Sai on watch · N
  alerts" (or all quiet) and the top alert; grown in place — Sai on watch (the guard alerts Setnayan AI already raises
  for this event: `ai_guard_alert` · `ai_payment_due`, unread, each with its own door — `lib/home-ai-card.server.ts`) ·
  Your picks (the planner's own ranked decisions, `buildCockpitModel`) · "Open Setnayan AI ›" last. On a phone, a tile
  counting the alerts. A refused read is "Couldn't load", never "all quiet". **No Ask box**: nothing in the product
  answers a typed question yet — an Ask that sends nowhere would be a door to nothing.
- **Not added**: the slim line says "Try it" with no price (button "Try it"); on a phone, a "Not added · Try it" tile.
- **The four exact-item addresses** (the notes' "needs a param"):
  - Guests · can't come → `/guests?q=declined` (the search already read "declined"; now held by a test);
  - Suppliers · a quote to decide → `/vendors/<id>/workspace?tab=quote` (that supplier's Quote tab);
  - Checklist · a task → `/checklist#task-<id>` (`lib/checklist-anchor.ts`; the row wears the id, `:target` rings it);
  - Budget · a payment · Pay → `/vendors?part=budget&pay=<line_item_id>` — Suppliers hands `pay` to its Budget part,
    the page resolves the line to its supplier from its own ledger (`payTargetVendor`) and that Pay sheet opens.
- "Remind" (Guests · no reply) stays the no-reply filter: no reminder flow exists; no new email.
- Guards: `home-deep-links-land` (one test per address, both ends) · `home-ai-card-reads-honestly`.

SPEC IMPACT: None — builds the approved prototype; the Ask box is reported, not built (no assistant chat exists).
