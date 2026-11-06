## 2026-11-06 · fix(claim): a declined claim link tells every host, not only the couple

Owner, verbatim: "all hosts get the notification". `tellCoupleTheirLinkWasDeclined`
(lib/vendor-invite-actions.ts) now sends the in-app `vendor_invite_declined` notice to
every `HOST_MEMBER_TYPES` member of the event (couple + coordinator), de-duplicated.
Still in-app only, with no email (no-new-emails rule). The two other couple-only queries in
the same file (`applyClaimAutoLink`, `registerClaimedServiceToCouple`) are unchanged.
Guard: `lib/a-declined-link-tells-every-host.test.ts`. Reverting the query to
`.eq('member_type','couple')` fails it (sabotage checked, 2 pass / 1 fail).

SPEC IMPACT: None
