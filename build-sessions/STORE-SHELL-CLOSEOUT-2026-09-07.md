# Store shell + four-platform launch — session closeout, 2026-09-07

**What this session was:** the owner asked for desktop builds, which surfaced a macOS
notarization failure, which surfaced the App Store rejection of 2026-06-30, which surfaced that
the fix shipped for it the day before was incomplete. Four platforms were audited and the iOS
blocker was closed.

⚠ **THIS FILE IS A HANDOFF, AND HANDOFFS ROT — including this one.** Every status below carries
the command that re-measures it. Run the command; do not trust the line. This repo's own
`CLAUDE.md` records a "what is left" section that pointed at two finished jobs for an unknown
stretch of sessions, at the top of the file every session reads first.

---

## 1 · The one thing with a clock

**The `Setnayan` YouTube pool-channel token expires 2026-09-07 15:51 UTC.** As of 14:58 UTC it
had **52 minutes** left and had never been refreshed.

```sql
select external_account_display, last_refreshed_at, connection_health,
       (granted_at + interval '7 days') - now() as time_left
from public.oauth_grants where provider = 'youtube';
```

Fix (owner, ~2 min): Admin → Live Studio channels → disconnect, reconnect. That re-issues the
token under the published OAuth app.

🔑 **`connection_health` reads `ok` the entire time.** A token that has never refreshed and a
healthy one are the same value in that column — the exact "failure that renders as success" this
repo is named for. `last_refreshed_at == granted_at` is the tell, not the health field.

If it has already lapsed by the time you read this: the fix is identical and still two minutes.
The cost of lapsing is discovering it through a failed broadcast instead of a calendar.

---

## 2 · Shipped this session

| PR | What |
|---|---|
| **#5186** | First store-shell gate — Studio tree + 3 purchase routes, `/web-only` page, cookie banner off in-shell, migration `20271205904859` reserving `web-only` |
| **#5276** | **The eight surfaces #5186 could not see** + both build numbers |

**Re-measure:** `git log origin/main --oneline | grep -E '5186|5276'`

### What #5276 actually changed

Two mechanisms, split by what the page is:

- **Route refused** (`WEB_ONLY_FEATURE_ROUTE` in `apps/web/lib/store-shell.ts`) where the whole
  page IS the paid thing — `/vendor-dashboard/subscription`, `/dashboard/<id>/live`.
- **Component withheld** where a free page merely carries an upsell, so the free tool stays whole
  — AI comeback offer, Animated Monogram upgrade, Event Hub PRO, Suite paid tiles, Papic guest
  buy panel on both guest surfaces.

**Deleted, not hidden:** `web-nudge-banner.tsx`. It rendered *only* when `isNativeApp()` was
true, read *"Buy on our website for less — up to 33% off"*, and linked to `setnayan.com` with
`target="_blank"`, beside plan cards multiplying the admin price by 1.5× for app users. Its
docblock justified this with a post-2024 Apple ruling that covers the **US storefront only**; we
ship to the Philippine storefront, where the rejection letter's own words apply — *"the app must
use in-app purchase."* It also contradicted DECISION_LOG 2026-06-11 (vendor billing is web-only).

**Build numbers:** iOS `CURRENT_PROJECT_VERSION` 1 → 2, Android `versionCode` 1 → 2. Both were
still byte-identical to the rejected `1.0 (1)`, and App Store Connect refuses a duplicate build
number — the earlier `.ipa` could never have been uploaded at all.

**Re-measure the gate is live:**
```bash
grep -c WEB_ONLY_FEATURE_ROUTE apps/web/lib/store-shell.ts   # expect 2
grep -E 'CURRENT_PROJECT_VERSION' apps/mobile/ios/App/App.xcodeproj/project.pbxproj | sort -u
```

---

## 3 · Artifacts built and handed over

| Platform | File | State |
|---|---|---|
| iOS | `Setnayan_1.0_build2.ipa` | Apple Distribution signed, `CFBundleVersion 2` **verified inside the binary**, not from config |
| Android | `app-release.aab` | Signed, Play-ready — but see §5, it cannot be uploaded yet |
| macOS | `Setnayan_0.0.1_aarch64.dmg` | **Signed + notarized** (run `34016548173`, Gatekeeper `accepted · source=Notarized Developer ID`) |
| Windows | `Setnayan_0.0.1_x64_en-US.msi` | Builds; **unsigned** pending the cert (§5) |

⚠ The macOS `.dmg` above was an earlier ad-hoc build handed to the owner. The **notarized** one
lives only in CI artifacts and has never reached `/download` — see §4.

---

## 4 · Open — owner, no engineering blocked behind them

### 4a · Four R2 secrets (~10 min) — the highest ratio of value to effort left

`R2_ACCOUNT_ID` · `R2_ACCESS_KEY_ID` · `R2_SECRET_ACCESS_KEY` · `R2_PUBLIC_URL` as **GitHub
Actions secrets**, then re-dispatch `build-desktop`.

```bash
gh secret list -R iscasasola/setnayan-platform | grep -E '^R2_'   # expect: nothing, today
curl -s -o /dev/null -w '%{http_code}\n' https://www.setnayan.com/api/download/mac  # 503 today
```

🔑 **Vercel env vars and GitHub Actions secrets are two separate stores.** The same four names
ARE set in Vercel, which is why this looked done. The publish step skipped silently, so a
signed, notarized Mac app has never been uploaded anywhere a customer can reach.

### 4b · Windows code-signing certificate (3–4 weeks, ~$129/yr)

SSL.com OV + eSigner. Azure's signing service excludes Philippine organisations, which is why
that route is out. **CI is already wired** — `src-tauri/scripts/windows-codesign.ps1` runs the
moment `SSL_COM_ESIGNER_USERNAME` / `_PASSWORD` / `_CREDENTIAL_ID` / `_TOTP_SECRET` exist. No
code change needed on arrival. Order it now; nothing else waits on it, but it is the longest pole
on the board.

### 4c · The App Store Connect package

- **App Privacy** → "Data Not Used to Track You"; declare Crash Data + Diagnostics (Sentry loads
  in the shell, gated only on its DSN).
- **Review Notes** → a demo account that works on production.
- **Review Notes** → a screen recording **on a physical iPhone**: Profile → *Delete my account* →
  type `DELETE` → confirm. **This recording is the entire 5.1.1 fix.** The feature has existed
  since 2026-06-11; the reviewer's own screenshot is the sign-in page — they never got in.
- Upload `Setnayan_1.0_build2.ipa`, submit.

⚠ `account_deletion_requests` is **empty in production** — the flow has never run end to end
there. The reviewer will be the first person to use it.

---

## 5 · Android is blocked on one free number

**The Play Console question is answered** — it was settled 2026-06-25 and written up in
`09_Operations/Google_Play_Org_Launch_Runbook_2026-06-25.md` (spec corpus) and DECISION_LOG rows
of that date. Two sessions re-asked the owner anyway. Do not re-ask a third time.

- A **personal** Play Console account exists, and it is **the wrong one to use**.
- A personal account faces **two** gates: production needs a 12-tester / 14-day closed test, and
  the account needs device verification through the Play Console app **on a real Android 10+
  phone**, which the owner does not own.
- **An organisation account waives both**, verifying by D-U-N-S instead. With no Android device
  this is not a preference — it is the only route open.
- DTI national BN **8297508** ✅ registered 2026-06-25.
- **D-U-N-S requested 2026-06-25 from CRIF D&B Philippines. Estimated ~30 days. Now day 74, no
  reply.** ← this is the entire Android blocker.
- Personal → org is **not a conversion**: a new $25 org registration. Nothing to migrate, nothing
  published.

**Owner action:** chase CRIF by phone/email with the DTI certificate in hand — they ask for it.
Alternates: `dnb.com.ph`, or D&B's global form, which routes to the local bureau.

**The matching Apple decision is also already made and is not reopenable:** Apple's *organisation*
enrolment does not accept sole proprietorships at all (corps/LLCs/LPs only), so Individual
enrolment — publishing under the owner's personal name — is the only option until a One Person
Corporation exists. Reversible later by app transfer. Do not raise it as an open choice.

---

## 6 · Residual App Review risk, stated not hidden

Free tools that merely **embed** the (inert) checkout drawer stay reachable in the shell — Save
the Date, Indoor Blueprint, Seating, Mood Board, the supplier workspace. So a save-the-date film
bought on the web still **plays** in the app, which is the 3.1.3(b) shape Apple cited in June.

If App Review presses on it, the lever is one line per page in
`STORE_SHELL_WEB_ONLY_STUDIO_SEGMENTS`. The durable answer is Apple IAP, scheduled for v1.1 on
2026-06-25.

**Budget for one more round-trip.** A resubmission on a previously-cited guideline is read more
closely than a first submission, and Guideline 4.2 (minimum functionality) is live exposure for a
WebView shell whose native camera/push paths are now hidden in-shell.

---

## 7 · The encoder's missing rung — unowned, and the ladder hides it

Sessions **S0–S12 + W1 are merged** (13 PRs, #5195 → #5252). Every stage is tested; the Rust
crate gates CI with 83 tests. The ladder reads as nearly finished.

**But the pipeline is never joined.** The canvas worker, the WebCodecs encoder and the Rust RTMP
sender are not called by the app: `src-tauri/src/encoder_ipc.rs` still carries a `STUB SINK`
comment and the only caller of the real sender is `crates/encoder/examples/publish_probe.rs`.

```bash
grep -rn "STUB SINK" src-tauri/src/encoder_ipc.rs
git grep -n "encoder::\(sender\|rtmp\|reconnect\|file_sink\)" origin/main -- src-tauri/src
```

🔑 **S5 said S6 would replace the stub. S6 merged *before* S5 and never did. S9 flagged the glue
as "follow-up session needed". No row in the README ladder owns it.** So every PR is green, the
plan looks complete, and the first OBS-free stream is not reachable. **One integration session
closes it** — that session does not exist yet and should be written.

Also unmeasured: **Windows/WebView2 WebCodecs** (S0 measured macOS only; WebView2 is Chromium, a
different engine — nothing on the Mac says anything about it), and the owner has no Windows
machine per the encoder README.

---

## 8 · What the next session should do, in order

1. **Check §1 first** — it may already be moot, either way.
2. **If the R2 secrets have landed:** re-dispatch `build-desktop`, confirm `/api/download/mac`
   returns 200, and correct the hard-coded *"isn't Apple-notarized yet"* string in
   `apps/web/app/download/page.tsx`, which is now false for the artifact but accidentally true
   for what is served.
3. **Write the encoder integration session** (§7) — the highest-value unowned engineering on the
   board.
4. **If App Review rejects again:** read the guideline it cites before changing anything; §6
   names the two most likely and the lever for each.

---

## 9 · Traps this session actually hit — do not re-learn these

- **A pipeline's exit code is the LAST command's.** `pnpm test:unit | grep | head -15` reported
  `exit 0` with an empty log — that was `head`, and `head` closing early can kill the run.
  Redirect to a file and capture `EXIT=$?` on its own line. An empty log and a clean pass are
  identical from the outside. (`PIPESTATUS` is bash-only; empty in zsh.)
- **A subagent cited a real filename I could not find**, because my `find` missed a
  subdirectory. The document existed. Verify a citation's absence harder than its presence.
- **`pnpm lint` does not run the repo guards.** ~27 blocking guards are separate CI steps. This
  session shipped a locally-green PR that CI failed on `lint port keeps every control` — a guard
  that correctly caught the deliberate `WebNudgeBanner` deletion and asked for it to be recorded
  in the baseline diff. Fix: `pnpm --filter @setnayan/web port:baseline` in the same PR.
- **Peer sessions run suites on this machine concurrently.** A long run can lose the CPU fight.
  Do not read a killed run as a failure or an unfinished one as a pass.
- **The local checkout's `build-sessions/encoder/` holds the RETIRED E0–E9 plan.** The live
  S0–S13 series exists only on `origin/main`. Reading locally shows the wrong plan.
