## 2026-09-17 · fix(guests): the add-guest form stops asking non-weddings which side

`/dashboard/[eventId]/guests/new` rendered a required **"Side \*"** (Bride / Groom /
Both) on every event type, and its server action refused with `missing_side`. On a
birthday, a wake, a corporate event or a Simple Event that question is nonsense — it
was the only reason the full add-guest form was unusable off a wedding, and the
documented workaround was "use the bulk-paste form instead".

The answer comes from the **event-type profile**, not a list of type names: the
profile already resolves a `RoleSet` per event, and a `RoleSet` already names the
side principals (`coupleRoles` = {bride, groom} for the two wedding sets, empty for
generic/simple). New pure module `apps/web/lib/guest-side-question.ts` turns that
into `eventHasSides()` + `resolveSubmittedSide()`; the form hides the select and the
action stores `side: 'both'` — the exact value `/guests/quick` has written since it
shipped. A **wedding is byte-identical**: still required, still refuses.

NO MIGRATION. `guests.side` stays NOT NULL with no default; a sideless event simply
writes the safe value in the application layer.

Guard: `apps/web/lib/guest-side-question.test.ts` executes both directions and pins
the two `server-only` call sites.

SPEC IMPACT: None.
