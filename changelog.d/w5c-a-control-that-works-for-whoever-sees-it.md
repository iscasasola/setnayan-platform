## 2026-08-24 · fix(hosts, live studio): two controls that refused, or told, the wrong person

**W5-C items 2 and 3. One rule, two screens:** never show somebody a control that
refuses them, and never withhold something the product already knows.

### The coordinator's "Edit this site" was a dead end

`buildOwnerRibbon` linked to `website/editor` unconditionally, and the owner
capability admits a `coordinator` member and **every accepted delegate** — while
`website/editor/page.tsx` redirects anybody whose `event_members.member_type` is
not `couple`. They pressed the button and were bounced with no explanation.

⚖ **Fixed by sending them where they can go, not by deleting the button.** The
guest site's only way back to the product is that link; removing it would have
been a second defect. The couple get **Edit this site**; every other host gets
**Open the planning desk** → `/dashboard/[eventId]`, which the event layout
already admits them to.

🔑 **It asks the SAME column the editor asks** (`member_type = 'couple'`), because
two copies of that rule is how the ribbon and the editor came to disagree about
the same person. `OwnerCapability` gains `maySiteEdit` — a **stricter** fact about
a host the database has already confirmed, consulted only after membership passed,
so it can only ever take a doorway away. **The editor's own gate is untouched and
remains the boundary.** An absent value resolves to `false`, the safe direction.

### During a broadcast the host could not see who held each camera

The controller said *"Phone joined · A phone holds CH 3"* on every channel — on
the screen a host reads **during the ceremony** to decide which camera to cut to.
Eight channels out, eight identical sentences.

🔑 **RULE 0 paid: the same gap was closed for Papic and the fix is copied, not
invented.** `crewHolderName` (`lib/papic-crew-roster.ts`) already solves exactly
this, fallback reasoning included. **No migration** — `claimer_user_id` has
recorded who since the seat was claimed; nothing ever joined it to a name.

⚠ **It has to be the service-role client.** `public.users` carries only
`user_owns_row` and an admin policy, so a host reading another person's row under
their own session gets **zero rows and no error** — indistinguishable from "nobody
holds this camera". The reader already runs as service-role for the seat table.

⚠ **"Someone" is correct, not a placeholder.** The camera join is login-free by
design (an anonymous session), so a claimed seat with no display name is an
ordinary state — and still strictly more than the screen said. An **unclaimed**
channel has no holder at all, never "Someone", or a host would go looking for an
operator who does not exist.

**Proof:** 7 new guard assertions + 4 new capability/ribbon tests; **6 mutations,
each verified to have LANDED before reading the result, each RED** — hardcode the
ribbon label (1→0) · drop `checkSiteEditing` (1→0) · one doorway for everybody
(2→0) · restore "a phone" (2→1) · move the name read off service-role (1→0) ·
drop the claimed guard (1→0). ⚠ The third mutation's **first** run printed 0→0 —
the count could not match, so its red proved nothing — and was redone against a
pattern that asserts it applied. Typecheck exit 0. Full unit suite 9844/9844.

SPEC IMPACT: None.
