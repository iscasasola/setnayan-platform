## 2026-10-24 · feat(hub): Invitation › Me is the one place for everything about the guest

The owner approved this on 2026-10-24 ("Approve the corrected Me redesign. Build it."). The contract is `Setnayan/prototypes/me_tab_redraw_2026-10-24_fable.html` (corpus d4201555).

**Me, top to bottom.** One centred axis, hairlines between the topics, and a frame only on things you press:
1. **The host's slim bar** (when a host is viewing as a guest): "Viewing as Indalecia ⓘ · Back to you". The ⓘ holds "This browser holds their invitation. Only they can save it to their account."
2. **The greeting** (`MeGreeting`, rules in `lib/guest-greeting.ts`): "Your invitation", then the formal name in the event's Name style, then the role in small caps with "· Groom's side", then the date, then Ceremony / Reception on labelled lines. The role line carries no colour dots; the colours are named in What to wear.
3. **Your place**: "You walk 5th, after …" and a "See where you are" pill. The role itself is now said once, at the top.
4. **A note from the couple**, unchanged.
5. **What to wear**: the shipped `RoleFigure`, with every swatch named. The Studio's `NamedColourDot` shows what the swatch colours, then the colour's name from `nearestColorName`. Under it, "See the full dress code ›" lands on Details (`#site-dress-code`).
6. **Arrive by**, **Coming with you**, their table, and their ticket after a Yes. The name card's own name and its card boxes are gone (`GuestMe plain`). The host's "Only they can save it" moved into the bar's ⓘ.
7. **The one Reply** (`MeReply`, `#me-reply`), from `replyCardOf` for every guest on the Invitation. Before a reply: "Will you join us?" · "Reply by …" · Reply. After a yes: "You're coming ✓" · "1 seat" · an outline "Change my reply".
8. **The record line with its ⓘ**, then two small icon-and-word pills: "Stop keeping a record" and "Sign out of this invitation" (sign-out still asks first).

**One place.** On a tabbed page:
- The cover's RSVP button is now a mark on Me (`#me-reply`). The hub shell opens Me there, and the glide steps aside for a part on another tab.
- **Removed:**
  - the Welcome's greeting paragraph ("We'd love to celebrate with you on … You're joining us as …", our default copy)
  - the Welcome's Reply card under the cover
  - the Reply card at the top of Me
  - the ticket's "Reply to the invitation" bar (the ticket now shows after a Yes)
  - the "Change your reply" bar
- A page that is one scroll keeps its Reply card under the cover.

**Copy.**
- The record notice says "at this event", never the event type's word ("at this wedding").
- Details › Dress with us keeps its figures and adds the colour's name under each swatch ("Gown · Garnet").

**Guards re-aimed.** Each pinned a removed piece; each now pins the new rule:
- `no-side-surface-on-a-sideless-event`
- `admin-money-and-gift-words-are-honest` (side gating)
- `the-first-arrival-is-not-a-return` (no "Hi," / no "Welcome")
- `the-wake-never-celebrates`: the greeting pair is retired, and a new test checks that the greeting celebrates for no one
- `a-dateless-event-prints-no-hole`: now checks Me's date line
- `me-reads-their-gender` (comment)

**New guard:** `lib/me-is-the-one-place.test.ts`.

Nothing is gated: there is no flag, no `is_internal`, and no admin-only path. Me's Reply is drawn for every guest, not only the new guest side.

SPEC IMPACT: None new. This implements the owner-approved prototype of 2026-10-24, already in the corpus (d4201555).
