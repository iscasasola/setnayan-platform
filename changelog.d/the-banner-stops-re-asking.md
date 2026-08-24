## 2026-08-24 · fix(legal): the cookie banner stops re-asking people who answered

Owner ruled 2026-08-23: **"fix the bug."**

The choice lived **only** in `localStorage`, written by script. Safari's
Intelligent Tracking Prevention **deletes all script-writable storage after
seven days without a first-party interaction** — localStorage, IndexedDB and
`document.cookie` alike. Answer once, come back a fortnight later, get asked
again, on a device where nothing was broken.

⚖ **HOW THAT DIAGNOSIS WAS REACHED, and it was NOT observed.** I did not watch
Safari purge anything, and say so rather than implying I did. What was checked is
everything else: the storage key has **never been version-bumped** (one commit in
its entire history), the banner's own show/hide logic is correct, and the
origin-split theory was already eliminated. Storage lifetime is what remains, and
the known Safari behaviour matches the symptom exactly.

🔑 **`document.cookie` WOULD NOT HAVE FIXED IT — the trap in this fix.** ITP's
seven-day cap is about **how a value was written**, not what it is: a cookie
written by script is capped exactly like localStorage. Only a `Set-Cookie` from
our own server escapes it. That is the entire reason `POST /api/cookie-consent`
exists rather than one more line in `writeConsent`.

⚖ **IT STAYS PER-DEVICE AND ANONYMOUS — the line this must not cross.** A cookie
on the browser that answered, and nothing else: **no database row, no account,
no identifier**. Keying consent to a USER would create an RA 10173
proof-of-consent record, which is a **DPO decision the owner has not made**. A
test fails if the route ever reaches for a Supabase client.

Both stores are kept and the cookie is read FIRST: on the visit where the purge
has happened it is the only record there is, and keeping localStorage means
nobody who decided before this shipped is asked again.

🛡 **6 mutations, all measured, all red:** back to a script-written cookie ·
localStorage read first · expiry shortened to a week · `httpOnly` (which would
make the banner flash at returning visitors) · the route reaching for the
database · the localStorage write dropped.

✅ typecheck clean · lint exit 0 · **test:unit 9776/9776**.

SPEC IMPACT: closes W2-A's cookie-banner item.
