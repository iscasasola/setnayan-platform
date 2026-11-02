## 2026-08-02 · fix(admin): "Last verified" could never say anything but "never" — nothing wrote it

`platform_integration_secrets.last_verified_at` was declared, documented as *"records this Resend key sent a test email successfully"*, nulled when the key is cleared (`COMPANION_NULL_ON_CLEAR`), and **rendered on `/admin/integrations`** — while **no code in the app ever wrote it.** A grep over every writer of that column finds only `vendor_profiles` (the vendor verification flow); the secrets singleton was never stamped by anything.

Found while verifying that the owner's freshly-pasted Resend key had been smoke-tested: the key was set, the test had run clean against prod, and the column was still `NULL`. Half of a rule had shipped — the half that clears it — with no half that sets it. A field that can only ever show one value is not a status, it is decoration.

**The fix.** `markResendKeyVerified()` in `lib/integrations/write.ts`, deliberately placed next to `COMPANION_NULL_ON_CLEAR` because it is that rule's inverse: one says when the stamp stops being true, the other when it becomes true. The smoke-test route calls it after a genuine send.

**Only when the DATABASE holds the key.** `resolveResendConfig()` is DB-first with an env fallback, so a successful test email proves only that *some* key works. If the key came from `RESEND_API_KEY` while the row is empty, stamping would make the console show "Last verified" directly beneath "Not configured". The update is therefore filtered on `resend_api_key_enc IS NOT NULL` **inside the WHERE clause** rather than by reading the row first — the guard and the write are one statement, so no concurrent clear can slip between a check and a stamp.

**A failed stamp cannot fail a sent email.** The helper never throws, and the route keeps `ok: result.ok` verbatim. The smoke test reports whether the *email* sent; losing a timestamp is cosmetic, whereas reporting "email is broken" when it just sent is not. The response gains a separate `verifiedStamped` field, which also distinguishes "sent, stored key now marked verified" from "sent via the env fallback, so there is no stored key to mark".

**On the tests.** `write.ts` is `import 'server-only'` and every function in it is I/O against the service-role client, so there is no pure rule to call. The five new tests are **source assertions** — a weak form used deliberately, not lazily: the alternative is mocking the Supabase builder chain, which asserts that a mock was called rather than that the query is correct. They pin the guard, its placement in the WHERE clause, the never-throw contract, the independence of the email verdict, and the symmetry with the clear rule. **Anti-vacuity checked:** deleting the guard line drops the suite to 4/5, so the test fails for the intended reason.

**Verification:** `test:unit` 6156/6156 · `test:db` 729/729 · `typecheck` clean · `lint` clean.

SPEC IMPACT: None — no SKU, price, schema or flag change. The column already existed; this writes it.
