## 2026-08-27 · fix(emails): the anniversary mail knows what kind of day it is talking about

**A bereaved family was one year away from being emailed *'you said "I do."'*.**

`couples_with_anniversary_today()` picks the recipients for both annual emails and had **no
`event_type` predicate anywhere** — it filtered on month/day, "strictly in the past", `archived`,
a reachable address and the once-a-year lock, and nothing else. The two templates it feeds were
hardcoded wedding copy.

🚨 **THIS WAS LIVE, NOT LATENT, AND THE REASON IS A NOUN.** The recipient is chosen by
`event_members.member_type = 'couple'` — legacy naming that **every** event type mints, not a
wedding marker. Measured against production: both non-wedding events carry a `'couple'`-typed
member. So a wake one year on was in line for *"1 year ago today, you said \"I do.\""* and
*"Every photo, every clip, every moment from your **wedding**…"*, and six weeks before it,
*"Your first **wedding** anniversary is about 6 weeks away. A whole year already — **worth
celebrating**."*

### What ships

**Both, deliberately — the fence and the belt.**

1. **The selector refuses solemn types** (migration `20271174085072`). A predicate cannot be
   forgotten the way a branch in the next template can.
2. **The templates cannot speak wedding words to a non-wedding**, and **return `null` outright
   for the solemn register** — the job treats `null` as "do not send".

Every other type now reads in its own words: *"1 year ago today, you had **a birthday** worth
remembering"*, *"…**a trip**…"*, *"…**an anniversary**…"*.

⚖ **THE FAILURE DIRECTION IS SILENCE, AND THE CHOICE IS MEASURED.** The gate is an
**allow-list** ("the type has a profile row and it does not say solemn"), not a deny-list ("no row
says solemn"). 🔑 **The deciding fact: `createEventTypeCore` inserts an `event_type_vocab` row and
nothing else** — a brand-new event type has **no profile row at all** until an admin sets its tone.
Under a deny-list, an admin adding a "Memorial" type and not yet setting its register would have
every such event receive "you said I do". Under the allow-list it receives nothing until somebody
has decided what kind of day it is — and loses nothing by waiting, since a type with no profile row
has no terminology either. An unsent anniversary email costs one marketing touch; a wrongly-sent
one arrives unprompted in a grieving family's inbox.

🔒 **A WEDDING READS BYTE-IDENTICALLY.** The wedding arm is keyed on the **event type**, never on
the resolved noun, and its literal strings are frozen in the guard.

⛔ **AND THE PREDICATE NAMES NO EVENT TYPE.** An earlier cut also refused the solemn type **by
name**, as a belt for the one case an allow-list misses: a solemn type whose row exists but has
**lost its `register` key** — real, not hypothetical, since the admin profile editor once rebuilt
`terminology` from its six form fields and silently dropped every key the form has no input for.
The belt was removed because **the owner renamed the solemn event type on 2026-08-27** and a
predicate hardcoding the old value would have gone **inert** the day that landed — still safe, but
silently doing nothing. Nothing is lost: that case is caught in code, by construction, because
`toProfile` falls back to the **type's own code profile** when a row omits `register`, and the
solemn type's code profile is solemn.

🔑 **THE LOCK IS CLAIMED ONLY ONCE WE KNOW WE WILL SEND.** It is a **once-a-year** lock: claiming
it and then declining burns that event's whole anniversary. Resolving the occasion first means a
deploy-window miss is simply retried tomorrow.

⚠ **DEPLOY WINDOW.** The selector's `RETURNS TABLE` gains `event_type` (hence `DROP` + `CREATE` —
Postgres refuses to `REPLACE` a changed return type). If the code ships first, the old function
returns no `event_type`, and the job **skips before claiming the lock** rather than guessing.

### Guards — 15 mutations, every one printed before → after, every one RED

`lib/anniversary-emails.test.ts` (13 assertions) + `tests/db/anniversary-mail-knows-the-occasion.db.test.ts`
(9). The db half **calls the function and reads what comes back** rather than grepping the
migration for the word "solemn" — a predicate that is present and inert fails there.

🪤 **ONE OF MY OWN GUARDS WAS DECORATION, AND ONLY THE MUTATION RUN SAID SO.** It DELETED the
solemn profile row and asserted the event stayed out — but a deleted row fails the allow-list on
its own, so removing the belt it claimed to test left it **GREEN**. It was asserting the allow-list
twice and the belt never once.

🔑 **AND THE WORD SCAN NEEDED TWO SPELLINGS.** The seeds are written as JSON
(`"event_word":"trip"`) and as SQL (`'event_word', 'wake'`); a scan that knew only the first found
12 words and silently missed four — including **`wake`**, the one word this whole change is about.
Both are read, with a floor that fails if the scan stops matching.

🔬 **The strongest test asserts the bug was reachable**: it runs every *other* predicate against
the solemn event and shows it satisfies them all, so the new gate is provably the only thing
holding it back.

### Two things found in passing, reported not changed

- 🔴 The **shared** branded-email footer says *"Setnayan · Filipino wedding planning + verified
  vendors"* on every branded email. That is the company's own tagline, not a claim about the
  reader's event — positioning, and the owner's call. Billed in the guard so it stays visible.
- 🔴 The line under it reads *"You're receiving this because you started a Papic gallery for your
  event"* on **every** branded email, directly beneath each email's own true reason line.

SPEC IMPACT: None. No price, SKU, or owner-locked decision moves. The retention, Papic and
event-type locks are untouched; this narrows who receives an existing email and corrects its words.
