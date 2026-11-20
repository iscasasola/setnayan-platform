## 2026-11-19 · chore(ship-batch): wave 4 — #7841 #7933 #7875(+#7793)

One integration branch: merges three owner-OK'd, Opus-reviewed (SHIP) PRs onto main, then regenerates every
generated file once. #7957 and #7964 already reached main on their own (18 Nov), and #7678 was dropped from
this wave so it ships only through #7678. Also one ratchet fix on #7875's `renewal-state-card.tsx`: the
"bookings carry on" phrase is now built in a `const` above the JSX. The rendered copy is unchanged, and
`vendor-dashboard/shop` stays at its template baseline.

SPEC IMPACT: None (the member PRs carry their own fragments and spec notes).

## 2026-11-20 · fix(shop-page): a shop renewing its papers wears no "Not yet verified" marking and no Verified badge

Review blocker on the wave. v16 S6 gates the unverified markings on `!isVerifiedShop`, and #7875 shut that gate for a
shop whose papers lapsed — so a renewing shop wore "Not yet verified" on the hero, the Awards slot, the footer, every
card and photo, both notes, "What Verified adds" and the side card / quote list, beside its renewing band. Each
marking now also asks `!renewing`; the side card and the quote tray show `RENEWING_COUPLE_MARK` in place of the
"Papers not checked by Setnayan" list; the content gates (`isVerifiedShop`) are untouched. The top-bar blue check,
the card Verified medal, `awardsView.verified` and both `readShopSeals` reads now ask `&& !renewing` too. Guards:
two new tests in `lib/papers-renewal.test.ts`; main’s v16 assertions gained the renewal term (none removed).

SPEC IMPACT: None — applies DECISION_LOG 2026-11-16 "PAPERS RENEWAL (#7875)" rulings (1) and (2) as written.
