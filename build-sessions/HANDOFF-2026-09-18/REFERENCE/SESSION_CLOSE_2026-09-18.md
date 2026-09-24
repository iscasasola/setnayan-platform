# What is done, what is not, and what was never built — 2026-09-18

> Written at the close of the session that configured SMTP and Turnstile.
> **20 PRs merged and served in this window.** Everything below was measured on
> the day, not carried forward. Commands are given so the next session
> re-measures instead of trusting this file — which will start rotting today.

---

## 1 · ✅ DONE AND SERVED — do not rebuild

**The owner's two dashboard tasks** (~35 min of his time, and they outranked
every build on the plan):
- **Custom SMTP** — Supabase Auth points at Resend via `smtp.resend.com:587`,
  sender `noreply@setnayan.com`, on a key scoped `supabase-auth-smtp`. Rate limit
  raised **2/hour → 100/hour**. ⚠ The minimum-interval-per-user field is 60s, so
  a three-in-a-row test must space requests ~70s apart or the 2nd and 3rd are
  refused by *that* setting and it looks like a failure.
- **Turnstile** — widget "Setnayan Auth", Managed mode, hostnames `setnayan.com`
  + `www.setnayan.com`, site key in Vercel Production, secret in Supabase.

**The 20 merged PRs, by what a person can now do:**

| area | what changed |
|---|---|
| **Auth** | a password reset completes in **any** browser (#5569) · a failed bot check says why, to the person and the console (#5580) · the bot check is solvable on a phone and an early tap waits (#5581) |
| **Security** | rotating a leaked guest QR **actually revokes** the old session (#5570) · a supplier's payment QR leaves the public bucket (#5567) · legacy public-bucket read paths deleted (#5578) |
| **Money** | a closed payment rail hands out no account number (#5571) · a supplier's own purchase never schedules a payout to them (#5574) |
| **Papic** | the free pool is promised once per account, not per event (#5572) · a reported photo is flagged wherever it lives (#5576) · the recap wall shows photos that exist, gated on the couple's choice (#5556) |
| **Supplier** | the first message speaks the host's own occasion, not "planning our wedding" (#5573) · a shop page says how long it has been on the marketplace (#5575) · dashboard counts link to what they count (#5583) |
| **Guest / UI** | the way out of an empty marketplace leads out (#5579) · a route-entry animation stops unpinning every fixed overlay (#5582) · the quote lives in the conversation (#5584) · the gift QR is redrawn from its own payload (#5566) |
| **Ops** | Google grants renewed by a registered job, not a cron nobody runs (#5577) |

**Re-measure before trusting any row:**
```bash
curl -s https://www.setnayan.com/api/health           # served sha
git merge-base --is-ancestor <mergeCommit> <full served sha>
```

---

## 2 · ⏳ IN FLIGHT — not finished at close

- **#5585 · `fix(papic): a retired model cannot come back through the catalogue`**
  — in CI at close. Puts the five retired Papic SKUs in a code-side denylist so
  an `is_active` toggle in `/admin/pricing` can no longer resurrect the seat
  product on its own. **Check `gh pr view 5585` before assuming it landed.**
- **The venue-NAT throttle** — briefed to another session, waiting on the owner's
  first end-to-end booking run. See §4.

---

## 3 · 🛑 NOT BUILT — measured today, with the evidence

| item | measurement (2026-09-18) | in scope? |
|---|---|---|
| **Email delivery log** | **0 writers.** `emitNotification` records no outcome. 76 notifications exist; how many arrived is unanswerable. Newly urgent *because* SMTP now works. | ✅ yes |
| **Refunds / receipt re-issue** | `order_refunds` = **0 rows** — path never exercised. ⚠ But **7 files carry refund/re-issue actions**, so the register's "no path exists" is wrong. **Re-measure before building.** | ✅ yes |
| **Venue-NAT captcha** | Cloudflare demands an interactive solve when one IP makes many requests quickly — i.e. a reception. Proved by accident. Not fixed. | ✅ yes |
| **4 vendor-dashboard payment surfaces** | still render an account number without consulting the kill switch (`booking-fees/[orderId]`, `shop`, `subscription`, `subscription/custom`) | ⚠ supplier-facing |
| **Guest song request (SUP-52)** | **0** song-request references under `app/[slug]` or `app/papic`; the band's inbox and the July DB half are both built. Every stage built except the join. | ⚠ supplier-facing |
| **DAY-14 dead branch** | the "broadcast day has ended" fork renders in **0 of 12** measured combinations — tidy-up, not a defect | ✅ small |
| **LR-21 comment nit** | five error boundaries name `instrumentation.ts` as the Sentry path; for the browser it is `deferred-observability.tsx` | ✅ small |
| **~170 untriaged rows** | the LAU-* and SUP-* registers, never re-measured against the served build. ⚠ **~40% of such rows turn out already done** — the honest next step is re-measuring, not building. | — |

---

## 4 · ⚖ OWNER DECISIONS — engineering is blocked or waiting

1. **Captcha back on?** It is **OFF** at close. The mobile lockout that forced it
   off is fixed and served (#5581), so this is now a choice. **Order matters:
   #5581 served → captcha on → the `/verify` gating question becomes answerable
   → then decision 2.**
2. **The seat-claim trade.** Is a scarce, single-claim, event-scoped token plus a
   venue-sized throttle sufficient, **given `seatClaimability()` already checks
   the token with the admin client and captcha is a second lock on the same
   door?** The join door already made this trade (`join-door-throttle.ts`, "sized
   for a VENUE, not a laptop"). Being built behind an **OFF flag**.
3. **Legacy Papic seat tokens** — 24 rows across 6 events, 6 claimed. Keeping
   already-printed QR posters working is reasonable; should NEW ones still be
   mintable?
4. **Browsewrap or clickwrap** on `/signup`. ~90 consent columns exist and none
   records Terms/Privacy acceptance, because there is no checkbox to record.
   **Stamping an acceptance that never happened is worse than none.**
5. **DPO wording** for guest collection surfaces (mobile number, allergies, a face).
6. **The site-wide token repaint** — `--hr-grey` / `--hr-grey-2` carry ~54 text
   roles and fail the readability bar. ⚠ Solving **both** to the bar collapses
   them: 0.1256 luminance apart becomes **−0.0022**, inverted.
7. **R2 bucket versioning.** ✅ The in-code half is solid — every delete goes
   through one pinned choke point with a derived caller list. ❌ Whether the four
   buckets have object versioning is **unknown and not visible from a session**.
   Cloudflare → R2 → bucket → Settings. **This is where the irreplaceable data
   actually lives.**
8. **Supabase Pro.** Free plan; projects with low activity can be paused, and
   backups are not downloadable. **Trigger: before the first real couple uploads
   a photo, or before any week the build goes untouched.** Neither has happened.

---

## 5 · 📊 WHERE THE PLATFORM ACTUALLY IS

```
real users 8 · anonymous 5 · published shops 1 · active services 2
upcoming real events 4 · orders 6 · refunds 0 · files in Supabase storage 2
per-guest Papic allotments ever created: 0
```

🛑 **The one published shop is named "Saysay Live Band & Hosting (FIXTURE)" and
its `is_demo` flag is FALSE**, so nothing filters it out and any count of
"verified suppliers" includes it.

**Engineering is not the bottleneck.** Every item in §3 is real and none of them
is what stands between a couple and a booking. **That is supplier recruitment,
it has weeks of lead time, and no amount of building shortens it.**

---

## 6 · 🔑 WHAT THIS SESSION LEARNED THE HARD WAY

- **A measurement that does not change the advice was wasted.** Captcha was
  recommended ON; the widget was then measured at **293 × 0** on a phone — unable
  to paint a challenge — and the recommendation was left standing. Mobile
  sign-in was locked out until another session switched it off. **Retract the
  advice in the same breath as reporting the number.**
- **A probe can change the system it measures.** The in-app browser cannot run
  Turnstile at all — 0 iframes, no error, no console line — so every reading was
  an artefact, *and* the probes made Cloudflare treat the owner's IP as a bot.
  **Run the control first; read the service's own telemetry before your code.**
- **A secret scan reads COMMIT HISTORY, not the working tree.** A follow-up
  commit cannot clear a finding — the branch must be rewritten.
- **A reset to `origin/main` mid-session absorbs other people's merges.** A
  squash did exactly that and would have reverted #5583 had the file list not
  been read. **`origin/main` is not a fixed point during a long session.**
- **"It works in production" is not "it should exist."** A retired Papic seat
  flow was verified end to end and a build dispatched to harden it, before
  anyone checked the catalogue. **Check the decision log before hardening.**
- **The right answer to a false positive is rarely an exemption.** The secret
  scan fired on duplicated SKU literals; removing the duplication fixed the scan
  *and* removed a second source of truth from inside the guard.
