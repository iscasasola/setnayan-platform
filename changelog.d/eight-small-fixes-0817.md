## 2026-08-17 · fix(day-of,papic,vendors): eight small fixes, each verified against origin/main and production first

Eight items from the owner's 2026-08-17 list. Every one was re-verified against
shipped code and the live database before being touched; one was measured to be
narrower than reported and one turned up a live save failure nobody had filed.

1. **The host could not see who was holding which camera.** "Your photo crew"
   rendered a Claimed/Open pill and the sentence "A friend has this seat" — no
   name, no shots left. It now prints the holder's name and how many shots that
   camera has left. The name read is service-role and scoped to the claimers of
   THIS event's seats, selecting the display name only (never the email beside
   it) — `public.users` carries only `user_owns_row` + admin, so a couple's own
   session reads **zero rows and no error**, which would have rendered as
   "unclaimed" and looked fixed. Shots-left comes from
   `papic_camera_points_remaining`, verified EXECUTE-granted to `authenticated`
   in production; its INT_MAX "uncapped" sentinel is never printed, and a failed
   probe stays silent rather than rendering 0 ("out of shots" on a working
   camera sends a host to fix nothing).

2. **A supplier could only tap six fixed messages.** `submitDayRequest` already
   shipped and already filed on the vendor lane; only the coordinator's inbox
   ever mounted a free-text box. A plain supplier now has one. This is wiring,
   not a new feature — the lane is still derived from the caller's own side, so
   a supplier cannot post as the coordinator. The component docblock claiming
   "nothing here can post arbitrary text" was a limitation being read as a
   security property; corrected.

3. **The emcee vanished when booked inside a bundle.** `fetchEmceeRecipients`
   hardcoded `serviceCategories: null`, so a band who also emcees summarised to
   "band" and the coordinator's whole "Tell the host" section rendered nothing —
   a wedding with a host reading as a wedding with none. The fetcher now does
   the second read. It takes its own injected reader because `vendor_services`
   is RLS-readable only for PUBLISHED shops and `event_vendors` only for the
   couple and moderators, so reading either under the caller's client narrows
   silently. Union-only: it can add a recipient, never remove one.

4. **Suppliers were told they could set their date-hold limit.** They cannot —
   `max_soft_holds_per_date` has zero writers, and the column comment named
   `/vendor-dashboard/settings/availability`, a route that has never existed.
   **Corrected both comments rather than building the control**; the DEFAULT 3
   and 1-20 CHECK are retained so a control can be added later without a
   migration. Migration `20271145888075` (comment only — no data, no default, no
   constraint touched).

5. **The old camera screen promised 3 free cameras above eight slots.**
   Measured before changing: the sentence is gated on the free tier, where the
   provisioning cap really is 3 — but seats also arrive from the unified
   controller one per bound channel, and the top-up never removes. Both
   production events holding camera seats hold **eight**, against zero orders.
   The count is now spoken only when the roster agrees with it; the watermark
   clause, which is always true, always shows.

6. **Every new shop was born saying it only serves ballrooms, gardens and
   heritage houses** — and the default NARROWS, because the read side is
   "is null OR contains{setting}". Migration `20271146556997`: default → NULL,
   and the seed trio backfilled to NULL (exact-array match only; it can only
   widen). **Also found while verifying: the shipped Wedding-fit card could not
   save "any venue" at all.** `parseCompatibility` returns NULL when nothing is
   ticked and both columns were NOT NULL — probed against production in a
   rolled-back transaction: **refused with sqlstate 23502**, and the action had
   no branch for that code, so the shop owner read a raw Postgres sentence and
   never saved. Both columns are now nullable; 23502 is mapped as a
   deploy-window guard. `compatible_ceremony_types` KEEPS its default — that
   opt-in is deliberate faith-sensitivity, not a defect.

7. **A photographer could only see their own shots on the wedding day itself.**
   The page mounted the "what you shot" strip and redirected away unless the
   booking was today, so at midnight the door shut on their own pictures. Never
   a permission limit: the row policy is "owns this profile OR admin" with no
   date condition. The gate splits — the shutter stays day-only, the gallery
   does not. The route's own feature flag is untouched.

8. **The silent refusal was real.** Confirmed, not assumed: the vendor client
   workspace passes `canAdvance` as a bare literal, so every booked supplier
   sees "Start next"; the server action narrows to host/couple ∪ delegate ∪
   booked coordinator ∪ admin and returns a refusal WITH a message — which the
   header awaited and threw away. A supplier pressed the button, watched the
   saving loader run, and the timeline did not move. The gate is correct and is
   NOT widened; only its silence is fixed. The header docblock said the booked
   vendor "is also allowed by the RPC", true of the database gate and false of
   the app-layer narrowing that actually decides; corrected.

Guards: `lib/papic-crew-roster.test.ts` (7) and
`lib/stage-notes-recipients-bundle.test.ts` (4, driving the real fetcher with
stubbed clients — a test over the pure picker cannot fail on this bug, because
the picker always accepted service categories). Both mutation-checked with
occurrence counts printed before and after.

SPEC IMPACT: `DECISION_LOG.md` row 2026-08-17 — the soft-hold limit is a
platform constant, not a per-vendor setting, until a control is built; and a
shop now starts making no venue claim.
