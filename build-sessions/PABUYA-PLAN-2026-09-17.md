# Pabuya — the plan the owner runs

Prepared 2026-09-17 against the ACTIVE worktree (`/Users/icecasasola/Documents/Claude/Projects/ACTIVE-qrph-session-do-not-remove`), `origin/main` at the #5549 merge, PR #5547 still `OPEN BLOCKED`. Every claim below that I re-checked myself is marked **[re-confirmed]**; everything else is carried from the measured state and marked **[carried]**. Section 9 lists what nobody has measured.

## 0. The one-paragraph shape

The gate the owner ruled for twice is real and works where it was built: `/[slug]/pabuya` withholds the number and the QR from a stranger, `/api/pabuya/qr/[publicId]` answers 403 anonymously. The bytes it protects, however, have a second address — the public `r2.dev` host — that answers everyone, and nothing in the app can revoke that because the object key was disclosed in every presigned `<img src>` the page ever rendered. Three more holes sit beside it: the route streams **whatever bucket the column names** (a signed-up stranger can PATCH their own row and read vendor IDs), **nothing ever deletes** a QR object, and the ruling itself is held only by regexes over source text. The plan closes the self-serve holes first (no decision needed, no destruction), gives objects a lifecycle, stops new uploads leaking, then hands the owner **one script** whose DELETE half is the actual revocation — and only after production is re-measured does a schema constraint lock it. The owner gets one message with every decision on day one and is not waited on until Stage 3.

**Re-confirmed in the worktree today:** `pabuyaQrPolicy(eventId)` returns `{ prefixes: [...] }` with no `bucket` (so it defaults to public media); `pabuya-manager.tsx` renders `<FileUpload bucket="media">`; the route imports `userHostsEvent`, `parseStoredAsset`, `r2GetBytes` and contains `NextResponse.redirect(ref.url, 307)`; `lib/pabuya-recognition.ts` begins `import 'server-only'`; `grep -c egift` is 0 in `event-media-sweep-core.ts`, `event-media-sweep.ts`, `erasure/purge.ts` (1 in `erasure/coverage.ts`); `identifiersWithheld` compares `handle` only; `savePabuyaMessage` is the only write in `pabuya/actions.ts` that follows `.update` with `.select` and a `data.length === 0` check; `PRIVATE_BUCKET_ROOTS` already lists `events` under `setnayan-thread-files`; the `refs_are_own` precedent exists in `supabase/migrations/20271219262486_every_cleanup_delete_is_pinned.sql`; the migration precedent `scripts/migrate-payment-screenshots-to-private.ts` gates on `MIGRATE_APPLY === '1'` and orders Copy → Head → Delete.

---

> ## ⚠ CORRECTED 2026-09-17 — READ THIS BEFORE THE TABLE IN §1
>
> **This plan's owner-decision table overstated what the owner owed.** It listed
> NINE questions. Checked against `DECISION_LOG.md` afterwards, only ONE was
> genuinely open:
>
> · **A (which private bucket)** was ALREADY RULED on 2026-07-30, when vendor
>   payment receipts were moved off the public bucket: `thread-files` **plus a
>   `bucketForPrefix` rule as defence-in-depth**. Presenting it as a question
>   also nearly lost the second half of that ruling — the rule needs a ROOT
>   prefix, which is why the keys moved to `pabuya-qr/<eventId>/` rather than
>   only changing bucket.
> · **E** is answered by the 2026-09-15 ruling's own verbatim sentence.
> · **C, G, H, I** have no evidence of ever having been asked. They were
>   inventions of the planning pass.
> · **B (suppliers)** was the one real question — and the corpus says so
>   explicitly, since the wallet ruling was issued separately rather than
>   inferred. Answered YES on 2026-09-17 and shipped.
> · **The moderator/host divergence**, which the table did NOT list, turned out
>   to be a real decision. Answered YES and shipped.
>
> 🔑 **A planning pass generates plausible questions as readily as real ones.**
> Every row here should have been checked against the decision log before it
> reached the owner's desk — the same rule the plan itself states in §1.

## 1. OWNER DECISIONS — all in one place, one word each

Send these as **one message on day one** (Step 1). Do not wait for answers before starting Stage 1.

| # | Question | Answer with | Recommended default | Unblocks |
|---|---|---|---|---|
| **A** | Which private bucket do gift QRs move to? | `thread-files` / `new` | `thread-files` — already registered private, `events` root already allowed, no Cloudflare action, no new registry entries | Steps 10, 11, 12, 13 |
| **B** | Do supplier payment QRs (`vendors/{id}/payment-qr`, 0 rows today) get the same treatment? | `yes` / `no` | `yes` — free while the table is empty | Step 17 (or a one-line ⚖ comment if no) |
| **C** | Setnayan's own `merchant-qr/` receiving code stays public? | `yes` / `no` | `yes` — a business's advertised receiving identity | Step 15 (one ⚖ comment) |
| **D** | Couple free text (`note`, `pabuya_message`) that looks like a phone/account number? | `refuse` / `warn` / `withhold` | `warn` — they are the couple's words | Step 15 |
| **E** | Link `/[slug]/invite` from the withheld sentence? | `yes` / `no` | no recommendation — it opens a door the ⛔ register closed | Step 15 |
| **F** | RoomFooter pill: `Send a gift` → `Send a blessing`? | `yes` / `no` | `yes` — two of three guest surfaces and the page H1 already say it | Step 15 |
| **G** | `account_name` may name a third party (a parent, a ninang)? | `leave` / `withhold` | no recommendation | Step 16 (record only) |
| **H** | A forwarded event join token is enough to earn recognition? | `accept` / `personal` | no recommendation | Step 16 (record only) |
| **I** | Recognition expiring 60 days after last open? | `accept` / `extend` | `accept` | Step 16 (record only) |

**Not a question — a reminder for the DPO:** `lib/npc-filing-tasks.ts` task `t1-7`'s condition has fired. `PABUYA_PUBLIC_ROUTE_ENABLED` is ON in production (re-measure: `curl -o /dev/null -w '%{http_code}' https://www.setnayan.com/cale-ice/pabuya` → 200). The RoPA financial-PI row is owed. Engineering does not draft it.

**Do NOT ask** (closed, verified): gate the number and the QR (ruled twice 2026-09-15); the page stays reachable by link; Setnayan never holds money; account name + rail shown to everyone; the note→`pabuya_message` move (measured complete).

---

## 2. Who does what

**A session completes alone:** Steps 1–11, 13–15, 17.
**Needs the owner's own hands:** Step 12 (runs the migration — no R2 credential reaches a session, precedent DECISION_LOG 2026-06-25); Step 10 *only if* answer A is `new` (he creates the bucket and sets the env var); and any step marked with an owner gate cannot start its gated sub-item until the word arrives.

**Destructive or money-adjacent (proof required before running):** Step 8, Step 9, Step 12. Called out inline with a ⚠ and the proof.

**Sequencing rule that applies to every branch:** fork from `origin/main` **after** #5547 has merged (it rewrites `pabuya/actions.ts` and `pabuya-card-list.tsx`). Before opening any PR: `gh pr list --state open --limit 40` and `git worktree list` — Rule 0 applies to work in flight. Run unit tests from `apps/web`, with the `app/**/name.test.ts` glob form (a bracketed literal path matches nothing and exits 0). Print the case count in every new guard. A CONFLICTING PR runs no CI — count the checks.

---

## 3. THE SEQUENCE

### STAGE 0 — Preconditions (nothing changes in production)

**Step 1 · Send the owner the one batched ask**
- **Goal:** Table §1 in front of the owner, one message, each line answerable in a word, closed questions absent.
- **Files:** none (a message). Cite `lib/r2-client-ref.ts` (`pabuyaQrPolicy`, `vendorPaymentQrPolicy`), `lib/bucket-routing.ts` (`bucketForPrefix`), `app/[slug]/_lib/room-links.ts`, `app/[slug]/pabuya/page.tsx`, `lib/guest-session.ts` (`COOKIE_MAX_AGE_SECONDS`), `lib/npc-filing-tasks.ts` (`t1-7`).
- **Model:** sonnet — transcription of §1, not judgment.
- **Depends on:** none. **Owner gate:** none.
- **Verification:** grep the draft for "account number", "reachable", "pabuya_message" phrased as questions — none may appear.
- **Guard:** none executable; Step 16 records the answers so they are never re-asked.

**Step 2 · Land PR #5547**
- **Goal:** the four commits on `claude/a-gift-qr-must-be-scannable` are on `origin/main` and served. Today: `OPEN BLOCKED`, `typecheck + lint` in progress **[re-confirmed]**.
- **Files:** that branch only. If CI names a file, fix it there — never by weakening a guard.
- **Model:** sonnet — binary done-condition.
- **Depends on:** none. **Owner gate:** none.
- **Verification:** `gh pr view 5547 --json state,mergeStateStatus` → `MERGED`; `git rev-list --count origin/main..claude/a-gift-qr-must-be-scannable` → 0; later, the Vercel production deployment sha equals `origin/main` (deploy-prod green is not served yet). Watch with a Bash `run_in_background` until-loop that enumerates OPEN/MERGED/CLOSED and aborts on repeated unknowns.
- **Guard:** the branch's own tests stay green on main.

**True at the end of Stage 0:** nothing has changed for users except #5547's controls; every later branch has a stable base; the owner has the full decision list.

---

### STAGE 1 — Close what a session can close today (no decision, nothing destroyed)

**Step 3 · The QR route serves only its own event's QR under `pabuyaQrPolicy`, and never redirects**
- **Goal:** `app/api/pabuya/qr/[publicId]/route.ts` replaces `parseStoredAsset` with `parseClientRef(method.qr_r2_key, <accepted policies>)`, where the accepted list is today `[pabuyaQrPolicy(method.event_id)]`; the `legacy_url → NextResponse.redirect` branch is deleted. Closes the read-any-bucket primitive and the open redirect. The single live row is under `events/<id>/pabuya/` in `setnayan-media`, which today's `pabuyaQrPolicy` accepts — it must keep serving.
- **Files:** the route; NEW pure `lib/pabuya-qr-ref.ts` exporting `resolvePabuyaQrRef(qrR2Key, eventId, policies)` (no `server-only`); NEW `lib/pabuya-qr-ref.test.ts`; extend `app/[slug]/pabuya/an-account-number-is-not-public.test.ts`.
- **Model:** opus — a security boundary on the money surface whose failure is silent; must confirm `method.event_id` is the uuid used in the key prefix before writing the check.
- **Depends on:** 2. **Owner gate:** none.
- **Verification:** `cd apps/web && npx tsx --test lib/pabuya-qr-ref.test.ts 'app/**/an-account-number-is-not-public.test.ts'` — cases printed and counted: own-event media pabuya key → ref; another event's key → null; `r2://setnayan-vendor-verification/…` → null; `https://…` → null; `events/<id>/other/x` → null. Live after deploy: anonymous `/api/pabuya/qr/S89Y-YVVMHATFG6` → 403; owner signed in → 200 `image/jpeg`. Preview, as testnayan1 by email+password on his own event: PATCH his own row's `qr_r2_key` to a vendor-verification ref → 404 with no `Location`; to `https://example.org` → 404 not 307; restore the row (standing authorisation).
- **Guard:** the executable resolver cases + source assertions at token boundary: route contains `resolvePabuyaQrRef(` exactly once, `NextResponse.redirect` zero times, `parseStoredAsset(` zero times. Sabotage: reinstate the redirect line → red.

**Step 4 · Every e-gift write counts its rows before it says "saved"**
- **Goal:** `saveEgiftMethod`'s update branch, `setEgiftMethodEnabled`, `deleteEgiftMethod`, both halves of `moveEgiftMethod` add `.select(...)` and return an error on `data.length === 0` — the shape `savePabuyaMessage` already uses in the same file **[re-confirmed]**.
- **Files:** `app/dashboard/[eventId]/pabuya/actions.ts`; NEW `app/dashboard/[eventId]/pabuya/a-zero-row-write-is-not-a-save.test.ts`.
- **Model:** sonnet — copying a sibling in the same file five times.
- **Depends on:** 2. **Owner gate:** none.
- **Verification:** `npx tsx --test 'app/**/a-zero-row-write-is-not-a-save.test.ts'` scans EVERY `.update(` / `.delete()` chain (not the first), asserts `.select(` and a length check follow within the same statement, prints the chain count and asserts it (expected 6 including `savePabuyaMessage` — the runner prints the number, the test author does not write it first). Preview as testnayan1: toggle a method with another event's id → error, not ok.
- **Guard:** the per-chain count. `moveEgiftMethod`'s two updates are not transactional — count both and say so in the returned message; do not paper over it.

**Step 5 · The withheld sentence fires whenever ANY identifier was withheld, QR included**
- **Goal:** a QR-only method (`handle` null, `qr_r2_key` set — a shape `saveEgiftMethod` allows) no longer renders as a blank card with no explanation for a stranger.
- **Files:** NEW pure `app/[slug]/pabuya/withheld.ts` (`anyIdentifierWithheld(methods, cards)`); `page.tsx` replaces the inline `cards.some(...)`; extend `an-account-number-is-not-public.test.ts`.
- **Model:** sonnet — one predicate with a written truth table.
- **Depends on:** 2. **Owner gate:** none.
- **Verification:** executed cases: handle-only withheld → true; QR-only withheld (`qrUrl` null, source `qr_r2_key` set) → true; recognised viewer → false; neither field → false. Source: `page.tsx` imports `anyIdentifierWithheld` and no longer contains `c.handle === null &&`.
- **Guard:** the executed QR-only case (production has 0 such rows — the test is the only place this shape exists; keep it). Compare against the SOURCE row, not the rendered card alone.

**Step 6 · The recognition rule becomes executable — pure decision, server-only I/O**
- **Goal:** split `lib/pabuya-recognition.ts` the way `pabuya-qr-verdict.ts` / `pabuya-qr-check.server.ts` already are: a pure `decideRecognition({ guestSessionEventId, eventId, memberType })` and a `.server.ts` sibling exporting `viewerIsRecognisedForEvent` unchanged. Behaviour-preserving.
- **Files:** `lib/pabuya-recognition.ts` (becomes pure), NEW `lib/pabuya-recognition.server.ts`, NEW `lib/pabuya-recognition.test.ts`, both importers (`app/[slug]/pabuya/page.tsx`, the route), repoint the three `readFileSync` regex checks in `an-account-number-is-not-public.test.ts` (guards pinned to file paths go red on a move — grep the bare module name first).
- **Model:** opus — refactoring the gate itself; the pure function must take `memberType` as a string, not a `hasRow` boolean, or the host-scope regression (existence mistaken for authority) becomes untestable.
- **Depends on:** 3. **Owner gate:** none.
- **Verification:** cases: session for this event → recognised; session for another event → not; `couple` → yes; `coordinator` → yes; a row typed `guest` → NOT; nothing → not. Sabotage: host arm → `Boolean(row)` → the guest-row case goes red; record the red count the runner prints. `grep -rn "from '@/lib/pabuya-recognition'" app | wc -l` → 0.
- **Guard:** the executable test + one source assertion that the pure module contains no `server-only` and no client construction.

**Step 7 · One definition of "host" for both doors**
- **Goal:** the route drops its `userHostsEvent` arm; both doors answer "host?" with recognition's host arm; the host set is **whatever RLS lets WRITE `event_egift_methods`** — the dashboard actions have no TypeScript host check **[re-confirmed: no `requireHost*`/`isHostMemberType` in `pabuya/actions.ts`]**, so authority lives in the policy `event_egift_methods_host_all`. The executor reads its predicate from `pg_policies` (a TS grep cannot see an RLS policy) and adopts exactly that set. Whoever can author an identifier may read it.
- **Files:** the route; `lib/pabuya-recognition.ts` + `.server.ts`; both docblocks; `lib/pabuya-recognition.test.ts`.
- **Model:** opus — the answer is not written down; wrong either way locks out a co-host or widens the gate.
- **Depends on:** 6. **Owner gate:** none — unless the policy's set differs from BOTH `isHostMemberType` and `userHostsEvent`, in which case stop and add it to the owner's batch rather than invent a fourth.
- **Verification:** `grep -n userHostsEvent 'app/api/pabuya/qr/[publicId]/route.ts'` → nothing; one test case per member of the adopted set plus one negative; `accepted_mods_without_host_member_row` SQL before/after (0 today, so no live viewer changes state); owner GET of the route → 200 after deploy.
- **Guard:** the host cases + a source assertion that both doors import the same symbol and the route imports nothing from `@/lib/events`.

**True at the end of Stage 1:** no signed-up stranger can read another bucket or bounce a redirect off `setnayan.com`; a refused write no longer says "saved"; a withheld QR-only card explains itself; the ruling's two arms are executed by tests; both doors agree on who a host is. **Still open:** the live QR still answers 200 anonymously on `r2.dev`; nothing deletes objects yet.

---

### STAGE 2 — Objects get a lifecycle (the privacy page's promise becomes true)

**Step 8 · ⚠ DESTRUCTIVE — deleting a method or replacing its QR deletes the displaced object**
- **Goal:** `deleteEgiftMethod` deletes the object after the counted row delete; `saveEgiftMethod`'s update path deletes the OLD key only when the key changed AND the counted update returned 1 row. Via the house `cleanupDelete` with a NEW `pabuyaQrScope(eventId)` in `lib/cleanup-delete-scope.ts` covering **both** `setnayan-thread-files` and `setnayan-media` under `events/{id}/pabuya/` only (legacy keys must remain deletable after Stage 3).
- **Files:** `pabuya/actions.ts` (copy the `cleanupDelete` usage from `app/dashboard/[eventId]/guests/[guestId]/actions.ts`); `lib/cleanup-delete-scope.ts`; its scope test; NEW `app/dashboard/[eventId]/pabuya/a-retired-qr-is-not-fetchable.test.ts` with a pure `planPabuyaQrDeletes({ previousKey, nextKey, updateRowCount })`.
- **Model:** opus — deletes production objects on a user action; order (count, then delete; never the NEW key; never on an unchanged key) is the whole safety.
- **Depends on:** 4. **Owner gate:** none — deletion on the couple's own action is already promised in `app/(shell)/privacy/page.tsx`.
- **Proof before it runs in prod:** the pure planner passes: same key → `[]`; changed + rowCount 1 → `[previousKey]`; changed + rowCount 0 → `[]`; delete + rowCount 1 → `[key]`. Scope test: ALLOWS both buckets under `events/e1/pabuya/`, REFUSES `events/e2/pabuya/`, `events/e1/other/`, `events//`. Byte-order assertion: the cleanup call sits AFTER the `.select` length check in each function.
- **Verification:** preview, testnayan1's own event: upload A, replace with B, anonymous curl of A's key on the `r2.dev` host → 404; delete the method → B gone. Restore after.
- **Guard:** the three tests above. Sabotage: swap the scope for `eventSiteMediaScope` → the thread-files ALLOW case goes red.

**Step 9 · ⚠ DESTRUCTIVE (service role) — "Remove for good" and account erasure reach `qr_r2_key`**
- **Goal:** `EVENT_MEDIA_KEY_SETS` / `planEventMediaDeletes` in `lib/event-media-sweep-core.ts` gain an egift set under `pabuyaQrScope`; `lib/event-media-sweep.ts` reads the rows; `lib/erasure/purge.ts` deletes the asset (today `coverage.ts` only nulls `created_by_user_id`).
- **Files:** those four plus their existing tests (`event-media-sweep` test, the erasure coverage test).
- **Model:** opus — crosses three subsystems on the service role; must decide event-sweep vs user-purge vs both when uploader and event owner differ.
- **Depends on:** 8. **Owner gate:** none.
- **Proof before it runs:** the sweep test with a fixture event holding one egift row plans exactly that key and REFUSES a key outside `events/{id}/pabuya/`; the coverage test lists `event_egift_methods.qr_r2_key` as purged. Never baseline the coverage guard away.
- **Verification:** preview: throwaway event with one QR → Remove for good → the planned delete list names the pabuya key. Remember `cron_job_runs` records the claim, not the outcome — read the plan output, not the timestamp.
- **Guard:** sabotage: remove the egift set → red.

**True at the end of Stage 2:** no Pabuya QR outlives its row from now on; the privacy page's "deleted with your event" is true for future actions. **Still open:** the one live object and any historical orphans remain in the public bucket; new uploads still land there.

---

### STAGE 3 — Stop the hole growing (needs answer A)

**Step 10 · New gift-QR uploads land in the private bucket; the route reads both during the transition**
- **Goal:** `pabuyaQrPolicy` gains `bucket: R2_BUCKETS.threadFiles` (or the new bucket); `pabuya-manager.tsx` flips `<FileUpload bucket="thread-files">` **in the same commit** (the policy pins the bucket by defaulting, so the pair is atomic or the couple's next save fails); a read-only `pabuyaQrLegacyMediaPolicy(eventId)` (media, same prefix) is added to the route's accepted list and to `saveEgiftMethod`'s ref validation so the pre-move row still serves. Side effect: a thread-files pabuya ref no longer satisfies `eventMediaPolicy` (media-defaulting), closing the superset hole without a second mechanism.
- **Files:** `lib/r2-client-ref.ts`; `pabuya-manager.tsx`; the route's policy list; `pabuya/actions.ts`; `lib/the-generic-signer-is-public-only.test.ts` (writer/reader enumeration — name the route as the reader); `lib/private-upload-roots-registered.test.ts`; `lib/r2-client-ref-stored-writes.test.ts`; `lib/r2-client-ref.test.ts`; **check `lib/pabuya-qr-check.server.ts` reads bytes bucket-agnostically, not via `publicUrlFor`** — otherwise validation fails open (`decoderRan=false`) on every private upload and #5547 ships inert. If A = `new`: also `lib/r2.ts` `R2_BUCKETS`, `PRIVATE_BUCKET_ROOTS`, `file-upload.tsx`'s `FileUploadBucket`, and the owner's env var.
- **Model:** opus — changes the security posture across uploader, save, route and four registries at once; a half-landed pair is a save outage that renders as emptiness.
- **Depends on:** 3, 8. **Owner gate:** **A**.
- **Verification:** the four registry tests green; `parseClientRef` cases: media pabuya ref under `pabuyaQrPolicy` → null; thread-files ref → truthy; thread-files ref under `eventMediaPolicy` → null; `pabuyaQrPolicy('e1').bucket` is in `PRIVATE_R2_BUCKETS`. Prod, owner's own event (standing authorisation): upload a real QR Ph PNG (not a 171 KB stand-in), read back `qr_r2_key` → `r2://setnayan-thread-files/events/…/pabuya/…`; anonymous curl of that key on the `r2.dev` host → 404; dashboard preview renders it; delete the test method after.
- **Guard:** the writer/reader enumeration + a source count of 0 for `bucket="media"` in `pabuya-manager.tsx`. Sabotage: delete the `bucket` field → the policy assertions go red.

**True at the end of Stage 3:** every QR uploaded from now on is unreachable without recognition. **Still open:** the one pre-existing object (and any orphans) still answer 200 anonymously.

---

### STAGE 4 — Drain and lock (the only step that reduces exposure that exists today is Step 12)

**Step 11 · Author the move script — dry-run by default, planning logic pure**
- **Goal:** NEW `apps/web/scripts/migrate-pabuya-qrs-to-private.ts`, line-for-line on the precedent: select rows whose `qr_r2_key` names `setnayan-media` under `events/%/pabuya/%`; per object COPY with its own S3 client (`r2Copy` cannot cross buckets **[carried]**) → HEAD-verify size + etag → UPDATE ref with `.select()` and require exactly 1 row → DELETE source; abort the object on any mismatch; keyed on the FULL key; `--only-key` filter; `MIGRATE_APPLY === '1'` gate. A pure `planPabuyaQrMove(rows)` decides rows and the new ref; the produced ref must pass `parseClientRef(ref, pabuyaQrPolicy(eventId))`. Generic over prefix so Step 17 can reuse it.
- **Files:** the script; NEW `lib/pabuya-qr-move-plan.ts` + `.test.ts`; changelog.d fragment.
- **Model:** opus — a verified copy followed by a wrong UPDATE is unrecoverable once DELETE runs; the precedent is a shape, not a script to run unchanged.
- **Depends on:** 10. **Owner gate:** A (and B, for whether the vendors prefix is in scope — 0 rows either way).
- **Verification:** `npx tsx --test lib/pabuya-qr-move-plan.test.ts`: the live shape's new ref passes the policy; already-private → skip; non-pabuya media key → excluded; `legacy_url` → skip with reason. Source assertions: `DeleteObjectCommand` appears after the etag comparison in byte order; the apply gate is `MIGRATE_APPLY === '1'` and nothing else. No credentials used in this step.
- **Guard:** the plan test + the byte-order assertion. Sabotage: drop the etag compare → red.

**Step 12 · ⚠ DESTRUCTIVE, OWNER'S HANDS — move the live QR and revoke the public copy**
- **Goal:** the old key returns 404 anonymously on `https://pub-37d64fe618584c2981a88610a55dd439.r2.dev`; the row names the private bucket; the owner's guests still see the QR. This is the revocation of every presigned URL ever rendered — not a tidy-up.
- **Files:** none. Owner runs: dry run, then `MIGRATE_APPLY=1 npx tsx apps/web/scripts/migrate-pabuya-qrs-to-private.ts` from a checkout with R2 + service-role creds.
- **Model:** sonnet for the session's part — four probes with expected values written down before they run.
- **Depends on:** 3, 10, 11 — **and Steps 3 and 10 must be SERVED** (probe the bundle, not deploy-prod's colour).
- **Owner gate:** the owner runs it. The session never asks for the credentials.
- **Proof before apply:** baseline anonymous curl of the old key → 200; route anon → 403; dry run prints exactly 1 event_egift_methods candidate ending `-IMG_4424.jpg` and 0 vendor candidates; Step 11's tests green on the served commit.
- **Verification after (different mechanisms, not the script's ledger):** (1) anonymous curl of the OLD key → 404, and a sibling non-existent key still 404 (so it is not a bucket outage); (2) `select qr_r2_key from event_egift_methods where public_id='S89Y-YVVMHATFG6'` → starts `r2://setnayan-thread-files/`; `select count(*) from event_egift_methods where qr_r2_key like 'r2://setnayan-media/%'` → 0; (3) anonymous route → 403; (4) owner signed in → 200 `image/jpeg`, same byte length as before (159647 **[carried]**); (5) `https://www.setnayan.com/cale-ice/pabuya` as a recognised guest shows the QR.
- **Guard:** Step 13 is what keeps it done.

**Step 13 · Tighten: private-only on read and write, one migration, after the count reads zero**
- **Goal:** delete `pabuyaQrLegacyMediaPolicy` from the route and the save path; ONE migration (`pnpm migration:new`, never hand-typed) adds a write-side fence on `event_egift_methods.qr_r2_key`: a CHECK naming only the private bucket (mirror of `events_site_media_names_only_the_public_bucket`, reversed) plus the own-event-prefix RESTRICTIVE pair copied from the `refs_are_own` precedent in `20271219262486_every_cleanup_delete_is_pinned.sql` — an in-repo shape, not an invented pattern. If the executor finds the per-event prefix cannot be expressed with that precedent, the CHECK alone lands and the route's prefix check (Step 3) is named as the fence, in writing.
- **Files:** `lib/r2-client-ref.ts`; the route; `pabuya/actions.ts`; `lib/pabuya-qr-ref.test.ts` (media own-event key → null); NEW `supabase/migrations/<new>_event_egift_methods_qr_private_only.sql`; NEW `tests/db/pabuya-qr-names-the-private-bucket.db.test.ts`; `lib/ugat/graph.ts` claims or `tests/db/ugat-concept.baseline.txt` only if the Ugat tests fire; the pinned-policy enumeration list if it enumerates `refs_are_own` policies.
- **Model:** opus — a constraint one clause wrong refuses the only live save path; it may only merge after Step 12's count is re-run.
- **Depends on:** 12. **Owner gate:** none.
- **Verification:** precondition `select count(*) … like 'r2://setnayan-media/%'` → 0 **immediately before merge**; `pnpm test:db` green including the new db test (media ref refused, private own-event ref accepted, other-event private ref refused, NULL accepted), `exposure-freeze.db.test.ts`, `ugat-schema-claims.db.test.ts`; the pipeline applies the migration — never a direct apply, never `migration repair`.
- **Guard:** the CHECK/policy (a fence no code path can forget) + the db test + the narrowed resolver case.

**True at the end of Stage 4:** the live QR is unreachable without recognition by any route; the write side cannot point the column anywhere else; the transition code is gone. This is the coherent stopping point for the security work.

---

### STAGE 5 — Registers, wording, and the one-word answers

**Step 14 · Correct the registers that now state something false**
- **Goal:** (a) `lib/pabuya-qr-verdict.ts`'s docblock stops calling the owner's `IMG_4424.jpg` an unscannable phone photo — cite the re-measurement (sharp + jsqr at the 1600px pass, every `isQrPhPayload` clause, merchant sub-tag matches the stored handle by hash, 2026-09-17) and claim nothing about other rows, because only ONE was decoded; (b) the switches register's `PABUYA_PUBLIC_ROUTE_ENABLED` row reads ON with the curl beside it — edit `build-sessions/P0-b-SWITCHES.md` only if it exists in the ACTIVE worktree, else record it in the handoff; (c) `app/[slug]/_lib/room-links.ts` gains the wake's solemn label via the same tone resolver the hub uses (ruled 2026-08-17, `WAKE_PROFILE` docblock) and joins the file list in `the-wake-never-celebrates.test.ts`. Do NOT change the celebratory word — that is question F.
- **Model:** sonnet — three known edits with written sources of truth.
- **Depends on:** 2. **Owner gate:** none.
- **Verification:** `grep -n 'phone photo' apps/web/lib/pabuya-qr-verdict.ts` asserts nothing about the live row; verdict tests still green (the `QR_PH_RAILS` lock untouched); `the-wake-never-celebrates` test green with `room-links.ts` listed; sabotage: restore the flat literal for a wake → red.
- **Guard:** the wake test; a docblock cannot fail, which is why it cites the command instead of a conclusion.

**Step 15 · Apply whichever one-word answers have arrived (C, D, E, F)**
- **Goal:** F → one string in `room-links.ts` plus an assertion that hub and footer share it. C → one ⚖ comment on `bucketForPrefix`'s `merchant-qr/` rule. D → a pure `looksLikePaymentIdentifier` in NEW `lib/payment-identifier-shape.ts` + test, wired as warn / refuse / withhold per the word (tested on `09171234567`, `0917 123 4567`, `1234-5678-90` AND negatives `09:00`, `Table 12` — assert the property, not a phrasing). E → the withheld sentence links `/[slug]/invite` and the ⛔ comment in `room-links.ts` is amended to say why this one door is allowed.
- **Model:** sonnet — each branch is a known edit once the word exists.
- **Depends on:** 1, 14. **Owner gate:** C, D, E, F — do only the sub-items whose answer arrived; a recommended default is a recommendation for him, never permission for the session.
- **Verification:** the new tests + `room-links`/wake tests; `grep -n '⚖' apps/web/lib/bucket-routing.ts` ≥ 1 if C answered; if E = yes, `an-account-number-is-not-public.test.ts` asserts the sentence carries an `/invite` href.
- **Guard:** `payment-identifier-shape.test.ts`; the shared-label assertion.

**Step 16 · Record every ruling in the corpus (including "leave it" for G, H, I)**
- **Goal:** one dated `DECISION_LOG.md` row per answered letter, quoting the owner's word; unanswered ones listed as open with a date; the t1-7 reminder noted as owed by the DPO with the measurement that fired it; every PR from Steps 3–15 has its `changelog.d/` fragment with a `SPEC IMPACT:` naming the row or `None`.
- **Files:** `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` (standing 2026-06-04 authorisation); `changelog.d/*` audit. `lib/npc-filing-tasks.ts` is NOT edited — the task text is still correct.
- **Model:** sonnet — transcription in the existing row format.
- **Depends on:** 15. **Owner gate:** G, H, I (record whichever arrived).
- **Verification:** `grep -n 'PABUYA\|Pabuya' DECISION_LOG.md` shows one row per answered letter; `ls changelog.d | grep <slug>` per merged branch.
- **Guard:** none beyond the fragment convention; anchors are ⚖ headings, never numbers.

**True at the end of Stage 5:** no register says something the tree contradicts; the wake pill is solemn; every owner word is written down once.

---

### STAGE 6 (conditional on B = yes) — Supplier payment QRs, while the table is empty

**Step 17 · Supplier payment QRs: private bucket, deleter, gated route — route first, readers second, bucket last**
- **Goal:** a gated `app/api/vendor-payment/qr/[publicId]/route.ts` (pattern: the pabuya route; recogniser: couple-owns-the-`event_vendors`-link, the vendor, admin — NOT a copy of pabuya's); the four readers of `vendor_payment_methods.qr_r2_key` (`lib/vendor-payment-methods.server.ts` twice, `app/vendor-dashboard/payment-options/surface.tsx`, `app/admin/payment-options/page.tsx`, and the couple-side workspace/budget/proposal pages that consume them) point at the route; then `vendorPaymentQrPolicy` pins the private bucket and `add-payment-method.tsx`'s `<FileUpload bucket="media">` flips in the same commit; `deletePaymentMethod` deletes via a `vendorPaymentQrScope`; `PRIVATE_BUCKET_ROOTS` gains `vendors` under thread-files (today only vendor-verification lists it **[re-confirmed]**) with the upload-prefix tenancy test covering it; a `refs_are_own` fence mirroring Step 13, private-only from day one. No migration script — re-confirm `select count(*) from vendor_payment_methods` = 0 immediately before the bucket flip.
- **Model:** opus — a second gated door with a different recognition question and four surfaces plus the proposal path; the bucket flipped ahead of the readers blanks every supplier QR silently.
- **Depends on:** 13. **Owner gate:** **B = yes**. If B = no: one ⚖ comment on `vendorPaymentQrPolicy` recording "stays public", nothing else.
- **Verification:** route test executes the ref allowlist and the three recogniser arms; registry tests green; as a test supplier add a method, as testnayan1 open the vendor workspace → QR renders via the route; anonymous route → 403; anonymous object on `r2.dev` → 404; delete → object gone.
- **Guard:** the route test + `private-upload-roots-registered.test.ts` + a source assertion that no reader of `vendor_payment_methods.qr_r2_key` calls `displayUrlForStoredAsset` (it returns null for a private ref — a failure that renders as emptiness).

**True at the end of Stage 6:** the whole Pabuya fix is not owed a second time for suppliers.

---

## 4. Dependency graph at a glance

```
1 ─────────────────────────────────────────────▶ 15 ─▶ 16
2 ─▶ 3 ─▶ 6 ─▶ 7
2 ─▶ 4 ─▶ 8 ─▶ 9
2 ─▶ 5
2 ─▶ 14 ─────────────────────────────────────▶ 15
3,8 ─▶ 10[A] ─▶ 11[A,B] ─▶ 12[owner runs] ─▶ 13 ─▶ 17[B]
```
Steps 3, 4, 5, 14 can run in parallel worktrees after 2 — but **one heavy job at a time** on this 16 GB Mac (serialise `tsc` through `heavy-lock.sh`), and never three concurrent Opus builds (weekly cap).

---

## 5. Destructive / money-adjacent steps and their proofs — summary

| Step | What it destroys | Proof that must exist first |
|---|---|---|
| 8 | The couple's displaced/deleted QR object, on their own action | Pure planner passes all four cases; scope refuses other events; byte-order: delete after the counted write |
| 9 | Every QR object of an event on Remove-for-good / erasure, service role | Sweep test plans exactly the fixture key and refuses a foreign key; coverage test lists the column |
| 12 | The public copy of the owner's live bank QR (encodes his account) | Dry run = exactly 1 candidate; Steps 3 and 10 SERVED (bundle probed); COPY verified by size+etag; UPDATE counted = 1; five post-probes by different mechanisms |

No step moves money, records an amount, or introduces a Setnayan-held rail. No step applies anything to production outside the pipeline; no step touches the migration ledger.

---

## 6. NOT DOING — and what I rejected from the three candidates

**Not doing (ruled or disproven):**
- Re-asking the account-number / QR gate, link reachability, Setnayan-never-holds-money, account-name-and-rail-public, or the note→`pabuya_message` move — all closed and verified.
- Re-uploading or backfilling the owner's bank QR — the "phone photo" premise is false; the object decodes and passes `isQrPhPayload`. Step 14 corrects the docblock. A sweep sized for one already-valid row is a guess dressed as a feature.
- Widening `QR_PH_RAILS` — locked as a product decision in the constant's own ⚖ note.
- Closing `/[slug]/pabuya` to link-holders, making the media bucket private, moving DNS to Cloudflare, or reviving `media.setnayan.com` — the bucket serves every public image; the CSP entry is a recorded owner ruling.
- Running the migration or any R2 delete from a session; applying a migration directly to prod; `migration repair`.
- Deciding D, E, G, H, I or the merchant-QR question by building a default — asked once, recorded once.
- Drafting the NPC RoPA row — the owner is the DPO.
- Retiring `event_egift_methods.note`; editing `CHANGELOG.md`/`STATUS.md` in feature PRs; touching #5543 or #5547's scope.
- A general orphan-object audit of `events/*/pabuya/` — needs an R2 listing the session cannot perform; noted as unmeasured in §9, offered to the owner as a dry-run flag on Step 11's script if he wants it.

**Rejected from the candidates, and why:**
- **risk-first's order (pin the bucket at step 2, before the route and the deleters):** it needs answer A before anything ships, and it makes the live row's next save fail until the migration runs. The route hardening (Step 3) closes the only self-serve exposure and needs no decision — it goes first.
- **dependency-first's two migrations (dual-bucket RESTRICTIVE policy early, then a narrowing migration):** two schema changes where one suffices; a fence that must be loosened to survive the transition is churn. Between Step 3 and Step 13 the route — the only reader that streams bytes — already refuses foreign refs, so the write side can wait for the data to move. Stated honestly: during that window a hostile PATCH is a stored-but-unservable row, not a read.
- **owner-time-first's `PABUYA_QR_BUCKETS` constant beside `pabuyaQrPolicy`:** two mechanisms for one fact — the exact near-miss the CLAUDE.md rules record. The route accepts a list of policies instead; there is one place the bucket is named.
- **risk-first's step 7/8 ordering (choose the host set, then make it executable):** inverted — the pure split (Step 6) is behaviour-preserving and lands first, so the host-set change (Step 7) is a tested one-line diff, not a refactor and a policy change in one PR.
- **risk-first's `isHostMemberType`-vs-`userHostsEvent` framing:** neither is the authority. The dashboard's write path has no TS host check; RLS decides. The executor reads `pg_policies`, not TypeScript.
- **owner-time-first's vendor route as "copy the pabuya recogniser":** the question differs (couple-owns-the-vendor-link); kept as Opus with the route-first ordering.
- **Correcting `P0-b-SWITCHES.md` as a hard step:** it is untracked in the main checkout and may not exist in the ACTIVE worktree; made conditional.

---

## 7. Where the owner can stop

- **After Stage 1:** self-serve attack surface closed; ruling executable. Anonymous exposure of the one live object remains.
- **After Stage 2:** objects have a lifecycle going forward. Same remaining exposure.
- **After Stage 3:** new uploads safe; one old object still public.
- **After Stage 4:** the exposure the owner ruled on twice is closed and fenced. **This is the stopping point that matters.**
- **After Stage 5/6:** hygiene and the supplier surface.

---

## 8. Model split (for the record)

Opus: 3, 6, 7, 8, 9, 10, 11, 13, 17 — gates, destruction, shape-deciding, cross-surface.
Sonnet: 1, 2, 4, 5, 12 (probes only), 14, 15, 16 — written done-conditions, pattern copies, transcription.

---

## 9. Still unmeasured — do not treat as findings

- **The production `R2_PUBLIC_URL` host** is inferred (it is the img base on the live homepage and the host in the CSP). I did not read the Vercel env; a session cannot.
- **Whether `lib/pabuya-qr-check.server.ts` fetches via a public URL or bytes** — unread. If public, Step 10 silently disables QR validation for private uploads. Step 10 must check it first.
- **What `event_egift_methods_host_all` actually admits** — unread; Step 7's whole answer depends on it.
- **Whether `event_egift_methods.event_id` is the uuid that appears in the key prefix** — likely (the route passes it to `userHostsEvent`), not confirmed; Step 3 confirms before writing the prefix check.
- **Whether `FileUpload` returns a presigned GET preview for a thread-files upload in `pabuya-manager.tsx`** — assumed from the payment-proof precedent.
- **How many orphaned objects exist under `events/*/pabuya/` in R2** — unknowable without a listing credential; production has one row that was never replaced, so likely zero, not proven.
- **Whether #5547's `typecheck + lint` block is a real failure or a slow runner** — it read IN_PROGRESS at measurement.
- **Whether the vendor-side readers behave with a presigned private URL** — they are RLS-gated, so the shape should work; not exercised.
- **The 159647-byte length and the 403/200 probes** are the measured state's numbers from today; re-run them before Step 12, do not cite them from this document.