## 2026-09-18 · feat(email): every email says whether it arrived

`sendEmail` (lib/email.ts, the single Resend choke point) now records every
send attempt in a new `public.email_deliveries` table: accepted (with Resend's
message id), send_failed (with the error), or not_configured (no key, nothing
tried). A cron-free job, `email-delivery-check` (admin traffic + a 10-minute DB
claim, registered in lib/periodic-job-registry.ts), asks Resend for each
accepted message's `last_event` and writes back delivered / bounced /
complained / suppressed / delivery_delayed. No webhook, so no owner setup.

Where a failure becomes VISIBLE: a strip on the admin home that renders ONLY
when email is switched off, the log cannot be read, or an email in the last 7
days did not arrive; it links to a new "Email delivery · last 7 days" section on
/admin/settings?tab=notifications listing every send with its verdict.

Recipients are stored masked (`is•••@gmail.com`), never whole. Auth emails sent
by Supabase SMTP (sign-up confirmation) are not in the log. The page says so.

Guards: lib/email-delivery-log.test.ts runs the verdicts.
lib/every-email-says-whether-it-arrived.test.ts pins the choke point, the one
exit, both mounts and the fragment id. Six sabotages were each confirmed red.

SPEC IMPACT: None. This is new ops plumbing, and no locked decision changes.
