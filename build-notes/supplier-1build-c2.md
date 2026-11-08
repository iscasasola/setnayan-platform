# THE ONE BUILD — lane C2 (Data + deal pages) · build notes

Branch `claude/supplier-1build-c2` (from `origin/claude/supplier-1build-base` @ 50ba2da1). Early push
`claude/supplier-1build-data` = the data commit only (migrations + db tests + additive `setnayanGiftForFee` `limitPct`).

## 📣 DATA PUSHED — `origin/claude/supplier-1build-data` @ d2c905c3 (2026-11-08)

The four migrations + their db tests + the additive TS (`setnayanGiftForFee` `opts.limitPct`, `GIFT_LIMIT_PCT_DEFAULT`,
`readShopBookedLoopCount`). Replayed on PGlite with every schema-wide db guard (Ugat claims/coverage/both-ends,
policies-ask-once, rls-checks-once, anon grants, realtime predicates, user-FK, exposure) — green except the two
generated maps (exposure baseline, user-FK map: controller regenerates) and two ITEMS PRE-EXISTING ON THE BASE (below).
**Full db run (all 528 files, on the data commit 0e11b3df): 4,366 / 4,372 pass.** The six: (1) `a-held-shop-name-holds-its-core`
#15 — pre-existing on the base; (2) exposure-freeze and (3) user-FK map — generated baselines, controller; (4) ugat-both-ends —
fixed by `readShopBookedLoopCount` (now in `-data`), leaving only `shop_name_is_held`, pre-existing on the base; (5)
every-person-keyed-table-is-decided — fixed: hearts are exported + erased (pushed to `-data` @ 19e22b15); (6)
gates-have-handles `chat_message_hearts.hearted` — its writer is the chat stream's upsert, which lives on the lane branch
(passes there); on `-data` alone it stays red until the controller integrates `-c2`. (On the lane, the same guard flags
C3's `vendor_questions.is_required` — C3's to answer.)
Merged on the lane branch with `-forms-data` (C3): prefixes unique, all lanes' new db tests green together (34/34).

## Status board

| Item | State |
|---|---|
| `-data`: brief `hosts` + `event_chat_hosts()` | ✅ built, db-tested, sabotaged |
| `-data`: `chat_message_hearts` (+ `chat_pair_is_blocked`) | ✅ built, db-tested, sabotaged |
| `-data`: `platform_settings.gift_limit_pct` + `setnayan_gift_for_fee` reads it | ✅ built, db-tested (TS == SQL at 40 and 25), sabotaged |
| `-data`: `shop_booked_loop_count(vendor)` | ✅ built, db-tested, sabotaged |
| Gift limit: TS `limitPct` everywhere, `getGiftLimitPct`, Admin › Gifts audited save | ✅ |
| Quotation (11 steps on ProposalMaker, pinned Total + Save + Send) | ✅ (see deviation D1) |
| Chat (body split, avatar strip, sender names, hearts) | ✅ (see deviation D1) |
| `_pages/hub.tsx` (Open Hub · Launch Hub · Set up · Crew · pages) | ✅ (see deviation D2) |

## Migrations (all via `pnpm migration:new`, none applied anywhere)

- `20271324946509_the_brief_names_the_hosts.sql` — `event_chat_hosts(uuid)` (service_role only; joins
  `u.user_id = em.user_id`, emits `u.user_id` = the auth uid) + `get_vendor_event_brief` copied verbatim from
  `20271304542745` with exactly three edits (diffed). `hosts` on every rung. `guests_may_see_seats` call kept; no
  "function get_vendor_event_brief(" phrase in a comment.
- `20271325581544_a_message_can_be_hearted.sql` — `chat_message_hearts` (RLS at CREATE; read mirrors as-built
  `chat_messages_member_read`; own-row INSERT/UPDATE with `(SELECT auth.uid())`; no DELETE; scope derived by trigger;
  realtime publication guarded).
- `20271326463501_the_gift_limit_is_an_admin_setting.sql` — column + CHECK 0–100; `setnayan_gift_for_fee(BIGINT)`
  copied verbatim from `20271303683629` with the constant turned into a read (diffed).
- `20271327129110_a_shop_counts_its_booked_loops.sql` — `shop_booked_loop_count(uuid)`, service_role only.

**Definition chosen for Booked Loop (follows spec §9 #11 "distinct couples who booked this shop on a 2nd event" + §4
"the same family books the shop again"):** a booking = `event_vendors` linked to the shop by `marketplace_vendor_id` OR
`linked_vendor_profile_id`, status in the booking-fee functions' booked list, not archived, not `voided_by_fraud`, not a
self-booking / self-comp (the `vendor_completed_events` exclusions); a couple = `event_members` `member_type='couple'`;
two partners count as ONE family (keyed by their first booked event with the shop). C4 reads it with the admin client.

## Findings (measured) the controller should see

1. **The shipped `chat_messages_block_guard` is defeated by the caller's RLS.** On the replay, a couple who blocked the
   supplier could still INSERT a chat message into an unpublished shop's thread: under `SET ROLE authenticated` the couple
   cannot see that shop's `vendor_profiles` row, so the guard's inline lookup is empty and NOT EXISTS is true. Hearts use a
   SECURITY DEFINER helper (`chat_pair_is_blocked`, answers only about `auth.uid()`) and their db test proves the block
   holds. **The chat_messages guard itself is outside this lane** — suggested follow-up: re-point it at the same helper in
   its own migration + db test. (Tried to file it as a suggested task; the tool timed out.)
2. The plan's B1 §3b claim "the block guard is inherited through the INSERT policy's EXISTS" is wrong — the block guard
   is RESTRICTIVE **FOR INSERT** on `chat_messages`, and an EXISTS is a SELECT. Fixed as above.
3. The plan's guard 7 wording ("`chat-message-stream.tsx` imports nothing from `lib/thread-decisions.ts`") is wrong —
   the stream has imported it for months (its Decisions panel). `lib/a-bubble-is-not-a-decision.test.ts` pins the real
   rule: the heart code imports nothing about decisions and the bubble tap does nothing but heart.
4. Authenticated gets DELETE on every new table through default privileges — the hearts migration REVOKEs ALL first.
5. Pre-existing on the base (not this lane, both re-measured on an untouched base worktree):
   - `tests/db/a-held-shop-name-holds-its-core.db.test.ts` test 15 fails on `origin/claude/supplier-1build-base`.
   - `tsc` error in `tests/db/one-source-buckets.db.test.ts(189,39)` (`VendorCount.unverified` missing).
6. More rendered "40%" gift strings exist than the spec's three (see NEEDS → C4).

## Deviations (each follows a written ruling; recorded so nobody re-asks)

- **D1 · No `lib/proposal-maker-props.server.ts` loader; one body instead.** The ProposalMaker props are computed from the
  thread page's ONE batched `Promise.all` (thread, brief, services, templates, packages, methods, gift/fee standings…).
  A separate loader would have been a second copy of those reads (two read paths that drift — what the loader was meant
  to prevent) and a rewrite of a 2,065-line page that 53 tests read by path (risk R2: "pure moves with green tests").
  Instead `SupplierThreadBody` renders the shipped thread page itself with an internal `__embed` view:
  `quotation` = version line + the page's own `toolNodes['build-quote']` (seeded from the live quote, like "Update this
  quote"); `chat` = the page's one `ChatBox` without the full-screen frame. One read path, one `<ChatMessageStream>`
  mount, every guard and string still in one file, the full-screen route unchanged. Cost: the Quotation page makes the
  thread page's reads (stated below). A later loader extraction can replace the embed without touching the client shell.
- **D2 · Hub** likewise renders the shipped on-the-day page for ONE event (`__embed=hub`): doors first, then Set up ·
  Crew · The event's pages. `hub-event-body.tsx` / `lib/hub-event-tools.server.ts` were NOT created — no second
  `resolveModules` call site exists to unify for the client page (it uses the page's own `readEventTools`). The live
  page keeps its own chain as today.
- **D3 · The quote's money rows** (fee · Setnayan gift switch · gift copy · Papic ceiling) stay ONE guarded container and
  sit in step 5 Gift — v113 draws the fee and the limit under GIFT. Subtotal / Discount / Total sit in step 7.
- **D4 · Pinned bar "Save"** = the shipped "Save this quote · reuse it next time" (opens its name field, in step 10).
  Plan Q1 / owner said "Total with Save"; the app's send is still the ONE "Send quote · ₱X".
- **D5 · Host strip** shows the hosts + "You"; the shop's other staff are not listed (no read for them on the thread
  page yet; v113 shows only hosts + You). Presence = the ring only (spec §4).

## NEEDS FROM OTHER LANES

- **C4 (service files, spec §9 #12)** — replace the typed "40%" with the live limit (`getGiftLimitPct(admin)` on the
  server page → a `giftLimitPct` prop; or drop the number): `services/_components/services-manager.tsx` ("capped at 40%
  of it"), `services/_components/service-wizard.tsx` ("capped at 40% of that"). Also, via the controller (not in any
  lane's rows): `lib/gift-pick.ts` (3 strings, "never more than 40% of that fee", "capped at 40% of its fee"),
  `lib/package-gift.ts` (1). `lib/the-gift-limit-is-one-setting.test.ts` lists them in a shrink-only list —
  **delete each line there when its file stops typing it** (the test fails until you do).
- **C4** — `shop_booked_loop_count(p_vendor_profile_id uuid) → integer` is in `-data` (service_role; call it with the
  admin client). Flip Booked Loop `measured:true` only when you read it.
- **L1 / C1** — the brief now carries `hosts: [{user_id, first_name, name, role, label}]` on every rung (Today's
  "N hosts in chat" chip reads `brief.hosts.length`). Parser: `lib/chat-hosts.ts` `chatHostsFrom`.
- **L2 (client shell)** — the bodies are `clients/[eventId]/_pages/{quotation,chat,hub}.tsx`, each a server component
  `({ eventId, vendorProfileId, threadId: string | null })` (default export + named `QuotationPage` / `ChatPage` /
  `HubPage`), each in its own Suspense. If your hour-0 stubs used the same paths, mine replace them at integration.
  L2 also owns the chat-redirect removal in `clients/[eventId]/page.tsx` and `one-chat-box-everywhere` tests 3–4.
- **Controller — `.gitignore` swallows `build-notes/`.** The root `.gitignore` is an allowlist (`/*` then `!/apps/` …)
  and has no `!/build-notes/` line, so every lane's notes file is invisible to `git add -A`. This file was added with
  `git add -f` (tracked files are unaffected afterwards); other lanes may not have noticed. Add `!/build-notes/` on the
  merged tree (the same swallowing pattern the file's own comments describe for `internal-decks/`).
- **Controller** — `apps/web/scripts/lint-server-action-budget.mjs` CEILING raised 1232 → 1233 with the reason
  (`saveGiftLimitPct`); reconcile ONE number on the merged tree.

## Generated files / Ugat / maps (controller, on the merged tree — not touched here)

- `supabase/migrations.manifest.txt` (`pnpm migrations:manifest`) and
  `supabase/security/exposure-surface.baseline.txt` (`pnpm exposure:baseline`) — 4 new migrations, a new
  authenticated-writable table (`chat_message_hearts`), 3 new functions.
- `tests/db/ugat-concept.baseline.txt` — only if `ugat-concept-coverage` fires for `chat_message_hearts`; the reasoned
  line: `chat_message_hearts | map-backlog — a per-user ♥ on chat_messages; lives under the chat thread joint`.
- `lib/ugat/graph.ts` optional claims: TYPE-THREADS "hosts in a chat = event_members member_type='couple'
  (event_chat_hosts)"; "a message's hearts are chat_message_hearts (message_id, user_id)"; supplier-gifts joint
  `column platform_settings.gift_limit_pct`.
- `lib/admin-map/admin-routes.generated.ts` — Admin › Gifts gains the "Gift limit" row.
- Port-control / design-rules / screens baselines — regenerate (ProposalMaker controls moved between sections; new
  `_pages` files).

## Request counts (per page, as built)

- Quotation: the thread page's batched read (one `Promise.all` + its dependent reads, as the full-screen thread) + 1
  (`vendor_proposals` version rows). Same as opening "Update this quote" today, +1.
- Chat: the thread page's batched read; the hosts read REPLACED two queries (`event_members … limit 1` + `users`) with
  one RPC; hearts: 1 read on load (+1 per resubscribe), writes are one upsert per tap; realtime rides the existing channel.
- Hub: the on-the-day page's reads for one event + Crew and pages bodies (the three segments' reads, in parallel).

## Proof

Side-by-side, v113 (left) vs build (right), 375 px light, in `build-notes/c2-shots/` — drawn from the fixture lab
`/dev/supplier-chat-lab` (no session, no database; dummy env only):

- `quotation-01…05.png` — `?m=quote&gifts=1&embed=quotation` (the client's Quotation page body), scrolled to Start from ·
  Gift · Travel and crew meal · Payment schedule · Quote effectivity. Every step in v113's order; the bar is pinned
  above the bottom nav with Total · Save · Send quote. (The lab's fixture standing is "silent", so the Setnayan-gift
  switch row is not drawn there — it renders only where the booking can carry a gift, as shipped.) The lab's shell is
  the base's (bar still says Customers/Hub — L1's).
- `chat-01.png` — `?m=tools&booked=1&hosts=1`: the hosts strip (Maria · Jose · You, "Shared chat · 3 inside") and the
  host's first name + initials on her run. The lab keeps the full-screen head; the client's embedded view has none.
- **Not shot:** hearts (a tap writes through Supabase; nothing to write to here — `lib/chat-hearts.test.ts`, the RLS db
  test and `the-host-strip-reuses-presence.test.ts` cover it) · the Hub page (the on-the-day page needs a signed-in
  supplier with a booked event; v113 reference: `v113-hub` text in the prototype). **Controller: check Chat hearts and
  Hub on the simulator after integration.**
- Motion: these pages do not animate on their own (the 520 ms open/close is L2's shell).

## Preflight (full run, `--base origin/claude/supplier-1build-base`, 2026-11-08) + full `tsc`

Full `tsc`: clean except the pre-existing base error (`tests/db/one-source-buckets.db.test.ts:189`).
Full preflight: 34 min. Every red that was this lane's is FIXED (audited save reads its error · hearts count via
`formatCount` · `_pages` walked by the port guard (`scripts/port-controls.mjs` PRIVATE_SUBDIRS) · the quote bar's
"fields are in the page" exemption in `every-bottom-input-rides-the-keyboard`). What stays red, and whose:

| Check | Why | Owner |
|---|---|---|
| Root map current / `ugat/screens-are-generated` | `screens.generated.json` stale (new `_pages`, moved doors); `check-ugat-screens` reports **no new enforced finding** | Controller (regenerate) |
| `admin-map/admin-jobs-are-generated` | Admin › Gifts gained the Gift limit save | Controller (`pnpm admin:jobs`) |
| `exposure-freeze` · `user-fk-behaviour` | new table/functions; `chat_message_hearts.user_id` CASCADE | Controller (`exposure:baseline` · `UPDATE_FK_BEHAVIOUR=1`) |
| `ugat-both-ends` | `supplier-thread-body` unmounted until L2's shell mounts `_pages/*`; `shop_name_is_held` pre-existing | Integration / base |
| `ugat-concept-coverage` | `vendor_forms` [hub] | C3 |
| `gates-have-handles` | `vendor_questions.is_required` | C3 |
| `numbers-carry-commas` | `lib/vendor-forms.ts` `items.length` | C3 |
| `export-coverage-guardrail` T12 · `shop-name-hold` | fail identically on the untouched base | pre-existing |
| port-control baseline | `_pages` is now walked (+ moved quote controls) | Controller (regenerate) |
| no-card baseline | 3 files now BELOW baseline (fewer cards) | Controller (`lint-no-card --update-baseline`, lowers only) |

## Where I stopped

**Done (pushed to `origin/claude/supplier-1build-c2`):** every item of the C2 lane block — `-data` (pushed, merged back),
gift limit (SQL + TS + Admin › Gifts audited save; the "40%" strings sent to C4 above), Quotation (11 steps, pinned bar,
proved at 375 px), Chat (`SupplierThreadBody`, hosts strip, sender names, hearts), Hub page. Notes, changelog
fragment, guards (each new one sabotaged once), side-by-side shots.

**Exact next steps:**
1. When `origin/claude/supplier-1build-foundation` appears: `git merge origin/claude/supplier-1build-foundation`, then
   swap the quote bar's raw `z-10` for the page-layer z token (spec §10 #23) and its bottom offset for the foundation's
   token if it supersedes `--sn-bottomdock-h` / `--sn-thumb-room`; re-run the quote guards + shots.
2. Re-shoot Quotation/Chat inside L2's real `PickedClientShell` once the shell exists (controller, after integration).
3. If the owner rules a loader file after all (D1), extract `lib/proposal-maker-props.server.ts` behind
   `SupplierThreadBody` — the client pages do not change.

**Waits on whom:** L2 (shell mounts `_pages/{quotation,chat,hub}.tsx`; chat redirect + `one-chat-box-everywhere`
tests 3–4) · C4 (the typed "40%" in its service files; Booked Loop reads `readShopBookedLoopCount`) · L1/C1 (`brief.hosts`
for Today's "N hosts in chat") · Controller (generated files above; the block-guard finding; `.gitignore` `build-notes/`).

**Owner questions left open (not built, honest state):** the card gift pre-filling the quote (spec §4 — unruled money);
host names before the fee (B1 Q9 — built visible, as the thread already shows one name).
