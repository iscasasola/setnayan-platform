## 2026-09-11 · fix(vendor-chat): label the mobile tools trigger

On a phone-width `/vendor-dashboard/messages/[threadId]` thread, the only way
into a supplier's tools (Build a quote, Send proposal, Log payment, Propose
schedule, Offer another service, Voice call, Video call, Deal or meeting, Log
the outcome) was `ChatInfoRailTrigger` — an unlabelled ⓘ icon-only button in
the thread header. A supplier could not find it (owner, live test, 2026-09-11:
"i cannot access tools when on mobile mode?").

- `ChatInfoRailTrigger` (`app/vendor-dashboard/messages/[threadId]/_components/chat-info-rail.tsx`)
  is now a visible "Tools" pill (Wrench icon + text), styled like the house's
  small secondary pill buttons (see `SubmitButton` usage in
  `app/vendor-dashboard/repertoire/page.tsx`). `aria-label` is now
  "Customer details and tools".
- The bottom sheet it opens is retitled "Customer & tools" (was "Customer") to
  match — it still holds the customer identity/facts AND the tool launchers,
  unchanged.
- The desktop docked column (`ChatInfoRailColumn`), the launchers, and the
  close-on-launch behaviour are untouched.
- Added `apps/web/lib/the-mobile-tools-trigger-is-labelled.test.ts`, a
  source-scan guard asserting the mobile trigger carries a visible text label
  (not icon-only) and a meaningful `aria-label`.

SPEC IMPACT: None
