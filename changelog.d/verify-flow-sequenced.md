## 2026-07-03 · feat(vendors): Get-verified flow — profile-first framing, 2 steps, post-submit final confirmation

Owner flow refinement ("once they complete the initial profile, the profile
will then pop up the documents … once they have submitted, we will contact them
for final confirmation" → settled as "show both"):

- **Show both, profile framed first.** The two vendor steps stay visible +
  uploadable from day one (documents are the slow offline part). While the
  profile is incomplete, a tappable "First step: finish your business profile —
  N fields left" banner leads the card (scrolls to the top grid).
- **The "pop up" moment.** When the profile hits 100% live in-session, the
  Documents step auto-opens and the section scrolls into view; it also starts
  open whenever profile-complete + no required docs are in yet.
- **Stepper is now 2 steps** (Documents · Confirm contacts). The Google Meet is
  no longer a vendor checklist step — it's the post-submit promise: "Submitted —
  we'll contact you to schedule your final confirmation, a 15-min Google Meet,
  within 5 business days" (shows the booked time once scheduled). `MeetStep`
  removed; Hero pill reads "Get verified · N of 2".
- **Submit gate simplified** to profile-100% + the 4 required documents (the
  shared `verificationSubmitMissing` helper). The VALIDATE contact
  confirmations no longer gate submit — they're stamped as they land and belong
  to the post-submit review, so a vendor is never blocked by our marking
  latency. (Approval remains an admin judgment with the stamps visible on
  /admin/verify.)
- **Removed the "Open the full profile editor" link** from the Profile panel
  footer (owner: "we do not want the open the full profile editor link").

Also this branch: applied migration `20270503892144_vendor_correction_requests`
to prod (verified — table live) after PR #2659 merged.

Verified `tsc` (0), `next lint`, production `next build`.

SPEC IMPACT: verification submit gate = profile + required docs (contacts →
post-submit review); Meet reframed as post-submit final confirmation. Logged in
DECISION_LOG.
