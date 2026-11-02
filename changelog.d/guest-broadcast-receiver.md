# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-08-03 · feat(guest-site): coordinator announcements finally reach the guests

Fourth build item of the event-website work (owner, 2026-08-03: *"coordinators can send message to guests (announcements/phone down - i remember having this)"*, then *"go"*). Follows #4068, #4069, #4070.

**The owner's memory was right, and so was the gap.** The composer has shipped for months — `coordinator-broadcast-card.tsx` on the day-of screen, `lib/coordinator-broadcasts*.ts`, the `coordinator_broadcasts` table, and the Data Privacy control `coordinator_day_of_broadcast` reading **ACTIVE in production**. But **nothing on the guest site ever read it**: every `broadcast` hit under `app/[slug]/**` is the Panood *livestream*, not an announcement. So a coordinator could type *"phones down, the ceremony is starting"* and it would appear only on the couple's own dashboard — to the two people least able to act on it while walking down an aisle. **The sender was complete; the receiver was never built.**

**What lands.** `loadDayOfBroadcast` (admin client, same precedent as the widget registry — this page renders for visitors with no RLS session) and `DayOfAnnouncement`, rendered at the top of the guest view during the live window.

Four properties, each pinned by a test because each is easy to undo:

- **Guests only.** Rendered inside `guestTree`, and a test asserts it is absent from the anonymous tree. *"The ceremony is running late"* is for the people in the room, not for whoever was forwarded the URL.
- **Live window only.** The loader takes the resolved phase and returns `null` outside it, so a stale *"we're running late"* cannot haunt the page forever. **Mutation-verified** — removing the gate fails the test.
- **One message, never a feed.** Latest only. A scrollback of operational chatter is the coordinator's business and would compete with the couple's own words.
- **Not dismissible.** *"Phones down"* a guest can swipe away is worse than none — the coordinator has no way to know it was dismissed. It clears itself when the window closes or a newer one replaces it. `role="status"` + `aria-live="polite"`, never `alert`: announced without seizing focus.

The body renders as **text** — never markdown, never HTML. It is typed by a person on a phone under pressure and shown to every guest at the wedding.

Verified: 6,312/6,312 unit tests, `tsc --noEmit` clean. No migration (the table and control already ship), no flag, no route change. Renders only during a live event with an announcement present, so every other page is byte-identical.

SPEC IMPACT: completes the guest half of the coordinator hub model (`DECISION_LOG.md` 2026-08-03). Coordinator→vendor and coordinator→emcee messaging remain unbuilt.
