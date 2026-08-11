## 2026-08-11 · feat(admin): a shop's address can finally be corrected — by us, once, with forwarding

**Permanent-by-design was right. Having no remedy at all was not.**

`vendor_profiles_business_slug_immutable` refuses to move a shop's address, and
should: it is on save-the-dates, printed QR codes and the sitemap. Its own
migration named the remedy — *"a deliberate correction must set
`setnayan.allow_slug_change = 'on'`"* — and **nothing was ever built that does**.
The escape hatch had zero callers outside its own test. So a typo minted at
registration, a trademark complaint, or an address derived from a name the
business has since corrected had **no remedy for anyone**, including the
Setnayan team. The only fix was a hand-written UPDATE by whoever had the
database password.

⛔ **The trigger is NOT weakened.** This adds the one door it already
anticipated, behind the service role and an admin session.

- `admin_correct_business_slug()` (`20271132819490`) — moves the address **and
  writes the `vendor_profiles` forwarding row**. A correction without forwarding
  inflicts exactly the harm the trigger exists to prevent; it only changes who
  caused it. `entity_type='vendor'` has been permitted since the table was
  created and had **never once been written**.
- 🔑 **The hatch is opened by a function-level `SET`, not `SET LOCAL`.** `SET
  LOCAL` in a function body lasts to the end of the *transaction*, so a caller
  doing more work would still be holding the door open unknowingly. Proved by
  mutation: swapping to `SET LOCAL` makes the leak test go red **and
  contaminates every later test in the file**.
- Availability is decided by the caller's `findSlugConflict` — the one answer,
  five sources, fails closed — and deliberately **not** re-derived in SQL. A
  second thinner copy is exactly how the auto-mint and the wizard came to
  disagree.
- `/admin/corrections` gets a direct form. ⚠ **Direct, not a queue item, because
  nothing can file a request** — `requestProfileCorrection` has zero callers, no
  screen renders it, and production holds zero rows. Routing the only remedy
  through an intake-less queue would have shipped a fix nobody can reach. The
  applied row is still written, with the before, after, reason and who.

### 🚨 A live defect found while building this

`location_city` was added to `LOCKED_IDENTITY_FIELD_KEYS` on 2026-08-10 and to
the admin apply path — but **not** to the `field_key` CHECK constraint, whose
own source comment says *"never widen one without the other"*. Prod's constraint
still listed eight fields. A city correction was **rejected by the database**,
and the writer turns any insert error into "please try again shortly" — so it
would have failed forever while reading like a hiccup. Rejected, not thrown; the
only symptom is an absence.

Also fixed: the request writer's snapshot select omitted `location_city`, so
`current_value` recorded null and an admin would have reviewed "change City from
(blank)" unable to tell an empty field from an unfetched one.

🛡 8 db tests, three mutation-proved (constraint parity · the forwarding write ·
the hatch leak) — plus the trigger is re-asserted **still shut** afterwards, so
this path can never quietly become a demolition.

SPEC IMPACT: DECISION_LOG.md — an admin correction path exists for a shop
address; the address stays immutable to everyone else.
