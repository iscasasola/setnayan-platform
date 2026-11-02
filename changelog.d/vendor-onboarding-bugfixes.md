## 2026-07-21 · fix(vendor-onboarding): stop bouncing new vendors to /login, stop wiping step 2, stop rejecting phone photos

Four independent drop-off bugs on the vendor signup path, found by a grounded audit of `/signup` → `/open-shop` (`Vendor_Onboarding_Redesign_Verdict_2026-07-21.md` PRs 1–2). No design change, no owner sign-off — these are defects.

**1 · A brand-new vendor was asked to log in again, immediately.** `signup/actions.ts` unconditionally redirected an AUTO-CONFIRMED signup to `/login?ready=<email>` — so someone who had just chosen a password was made to retype it seconds later, at peak intent, on a phone whose password manager had already closed. The password is still in scope from the FormData read, so the auto-confirmed branch now calls `signInWithPassword` and redirects straight to `next` (`/open-shop`). **Strictly additive:** any sign-in error falls through to the exact `/login?ready=` redirect that shipped before, so this path can never be worse than today.

⚠ **Ordering trap, handled.** The defensive cookie downgrade that honours an unchecked "Stay signed in" ran *before* both redirect branches. Signing in after that point re-writes persistent `sb-*` cookies and would have silently defeated the checkbox. The downgrade is now a small helper invoked by each branch **after** any session write — same behaviour for the check-email path, correct behaviour for the new one.

**2 · Step 2 discarded everything on a server rejection.** Step 1 had three client checks; step 2 had **none**, and none of its inputs carried `required`. A blank phone or `juan@gmail` reached the server, which redirected to `?error=`, and the wizard — `useState<1|2>(1)` — remounted at **step 1** with all three step-2 values gone, because none had ever been written to the DB that the `defaults` prop reads from. The vendor retyped the lot.

Fixed at both layers: a `submitGate` mirroring `next()`, and `&step=2` on every step-2 rejection so the wizard resumes where the vendor was. The `step` param is threaded through the page and seeds the wizard's initial state. **Both are needed** — the client gate removes the pointless round trip, and the param is still required because the server rejects shapes the client accepts (and any DB error redirects here too).

New `lib/open-shop-validation.ts` holds the email regex and the exact error strings, imported by **both** the server action and the client gate, so the two layers cannot drift into disagreeing about what "valid" means — which is the failure mode that turns a client gate into a second bug rather than a fix. (It lives in `lib/` because `actions.ts` is `'use server'` and may only export async functions.)

**3 · A photo of your own storefront was rejected with no remedy.** The logo `<FileUpload>` capped at `maxSizeMB={2}` and did not pass `compressImage` — and the size check runs *before* compression, so a 3–6 MB phone photo of a tarpaulin or shop sign was refused outright. Now `maxSizeMB={10}` with `compressImage`: raising the cap is what admits the phone photo, compression is what keeps R2 small. `compressImageForWeb` already exists, is already dynamically imported, and returns the original on failure, so it cannot throw.

Also added `image/heic` + `image/heif` to `acceptedTypes` — `file-upload.tsx` already maps `.heic`/`.heif` to `image/heic` and then rejected it against the accept list, so an iPhone user picking via Files rather than Photos hit a confusing dead end.

**4 · The third email, and the optional city.** `contact_email` now defaults to the account email — it was the **third** time a vendor typed an email address in one flow (still editable). And `location_city` is promoted from "· optional" to required on both layers: a city-less listing cannot be ranked, filtered by couples, or given a screen-name namespace, so it is invisible in practice.

**NOT in this PR — deliberately.** Making the shop logo **optional** (43 of 50 live `vendor_profiles` have `logo_url` NULL, so the requirement is already universally unmet) needs owner sign-off: it softens iteration 0022 § 2.1b *"mandatory company logo upload at registration"* to mandatory-at-publish. The publish gate in `lib/vendor-profile.ts` already blocks `is_published` without a logo, so deferring it would not let anyone go public logo-less — but that is a spec change, not a bug fix, and it is not bundled here.

SPEC IMPACT: None. `Vendor_Onboarding_Redesign_Verdict_2026-07-21.md` records the full plan; PRs 1–2 ship here minus the logo item, which stays open as sign-off §5.
