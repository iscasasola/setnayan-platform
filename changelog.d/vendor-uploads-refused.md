## 2026-08-10 · fix(uploads): no vendor could send a verification document — every upload to their own shop was refused

🔴 **This blocked the entire vendor pipeline.** Everything a vendor sends about their shop is filed under `vendors/<vendorProfileId>/…`: the logo on My Shop, portfolio and service photos, the payment QR, the booth poster, and **the DTI registration, BIR 2303 and Mayor's Permit that verification runs on.** All of it answered **403 "That upload location isn't allowed."**

Documents gate approval, and approval gates a shop going public — the owner's model is *"their website will be live upon verification."* So the consequence was not one broken button: **no vendor could ever become verified, therefore no vendor shop could ever go live.**

### The cause is a default that was true when it was written

`tenancyForPathPrefix` reads the first path segment to decide which table can confirm the id. `chat` → threads, `payments` → orders, and **everything else falls through to `event`**. `vendors` was in no set, so a **vendor** id was checked against `events`. A `vendor_profile_id` is `gen_random_uuid()` and has nothing to do with events, so the read returned nothing every single time.

🔑 **The file's own comment predicted this and was read as reassurance.** It says *"an event check is the stricter one for every current caller"* — true when written, and falsified by every new prefix without a line of that file changing. `payments/<orderId>` broke this way in August; `vendors` is the same bug one prefix later. **A fall-through default is a claim about callers that do not exist yet.**

⚠ **Measured, not reasoned.** Production holds `r2://setnayan-media/vendors/51858369-…/logo/…` for the shop `setnaprod`. That UUID is its `vendor_profile_id`, and it matches no row in `events` or `chat_threads` — confirmed by query. The object exists only because it was uploaded before this guard shipped. The identical upload is refused today.

### Sweeping instead of stopping found a second one

`profile-photo/<authUserId>` carries a **user** id. Same fall-through, same 403 — **nobody could change their profile picture**, couple or vendor, on the only screen that offers it. Nothing pointed at it; it turned up only because the next step after fixing `vendors` was to enumerate all **eighteen** prefix roots and ask what id each actually carries.

The other sixteen are fine: nine genuinely carry an event id, `chat` and `payments` have their own arms, and `merchant-qr/<kind>` · `onboarding/background-music` · `papic/seat-N` · `taxonomy/<slug>` · `refinements/<leafKey>` carry no UUID at all, so this module correctly says nothing about them.

🔑 **`user` is confirmed by comparing ids, not by reading `users`.** The row there is created by a trigger, and a check depending on it would refuse the very first upload of a brand-new account — swapping one silent refusal for a rarer, harder one. The route already knows who is calling.

### The guard that was green on all of this

`upload-prefix-tenancy.test.ts` scans the repo for every `pathPrefix` and asserts each resolves to a checkable kind. It found `vendors` — and **accepted it, because the fall-through answer is `'event'`, which is on the accepted list.** It proved the route KNEW A KIND. It never proved the check COULD PASS. Same disease as the duplicate-payment guard that queried a non-existent enum value.

It now scans as before, but every discovered root must also appear in a written declaration of *which id it carries*. A new upload surface fails the test until somebody writes that down — and writing it down is the moment the mistake becomes obvious. 🔑 **One side generated, one side declared: two hand-typed lists drift together silently; a generated list checked against a declared one cannot.**

Mutation-tested four ways — removing the vendor root (3 fail), removing the user root (3 fail), pointing the vendor arm back at `events` (1 fail), and neutering the identity comparison (1 fail).

Verified: **7334/7334** unit · 20/20 `lint-*.mjs` · `tsc` clean.

SPEC IMPACT: None — no product rule changes; a shipped rule starts working.

### Follow-up, same PR: the secret scanner was right

The first push failed `secret scan`. The test had pinned a **real production auth user id** as `const AUTH = '…'`, and gitleaks flagged it as a generic API key on entropy.

Not a false positive worth suppressing. A high-entropy literal sitting next to a name like `AUTH` is genuinely indistinguishable from a leaked key, and a scanner able to tell them apart is a scanner that can be talked out of firing. The prod id belongs in the finding, not in the repo — the test only ever needed the **shape** of a UUID. Both constants are now obviously synthetic (`00000000-0000-4000-8000-…`) and named for what they represent.

🪤 **AND REMOVING IT IN A FOLLOW-UP COMMIT DID NOT CLEAR THE JOB.** gitleaks scans **commits, not the working tree** — the finding kept naming the original commit sha long after the file was clean, because the value was still sitting in branch history. A second green-looking fix that changes nothing is worse than no fix: the file reads clean, so the obvious next move is to suspect the scanner. **The history is the artefact being scanned, so the history is what had to change** — the branch was squashed to a single commit in which the value never appears. Verified before pushing: remote tip equalled local `HEAD` (so no concurrent session's work was at risk), the tree was byte-identical after the squash, and a `git log -p` over the branch matches the id zero times. Pushed with `--force-with-lease`.

⚠ **Pre-existing, not fixed here:** `lib/verification-docs.test.ts:22` pins the same real vendor id and passes the scan only because its variable is called `VP` — no keyword for the rule to catch. Flagged separately rather than widened into this PR.
