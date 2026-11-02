## 2026-07-15 · fix(guests): restore invite-link + QR doorways

Owner report: "Event dashboard → Guests: invite link, QR codes — these are all gone." The Invite journey stage and the crew-pairing Event QR tool were both fully built but had lost every inbound link during the Living Roster reskin + Home/Overview redesigns. Restores their doorways without recomposing the Living Roster surface (Atelier-Glass rollout handles reskin separately).

- **Desktop Guests header:** added an "Invite guests" doorway (lucide `Send`, `button-secondary` weight matching the adjacent Share affordance) linking `/dashboard/[eventId]/guests/invite` — the previously orphaned Invite stage (one join link + QR + regenerate) had zero inbound hrefs on the desktop surface.
- **Empty state (zero guests):** added the same Invite doorway beside "+ Add your first guest" — inviting is the zero-state action.
- **Mobile carousel:** fixed the 'Invite' progress-ribbon pill, which mis-routed to `/guests/claims` (the Confirm stage). Now routes to `/guests/invite`. Its `unsent`/"to send" badge (guests with no `invitation_sent_at`, not declined) is semantically the Invite stage, so the badge was kept as-is.
- **Event QR reachability:** added a quiet secondary "Event QR for your crew" link on the Invite page pointing to `/dashboard/[eventId]/event-qr`, with honest copy (pairs photo/livestream vendor devices, not a guest invite). The Event QR tool had lost its Home-tiles-grid tile in the Overview redesign and was fully orphaned.
- **Stale comments:** corrected the reachability claims in `lib/guest-journey.ts` and `event-qr/page.tsx` that still asserted Event QR "stays reachable from the Home tiles grid" — now point at the Invite-page link.

SPEC IMPACT: None — restores links to already-built, already-spec'd surfaces; no behavior, schema, pricing, or SKU change.
