## 2026-10-31 · feat(notifications): a guest's reply reaches the host's phone, grouped — and is no longer emailed

Owner, verbatim: *"I keep getting email notifications everytime a person confirms
rsvp. How much does that cost us?"* → *"Can we make the notification instead like
facebook even if on website and app?"* → *"Yes. The notification on the phone not
on the app."*

- **No more RSVP email.** `rsvp_received` left `EMAIL_ENABLED_TYPES`
  (`lib/notification-emit.ts`); the frozen-list guard
  (`the-email-allowlist-is-frozen.test.ts`) now records 51 emailed types and the
  owner's words. Payments, bookings and security keep their emails.
- **Pushed, grouped, like Facebook.** `rsvp_received` joined `PUSH_ENABLED_TYPES`
  and the new `GROUPED_PUSH_TYPES`: the first reply after a quiet stretch buzzes
  at once; later replies inside 20 minutes wait and go as ONE notice — *"Maria + 2
  others replied"* (`lib/rsvp-push-grouping.ts`, pure; `lib/rsvp-push.server.ts`).
  The tail of a burst is sent by a cron-free 5-minute job, `rsvp-push-flush`,
  fired from the RSVP action and the event layout. The bell is unchanged — one
  row per reply.
- **[migration]** `20271299863206_rsvp_push_groups_on_the_bell_rows.sql` adds
  `notifications.pushed_at` (nullable) + one partial index. The grouping's state is
  the bell rows themselves; RLS and erasure unchanged. NOT applied — the pipeline
  pushes it.
- **The service worker opened the wrong screen for every notice.** `sw.js` read
  only the old `data.thread_id` shape, so every `sendWebPush` notice was tagged
  `setnayan-vendor` and a tap opened `/vendor-dashboard`. It now reads the funnel's
  `url` (same-origin paths only) and `tag`.
- **A one-time ask on Guests**, in the house sheet: *"Get a notice on this phone
  when guests reply?"* → Yes / Not now. Couple only, never in the iPhone app (the
  native ask is a separate PR), never on first paint (2.5 s after the list
  settles), only once there is a reply, and remembered per device for 30 days
  (no server field exists). Yes runs the profile switch's path — now shared as
  `lib/push-subscribe.ts`. On iPhone Safari outside the Home Screen there is no
  Web Push, so the ⓘ says *"On iPhone, add Setnayan to your Home Screen to get
  these"* with the steps.
- Guards (each sabotaged red, then restored): `rsvp-goes-to-the-phone-not-the-inbox`,
  `rsvp-push-grouping`, `reply-push-ask`, `the-reply-ask-is-asked-once`, and the
  db test `a-reply-is-pushed-once`.

⚠ **Not done, on purpose:** the brief said to add RSVPs to "the daily digest" if
it did not carry them. The only daily digest is the ADMIN ops digest (queues for
the console), and no host-facing digest exists — adding RSVPs would mean a NEW
email to every host, which the standing rule forbids without the owner's word.
The bell and the grouped push carry replies.

SPEC IMPACT: DECISION_LOG row "2026-10-31 · GUEST REPLIES GO TO THE PHONE, NOT THE
INBOX" (corpus).
