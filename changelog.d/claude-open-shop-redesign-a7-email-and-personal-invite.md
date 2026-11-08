## 2026-11-07 · feat(open-shop): the claim door's account slide gets "Continue with Email", and Setnayan's personal invite moves to the claim door

Owner 2026-11-07, verbatim to both questions: "Yes" (Continue with Email on the claim door) · "yes" (the Setnayan
admin invite — the personal invite with "Your offer" — moves to the new claim door too, pre-filled, keeping the offer).

- **Continue with Email.** The account slide now offers Google · Apple · Email. Choosing Email hides Google and Apple and
  shows one grey "Use another way" that brings them back (v21's rule). Below it: the email box (pre-filled from the
  invite, `vendor_invites.email`, else the couple's `event_vendors.contact_email`, with the hint "your login, never shown
  on your page"), the shipped `PasswordField mode="new" quiet` (one rule line, ticking as they type; the leaked-password
  check speaks only on submit), the role field and the Terms tick. With no Google / Apple enabled on the shell, Email
  is the only way and starts open.
- **The shipped /open-shop account path, nothing new.** `finishClaimDoor` runs `decideOpenShopAccount` →
  `createVendorAccountForShop` (breach check · blacklist · Turnstile · signUp · the verification switch), and only
  after the invite is known to be usable, so a dead link never mints an account. `createVendorAccountForShop` gains an
  optional `confirmNext` (default `/vendor-dashboard`, so the wizard is unchanged): the door passes its own account
  slide, so with verification on the email link signs them in and returns them there to press "Claim it". A taken
  email becomes the shipped `TakenSignIn` in place (it gains a `next` prop for the same reason). The bot check
  (`<TurnstileField action="signup" />`) rides inside the finish form, which is now a layout-free `contents` wrapper
  holding the account slide's email body. The kept draft moved from sessionStorage to localStorage so the email link
  (which can open a new tab) finds it; the password is never in it. The shop's contact email is still the signed-in
  account's (`contact_email: user.email ?? null`), never a typed one.
- **Setnayan's personal invite → the claim door.** The claim page's admin branch now builds its "Claim & sign up" with
  `claimDoorHref(invite.claim_token)`, like the couple and auto-share branches; an email that already runs a shop still
  signs in through finalize. `/signup?as=vendor` no longer appears anywhere on the claim page. `readClaimDoor` opens an
  admin invite through `readSetnayanInvite`: pre-filled from the shop the admin staged (`claimed_vendor_profile_id`,
  no owner yet), else the invite's own snapshot, plus the offer rows via the claim page's own `readInviteOffer` →
  `doorOffer`. The finish calls the SAME `claim_ready_the_invited_shop` finalize calls for admin invites, so the
  staged shop is handed over and the offer is applied by the shipped mechanism, then lands on Your details as finalize
  does. The door's words name the Setnayan team, slide 1 shows "Your offer", and the bundle slide is skipped (nothing
  was booked). `opensTheClaimDoor(source)` (`lib/vendor-invites.ts`) names which sources open the door.
- **Seeds.** A second service is bundled only onto a confirmed price; with none, each card is priced on its own (the
  same rule `syncCards` already applied), never "part of a ₱0 bundle".
- **Guards.** `app/open-shop/the-claim-door.test.ts`: "NO EMAIL FIELD" now covers the slides BEFORE the account, which
  still have none; new lines expect Email on the account slide, the hide-and-bring-back rule, the shipped boxes, the
  shipped path, and the admin branch opening the door with its offer kept. Sabotaged once each, both red with their
  own message, then restored: Google / Apple drawn inside the chosen Email way, and the admin branch put back to
  `/signup?as=vendor`. `lib/one-password-field.test.ts` lists the claim door as a create-password door;
  `the-gate-walk-fixes.test.ts` now reads the wizard's dashboard landing from the `confirmNext` default;
  `claim-account-gate.test.ts` follows the shop call, which names both claim functions now (it still has to run
  after the account check).

SPECIAL NOTE: if the details update fails AFTER Setnayan's claim call, the link is already spent, so the finish lands on
Your details (the page that edits those same details) and logs, but shows no notice there.

SPEC IMPACT: None. Both are owner rulings given in chat on 2026-11-07, applied to the claim door the 2026-11-06 ruling
already records.
