## 2026-06-22 · feat(save-the-date): email the guest list on launch (augments the shared link)

Launching the Save-the-Date now actively EMAILS each guest who has an email
address their save-the-date — a "push" that augments today's shared-link "pull"
model. PH weddings often don't collect guest emails, so the fan-out covers ONLY
guests WITH an email; the shared join link stays the fallback for everyone else.

- **New `save_the_date_sent` email** (the 0028 branded pattern): couple names +
  wedding date + a link to the now-public `/[slug]` page + an add-to-calendar
  (Google Calendar) link, plaintext + branded HTML, RFC 8058 one-click
  `List-Unsubscribe` (mailto-based — no new token table/endpoint).
- **Fan-out wired into `launchSaveTheDate`** via a Next 15 `after()` hook
  (CRON-FREE per the locked architecture), best-effort (one failure never blocks
  the launch or the other guests, never throws).
- **Idempotent** via a new per-guest `guests.std_sent_at` stamp (migration
  `20270216928652_std_guest_email_sent.sql`) — re-launching never re-spams a
  guest who already received theirs. Distinct from `guests.invitation_sent_at`
  (the later formal RSVP invitation).
- **Opt-out honored** — relationship/transactional mail the couple initiates to
  their own list (matches the existing notification-emit posture: not gated on
  `users.marketing_opt_in`), but carries the one-click unsubscribe header.
- `lib/email.ts` `sendEmail` gained an optional `headers` field (for the
  unsubscribe header). Pure content shaping lives in
  `lib/save-the-date-emails-core.ts` (unit-tested); the server-only orchestration
  in `lib/save-the-date-emails.ts`.

Files: `apps/web/lib/save-the-date-emails.ts` (new),
`apps/web/lib/save-the-date-emails-core.ts` (new),
`apps/web/lib/save-the-date-emails-core.test.ts` (new),
`apps/web/lib/email.ts`,
`apps/web/app/dashboard/[eventId]/studio/save-the-date/actions.ts`,
`supabase/migrations/20270216928652_std_guest_email_sent.sql` (new).

SPEC IMPACT: 0024 save-the-date / 0001 guests / 0028 email — launching the STD
now emails each guest-with-an-email their save-the-date (save_the_date_sent
template), cron-free fan-out, idempotent (`guests.std_sent_at`), opt-out
honored; the shared link stays the fallback.
