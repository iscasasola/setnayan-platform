## 2026-08-28 · feat(event-hub): a supplier working two celebrations in one day can step between them

Design § E, and the last unbuilt piece of the supplier's room:

> *"A caterer with a morning christening and an evening reception has two rooms
> at two addresses — **and no time to hunt for links mid-service.**"*

On the day, the desk now carries one line — the shop's OTHER celebrations
running today, each a tap away at its own address. On every other day it carries
nothing: *"you are also at"* is not a fact anybody is about to act on in March,
and the design puts the line inside the live room.

### 🔒 Why it is a database function and not four lines in the page

The rule the whole desk is built on: **`/{slug}` renders with the SERVICE ROLE**,
so every policy keeping a supplier out of somebody's guest list is inert there.
*Authorization may be answered the admin way, scoped by an id the session proved;
**event content never is.*** A bridge is event content — another celebration's
name, day and address.

🪤 **AND THE TEMPTING REUSE IS EXACTLY THAT MISTAKE.** `fetchVendorRoomEvents`
already answers almost this question, is already tested, and **opens
`createAdminClient()` internally.** Right for the vendor dashboard; inside a
guest-facing page it would put every other celebration's name through the one
client this loader has a guard forbidding it to import. So the database answers,
from `auth.uid()`, and nothing is trusted from the caller but which room they say
they are standing in — which is itself checked before anything is returned.

### ⛔ The narrowing that is the whole point

`get_vendor_event_brief` resolves the caller's shops as *profiles owned* UNION
*`vendor_team_members`*. **This function deliberately does not union that table.**
Today only a profile owner can reach a desk at all, so owners are the exact set
of people who can be standing in one of these rooms — and the design says why it
matters:

> *"the shop's admin sees both; an agent granted only the christening **never
> learns the reception exists**."*

A bare team-membership union is shorter, looks equivalent, and would tell every
teammate about every booking the shop holds — the shape the owner ruled against
when he kept grants per-event. **A db test asserts the teammate gets nothing and
the owner still gets their second booking**, so the narrowing cannot be mistaken
for "nobody gets anything", and any later migration that widens the live function
fails that test rather than passing quietly.

### What it discloses

Nothing new. The name, day and public address of celebrations this caller is
already booked on — every one of which the brief already hands them and their own
dashboard already lists. It moves an existing fact to where the work is.

⚖ **`p_day` comes from the app because the database does not know the venue's
clock.** A caller passing another day learns only about their own bookings on it.
What the parameter must never do is decide *who* the caller is; that is
`auth.uid()`.

🔑 **A DAY, NOT A START DATE.** `event_date <= p_day <= COALESCE(end, date)`, so a
celebration spanning several days bridges on every one of them — anchoring on
`event_date` alone would hide the reception from a caterer working day three of a
festival, the same first-day-only mistake the desk's opening rule had to be
taught out of.

### Measured

* **9 db tests against the real replay** (the leak cases, the middle-day case,
  the closed-out case, the signed-out case) and 3 new source assertions.
* **7 mutations, occurrence counts before → after, all 7 red** — including
  pasting the teammate union in, dropping the booked-in-this-room premise,
  admitting a shortlisted link, and anchoring on the start date.
  🪤 Two first read as "did not land": one marker spanned two lines and `grep -F`
  is line-based, and one sabotage produced a SQL syntax error rather than a
  behavioural change (10 failures, which is a broken function, not a refutation).
  Both re-run properly. *A red suite is not automatically a guard working.*
* The function's column list was **proved against production first** — the
  equivalent SELECT was run there read-only before the migration was written, so
  the PGlite replay is not the only thing that has seen these columns. (The
  `manpower_gigs` drift is the reason that matters: the replay builds from the
  repo file and can agree with a table production does not have.)
* Clean typecheck; full db suite and unit suite green.

SPEC IMPACT: closes the last outstanding item of `Vendor_Room_Design_2026-08-26.md`
§ E. A `DECISION_LOG.md` row is appended.
