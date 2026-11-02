## 2026-09-02 · docs(owner): publish the Google OAuth app before 2026-09-07

Docs only — no code, no migration, no schema.

The Live Studio pool channel's Google refresh token was issued 2026-08-31 10:37 UTC.
Google issues 7-day refresh tokens to apps whose publishing status is **Testing**, and
refreshing does not reset that clock — it runs from issuance. It therefore dies
**2026-09-07 10:37 UTC**.

`goLivePanood` has preferred a pool channel since Wave 9, with BYO only as its fallback,
so when that token expires the **Go live button stops working for every event — the free
single-camera tier included**, not merely for Live Studio purchases.

🔑 It will not present as an expiry. `connection_health` reads `ok` right up to the moment
it doesn't, because nothing measures the refresh token's AGE — only whether the last
refresh succeeded, and hourly refreshes keep succeeding until the fuse burns out. It will
surface as "YouTube could not create the broadcast", the same sentence a dozen unrelated
faults produce.

`OWNER_ACTIONS.md` gains a dated section with the console steps, the re-measuring SQL, and
the check that actually proves it worked: **`granted_at` must move**, because
`last_refreshed_at` moving is not evidence — it moves on its own every hour and says
nothing about the fuse.

⚠ The section flags an honest unknown rather than papering over it: Google documents that
a Testing-status app *is issued* 7-day tokens, but does not document what happens to a
token already issued that way once the app is published. The steps therefore treat
reconnecting the channel as required, not optional.

Also recorded there: publishing is NOT verification. Unverified-in-production keeps the
"Google hasn't verified this app" screen and the 100-user cap — and neither binds the
pool, which authenticates a handful of Setnayan-owned accounts. The cap only ever binds if
couples connect their own channels through our app, which the BYO path shipped in #5093
deliberately avoids.

SPEC IMPACT: None. Operational deadline, no product decision.
