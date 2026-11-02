## 2026-10-12 · fix(guest): Reply carries the landing's code — a guest without the pass is asked, never sent to the door

Live fault on d2e38b7: the owner opened a guest's personal link signed out on
`maria-and-jose` (dated → Invitation stage), pressed "Reply to the invitation"
and landed on the stranger door ("Get inside · Upload your QR · Sign in").
Production showed the landing rendered WITH the guest pass (its re-entry code
was never spent) and the Reply's request, 13 s later, arriving with none — so
`app/[slug]/invite/reply/page.tsx`'s `if (!canvas && !session) redirect(/{slug})`
sent the guest to the door. The landing already held the tool for this — its
single-use re-entry code (`?k=`) — but the Reply link dropped it and the reply
page had no fallback (the landing has one).

Now every Reply on the landing carries the landing's code (`replyHrefCarrying`),
and the reply page, finding no pass, spends it at `/{slug}/redeem?k=…&to=reply`
and comes straight back to the questions (`replyEntry`, lib/guest-pass-hop.ts;
the redeem's new `to=reply` destination). No sign-in, no account — owner: "you
can still reply without an account". A stranger with no code still meets the
door; a guest holding the pass spends nothing; the Save the Date landing still
offers no Reply. Not reproduced in Chromium on the same live guest (the
browser was desktop Safari); why Safari lost the pass is not determined.

Guard: `apps/web/app/[slug]/invite/reply/a-guest-without-the-pass-still-replies.test.ts`
(red on main 4/5; each of four sabotages reddens its own test).

SPEC IMPACT: None — restores the locked guest path (personal link → landing →
Reply → questions, no account); no decision changed.
