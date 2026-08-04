## 2026-07-26 · feat(website-editor): "RSVP'd" preview tab — the keepsake state, previewed with a fabricated sample guest

The unified website editor's phase switcher had four tabs, one per lifecycle
phase. It could never show the couple one state their guests actually see: the
**RSVPed fork**, where a guest who has answered "attending" gets the keepsake
ticket instead of the RSVP ask. That fork keys on a *guest's* own
`rsvp_status`, and a host has no guest row of their own — so `?phase=rsvp`
always showed them the un-answered ask.

Adds a fifth tab, **RSVP'd**, between "Invitation" and "Wedding day", captioned
"what a confirmed guest sees — sample guest, not one of yours".

- **New param, not a fifth phase.** `?phase=` is validated against a closed
  four-value allow-list and `lib/site-body-plan.ts` is golden-tested against
  those four, so the tab rides a separate `?as=replied` and still renders the
  `rsvp` phase — same phase, substituted identity. No new `LifecyclePhase`, no
  change to the plan, the widget registry or any golden expectation.
- **The guest is fabricated, never fetched.** `lib/simulated-guest-preview.ts`
  builds the identity from constants ("Sample Guest", "Table 1 · sample", a
  `SAMPLE` QR placeholder, empty `qr_token`, null meal/dietary/notes). Nothing
  queries `guests`. Two reasons: rendering a real guest's name, meal preference
  and dietary notes to the host is an RA 10173 surface created for a UI
  convenience; and constants mean the zero-guest firewall
  (`lib/anonymous-zero-guest.test.ts`) is not weakened by a byte — real guest
  data cannot flow down this path by construction, not by discipline.
- **One gate, and it's the existing one.** Substitution requires a
  server-verified `OwnerCapability` (PR #3764 — a real `event_members` /
  `event_moderators` row), bound to the event being rendered. `?as=replied` is
  inert for guests and anonymous visitors: they get the ordinary page, byte for
  byte. No second, weaker host signal was added.
- **Preview-only.** The helper returns literals; the identity is routed through
  the existing `guestIdentity()` key-pick constructor so it cannot carry an
  extra key or an owner capability. Zero writes, no server action, nothing
  persisted.

Files: `apps/web/lib/simulated-guest-preview.ts` (new, pure) +
`apps/web/lib/simulated-guest-preview.test.ts` (new, 16 tests) ·
`apps/web/app/[slug]/page.tsx` ·
`apps/web/app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx`.

SPEC IMPACT: None. No pricing, SKU, schema or locked-decision change — this is a
host-only preview of an already-shipped guest state (the RSVPed keepsake fork,
design 2026-07-25 §11), and it adds no lifecycle phase.
