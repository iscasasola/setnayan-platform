## 2026-07-02 · feat(vendor-profile): compose-first "Inquire" for visitors with no event yet

Visitors without an event (signed-out, or signed-in with no event) can now
inquire directly from the public vendor profile instead of hitting the old
"Already a Setnayan couple? … from your dashboard" dead-end. They write the
inquiry FIRST (email · service · message); the CTA reads "Log in free to see
your conversation"; submitting carries the inquiry through signup + event
onboarding and it sends itself once they land.

Owner design (2026-07-02): capture happens AFTER account creation — no
server-side anon-leads table. The composed inquiry rides `localStorage`
(`lib/pending-vendor-inquiry.ts`) through the signup → `/onboarding/wedding`
journey (the same browser-survival onboarding already uses), then a dashboard
dispatcher (`PendingVendorInquiryDispatcher`, mounted in the couple dashboard
layout) replays it via the existing `startServiceInquiry` action the moment the
couple is secured with an event, and opens the thread. Best-effort + idempotent
(chat_threads UNIQUE dedupe); a hard abandon before finishing loses the message
(owner-accepted trade-off). Terminal errors drop the stash; `no_event` keeps it
for a later retry; a 48h TTL caps any stale carry.

New: `lib/pending-vendor-inquiry.ts`, `v/[slug]/_components/anon-inquiry-composer.tsx`,
`dashboard/_components/pending-vendor-inquiry-dispatcher.tsx`. Wired into
`v/[slug]/page.tsx` (renders when a bookable vendor with ≥1 service is viewed by
an eventless visitor) + `dashboard/layout.tsx`.

V1 routes to `/onboarding/wedding` (wedding-first); the event-type picker →
`/onboarding/[type]` is deferred until the generic onboarding flow is un-gated.

Slice 4 of the vendor-website redesign (2026-07-02).

SPEC IMPACT: vendor microsite inquiry funnel — eventless visitors get a
compose-first inquiry (reorders the old gate-first/dead-end behavior). No schema,
no pricing, no catalog change. See DECISION_LOG.md 2026-07-02.
