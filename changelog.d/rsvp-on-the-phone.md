## 2026-10-31 · feat(notifications): a guest's reply reaches the host's phone at once — not their inbox — and every phone notification is written with one template

Owner, verbatim: *"I keep getting email notifications everytime a person confirms
rsvp. How much does that cost us?"* → *"Can we make the notification instead like
facebook even if on website and app?"* → *"Yes. The notification on the phone not
on the app."* → **"Yes"** to *"instant, but each new RSVP notification replaces the
last one on the lock screen instead of stacking"* → *"Also fix the way how the
notification messages the phones."*

- **No more RSVP email.** `rsvp_received` left `EMAIL_ENABLED_TYPES`
  (`lib/notification-emit.ts`); `the-email-allowlist-is-frozen.test.ts` now records
  51 emailed types and the owner's words. Payments, bookings and security keep
  their emails.
- **Instant, replacing, counted.** `rsvp_received` joined `PUSH_ENABLED_TYPES`.
  Every reply pushes at once — the RSVP action notifies inside `after()`, so the
  guest's reply never waits — with one collapse key per host × event
  (`rsvp:<eventId>`: Web Push `tag` + `renotify: true` + the `Topic` header). The
  text counts the host's UNREAD reply rows for that event: "Maria replied" →
  "Maria + 1 other replied" → "Maria + 5 others replied", plus "· 34 coming so far"
  (`lib/rsvp-push.server.ts`, `lib/rsvp-push-count.ts`). Opening Guests marks this
  event's reply rows read (`markReplyNoticesSeen`), and so does reading the bell —
  the count starts over. No migration, no new table.
- **One template for every phone notification** — `lib/push-message.ts`: title =
  the event's name, the shop's name, or "Setnayan"; body = one plain sentence
  (counts via `formatCount`, money via `formatPhp`, "event" never "celebration");
  ids, uuids, snake_case type names and links scrubbed; ~40/~110 characters cut at
  a word; tap = the exact screen (same-origin paths only); badge = unread count
  (`setAppBadge` in the service worker). `sendWebPush` now accepts only a branded
  `PushMessage`, sent through the one funnel `lib/push-send.server.ts`; the dormant
  `/api/notify` route uses it too. The four other pushed types (chat_message,
  vendor_inquiry_received, inquiry_accepted, security_alert) were rewritten to it.
- **The service worker opened the wrong screen for every notice.** `sw.js` read only
  the old `data.thread_id` shape, so every notice was tagged `setnayan-vendor` and a
  tap opened `/vendor-dashboard`. It now reads `url` (same-origin only), `tag`, and
  `badge`.
- **A one-time ask on Guests**, in the house sheet: *"Get a notice on this phone
  when guests reply?"* → Yes / Not now. Couple only, never in the iPhone app, never
  on first paint (2.5 s after the list settles), only once there is a reply,
  remembered per device for 30 days (no server field exists). Yes runs the profile
  switch's path, now shared as `lib/push-subscribe.ts`. On iPhone Safari outside the
  Home Screen there is no Web Push: the line reads *"On iPhone, add Setnayan to your
  Home Screen to get these."* and the ⓘ says how. Lab for screenshots:
  `/dev/reply-ask-lab` (dev only).
- Guards, each sabotaged red then restored: `rsvp-goes-to-the-phone-not-the-inbox`,
  `rsvp-push-count`, `push-message`, `every-push-goes-through-the-template`,
  `reply-push-ask`, `the-reply-ask-is-asked-once`.

⚠ **Not done, on purpose:** "add RSVPs to the daily digest". The only daily digest
is the ADMIN ops digest; no host-facing digest exists, and creating one would be a
NEW email to every host (standing rule: no new emails without the owner's word).

SPEC IMPACT: DECISION_LOG row "2026-10-31 · GUEST REPLIES GO TO THE PHONE, NOT THE
INBOX — INSTANT, EACH ONE REPLACING THE LAST · AND EVERY PHONE NOTIFICATION IS
WRITTEN WITH ONE TEMPLATE" (corpus b6a95cb1).
