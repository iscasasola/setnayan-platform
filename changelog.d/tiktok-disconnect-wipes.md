## 2026-08-07 · sec(tiktok): the fifth and sixth leaking revoke paths — and the privacy notice I made false

**This corrects my own work from an hour ago.**

PR #4224/#4225 fixed four Google revoke paths to erase the credential on
disconnect. PR #4231 then rewrote the privacy notice to say, in public:

> *"The moment you disconnect, we erase the stored keys."*

**That was false for TikTok.** Its disconnect set `revoked_at` alone and kept a
live refresh token. **I replaced an unimplemented promise with a different
unimplemented promise** — the exact defect that PR existed to fix.

🔑 **THE GUARD MISSED IT BECAUSE ITS TABLE LIST WAS HAND-TYPED.** It scanned
`oauth_grants` and `live_studio_channel_grants`. TikTok stores its grant in
`patiktok_oauth_grants` — a third table, invisible to a guard written the same
hour. **That is the second scoping miss on this one guard**: first the folder
(`app/api/oauth`, which hid two Google routes), now the table list.

*A hand-typed list is silent about the thing nobody typed into it.*

**Widening it to that table immediately found a SIXTH path** — the TikTok
connect callback. Reconnecting soft-revokes the previous grant and inserts a new
one, and the old grant kept its tokens **forever**. Arguably worse than the
disconnect case, because it happens on a perfectly ordinary action nobody thinks
of as revoking anything.

**Both now write the same three fields as every other route:** `access_token`
null · `refresh_token` `''` (the column is NOT NULL) · `revoked_at`.

The public sentence is now true for every provider.

🛡 Guard widened, self-check raised from ≥3 to ≥4 matched revoke sites, and
re-sabotaged after widening: reverting the TikTok disconnect fails naming that
exact file.

🔒 Prod holds **0** rows in `patiktok_oauth_grants` — nothing was exposed.

SPEC IMPACT: None.
