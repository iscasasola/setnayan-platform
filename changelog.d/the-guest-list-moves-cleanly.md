## 2026-08-21 · feat(guests): the shell's top nav comes back, the frames come off, and you can add people we already know

Three things the owner asked for in one walk across the guest list.

**1 · THE TOP NAV WAS GONE INSIDE AN EVENT — and it was this page doing it.**
`app/dashboard/[eventId]/guests/page.tsx` injected `.shell-topbar{display:none}`
under a 2026-06-01 owner directive. That directive was correct **when it was
written**: `.shell-topbar` was then `SidebarShell`'s own event-tree strip, so
hiding it cost the page a duplicated event header and nothing else. The
one-shell move (2026-08-14/15) handed the **same class** the product's only top
bar — identity, the ⌘K palette, the unread bell, and the `AccountSwitcher` that
is this surface's only route to sign-out, profile and Setnayan AI. From that day
the rule no longer meant "no event chrome on Guests"; it meant **"no way out of
Guests", at every width**, because an injected rule carries no media query.
Nothing failed. The page simply had less on it.

🔑 **A directive is scoped to the thing it was written about.** The words did not
change; what they pointed at did.

Removed, along with the `-mt-6` and the safe-area top padding that existed only
to fill the hole it left. ⚠ **HALF THE BUG IS THE OFFSET, AND IT WAS TWO ELEMENTS, NOT ONE.** Both phone
stickies on this route were pinned at `env(safe-area-inset-top)` — right only
while nothing sits above them. That inset is **0** in every mobile browser tab,
on Android, on iPad and on any non-notched install, so both landed inside the
restored bar's 0–61px band. The active-filters chip strip (`page.tsx`) renders
only while a filter is set; **the phone masthead in `mobile-guest-carousel.tsx`
renders on every phone visit** and carries the headcount, Invite and the red
Needs-you against the bar's wordmark, search, bell and account switcher — this
surface's only route to sign-out. Both now clear `var(--fd-bar)`, the shell's own
**measured** height, read from the ancestor that declares it rather than
hand-typed. Vendors keeps its `.shell-topbar` hide: that one is a full-screen
takeover, scoped `@media (max-width:1023px)`.

**2 · THE FRAMES CAME OFF** (owner: *"we want to remove the framings so it moves
cleanly"*). The capture bar was a glass card around an input that already has its
own border — a second edge 8px outside the first. The summary + facet bar was a
glass panel around four sections that already separate themselves with hairlines,
and it inset every row 16px from the measure the roster below sits flush with.
Both empty states sat in dashed rectangles, which read as drop zones and made the
emptiest state on the page the most heavily drawn thing on it. All four
unframed; the sections, dividers and every control are untouched.

⚖ **The load-failure card KEEPS its mulberry edge, deliberately** — it is a
refusal and has to stop the eye. A sweep that deleted every border on the page
would have passed the other assertions and been wrong here, so the guard asserts
this one in the opposite direction.

**3 · ADD FROM YOUR PEOPLE** (owner: *"we want them to be able to add people from
the people's list as well and not just names"*). A new door in the add row's
overflow and in the empty state opens a picker of everyone Setnayan already knows
for you, merged from three places and labelled by which: a guest of **another
event you organise**, your **People page** (connections + alaga), and
**samahan** co-members.

🔑 **"The people's list" taken literally would have opened EMPTY for the person
who asked for it.** Measured in prod the same day: **0 connections · 0 alaga ·
0 samahan members**, against **5 events · 40 guest rows (36 not deleted) · 5
couple memberships across 3 organisers**. The other-events source is the only
non-empty one today and is the obvious one — the same tita is at the graduation
and the anniversary.

🚨 **RLS IS A FLOOR, NOT A SCOPE, AND HERE IT WAS THE WHOLE RISK.** `guests`
carries `couple_writes_guest` = `(event_id IN current_couple_event_ids()) OR
is_admin()`, and **production's admin is the owner's own account**. A read that
leaned on that policy would have offered him **every guest of every event in the
database**, in a picker whose job is to offer names to add to a wedding, with his
own events' rows for them to hide among — no error, nothing that looks wrong.
Same shape as My Shop reading every other shop's corrections (2026-08-12). The
event ids come from a `user_id = me AND member_type = 'couple'` read first and
the guest query is fenced `.in('event_id', those)`.

🔒 **An email rides only on an `event` row** — that address is the host's own
record, and writing it is what makes the `set_guest_person` BEFORE-INSERT trigger
relink the **same** person node instead of minting a stranger. People-page and
samahan rows carry **none**: the roster never exposes one, and a co-member's
address is not the host's to hold because they share a group. The rule is
enforced in the merge, not trusted from the caller. **No `person_id` and no auth
uuid crosses the boundary in either direction** — a host may say "this name, at
this address"; the trigger decides which person that is.

🔒 The write path **rebuilds the candidate list server-side and resolves posted
keys against it**, so a forged or stale key finds nothing and no name can be
posted that was never offered. The sheet's read carries **no email at all** — an
address that never reaches a browser cannot leak from one.

⚠ **A one-word name gets a box, not a guess.** `guests.last_name` is NOT NULL and
some sources store a whole name in one string; `splitPersonName` returns an empty
surname rather than repeating the word or writing a dash, and the row grows a
"Last name" field instead. An invented surname is silent and permanent — it goes
onto an invitation, a place card and a check-in list, and nobody ever sees the
moment it was made up.

⚠ Somebody already on the list is shown greyed as "already here", never hidden:
hiding them is indistinguishable from not having them, and the host types the
same tita in a second time. Partial adds are stated ("Added 7. 2 didn't go on —
…"), because closing on a silent partial is how the missing two get added twice.

`QuickAddInput` gains an optional `email`, so the picker reuses the one canonical
single-add (names check, side check, offered-role set, post-finalize lock, the
single-bride/single-groom message) instead of growing a second, softer insert
beside it. Every existing caller inserts exactly the row it inserted before.

🪤 **AND THE REPO'S OWN COLUMN SCAN CAUGHT A PHANTOM COLUMN IN THIS VERY
CHANGE, BEFORE IT SHIPPED.** The event-title read asked `events.select('title')`.
**There is no `events.title`** — the column is `display_name`. PostgREST rejects
the WHOLE query with 42703 rather than throwing, so `.data` would have been
null, the title map empty, and **every row in the picker would have read
"another event"** — a feature that looks finished and quietly never worked, with
green CI. Exactly the family this repo already names four times over (phantom
column · enum value · RPC argument · blocked iframe): **rejected, not thrown,
and the only symptom is an absence.** Fixed and re-verified against the live
catalog; `select-column-scan.test.ts` is green.

**Guards** — `guests-keeps-the-shell-bar.test.ts` (5) ·
`add-from-people-is-scoped.test.ts` (5) · `people-you-can-invite-core.test.ts`
(7) · `person-name-split.test.ts` (7). Every sabotage measured by **occurrence
count before → after** before its red was trusted.

SPEC IMPACT: None — no locked price, SKU, schema or owner decision changes. The
2026-06-01 "no top nav on Guests" directive is superseded by the owner's
2026-08-21 instruction, recorded in `DECISION_LOG.md`.


---

## Follow-up: five defects found by an adversarial review of this very change

A 5-lens review (privacy/scope · the restored bar's layout knock-ons · the write
path · guard quality · what a person meets), each finding attacked by two
independent skeptics. 25 candidates, 10 survived, collapsing to five defects —
**all of them mine, all fixed here.**

**1 · 🚨 A MERGED SAME-NAME ROW CARRIED THE OTHER PERSON'S EMAIL, AND THE
SAVE-THE-DATE MAILS IT.** The merge de-duplicated on the NAME and kept the first
row's address. Two different Maria Santoses — the cousin on last year's list and
the colleague on another — collapsed to ONE row, and picking it wrote the wrong
address onto the new guest; `save-the-date-emails.ts` then mails every guest of
the event who has one. The screen could not warn anybody: it shows the name and
the `from` line, and the address never reaches the browser at all.
🔑 **A NAME IS NOT AN IDENTITY.** A merge now requires the two to be COMPATIBLE —
at least one address unknown, or the same address twice. Two known-and-different
addresses are two people and **both rows are emitted**; the `from` line is what
tells them apart, which is the whole reason it is there. Same boundary
`app/join/[eventId]/actions.ts` already draws for an ambiguous name match: admit
the ambiguity rather than guess. 4 new tests.
⚖ Latent, not live — every address that can ride is on the host's own other
guest list, and prod holds no guest emails today. It arms on the first real list.

**2 · 🚨 THE PHONE MASTHEAD LANDED ON THE BAR THIS CHANGE RESTORED.** Fixed
above; it was the second sticky, in a file not in the original diff.
🔑 **AND THE GUARD THAT NAMED IT READ THE WRONG FILE.** It scanned `page.tsx`
while being titled "the roster's sticky view tabs" — which is neither the
element it checked nor the one that was broken. **A guard named after something
it is not checking is worse than no guard: it reads as covered.** It now asserts
the RULE across both files, so a third phone sticky has to satisfy it too.

**3 · 🔴 ON A PHONE THE NEW DOOR DISAPPEARED THE FIRST TIME IT WAS USED.** The
picker had exactly two mounts: the capture bar's overflow, which lives inside
`hidden … lg:block` and does not exist below 1024, and the zero state, which
stops rendering the moment the event has one guest. Add a guest by any route —
including the picker's own first use — and no control on a phone could open the
sheet, which stayed mounted and listening the whole time. **The sixth gate with
no handle.** A phone is also where the feature is worth the most.

**4 · 🔴 THE SHEET NEVER RE-READ, SO A FAILURE LATCHED AND SUCCESS WENT STALE.**
Mounted once for the life of the page, fetch guarded on `rows === null`, and
`onOpen` never cleared it — so the guard meant "already fetched EVER". A failed
read wrote `rows = []` (not null) and the panel then said *"close this and try
again"* on every reopen forever, **instructing the one action that could not
work**. And after a successful add, reopening showed the people just added with
a live checkbox; ticking one got them refused — the screen offered a row and
then told the host off for taking it. One reset, where every open passes.

**5 · 🪤 A GUARD THAT A RENAME SILENTLY DISARMED.** The `-mt-6` / safe-area
assertions sliced from `page.indexOf('const master = (')` with no anchor check.
Rename that const — which the live design-port programme could do any week — and
`indexOf` returns -1, the slice collapses to the empty string, and both negatives
pass over nothing. **Measured: restore the hazard alone → RED; restore it AND
rename the const → 5 pass, 0 fail.** Now anchored on the class the regression
would have to touch, not on a renameable symbol.

**Prose swept, since it was drift this change created:** three files
(`front-door-shell.tsx`, `front-door.css`, `admin/layout.tsx`) still said **two**
event pages hide `.shell-topbar` when only the Vendors takeover does, and a JSX
comment in `page.tsx` still justified padding that had been deleted by naming the
`<style>` that had also been deleted.

**What the review pursued to a concrete claim and then killed** — recorded so the
absence reads as a result, not an omission: server-action authorization on both
new actions · the `guests` RLS floor (`OR is_admin()`) · the pre-existing
unfenced `dependents` read (real, untouched here, and every non-`event` row
writes a bare name anyway) · the 200-pick truncation (no bulk select, so the
201st pick is a 201st deliberate tap) · `quickAddGuest` gaining `email` as an
escalation (the full form and CSV import already write one) · one-word names
never matching "already here".
