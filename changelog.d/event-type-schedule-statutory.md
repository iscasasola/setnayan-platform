## 2026-06-24 · feat(event-type): gate the PH-marriage statutory content to weddings — iteration 0053 Phase 4 (Unit 1)

Stops a **non-wedding event** from showing wedding-only statutory content (spec `0053_event_type_engine`). Today a birthday/debut/etc. event wrongly surfaces PSA/CENOMAR/marriage-license deadlines on its Schedule **Preparation agenda** and Home **"Needs you"** stream, and a full "Your wedding paperwork" checklist. **Weddings are byte-identical** (2-lens adversarial verify: ship).

The lever is the Event-Type Profile's statutory pack: `WEDDING_PROFILE.statutoryPackKey === 'ph_marriage'`, `GENERIC_PROFILE` = `null`. Wedding is the only type with a statutory pack, so the gate is equivalent to `event_type === 'wedding'`.

- **`lib/preparation.ts`** — `FetchPreparationInput.statutory?: boolean` (defaults `true`); statutory milestones computed only when `statutory`. Builder + `STATUTORY_MILESTONES` unchanged; payments/meetings/manual sources untouched.
- **`lib/upcoming-items.ts`** — `FetchUpcomingItemsInput.statutory?: boolean` (defaults `true`); the Home document-deadline source gated likewise.
- **`schedule/page.tsx`** — resolves the profile and passes `statutory = profile.statutoryPackKey === 'ph_marriage'`.
- **`upcoming-schedules-async.tsx` + `dashboard/[eventId]/page.tsx`** — thread the flag to the Home stream (mount passes `event_type === 'wedding'`, the exact equivalent, no async on the hot page).
- **`paperwork/page.tsx`** — non-wedding events early-return a neutral "no government paperwork checklist" page (points to Documents); the wedding render is untouched.
- **`paperwork/actions.ts`** — `seedPaperworkForEvent` hard-blocks writing marriage rows for a non-wedding (defends a crafted POST).
- **`schedule/actions.ts`** — defensive `event_type` guard on the dead `seedDefaultScheduleBlocks` (zero call sites; prevents a future wiring from injecting a wedding timeline into a non-wedding).

`statutory` **defaults `true`**, so any un-updated caller stays wedding-safe (verified: the only other `fetchUpcomingItems` caller, `MoneyAndUpcomingAsync`, isn't mounted anywhere live). No migration. **Deferred to Unit 3 (terminology):** the wedding-literal *copy* (schedule header/empty-state, documents-page title).

**Verify:** `pnpm typecheck` clean · `pnpm lint` clean (no flagged files) · unit suite **396/396** · 2-lens adversarial review → **ship** (one documented low-severity latent-coupling note: the schedule page gates on `statutoryPackKey` while home/paperwork use the equivalent `event_type === 'wedding'` — identical under the current single-statutory-profile config; not a wedding regression).

SPEC IMPACT: Iteration 0053 Phase 4 Unit 1. Logged in `DECISION_LOG.md`. [[project_setnayan_event_type_engine]]
