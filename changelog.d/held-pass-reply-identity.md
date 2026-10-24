## 2026-10-24 · fix(hub, reply): the reply is sent as whom the Event Hub says it is viewing as; the held-pass actions are pills that follow their line

**Bug 2: the wrong person on the reply.** On cale-ice the host was signed in, and the Hub said "This browser also holds Indalecia's invitation. Viewing as you." He tapped Reply, and the reply sheet greeted **"Gabriel dela Peña"** and asked him to answer Gabriel's RSVP.

- **Root cause.** The host's Reply card (`hostReplyCard`, `site-body.tsx`) linked to `/{slug}/invite/reply?preview=draft`. For a verified host, that address is the Maker's PREVIEW of the reply. Its sample guest is named after the event's first non-couple guest (`loadPreviewPerson`), which on cale-ice is Gabriel. The card also hard-coded `rsvpStatus: 'pending'`, so it always asked "Will you join us?", even of a groom who is already attending.
- **Nothing was written for Gabriel.** The sample's Send writes nothing (`SIMULATED_GUEST_ID`), and `submitRsvp` binds every write to the request's own pass or seat. A real guest can never be answered for this way.
- **One identity, asked by both the page and the save.** `readReplyIdentityForEvent` (`lib/guest-one-path.server.ts`) decides who replies, using the pure rule `resolveReplyIdentity`, in this order:
  - the pass the account rule honours;
  - else the guest's own seat;
  - else a signed-in account's OWN guest row, under any membership. This is the host's own row, which the guest-only seat lookup never found.
- **When there is no one to reply as**, the page says so (`NoReplyHere`). That covers an account with no row of its own, or one bound to more than one row. It never draws a sample, and it never draws somebody else.
- **The host card** now opens the plain reply page and shows the host's real answer, e.g. "You're coming · 1 seat · Change my reply". A host with no row of their own gets no card.
- **Unchanged:**
  - A set-aside pass is never used to answer.
  - A host who pressed "Open as …" replies as that guest, which is exactly what the Hub says it is showing.
  - Signed out, the active pass answers, the same one the Hub honours.
- 🛡 `lib/the-reply-is-sent-as-who-the-hub-says.test.ts` runs against the REAL readers. The setup is a browser holding two passes plus a signed-in host, a host with no row, a host with two rows, a host who pressed "Open as", and a signed-out visitor. A source guard checks two things: the page and `submitRsvp` ask the one function, and the host card never carries `preview=draft`.

**Bug 1: the held-pass line's actions.**

- **Before:** the sentence sat centred under the Reply card, and its two underlined links sat flush left. The cause was `flex flex-wrap gap-x-5`: a flex row sets its own alignment and ignores the `text-align` it sits in.
- **Now:** each action is a small quiet pill with an icon and a word: Eye "Open as …", LogOut "Remove it from this browser", Undo2 "Back to you".
  - Each pill has a 44 px tap target and is painted only with the Hub's `ink` token, so it fits every couple's theme and the dark Look.
  - Each pill sits in an inline-block POST form, so the row follows whatever alignment surrounds it.
- 🛡 `app/[slug]/_components/the-held-pass-actions-follow-their-line.test.ts`.
- 🧪 Lab: `/dev/maker-lab/guest?heldpass=<case>&hub=1[&look=<theme>][&art=candlelight]` draws the line the way the Hub draws it, centred under the cover's Reply card.

**Copy.** The reply form's default question is now "Will you join us?", the Hub card's own words, instead of "Will you celebrate with us?" (the rule is "event", never "celebration"). This is our default only: a couple's own question still wins. cale-ice had written none, so it was our default.

SPEC IMPACT: None. This enforces the existing owner rulings: "the account outranks the pass" (2026-10-19), "the host's page is a guest's" (2026-10-15), "say event, never celebration", and the button rule's icon + word.
