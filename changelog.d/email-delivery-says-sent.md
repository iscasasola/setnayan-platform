## 2026-11-15 · fix(admin): Email delivery says "Sent · not confirmed" instead of counting accepted mail as "Waiting"

Controller, 15 Nov 2026: Admin › Email delivery showed "Delivered 0 · Waiting 58" for the week, which reads as "mail isn't going out". Measured in prod (SELECT only): all 58 rows are `outcome = 'accepted'` with a provider message id, and `last_event` / `last_event_checked_at` are NULL on every row — Resend took them, but the live Resend key is send-only, so the status check can never read an email back (owner item AW-6).

- New verdict **`unconfirmed`** ("Sent · not confirmed"): accepted, and no status at all an hour later. It is a fact about the status check, not about the mail. Fresh sends (< 1 h) are still honestly "Waiting"; Resend's own "sent"/"queued" is an answer and stays "Waiting".
- The screen shows **Delivered · Did not arrive · Sent · not confirmed**, then Waiting · No answer · Total, and one line "Sent 58 · delivery not confirmed" whose ⓘ says Resend accepted them, this page cannot ask whether they arrived, and that a full-access email key lets it confirm.
- Unconfirmed mail is **still re-checked** (not settled), so the moment a key that can read is installed these turn into Delivered / Did not arrive on their own. It raises **no alarm** on the Work strip — failures do.
- No migration, no new server action, no change to the checker or to what is stored.

SPEC IMPACT: None.
