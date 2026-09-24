# What is actually true — measured 2026-09-18

Every claim here carries its command. **Re-run them; do not trust the values.**

## The platform

```
real users 8 · anonymous 5 · published shops 1 · active services 2
upcoming real events 4 · orders 6 · refunds 0 · files in Supabase storage 2
per-guest Papic allotments ever created: 0
```
🛑 The one published shop is **"Saysay Live Band & Hosting (FIXTURE)"** with
`is_demo = FALSE`, so nothing filters it out of a supplier count.

## The served build

```bash
curl -s https://www.setnayan.com/api/health
# {"ok":true,"region":"sin1","version":"2c3b0dd","env":"production"}  ← at handoff
git merge-base --is-ancestor <mergeCommit> <full served sha>   # did MY PR serve?
```
⚠ **`deploy-prod` going green is not "served yet"** — the job only fires the
Vercel hook; the build lands minutes later.

## The two PRs — both were misdiagnosed once, read this before touching them

### #5586 · the chat box
The failing check said **"native encoder tests (outcome: skipped)"**. That was
not the failure. **Unit tests** failed, and everything after it — DB replay,
duplicated-rule guards, Rust toolchain, the encoder — was *skipped*, with the
aggregator naming the last skipped step.

🔑 **Read the step list, not the summary line:**
```bash
RID=$(gh pr view 5586 --json statusCheckRollup \
  -q '.statusCheckRollup[]|select(.name=="typecheck + lint")|.detailsUrl'|head -1|sed -E 's#.*/runs/([0-9]+).*#\1#')
gh api repos/iscasasola/setnayan-platform/actions/runs/$RID/jobs \
  -q '.jobs[]|select(.name|test("typecheck"))|.steps[]|"\(.conclusion)\t\(.name)"'
```

The real fault was a **pre-existing** guard, `an-open-tool-does-not-bury-the-conversation.test.ts`
(2026-09-11), which anchored the conversation's floor on *"the `<div>` opening
last before `<ChatMessageStream>`"*. Once the page became one frame the composer
is a **prop** written before the stream **child**, so that source-order anchor
read the declined-inquiry notice instead. Fixed by making the guard walk the
chain (page → ChatBox child slot `min-h-0 flex-1` → the `<ol>`'s own
`min-h-[Nrem] flex-1`) rather than trusting source order. **Not relaxed** — it
still fails on the original property, and 24/24 sabotages are caught.

### #5585 · the retired Papic denylist
Failed **secret scan**: gitleaks' `generic-api-key` heuristic fired on a
`deepEqual` against a literal array of quoted Papic SKU codes — a run of
SCREAMING_SNAKE strings in quotes, which scores as entropy. Not a real secret;
every one of them is printed on the pricing page.

⚠ **Do not paste the offending line into a document to explain it.** Writing
this paragraph with the array in it made gitleaks fire on the paragraph, and
then on the `.gitleaksignore` comment written to excuse the paragraph — three
findings for one non-secret. Describe the SHAPE; the reader does not need the
characters. Re-measure the real thing with
`grep -n "PAPIC_GUEST" apps/web/tests/db/*.db.test.ts`.

Fixed by asserting the **property** (no retired code survives; exactly the
retired entries are dropped) instead of re-typing the SKU list — which removed a
second source of truth from inside the guard as well as the false positive.

🔑 **A secret scan reads COMMIT HISTORY, not the working tree. A follow-up commit
cannot clear a finding — the branch must be rewritten.** This one was squashed to
`git merge-base HEAD origin/main` and force-pushed.

⚠ **Reset to the MERGE-BASE, never to current `origin/main`.** `origin/main` is
not a fixed point during a long session: a squash onto it once absorbed another
session's merges and would have reverted a shipped PR.

## The 20 PRs that merged 2026-09-18 — do not rebuild any of these

| area | what a person can now do |
|---|---|
| Auth | a password reset completes in **any** browser (#5569) · a failed bot check says why (#5580) · the bot check is solvable on a phone and an early tap waits (#5581) |
| Security | rotating a leaked guest QR **actually revokes** the old session (#5570) · a supplier's payment QR leaves the public bucket (#5567) · legacy public-bucket reads deleted (#5578) |
| Money | a closed payment rail hands out no account number (#5571) · a supplier's own purchase never schedules a payout to them (#5574) |
| Papic | the free pool is promised once per **account**, not per event (#5572) · a reported photo is flagged wherever it lives (#5576) · the recap wall shows photos that exist (#5556) |
| Supplier | the first message speaks the host's own occasion (#5573) · a shop page says how long it has been listed (#5575) · dashboard counts link to what they count (#5583) |
| Guest / UI | the way out of an empty marketplace leads out (#5579) · a route-entry animation stops unpinning every fixed overlay (#5582) · **the quote lives in the conversation (#5584)** · the gift QR is redrawn from its own payload (#5566) |
| Ops | Google grants renewed by a registered job, not a cron nobody runs (#5577) |

## Infrastructure now configured (owner did these by hand)

- **Custom SMTP** — Supabase Auth → Resend, `smtp.resend.com:587`, sender
  `noreply@setnayan.com`. Rate limit **2/hr → 100/hr**.
  ⚠ The **minimum-interval-per-user is 60s**, so a three-in-a-row test must space
  requests ~70s apart or the 2nd and 3rd are refused by *that* setting and it
  reads as a failure of the thing you are testing.
- **Turnstile** — widget "Setnayan Auth", Managed mode, hostnames `setnayan.com`
  **and** `www.setnayan.com`, site key in Vercel Production, secret in Supabase.
  **It is currently switched OFF in Supabase** — see owner decision 1.
