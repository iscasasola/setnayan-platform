# Supplier Build 2 · lane B2-D — one thread draw per client open + #42 Decisions on Details

Branch `claude/supplier-build2-d` (from `origin/claude/supplier-1build` @ `20a8c8bf34`). No PR, no merge, no deploy.
Dummy env only (`http://db.test` in the guard, `http://127.0.0.1:1` for the lab); `.env.local` never read. No migration.

## RULE 0 — what existed · what was missing · the delta

- **Existed:** the picked client builds EVERY page body per request (`_pages/switch.tsx` `pickedPageBodies`); Chat and
  Quotation both render the shipped thread page through `SupplierThreadBody` (`__embed`). The Decisions merge lived in
  `ChatMessageStream`'s `useMemo` (client), fed by card rows the stream reads in the browser. Details had Build 1's
  door (`details-decisions-door.tsx` + `decisionsLine`). The repo's per-render memory is `lib/request-once.ts`
  (`askedOnce`, with `withRenderScopeForTest` for tests) — used, not reinvented.
- **Missing:** a shared draw (each embed ran the whole 2,100-line read again), an exported merge, and the list on Details.
- **Delta:**
  1. `messages/[threadId]/page.tsx`: the page body became `drawVendorThread(threadId, sp, embedded)`. The default export
     routes every `__embed` (`chat` · `quotation` · NEW `decisions`) through ONE `askedOnce(viewerClient,
     'vendor-thread.embeds-draw', [threadId], …)`; the embedded draw returns all three nodes at once. The full-screen
     route draws alone, unchanged. Page-file text kept in place (46+ guards read it by path).
     - the embedded draw seeds the quote revision (Quotation opens on the live quote) — the chat tray's builder still
       opens empty (`toolNodesFor(cm)` / `vendorToolsFor(cm)`, `revision` only for `'quote'`);
     - it skips the conversation-list column (never drawn inside the client) — `fetchVendorThreads` + its batch;
     - `markThreadRead`: ONE per open. Build 1's "Quotation does not mark" never held (the Chat body was built on the
       same request); the Chat page is reachable from any page without a request, so the open marks once.
  2. `lib/thread-decisions.ts`: `threadDecisionFacts({ viewer, messages, cards, payments, guestCounts })` — the stream's
     merge moved out unchanged (incl. the centavo-exact `Math.round(card.totalCentavos) / 100`); the stream calls it.
  3. Details: `_components/details-decisions.tsx` (server, no read: `<Suspense><SupplierThreadBody view="decisions"/>`;
     no thread → "Nothing decided yet.") + `_components/details-decisions-list.tsx` (client; reads the clock,
     `buildThreadDecisions`, v118 look; answers through the stream's own `ReplyControls`, now exported, returning to
     `/vendor-dashboard/clients/<event>?tab=details`). The embedded draw builds the facts from its own messages, the
     Quotation's version rows (select widened by `title, resolved_at` — the same one read), payments, guest counts, and
     — only when a message carries one and the negotiation cards are on — the appointment / amendment rows (the
     stream's columns, the supplier's own session). A refused read → `partial` ("Some couldn't load. Chat has the full
     list."), never a shorter list.
  4. Build 1's door + `decisionsLine` deleted; `the-details-and-schedule-are-v113-order.test.ts` re-anchored (order
     marker `<DetailsDecisions `; test 4 = the list is mounted with the thread Details holds, no read of its own);
     `lib/the-installment-keeps-its-centavos.test.ts` pin moved with the merge (stream → `lib/thread-decisions.ts`).

## Proof — requests per client open (dummy env, fetch counted)

Lab = the guard `app/vendor-dashboard/clients/[eventId]/a-client-open-draws-the-thread-once.test.ts`: the REAL
`pickedPageBodies`, the REAL Chat · Quotation · Details bodies and the REAL thread page, rendered as React renders server
components, inside one render scope; `NEXT_PUBLIC_SUPABASE_URL=http://db.test`, every request answered and counted, a
signed-in supplier cookie, `createClient` one-per-request (its React-`cache()` contract). Run with `B2D_PRINT=1` to print
the per-table tally. Fixture: one accepted thread, empty tables (so a lower bound — real threads read more per draw).

| one client open | requests | thread draws (`chat_threads?thread_id=eq.`) | `markThreadRead` (POST `chat_thread_reads`) |
|---|---|---|---|
| **before** (base `20a8c8bf34`, Details = door) | **128** | **2** | **1** |
| **after** (Details shows Decisions) | **62** | **1** | **1** |
| after, Details' Decisions removed | 62 | 1 | 1 — Details' list costs **0** |
| sabotage: embeds un-shared | 172 | 3 | 3 |

(The before run was measured by checking the base versions of the thread page, `supplier-thread-body` and the door back
into this worktree against the same harness, then restoring them.) `markThreadRead` was already 1 on this base — the
"Quotation does not mark" skip (`e023fcaa62`) had landed after B2-A's note; un-shared it would be 3 with Decisions.

## Guards

`a-client-open-draws-the-thread-once.test.ts` — **6 pass**:
1·2 one draw · ≤1 read mark per open · 3 Details' Decisions add 0 requests · 4 two opens = two draws (per-render only) ·
5 the Details body has no client / fetcher and mounts the shared embed · 6 the decision is the thread's own quote row
(₱40,000.50 centavo-exact) and a refused `vendor_proposals` read sets `partial`.

Sabotaged, each red then restored:
- embeds drawn without `askedOnce` → 1 red (drawn 3×), 3 red (+54 requests), 4 red;
- Details reading `vendor_proposals` itself → 3 red (+1 request), 5 red ("no client, no fetcher");
- `partial` ignoring the refused version read → 6 red.

Touched-file test set: see "Test results" below. ESLint (`next lint --file …` on every touched file): clean.

## Screenshots (375 px, light + dark) — `build-notes/shots/b2d/`

- `sbs-42-details-decisions-{light,dark}.png` — v118 (Reyes & Santos, Details › Decisions) beside the build (the lab's
  Details on v118's own five rows: quote accepted · meeting confirmed · adjustment waiting · payment waiting · guest
  count waiting).
- `build-details-decisions-{full,none,partial}-{light,dark}.png` — the list · "Nothing decided yet." · the refused line.
- Light: the build matches v118's structure (title · now-line · answer under the row, dashed rules, no frames but the
  buttons). Page errors during the shot run: **none** (`errors []`). The red "3 Issues" pill is Next's dev overlay
  counting the dummy env's refused Supabase fetches (`127.0.0.1:1`, "bad port") — dev only, not from this list.
- ⚠ Dark is FORCED (`html.dark`) and the dark shot is **not a fair picture**: `/vendor-dashboard` is not on
  `DARK_READY`, so the picked client's body stays a white panel while the ink tokens flip light — every row on Details
  (the pre-existing ones above Decisions too) washes out alike. Production shows this surface light only; making the
  supplier client dark-ready is outside B2-D.

## Differs from v118 (for the controller)

- v118 colours a settled row green ("Confirmed", "Accepted · 10 Oct"); the build keeps settled rows neutral (ink/60) and
  only the one waiting on you in the ask colour — a declined or expired quote must not read green. One line to change
  if the owner wants green for settled-positive.
- v118's "See the quote →" link on an accepted quote: the build shows the stream's own reply for each kind (a quote
  under review links to `/proposals/<id>`); an accepted quote has no reply line, as in Chat.
- The answer buttons are the stream's (`ReplyControls`: Accept/Decline, Confirm received/It never reached me, Re-price/
  Hold the price) — the SAME forms and actions as Chat, not v118's mock pills. The payment answers' own actions return to
  the thread they were built for (they do not read `return_path`); meeting / adjustment answers land back on Details.
- "Details inside the ⓘ": the heading carries the ⓘ ("Every quote, meeting, payment and change…"); visible text is the
  title + rows.

## Test results

- Guard `a-client-open-draws-the-thread-once.test.ts`: **6/6 pass** (and red under each of the three sabotages).
- Core set (57 files that read the thread page, the stream, `thread-decisions`, the Details page or the lab): **460/460
  pass** after the source guards were re-anchored (`one-chat-box-everywhere`, `one-chat-box-like-messenger`,
  `one-chat-look-on-every-thread`, `the-chat-is-messenger-shaped`, `the-details-and-schedule-are-v113-order`,
  `the-installment-keeps-its-centavos` — each change says why in the test).
- After merging `origin/claude/supplier-1build` (`6635c00c73`, clean merge): the guard + `public-price-literals` +
  `numbers-carry-commas` **12/12 pass**.
- Lints: `next lint --file` on every touched file clean; `lint:port-controls` (baseline regenerated), no-card, radius,
  legibility, contrast, changelog-dir, server-only, `ugat:screens:check`, dup-rule — all pass.
- tsc: queued behind the heavy lock (4th in line at push time); CI on draft PR #7399 is the typecheck if it has not run. The full 107-file related set runs in the same heavy slot.

## Needs / not done

- **tsc:** see "Test results". CI's typecheck on draft PR #7399 is the gate.
- **Server actions:** none added (the list reuses existing actions; the lab's answers are client stand-ins).
- **Generated files:** `port-control-baseline.json` regenerated in this branch (door out, the list + lab in);
  `ugat:screens:check` passes as committed. If another lane also regenerates the baseline, re-run `pnpm port:baseline`
  after the integrate merge rather than hand-merging the JSON.
- **Dark:** see Screenshots — the supplier client is not dark-ready; not changed here.
