## 2026-08-02 · fix(security): drop the unregistered `setnayan.ph` from the R2 CORS allowlist

Audit of every place the platform publishes or sends to a `@setnayan.ph`
address. **The headline finding is not the one we went looking for.**

**`setnayan.ph` is NOT REGISTERED.** The starting report was "it has no MX
records, so it silently discards mail." True but understated — the domain has
**no NS delegation at all**. It appears to resolve (`A 45.79.222.138`) only
because the `.ph` registry runs a wildcard NXDOMAIN lander:

```
dig +short A setnayan.ph                      → 45.79.222.138
dig +short -x 45.79.222.138                   → k8s-svc-lander-dotph-NXD-us-southeast-01.parklogic.net
dig +short A <random-nonexistent>.ph          → 45.79.222.138   ← same IP, proves the wildcard
dig NS setnayan.ph                            → (none; authority = the `ph.` SOA)
```

So the domain is not ours, is not delegated, receives nothing, and today serves
a third-party parking/ad page to anyone who visits it. Anyone can buy it — our
own `API_Integration_Checklist.md` still lists "Register `setnayan.ph` (via
PHNic)" as an **unchecked** box, while the summary table two sections earlier
marks domain registration `✅`. The checkbox was right.

### What this changes in code (the only code hit)

`apps/web/scripts/r2-cors.sh` allowlisted `https://setnayan.ph` and
`https://www.setnayan.ph` as browser origins across **all five** R2 buckets —
including `setnayan-vendor-contracts` and `setnayan-vendor-verification`, which
hold vendor ID documents — with `GET, PUT, HEAD` and `AllowedHeaders: ["*"]`.

Allowlisting an origin on a domain **anyone can purchase** is pure downside:
nothing legitimate can be served from it today, and the day someone registers
it they inherit a browser origin our buckets already accept. This is
defence-in-depth, not an open door — CORS relaxes browser policy, it does not
mint credentials, so a presigned URL would still be required. But it is dead
weight that only ever becomes a foothold, and it costs nothing to remove.

Dropped from `DEFAULT_ORIGINS`. The `R2_CORS_ORIGINS` env override still lets
the owner re-add it without editing the file if the domain is ever registered
and pointed at Vercel.

### What was deliberately NOT changed

- **`lib/custom-domain-resolve.ts` keeps `setnayan.ph` in `isSetnayanHost()`.**
  It reads like a stale reference to a domain we don't own, but its load-bearing
  consumer is `vendor-dashboard/website/actions.ts:55`, which *rejects* a vendor
  trying to claim a Setnayan domain as their own custom domain. Removing `.ph`
  would let a vendor attach `setnayan.ph` the moment someone registers it. The
  entry is protective — it stays.
- **No email address was rewritten.** There are **zero** `@setnayan.ph`
  addresses in the repo, in the spec corpus, or in prod. Every published contact
  address is already `@setnayan.com`. The `.ics` VEVENT UID pattern
  `{event_id}-{line_item_id}@setnayan.ph` in the corpus is an RFC 5545 UID, not
  a mailbox — it is never delivered to and is correct as-is.

Verified (prod, `njrupjnvkjkitfctetvi`, SELECT only): a scan of every text/jsonb
column in `public` for `%setnayan.ph%` returned **0 rows**; the identical
scanner run for `%setnayan.com%` returned 8 populated columns, proving the
scanner works rather than silently reading nothing. `auth.users`: 0 of 8.

Verified (this change): `bash -n` clean; the emitted `CORSRules` JSON re-parses
and retains every `.com`/Vercel/localhost origin.

SPEC IMPACT: `API_Integration_Checklist.md` § 1.6 and `Installed_Stack_Inventory.md`
still imply `setnayan.ph` is registered, and three **ADOPTED** NPC compliance
documents declare it to the regulator as a Setnayan public domain. Not corrected
here — regulator-facing copy is owner/counsel territory, flagged for sign-off.
