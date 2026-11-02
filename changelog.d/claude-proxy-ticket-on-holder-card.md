## 2026-10-27 · fix(guests): the stand-in gets their own row again — two rows, linked, counted once

Owner, verbatim, testing on cale-ice after #6982: *"Why does catherine sacdalan not have a qr code anymore? How can she
reply and answer rsvp"* · *"Cannot find her on the list anymore. Seems like she fused with the original guest"*; offered
A (keep one row, put her ticket on the holder's card) or B (her own row again, linked): *"B"*.

The Guest List no longer folds the proxy into the role holder (`asOnePair` → `withStandIns`, `lib/guest-proxy.ts`). The
holder's row reads "Represented by <proxy> · not counted" (it keeps `represented_by_guest_id`, so `countsTowardEvent`
leaves it out); the proxy's own row is an ordinary row — their own reply, ticket and Invite — reading "Proxy for
<holder> · <reply>". The pair still counts ONCE. Searching either name finds both. Guards updated to the new ruling:
`lib/the-pair-counts-once.test.ts` § 4 (sabotage: the old one-row file → red) and
`lib/a-proxy-stands-in-for-a-role.test.ts`.

SPEC IMPACT: DECISION_LOG row "ROLE PROXY — THE STAND-IN KEEPS THEIR OWN ROW (B)" (amends the one-row list of the
2026-10-27 proxy row).
