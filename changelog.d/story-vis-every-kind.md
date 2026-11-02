## 2026-09-09 · fix(story): the Stories opt-in reaches every kind of day

The owner ruled on 2026-08-15 that every kind of celebration gets a story, and the
public gallery opened that day — five `event_type='wedding'` filters came out of the
gallery, the sitemap and the credited-vendor portfolio. **Two doors in the Story Maker
never moved with it**, so fifteen of the sixteen kinds could write and publish a story
and were never shown the control that lets anyone see it.

- The "Feature our story in Stories" switch was hidden behind a wedding-only boolean
  computed at its call site; it now asks `editorialAllowsEventType`, the one home of
  that question, and speaks the event's own noun.
- `setStoryShowcase` refused a non-wedding opt-in server-side, citing filters deleted
  three weeks earlier. It asks the same one question now, and fails **closed** on an
  unreadable event instead of letting `?? 'wedding'` answer for a broken read.
- The caveat named a remedy that had stopped working — "Make it Public or **Unlisted**",
  while the gallery had tightened to `= 'public'` the same 2026-08-15 because unlisted
  is what the privacy screen sells as link-only. It now names the setting actually
  chosen (all four states) and the remedy that works, and is no longer hidden behind
  the switch, so the person still deciding can see it.
- The privacy page's badge said "On — eligible to be featured" unconditionally, while
  the gallery also requires a public page and an address. Consent is not eligibility;
  it now says which of the two is missing.
- `setShowcaseConsent` — the **second door to the same consent flag** — had no kind
  check at all, so the rule was enforced at one door and not the other. Both ask now,
  and its refusals are rendered rather than silent. Inert today by arithmetic: the
  exclusion set is empty by owner ruling, so it admits every celebration in production.
- Both `LandingVisibility` unions omitted `invited_accounts`, a real fourth state in the
  database's own CHECK constraint, so the cast silently relabelled it "Private".

Supersedes draft PR #5012, whose target files were renamed (`website/editorial` →
`story`) on 2026-09-07, after it was written.

SPEC IMPACT: None. No migration, no schema change, no price or SKU change. The
2026-08-15 ruling this implements is already recorded in DECISION_LOG.md.
