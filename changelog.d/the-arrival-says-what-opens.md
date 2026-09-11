## 2026-09-11 · fix(invite): the arrival says what the next screen actually opens

The owner walked the invite arrival on 2026-09-11 and found five places where a
door promised something the destination did not deliver. One disease, five
symptoms, one PR — with a guard per item
(`apps/web/app/[slug]/invite/the-arrival-says-what-opens.test.ts`).

1. **The sign-in line spoke to somebody who already had an account.** The Reply
   door printed *"Fills this in for you, and becomes how you sign in later."*
   above Google/Apple. Owner: *"if they do not have an account yet, you say that
   it fills it up for them. how is that if they do not have an account yet."*
   The behaviour was always right — a provider sign-in MAKES the account and
   hands back a name and email — so this is copy only, rewritten to be true for
   somebody with no account.
2. **A decline no longer goes on to ask for a meal.** Meal preference and
   Dietary notes now ride the `attending-reveal` class the card already ships
   (one CSS `:has()` rule, no client state, no second mechanism) — the same one
   that already hid the selfie and the plus-one block. The frozen-list arm is
   handled explicitly, because with no radio rendered the CSS rule is not there
   to help: a guest whose FINAL answer is "declined" gets no meal boxes at all,
   while a coming guest keeps them (the caterer's last fortnight is exactly when
   "nut allergy" matters).
   ⚖ **Orchestrator's call on the owner's behalf, reversible:** a decline KEEPS
   the contact boxes and the note to the host, and loses the meal, the dietary
   notes, the selfie and the plus-one.
   ⚠ **Blast radius:** the card is shared with the Event Hub's own RSVP card, so
   this applies on both surfaces. Correct on both — a declining guest never
   needs a meal anywhere.
3. **"Signing in keeps the photos of you" is now said on the Reply door** —
   worded against what ships (`photos-of-you-gallery.tsx`, mounted for the day
   window, plus the account-to-seat path that reaches the event from any device
   once the 60-day guest cookie is gone). No cross-event "photo collection" is
   claimed; no such surface was found.
4. **Face tagging comes off the invite.** Owner: *"face tagging does not happen
   on the invite. it happens on their first view on the day of the event? or on
   the day papic becomes available to use for them."* This is a REMOVAL from one
   surface, not a build: `day-of-face-enroll.tsx` — "the day-of catch for a guest
   who skipped the optional RSVP selfie" — already ships and is mounted in three
   live places. Done with a new `offerSelfie` prop (default ON) so the Event Hub
   card keeps its selfie; the Reply door passes `false`.
   Consequence, stated plainly: fewer guests enrol early, so more are asked on
   the day. That is the owner's stated intent.
   ⚠ `site-body.tsx` also mounts the enrolment BEFORE the day
   (`context={isLive ? 'day_of' : 'pre_event'}`). Left exactly as it is —
   whether that early prompt survives is an open owner question.
5. **The last door promised an invitation and opened a save the date.** The LINK
   was never wrong (`/[slug]` IS the Event Hub) and is unchanged. The words were.
   The Event Hub wears a face chosen by how far off the day is, and far out that
   face is the Save the Date — where `qr_card` is gated out of the page — so
   "your QR … waiting on it" was a promise the next screen did not keep. Door 03
   now asks the SAME resolver the Event Hub asks (`getLifecyclePhase` on the
   venue clock, then `solemnAdjustedPhase`) through a new pure module
   `apps/web/lib/invite-destination.ts`, and says something true in each of the
   four phases. No threshold is restated anywhere; the invitation-phase sentence
   is the shipped one, byte for byte.
   ⚠ The event the owner walked crosses the threshold within days, at which
   point the old copy becomes true for it and stays wrong for everyone further
   out — so the guard CONSTRUCTS a far-future event rather than reading a real
   one.

SPEC IMPACT: None. No locked decision moves — the destination, the payment flow,
the RLS patterns and the invite-arrival door order are all unchanged; only door
copy, one shared-card prop and one new pure resolver module.
