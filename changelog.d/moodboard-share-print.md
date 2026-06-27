## 2026-06-28 · feat(mood-board): share with vendors + free one-page printable PDF

Two cohesive additions to the couple's studio Mood Board
(`app/dashboard/[eventId]/studio/mood-board`):

**1. "Share with vendors".** New `shareMoodBoardWithVendors()` server action +
`ShareWithVendorsButton` client component. One press fans out an in-app
`mood_board_share` notification to every booked marketplace vendor on the event,
deep-linking to the read-only vendor mood board
(`/vendor-dashboard/clients/[eventId]/mood-board`, shipped #2293). The "booked"
set mirrors the `get_vendor_mood_board` RPC gate EXACTLY — any `event_vendors`
row with a non-null `marketplace_vendor_id`, de-duped per vendor — so we only
ping vendors who already have read access. Free convenience layer, no paywall.
Couple gets a `useToast` "Shared with N vendors" confirmation. Vendor user_id
resolution + notification insert go through the service-role admin client
(mirrors the `booking_confirmed` emit in `vendors/actions.ts`); `emitNotification`
fails soft so one vendor's hiccup never blocks the rest. `mood_board_share` is an
informational nudge — deliberately NOT on the email/push allowlists.

**2. Free printable Mood Board PDF.** New `lib/moodboard-printable.ts` (pdf-lib,
same house pattern as `lib/concept-pdf.ts`/`lib/seating-pdf.ts`) + `print-pdf`
route + `PrintablePdfButton`. Generates a single, light/white, print-safe A4 page:
palette swatches grouped per role (`events.role_palette`), a reception-design
summary (`events.reception_design`), and the couple's names + date. DISTINCT from
the V2-deferred multi-page Concept Book PDF (no hero raster, no inspiration grid).
Sits next to the existing concept-book button under a "Keep a copy" section.

Schema: migration `20270308120000_mood_board_share_notification_type.sql` adds the
`mood_board_share` value to the `public.notification_type` enum (idempotent
`ALTER TYPE … ADD VALUE IF NOT EXISTS`, bare/no-txn — matches the existing
add-notification-type migrations). TS union + `NOTIFICATION_TYPE_LABEL`/`_TONE`
updated in `lib/notifications.ts`. Migration is in the PR only — applied to prod
separately.

Local verify: typecheck ✅ · lint ✅ (0 errors; only pre-existing warnings) · prod
build ✅ (both PDF routes present, exit 0).

SPEC IMPACT: None. No SKU, price, or locked-decision change — both builds are free
convenience layers over already-shipped data + the already-shipped booked-vendor
read access. Notification taxonomy gains one informational type. Code is canonical
per the 2026-06-07 ground-truth flip; logged here for repo-history completeness.
