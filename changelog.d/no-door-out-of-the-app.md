## 2026-09-10 · fix(vendor-page): no door out of the app — a couple reaches a shop through Setnayan, never around it

Owner, verbatim, 2026-09-10: *"our goal is to let them integrate their event with the
vendor they find. not to let them communicate outside the app"*. The booking fee is
charged on SOURCED clients, so a couple who finds a shop here and then emails or calls it
books off-platform — no fee, no in-app record, no lock, no price freeze, no protection.

Measured on `origin/main`, FIVE exits, two printed and three not:

- **Public shop page** (`/v/[slug]`, also the bare `/{slug}`) printed every bookable
  shop's email as `mailto:` and phone as `tel:`, signed out. Gone — and the page no
  longer FETCHES either field. The row now says "Replies in your Setnayan inbox" (a
  statement, not a second Inquire button a few centimetres from the real one). The
  shop previewing its own page sees one line explaining why. The Inquire section's
  "Identity stays masked until you choose to share" — false twice over — is replaced
  with what is true of the in-app path.
- **The couple's supplier card** (workspace) offered `tel:` + `mailto:`; its fetch no
  longer selects them, and the card offers the conversation instead.
- **The workspace summary** printed the booking row's contact, which a package lock fills
  with the SHOP's own email/phone — now only for an off-platform supplier the couple typed.
- **The budget card** pre-filled that copied address into the Messages "start a thread"
  box, in plain sight — now only an off-platform supplier's couple-typed email.
- **The couple's Vendors page** carried every supplier's email/phone inside a client
  prop (page payload) — the fields had no reader and are dropped.

Copy that pointed couples at a shop's email (Messages empty state, the help article, the
first-run tour, the vendor signup email) now points at Message / Inquire. Unread
`contact_email` selects are dropped (explore, the thread page, two in vendor-invites).

**Kept, deliberately:** a shop's own dashboard/My Shop, admin/staff surfaces, the shop
claim flow, a BOOKED coordinator's address on the hosts page (the destination of the
in-app delegate invite), emails Setnayan sends TO a shop, and an off-platform supplier's
contact the couple typed themselves.

**Open, for the owner, untouched:** the shop's external website link, portfolio
link-outs to Instagram/Facebook/TikTok posts and song "Watch them play it" links, and
contact details a shop types into its own free text.

**Guard:** `lib/no-door-out-of-the-app.test.ts` — file set DERIVED from every
couple/public route entry point's import graph. Rule 1 computed `mailto:/tel:/sms:/wa.me…`
links · Rule 2 printed contact fields (JSX + template strings) on an exact bill whose
lines must prove the gate their reason names · Rule 3 a `vendor_profiles` read naming a
contact field · Rule 4 (behavioural) the Vendors-page client model carries none · the
retired sentences stay retired. 10 mutations, each needle/added-string count printed,
all RED.

**Not closed here:** `vendor_profiles.contact_email` is SELECT-granted to `anon` and
`contact_phone` to `authenticated` (measured in prod 2026-09-10), so both are one
PostgREST call away regardless of the UI. Closing that is a column revoke (a migration).

SPEC IMPACT: Yes — a product principle. `DECISION_LOG.md` 2026-09-10 (the principle
row already exists; a follow-up row records what shipped, what survives and the open
decisions).
