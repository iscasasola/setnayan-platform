## 2026-08-21 · feat(invitation): the guest fills their own details, and the app stops asking what it knows

Owner, 2026-08-21, pointing at the host's own guest page: *"these are all the
information we want to fill up."* Then: *"their email will come from the app? and
mobile number can also come from the app? means they can store these information
on their profile."* And: *"if they have an account, and all details are filled,
all they need is to accept the invitation and they can already see the event hub."*

**RULE 0 answered two of the three.** The account profile has stored
`display_name`, `phone`, `meal_preference` and `dietary_restrictions` for a long
time and lets a person edit every one of them; the sign-in `email` is on the same
row. Nothing needed building for storage. And replying already lands the guest on
`/{slug}` — the event hub. What was missing was the half in between.

**The host's page has Email, Mobile and Display name, and NOTHING anywhere let a
guest supply any of them.** `submitRsvp` read four fields; the guest's own row was
not even SELECTED with `email` or `mobile`, so the card could not have shown them.
A host without a number had to leave the app and go and ask, per guest.

- The reply card gains **Email · Mobile · What should we call you**, named
  `contact_*` so they can never collide with the sign-in-link box elsewhere on
  the same page, which posts `email` to a different action entirely.
- All three prefill from **this event's answer first, the account profile
  second** — never the other way round, or a preference saved at somebody else's
  wedding would silently replace the one the caterer cooks from.
- **Not frozen when the guest list closes.** Only the ANSWER freezes: a phone
  number corrected the week of the event is worth more then than ever.
- `guestDetailsChanged` learns all three, so the host is told which one moved.
  Each says WHICH detail changed and never the value — contact data stays in the
  app, the same line already drawn on dietary notes. Email compares
  case-insensitively, or a phone keyboard's capital letter reports a change forever.
- **The block FOLDS when both ways of reaching them are already known.** A
  signed-in guest sees their answer and one line — *"Your details are filled in —
  Ana Cruz · ana@example.com · +63 917 …  · Change"*. ⚠ The summary NAMES
  everything behind it, or this is #4683 in a new position; and `<details>` hides
  without disabling, so both arms still post. Meal and dietary deliberately do
  NOT gate the fold — "no preference" and "no allergies" are real answers.
- 🔒 First and last name stay **host-only**. The link that reaches this card is
  printed on a poster; a stranger who can rename a seat-holder is the exact harm
  `seedBindAllowed` was hardened against. What to CALL you is a label; who you
  ARE is not.
- 🔴 **The guest-side restamp is fixed too** — the twin of the host bug fixed
  earlier today. Every field here is `defaultValue=`, so a guest correcting a
  phone number reposts the answer they already gave, and that used to restamp it
  as a fresh reply.
- `profileFood` → **`profileDetails`**: it now carries a phone number, and a
  value whose NAME misleads is a defect this project has already paid for twice.

16 sabotages, all landed by occurrence count, all RED. Two of the new guards were
**decoration on their first run** and were rewritten: one matched the string
`changed.includes('mobile')` so `if (false && …)` stayed green, and one never
asserted the guest's own row carries what the card prefills from — deleting
`email, mobile` from the select left every guard green while the box renders empty
and Save writes the blank away.

SPEC IMPACT: None.
