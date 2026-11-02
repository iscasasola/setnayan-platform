## 2026-07-15 · feat(merkado): desktop vendor quick-view inspector

Inspector Column phase 3 — the Merkado (couple Vendors tab) Shortlist bench
joins the desktop inspector program. On desktop (≥xl) a plain click on a bench
vendor card now opens a right-side inspector column (`?inspect=v:<vendorId>`)
with a vendor quick-view instead of navigating away: identity (name · category
· city · photo/initials), Chosen/Considering status, Setnayan + Verified
badges, rating/review summary, the live fit-badges (reach / budget / date),
the quoted price, and "Open full profile ↗" → the vendor's existing
`/vendors/<vendorId>` room. Below xl and on modified/new-tab clicks the card
stays a plain link (today's behavior unchanged).

- `vendors/_components/vendor-quickview-inspector.tsx` (NEW) — the
  `InspectorColumn` body; a re-presentation of the SAME `ShortlistVendor` the
  card renders. Every field hidden-when-absent, nothing fabricated, and no
  AI-ranked signal (the % match / eyeing / ranked sort live outside
  `ShortlistVendor`, gated upstream) so nothing behind the Setnayan AI paywall
  leaks.
- `vendors/_components/shortlist-categories.tsx` — the bench `VendorCard`
  becomes an `InspectorTrigger` (was a plain `Link`); selected card wears the
  quiet gold ring via `[data-inspector-selected]`.
- `vendors/page.tsx` — resolves `?inspect=` server-side against the already-
  built shortlist folders (stale/unknown id → inspector closed, never a blank
  rail) and wraps the Shortlist slot only in `InspectorLayout`. The locked
  Merkado compositions (Build rail · lock flow · budget accordion) are
  untouched — the inspector attaches to the bench surface only.

Also in this PR (owner-locked 2026-07-15, DECISION_LOG): **Setnayan AI is an
ENTITLEMENT STATE, not a toggle** — the Merkado's `SummaryAiToggle` switch is
retired (component deleted; this page was its only consumer). Not owned → the
plain bench + the existing Unlock banner as the only door in; owned → the
AI-enhanced bench renders unconditionally. The page's `aiActive` read now
neutralizes `planning_mode` (entitlement-only via the same
`isSetnayanAiActiveForUser` gate), so a couple who once flipped the old toggle
to Manual isn't stranded AI-off with no control left to flip back. The shared
`setPlanningMode` action and other surfaces' planning_mode reads are untouched.

SPEC IMPACT: None beyond the inspector program (phase 1 shipped the primitive
in #3265; this is consumer #3, per the owner's "Finder master-detail on
desktop" directive) + the AI-entitlement lock above (already logged in the
corpus DECISION_LOG 2026-07-15). No schema, pricing, or locked-composition
changes.
