## 2026-07-21 · fix(vendor-verification): make "logo required before verification" actually true — and stop trapping the vendors it created

Follow-up to #3471, which merged before verification finished. Verification then found the change **did not achieve its stated goal**, and had opened a trap. Both are fixed here; #3471's product decision (owner decision 4 — _"shop logo is only required before verification. starting your shop can start as name, next is completing the profile, then verification"_) is unchanged and still correct.

### 1 · The goal was not met — verified with `logo_url` NULL was reachable (HIGH)

#3471's summary claimed the vendor-side submit gate was the single point of enforcement. It is not. `/admin/verify` has **two** paths that write `verification_state = 'verified'`, neither of which consulted the profile:

- `transitionVendorVisibility({ nextVisibility: 'verified' })` — the marketplace Approve button. Since the flip also advances `verification_state`, an admin could mint a fully verified vendor **who never submitted an application at all**.
- `applyApplicationDecision` `case 'approved'` — an application can be submitted while complete and approved later; nothing re-checked at approve time.

Both now run **`verificationApprovalRefusal`** (new, `lib/vendor-profile.ts`) before anything is written — before the audit-log insert, so a refusal writes nothing. **Deliberately no admin override**, and that is now explicit in code rather than accidental: approving an incomplete profile produces exactly the vendor this workstream exists to prevent — one who is verified, therefore identity-locked, therefore (see §2) stuck. Refusing costs an admin one sentence naming the missing field. Reject / hide / archive are untouched: marketplace moderation must never be blocked by profile gaps.

### 2 · The trap: a verified vendor with no logo could never add one (HIGH)

`logo_url` is one of the 8 `LOCKED_IDENTITY_FIELD_KEYS`. Once `public_visibility = 'verified'`, `updateVendorProfileField` rejected a logo edit with `VERIFIED_LOCK_ERROR` and `saveVendorProfile` stripped it from the write. The documented escape hatch — `requestProfileCorrection` — **has no UI wired to it anywhere in the app** (grep it: the only two references are its own definition and a comment). So combined with §1, a logo-less verified vendor had **no path in the product to ever add a logo**. That is strictly worse than the pre-#3471 behaviour, where the logo was collected up front, and it needed fixing regardless of how §1 was resolved.

New shared predicate **`isLockedLogoCompletion`** (`lib/vendor-corrections.ts`): **blank → non-blank on `logo_url` is allowed while verified; everything else stays locked.** Adding a missing logo is a *completion*, not a *correction* — the lock exists to stop a verified shop from **changing** the identity an admin signed off on, not from filling in a field that is empty. Clearing a logo is never a completion. Honoured by both write paths (the inline field editor a real vendor uses, and the full-form strip).

### 3 · The gate was invisible where the vendor acts (MEDIUM)

`SubmitCard` on `/vendor-dashboard/verify` took only `(applicationId, completeCount, totalSlots)` and computed eligibility from **document slots only**. A logo-less vendor saw an **enabled** submit button, clicked it, and was bounced by the server. Removing a requirement from the door only to spring it silently three screens later is the same drop-off bug class the whole workstream exists to fix. The card now receives `profileMissing` from the same probe the action uses, disables submit, and names the outstanding fields with a link to My Shop.

### 4 · A re-typed literal re-introduced the drift class (MEDIUM)

`verify/actions.ts` branched on `gateReasons.includes('Finish your business profile')` — a string literal owned by another module, in a PR whose own thesis is that client and server must not drift. Now `VERIFICATION_MISSING_PROFILE`, exported from `lib/vendor-verification.ts` and imported. A test asserts the literal does not reappear at that call site.

### 5 · A resilient read became a false accusation (MEDIUM)

`selectVendorProfileBy`'s LEGACY fallback deliberately returns `hq_address` / `business_owner_name` / `in_business_since_year` as **NULL**, with a comment saying the completion gate reads them as "missing". Harmless while completeness only dimmed a progress ring. **Now that completeness gates verification, the answer is: permanently BLOCKED, not ungateable** — one transient PostgREST/RLS hiccup and a fully-complete vendor is refused, and told three fields they already filled in are missing. Fail-closed on a lie.

New **`probeBusinessProfileCompleteness`** reads only the 8 checklist columns and **reports failure as failure** instead of laundering it into "incomplete". Callers surface _"we couldn't check — try again"_, never a field list. Used by both submit paths, the /verify page, and the admin guard. The LEGACY fallback keeps its resilience for display; a comment now says it must never decide a gate.

### 6 · A test docblock that overstated its coverage (LOW)

`lib/open-shop-logo-gate.test.ts` claimed to assert "the same field set as the save-time gate" and only checked that the logo label existed. The suite now **source-scans the publish gate block** and asserts the `BUSINESS_PROFILE_LABELS.*` keys it enumerates are **exactly** the checklist's key set. 5 cases → 14, including two mutation-verified guards (deleting either admin-path guard, or the logo-completion exception, fails the suite — checked by actually deleting them).

### Reported, not fixed — pre-existing RLS

`supabase/migrations/20260513120000` `vendor_profiles_owner` is `FOR ALL TO authenticated USING (user_id = auth.uid())` with **no column restriction and no column-level GRANT anywhere in the migration tree**. An authenticated vendor can therefore PATCH their own row directly through PostgREST and set `verification_state`, `public_visibility`, `tier_state` or `logo_url` themselves, bypassing every app-layer gate in this PR (and self-triggering the `verified_vendor_token_bonus` trigger). Pre-existing, far larger than this change, and deliberately **not** touched here — flagged for the owner.

Verified: `tsc --noEmit` exit 0 · `next lint` exit 0 (13 pre-existing warnings, 0 errors) · `tsx --test "lib/**/*.test.ts"` = **2506/2506 pass**.

SPEC IMPACT: Iteration 0022 § 2.1b — #3471 softened "mandatory logo at registration" to "mandatory before verification"; this PR adds the two mechanisms that make that sentence enforceable and survivable, and both are worth a corpus row: (a) **admin approval is refused, with no override, when the business profile is incomplete** — a new rule for the 0023 admin verification queue; (b) **the verified identity-lock now exempts blank → non-blank on `logo_url`** — "adding a missing field is a completion, not a correction" (0022 § verified-lock / correction-requests). Surfaced for owner sign-off rather than assumed: (a) removes admin discretion that previously existed de facto.
