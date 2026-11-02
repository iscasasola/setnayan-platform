## 2026-10-19 · fix(help): /help, /about and llms.txt say what is true today, to the public only

Quality sweep 2026-10-19, batch 4 (rows A3, B3, B6 /help copy).

- **A3 — the mobile-app answer.** The FAQ an App Store reviewer reads inside the
  iPhone app said "Native iOS and Android shells via Expo are on the V1.5
  roadmap"; llms.txt said "Native apps are in preparation ahead of the December
  2026 launch"; /download's description said the same. Now one function,
  `mobileAppAnswer()` in `lib/where-setnayan-runs.ts`, feeds /help, /about and
  llms.txt: the installable web app on any phone, plus the Mac and Windows
  desktop app. The iPhone-app sentence is gated on
  `NEXT_PUBLIC_IOS_APP_STORE_URL` (the switch the Papic install banner already
  uses), so it appears the day the App Store listing exists and not before. No
  Android-app claim (nothing is on Google Play).
- **A3 — pilot and launch talk.** "When does Setnayan launch? … a pilot with a
  small family + friends cohort" is now "Is Setnayan open now? Yes." (slug kept).
  llms.txt drops the pilot/public-launch dates, "Incorporation pending — pilot
  operates under the founder's personal name", "what it's becoming / DIRECTION",
  "Cebuano on the V1.1 roadmap", "in V1" and "not yet shipped".
- **B3 — the operations guides left the public help.** The Admin role card and the
  three team topics (Setnayan HQ basics, Two-admin approvals, Force-majeure
  escalations) moved to `lib/help-admin.ts`, which no public route imports; the
  `HelpRole` type no longer has an admin value. Their 10 `/help/<slug>` pages now
  404. The contact form's "Admin / operations" topic is gone. Raw paths
  (`/vendor-dashboard`, `/dashboard`, the guest URL pattern) and version talk
  ("V1 ships 18 roles", "locked behavior in V1", "Once Resend SMTP is wired",
  "once Setnayan Pay is live") are gone from the public help.
- **B6 — house words in /help.** "celebration" → "event" / "Event Hub"; "maid of
  honour" → "honor"; topic "Invitation site" → "Event Hub". The Papic free-credit
  sentences now interpolate `PAPIC_FREE_CREDIT_CONDITION`, so batch 6's rewording
  of that constant reaches /help and llms.txt with no second edit.
- **Truth fixes found on the way** (same file, same disease): sign-up (there is
  no account-type picker; a supplier signs up from /for-suppliers), "Delete your
  account" (it files a request reviewed within 24 hours — it is not an instant
  soft-delete), create-an-event ("Weddings only in V1" was false).
- **Guard:** `lib/public-help-says-what-is-true.test.ts` — no public topic for the
  team, no public import of `help-admin`, no future/version talk in public help or
  either llms.txt render, no internals (bare paths, code spans, column names), the
  house words, and one mobile-app answer true in both App Store states. 8/8
  sabotages caught. `the-two-admin-promise-is-tracked.test.ts` re-pointed to
  `lib/help-admin.ts` (every § 9.1 promise still counted);
  `the-free-pool-is-not-on-every-event.test.ts` accepts the interpolated constant.

SPEC IMPACT: None. (No decision changed; the copy now matches shipped behaviour.
Owner calls listed in the PR body: where the operations guides should live inside
/admin, and the uncertain facts that were removed rather than guessed.)
