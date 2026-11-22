## 2026-11-19 · fix(supplier): the audit's MEDIUM findings — a refused read is said, never drawn as an empty list or a switch that's off

From the supplier dashboard audit (closed PR #7934), re-measured against main on 2026-11-19.

**Dates (Clients › month)**
- **D-4** — a refused waiting-list read said "Nobody waiting." and hid the notify button. `fetchVendorWaitlistRead` keeps the outcome; the fold says "Couldn't load who's waiting."
- **D-5** — a refused pools read told a shop with schedules to "Set how many events you take a day". The list reads `fetchVendorPoolsOrNull`; unread is said.
- **D-6** — `pickWaitlistCouple`: a refused cap count (`count ?? 0`) let a pick past the cap, and a refused next-couple read said "No one is waiting". Both fail closed with "that didn't go through".
- **D-8** — a thrown month read (‹ ›) went to the error boundary and replaced the whole Clients screen. It is now the same "unread" month as a refused one.

**The picked client**
- **C-3** — a refused plan read told a paid shop "Media files come with Pro" (forms, on both the client page and Shop › Forms Maker). Unread draws no lock; the server still re-checks.
- **F-1** — no library read gave "No suggested forms for this service yet". Now "unread".
- **C-4** — refused challenges / shared-photos reads said "No challenges yet — write your first one" and "No shared photos yet". They return null on a refusal and say so.
- **C-5** — a refused own-submissions read hid "Already on their editorial" and offered the full allowance. Unread is said and no room is offered.
- **C-7** — a thrown remove left "Removing…" spinning with every button disabled, and `{ ok: false }` was dropped. try/finally, and a refusal is said.
- **C-6** — a refused sign-off read hid an open sign-off ask. It is said.

**Shop and Services**
- **S-6** — a refused auto-reply read drew both switches OFF, and a re-save turned them off for real. Unread draws no switches ("Couldn't load your auto-reply settings").
- **V-4** — a refused inclusions / discounts read drew every card with none. `fetch…ByServiceRead` keeps the outcome; one line over the cards says so.
- **V-5** — a refused stay-on read drew nothing, so every "On hold" tag pointed at a `#stay-on` that wasn't there. It now says so under that anchor.
- **V-6** — a refused halls read made a venue card's "Uses" row vanish. It is said.
- **V-7** — `addCoverageForCard`: a refused taxonomy read became "That kind is not one couples search by yet", and a refused plan read could give a founder a wrong "bigger plan" line. Both now say the check could not be made (nothing is added either way).
- **V-8** — "…or request it under Tools" pointed at a removed view. It now links the request page (`SERVICE_REQUEST_NEW_HREF`).
- **V-9** — the destructive category ✕ was 16 px wide. Its press now reaches 44 × 44 (the drawn circle is unchanged), and the current breadcrumb is no longer a button that does nothing.

**Chat**
- **H-3** — a pax decline wrote its audit row even when the update was refused. Nothing moved → nothing is audited (the accept path's rule).
- **H-4** — a refused suppliers read drew "None yet" on the Customer card. Unread (null), as the thrown path already was.
- **H-5** — a refused event read gave the answer line "No date yet". No answer line then.

**Prints and Plans**
- **P-1** — while the badge facts loaded, or when they failed, the Verified · Rating · Badges switches were drawn OFF. They say "Checking…" / "Couldn't load" until the read lands.
- **P-2** — the Save links were 34–36 px tall. Their press now reaches 44 px (the drawn pill is unchanged).
- **L-4** — a refused scheduled-change / credit read priced "Today" without the held credit and hid a scheduled change. Unread shows no Today figure and says so.
- **L-6 · L-7** — "Cancel the plan" looked like a door and did nothing, and its 85-character line was cut at 390 px with the end date lost. It is a statement now ("Nothing renews by itself") that leads with the date.

Guard: new `app/vendor-dashboard/a-refused-read-is-said-not-drawn-empty.test.ts` (21 tests, all red against origin/main's sources, green here).

Not fixed here: **D-7** and **L-5** need the owner (Q2, a half-made purchase or booking). **V-2** is in open PR #7952. **V-10** is in open PR #7928 and is owner question Q1.

SPEC IMPACT: None.
