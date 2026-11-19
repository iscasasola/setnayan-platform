## 2026-11-17 · fix(settings): the renewal reminder's Unsubscribe reaches a real place

From the couple-dashboard audit (dead links): `lib/subscription-renewal-emails.ts` › `renewalUnsubscribeHeaders` set `List-Unsubscribe: <${APP_URL}/settings/notifications>` with RFC 8058 one-click. That page never existed (`lib/vendor-email-triggers.ts` already records the same for the supplier side), so a mail client's Unsubscribe POSTed to a 404 and the buyer stayed subscribed. It now carries the house shape every sibling relationship mail carries (`guestReminderUnsubscribeHeaders`): `mailto:` support with the one-click pair.

Guard: `lib/renewal-unsubscribe-reaches-a-real-place.test.ts` (red on `origin/main`).

SPEC IMPACT: None
