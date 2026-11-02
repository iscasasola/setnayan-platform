## 2026-09-13 · feat(security): a couple's Drive / YouTube / TikTok connection keys are stored encrypted

Setnayan's privacy filings say these keys are stored encrypted. Measured against the
production database on 2026-09-13 they were not: **five live rows** across
`oauth_grants` (2) and `live_studio_channel_grants` (3) held Google access AND refresh
tokens as plaintext (`ya29.` / `1//`). `patiktok_oauth_grants` was empty. LAU-6 / CP-3.

- **`lib/oauth-token-vault-core.ts`** (pure) decides the one thing that can be got
  wrong: is a stored value one of our sealed envelopes, or a token written before
  sealing existed? Decryption settles it normally — AES-GCM's auth tag — and the shape
  rule is consulted only when decryption fails. It fails **closed**: an envelope we
  cannot open is never sent to a provider as a bearer token.
  ⚠ A plaintext Google refresh token is base64-shaped, so the provider prefixes are
  what make the rule correct, not decoration.
- **`lib/oauth-token-vault.ts`** (server) seals, opens, and upgrades legacy plaintext
  in place — best-effort, so a failed re-seal can never break a photo upload.
- Wired through every site touching a token column: the three refresh paths, the four
  OAuth callbacks, the refresh cron, and all five Live Studio grant sites — including
  the **revoke** path, which must send the provider the OPENED token or the grant
  stays live at Google while our row says revoked.
- **All six new sealed columns joined the key-rotation sweep.** A sealed column the
  sweep does not know about becomes permanently unopenable the moment
  `ENCRYPTION_KEY_PREVIOUS` is dropped — every couple's connection would die at once.
- **No migration and no new column.** The key lives in the application, so no SQL could
  seal an existing value; ciphertext is text and the column is text. A new column would
  also inherit the public grant and need an exposure-baseline line for no benefit.

**A couple who is already connected sees nothing.** No reconnect, no reauthorisation:
a read that finds plaintext uses it and seals it in place, and Google access tokens
refresh about hourly, so the live rows convert within a normal day of use.

Two register corrections, both measured: `ENCRYPTION_KEY` **is** set in Vercel
production and demonstrably working (the Resend key is sealed with it), so this row was
never blocked as the pack claimed; and `events.photo_delivery_oauth_token_encrypted`
holds zero values — a column named "encrypted" that nothing writes.

Guards: `lib/connection-keys-are-encrypted.test.ts` (14). Eight sabotages each turned it
red — dropping the provider prefixes, returning ciphertext instead of failing closed,
un-sealing one callback, dropping a column from the rotation sweep, sending the envelope
to Google on revoke, spending a token without opening it, and two shapes of log leak.
🪤 The first log pin was **inert** against an object second argument; it now requires a
lone string literal.

SPEC IMPACT: None — the filings already state that these keys are encrypted. This makes
the code match the document rather than changing what is promised.
