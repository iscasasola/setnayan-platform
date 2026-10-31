## 2026-10-31 · feat(notifications): a guest's reply reaches the host's phone at once — not their inbox — and every phone notification is written with one template

Owner, verbatim: *"I keep getting email notifications everytime a person confirms
rsvp. How much does that cost us?"* → *"Can we make the notification instead like
facebook even if on website and app?"* → *"Yes. The notification on the phone not
on the app."* → **"Yes"** to *"instant, but each new RSVP notification replaces the
last one on the lock screen instead of stacking"* → *"Also fix the way how the
notification messages the phones."* → *"Yes, add them"* (Urgent · Normal · Low +
quiet hours).

- **No more RSVP email.** `rsvp_received` left `EMAIL_ENABLED_TYPES`
  (`lib/notification-emit.ts`); `the-email-allowlist-is-frozen.test.ts` now records
  51 emailed types and the owner's words. Payments, bookings and security keep
  their emails.
- **Every notification type has one phone level** — `lib/push-levels.ts` replaces the
  old four-type push list; the `Record` is exhaustive, so a new type does not compile
  without one. URGENT (13) buzzes always; NORMAL (46) buzzes by day and waits through
  quiet hours, 10 pm to 7 am Manila; LOW (45) never buzzes. `pushDecision` is the one
  gate. **Held notices need no new state:** the 7 am release and the one evening
  summary ("Today on your event: 3 updates", opens the bell) read the unread bell rows
  (`lib/push-schedule.server.ts`), each claimed once a day through `runClaimedJob`,
  riding public and event-page traffic — so "7 am" means the first request after 7 am.
  No email in any of it. No migration.
- **Instant, replacing, counted.** Every reply pushes at once — the RSVP action notifies inside `after()`, so the
  guest's reply never waits — with one collapse key per host × event
  (`rsvp:<eventId>`: Web Push `tag` + `renotify: true` + the `Topic` header), Normal, so
  it waits overnight like the rest. The
  text counts the host's UNREAD reply rows for that event: "Maria replied" →
  "Maria + 1 other replied" → "Maria + 5 others replied", plus "· 34 coming so far"
  (`lib/rsvp-push.server.ts`, `lib/rsvp-push-count.ts`). Opening Guests marks this
  event's reply rows read (in the page's `after()`, no new server action), and so
  does reading the bell — the count starts over.
- **One template for every phone notification** — `lib/push-message.ts`: title =
  the event's name, the shop's name, or "Setnayan"; body = one plain sentence
  (counts via `formatCount`, money via `formatPhp`, "event" never "celebration");
  ids, uuids, snake_case type names and links scrubbed; ~40/~110 characters cut at
  a word; tap = the exact screen (same-origin paths only); badge = unread count
  (`setAppBadge` in the service worker). `sendWebPush` now accepts only a branded
  `PushMessage`, sent through the one funnel `lib/push-send.server.ts`; the dormant
  `/api/notify` route uses it too.
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
  Home Screen to get these."* and the ⓘ says how.
- Guards, each sabotaged red then restored: `push-levels`, `push-schedule`,
  `rsvp-goes-to-the-phone-not-the-inbox`,
  `rsvp-push-count`, `push-message`, `every-push-goes-through-the-template`,
  `reply-push-ask`, `the-reply-ask-is-asked-once`.

⚠ **Not done, on purpose:** "add RSVPs to the daily digest". The only daily digest
is the ADMIN ops digest; no host-facing digest exists, and creating one would be a
NEW email to every host (standing rule: no new emails without the owner's word).
⚠ **No type exists for "a supplier is running late"**, so nothing can buzz for it yet.

SPEC IMPACT: DECISION_LOG row "2026-10-31 · GUEST REPLIES GO TO THE PHONE, NOT THE
INBOX — INSTANT, EACH ONE REPLACING THE LAST · AND EVERY PHONE NOTIFICATION IS
WRITTEN WITH ONE TEMPLATE" (corpus b6a95cb1).
