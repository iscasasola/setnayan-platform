## 2026-09-30 · feat(rsvp): every name a guest types is the five parts — Prefix · First · Middle · Last · Suffix

Owner, verbatim: *"The name will be same: Prefix · First · Middle · Last ·
Suffix, to stay consistent"* — the same five parts the profile and the Guest list
already store (`FORMAL_NAME_FIELDS`, `guests.name_prefix / first_name /
middle_name / last_name / name_suffix`; no migration).

One shared set of boxes, `app/_components/formal-name-inputs.tsx`
(`FormalNameInputs`), now draws every guest-side name:

- the RSVP's plus-one seats (`PlusOneSeatPanels` in `rsvp-plus-ones.tsx`), and so
  Me's "Add name" in place, which draws those same panels. A blank seat is still
  "+N TBA", allowed;
- the plus-one's own door (`PlusOneDoor` in `welcome/_components/plus-one-door.tsx`),
  both "One more thing" and "Something wrong? Change it";
- the ask-to-join request (`RequestForm` in `join/[eventId]/_components/request-form.tsx`),
  First and Last required. A signed-in asker's boxes open on their profile's Full name,
  or on their account name split by the Guest list's parser.

Prefix is one dropdown (`NAME_PREFIX_CHOICES` in `lib/formal-name.ts`). Every
entry is a title the Guest list's splitter (`parsePersonName`) already treats as
a prefix. A stored prefix that isn't on the list stays selectable. Phone-first:
at 390 the five boxes sit in two columns (Prefix | First · Middle | Last ·
Suffix) with no sideways scroll, and on `sm` and up they sit in one row.

Saving: `readSeatNames` → `planSeatNames` → `submitRsvp` writes a seat's three
optional parts (`seatNamePartColumns`) only when the reply posted them. An older
page leaves the stored parts alone. `confirmPlusOneName` does the same for the
door. `readRequestAnswers` keeps the typed parts (`RequestAnswers.parts`), and
`createJoinRequest` stores them as typed. The one-line `name` field (the
signed-in "Open my invitation" hidden field) is still split by the parser.
`display_name` is handled the way the Guest list handles it: naming a seat
clears the placeholder.

Guarded by `apps/web/app/_components/guest-side-names-use-five-parts.test.ts`.
It sweeps every `app/[slug]` and `app/join` file for a hand-rolled name box,
renders each surface with all five boxes, and checks what the readers keep.

Not converted, on purpose: the reply's "What should we call you?" is the
nickname (`display_name`), which the profile also keeps beside the five parts.
The find-your-seat box is a lookup and saves no name. The song card's "Your
name or table" is free text.

SPEC IMPACT: None. This applies the owner's 2026-09-30 wording to the shipped
five-part name. Profile and Guest list Prefix are still free text, so the
guest-side dropdown is the only place Prefix is a choice. That is flagged for
the owner.
