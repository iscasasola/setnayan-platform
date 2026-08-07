## 2026-08-07 · sec(oauth): a disconnected Google account still had its key — and Drive would do it again

**Live in production right now:** a YouTube grant revoked **2026-07-26** still holds a
103-character refresh token and a 253-character access token, with
`connection_health` reading `ok`. Someone pressed Disconnect thirteen days ago
and we are still holding a credential that opens their Google account. A Google
refresh token does not expire on its own.

🔑 **The register called this "nobody cleaned up the one already there". That
understates it.** The wipe-on-disconnect was added to the **YouTube** route on
2026-07-27 and **never added to the Drive route**, which sets `revoked_at` alone
to this day — and its comment argued that was sufficient, because `revoked_at` is
*"the source of truth for whether we'll ever use this token again."* That is the
wrong test. The question is not whether **we** would use it; it is whether we are
still holding someone's key after they asked us to let go.

So it is not one stale row. **Prod holds an ACTIVE Drive grant, and the next
Disconnect press would have recreated the problem.**

🚨 **AND IT WAS NOT TWO ROUTES — IT WAS FOUR.** The first cut of the guard
scanned `app/api/oauth`, the folder the code "should" be in. Widening it to scan
by TABLE NAME across the whole `app` + `lib` tree immediately found two more:
`app/api/photo-delivery/disconnect` and
`app/dashboard/[eventId]/studio/photo-delivery/actions.ts` — the latter not under
`app/api` at all. Both cleared the short-lived **access** token and kept the
long-lived **refresh** token, which is the one that actually re-opens the
account. **A guard scoped to the folder you expect is the same mistake as the bug
it is hunting.**

**Shipped — all four revoke paths now write the same three fields** as the
Setnayan-owned channel pool: `refresh_token: ''` (the column is NOT NULL),
`access_token: null`, `revoked_at`.
- A backfill migration wipes tokens on any already-revoked grant, in both
  credential tables. Active grants are untouched — wiping one would break a
  working connection.
- 🛡 A guard that **was verified to FAIL by name before it was trusted**: revert
  the Drive route and it reports *"drive/disconnect — sets revoked_at on
  oauth_grants without refresh_token and access_token"*. It carries two
  self-checks, because a scanner that matches nothing passes forever.

⚠ It is a **unit** test, not a new `lint-*.mjs` — wiring a lint into `ci.yml`
takes three separate edits and missing one makes it run without ever failing the
job. And not a **db** test — the PGlite replay has no prod rows, so the
assertion would pass vacuously there.

7032 unit + 853 db tests pass; typecheck and all 20 lint scripts clean.

SPEC IMPACT: None — this closes an item already recorded in `WHAT_IS_LEFT.md` §1.
