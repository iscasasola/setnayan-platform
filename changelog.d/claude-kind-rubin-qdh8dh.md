## 2026-11-27 · fix(guest + hub): lane L2. Dead taps answer, hosts aren't asked to confirm, the reply form says each thing once, one checklist reader, one main button in the Maker

The owner's walk, MASTER-PLAN items L3, L4, B7, B8 and B9.

- **"Open in Safari to …" and "Copy my link" are no longer dead taps** (`/[slug]/invite/enter`, `/[slug]/welcome`). Inside Messenger, Facebook and Instagram:
  - The clipboard API is often missing or refused there, and on some versions its promise never settles. `copyText` now copies by selection first, inside the tap, then asks the clipboard API with a time limit (`COPY_WAIT_MS`). It never hangs. If both fail, it says so and hands over the link in a read-only field the guest can select (`LinkToCopyByHand`).
  - Some app versions ignore the `x-safari-https://` hop. Every hop is now a `SafariHop` (`app/[slug]/_components/safari-hop.tsx`): the in-app bar, the ticket pop-up and the landing's Save. If the page is still on screen after `SAFARI_HOP_WAIT_MS`, it says "Safari didn't open from here." and shows the app's own Open in browser plus the guest's link to copy.
- **A host is not asked to confirm.** A host with no guest row of their own on their own Event Hub saw "Confirm attendance", and the tap led to "You're not on this event's guest list". The cover's button and the Reply card under it are now drawn only for a host who is a guest there (`hostHasOwnReply`, `lib/cover-rsvp.ts`). Otherwise the cover's foot keeps its "Swipe up" hint.
- **The reply form (B8):**
  - The Terms line's two links are one unbreakable group, and each 44 px link hands its extra height back to a 20 px line, so a wrapped line no longer gapes.
  - "Your reply" is said once. The Hub sheet and the desktop panel are headed "Reply to the invitation", the words of the press that opens them. The reply page no longer prints "Your reply" as a stand-in for a missing name.
  - Send stays disabled until Yes or No is picked, on any card that asks (`replyAnswerMissing`). With no script, the radios' own `required` holds the form.
- **The private `/[slug]` (B9):**
  - "This event's page is private" is one string. Split over three text nodes, a browser's translate could space them apart. The Story's sibling line is fixed the same way.
  - The checklist's pass row reads "Save your QR pass", a to-do instead of a status. Whether it is done is the tick's alone (`checklistProgress`), and "Save to Photos" ticks it when the save lands (`savingTicks`). The reminder email's pending line reads the same.
- **Hub Maker `/launch` (B7):**
  - While an editor's head is up (its name, ⤡ and ✓ Done), the bar's icon-only ✓ Apply steps aside on every width. Done is the one main button, with its word.
  - The setup's "N left" pill wrote a fixed dark brown on the accent's tint, which was dark on dark in dark mode. Its words are now the paired page ink.

Guards: `app/[slug]/a-host-is-not-asked-to-confirm.test.ts`, `app/[slug]/_components/send-waits-for-yes-or-no.test.ts`, `lib/the-pass-row-says-one-thing.test.ts`, `app/[slug]/_components/the-guest-taps-are-never-dead.test.ts`, `app/[slug]/the-private-page-line-is-one-string.test.ts` and `app/dashboard/[eventId]/launch/_components/the-editor-bar-has-one-main-button.test.ts`. Existing guards were re-aimed to the new shapes. The reply card's golden (`the-reply-card-is-todays-page.golden.json`) was re-recorded with a dated note, because the Terms line changes for every guest.

SPEC IMPACT: None. These are fixes to drawn pages. Open question to the owner: should a host who IS on their own guest list still be offered their own reply on the Hub? The current behaviour is yes, kept from the 2026-10-24 ruling.
