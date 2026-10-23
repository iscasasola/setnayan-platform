# HANDOVER — rd/audit-small-fixes-2026-10-23 (moved to a CLOUD session, 2026-10-23)

Four owner-approved audit fixes (owner "yes", 23 Oct). Branch cut from origin/main 250ff3e8ca.
Work in `apps/web`. Run every test from `apps/web` (`@/` imports die elsewhere). A test path with
`[eventId]` written literally matches ZERO tests — use `*` globs and check the count is non-zero.

## Brief rules that still apply (copied from the controller's prompt)
- ONE PR (or two if the admin part is cleaner alone): `gh pr create --draft --base main`, then
  `gh pr edit <N> --add-label do-not-auto-merge` and `gh pr merge <N> --disable-auto`; verify
  `gh pr view <N> --json autoMergeRequest` is null. NEVER mark ready, merge or deploy.
- PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`; commits end
  with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Add a `changelog.d/rd-audit-small-fixes-2026-10-23.md`
  fragment (`## 2026-10-23 · fix(scope): …` + `SPEC IMPACT:` line). Do not edit CHANGELOG.md/STATUS.md.
- Do NOT touch: Guests "Setup"→"Settings" rename, Home/Papic/Memories (rd/event-bar-memories),
  account Settings/Preferences/front door/Discover (rd/menus-and-discover-follow-the-rulings),
  lib/iap + studio routes (rd/iap-five-more-products), Papic camera upload (rd/papic-save-first-send-later),
  "gallery" copy sweeps (rd/no-gallery-word).
- Server-action ceiling 1225 — add none (fix 4 reuses `saveLaunchOffer`'s `intent=window`).
- UI house rules: title + one short line, details in ⓘ; choices = dropdown; frames only on
  pressable; dark works; phone first 375; say "event", never "celebration".
- Migrations: `pnpm migration:new` only; RLS/grants per repo; CLAUDE.md rule 4 (Ugat db tests);
  NEVER apply to production.
- Proof wanted: before/after 375 px screenshots for fixes 1–3; guards with a sabotage run; all CI
  guards from apps/web, tsc, unit + db tests.
- REPORT once (≤12 lines): PR + SHA, each fix done/not and why, migrations, screenshots, checks.

---

## FIX 1 — Maker scene delete is immediate → ✅ ALREADY SHIPPED, nothing to change

Ruling (DECISION_LOG.md, verbatim):

| 2026-10-07 | ✅ **FINAL FIXES MERGED (#6394); THE COVER LOSES ITS FRAME FOR EVERYONE; "REMOVE FOR GOOD" WAITS FOR APPLY (OWN STEP).** Owner, verbatim: *"ok"* → *"1. remove for good · 2. for everyone"*. ⇒ (1) "Remove for good" on a couple's own scene becomes a drafted removal published by Apply (Undo restores), and a new own scene lands above/below the picked part — its own PR. (2) The cover drops its card frame and wears the Global Background for EVERY couple (not behind the Maker switch), legibility by the hub's contrast rule — its own small PR. | Owner in chat 2026-10-07. |

Verified on origin/main: shipped in PR #6397 (commit 10c3b7049b). The Maker's own-scene confirm
(`add-part-sheet.tsx` `RemovePartSheet`) renders `sceneRemovers` = `SectionsPanel makerPart="remove"`
whose form carries `HubDraftField` (`draft=1`); `widgets/actions.ts` `intent === 'delete'` +
`draftingHere` saves `HubDraftWidget.removed`; Undo restores (`undoHubDraft`); Apply deletes via
`deleteOwnScene` (`hub-draft-actions.ts`). The copy already says "…deleted for good when you Apply"
(`makerRemoveWords` in `lib/maker-part-groups.ts`). The audit misread the `removeWord: 'Delete'` label.
Guard: `lib/remove-for-good-waits-for-apply.test.ts` — 7/7 pass. Sabotage done: replacing
`{makerPart ? <HubDraftField /> : <HubSavesImmediately />}` with `<HubSavesImmediately />` in
`sections-panel.tsx` → red ("the Maker’s Remove for good is not drafted") → restored green.
Verify: `npx tsx --test lib/remove-for-good-waits-for-apply.test.ts`
Left: optional before/after screenshot is moot (no change) — say so in the report.

## FIX 2 — Event-day Home shows "Head table" on simple events → ✅ CODE DONE (committed)

Ruling: owner "yes" to the audit item (no separate DL row): show `YourTableCard` only when the
event actually has a seat plan / tables, using the existing seating signal, no new flag.
Done: `apps/web/app/dashboard/[eventId]/_components/day-of-mode/your-table-card.tsx` exports
`eventHasSeatPlan(headTable, nearbyTables)` (= any table exists, from `fetchTables` on the page)
and the card returns null without one. Kept OUT of `grid.tsx` on purpose: open PR #6791 edits the
lines right after `<YourTableCard … />` there, so this avoids a conflict.
Guard: `app/dashboard/[eventId]/_components/day-of-mode/the-head-table-needs-a-seat-plan.test.ts`
(render via react-dom/server) — 4/4 pass; sabotage (delete the `return null` line) → 2 fail →
restored 4/4.
Verify: `npx tsx --test 'app/dashboard/*/_components/day-of-mode/the-head-table-needs-a-seat-plan.test.ts'`
Left: 375 px before/after screenshot of the event-day Home on a lab event with no tables.

## FIX 3 — Articles title is wedding-only → ⏳ NOT STARTED

Ruling (DECISION_LOG.md, verbatim — the 10-01 Articles rows):

| 2026-10-01 | 📰 **KEEP THE ARTICLES — AND GROW THEM ACROSS EVERY EVENT TYPE AND FAITH (feature pages are not articles).** Owner, verbatim: *"this means we no longer need articles? those are the articles? And we can create more articles to be able to address the different event and religions and features our website has?"* ⇒ Two different jobs: **feature pages** (/features/<slug>) say what Setnayan does; **articles** (the shipped `/blog` = "Setnayan Articles", `lib/blog.ts`) answer what people search while planning. Keep both and link them both ways. Grow the articles: (1) one guide per event type (debut 18 roses/candles/treasures, christening, wake & pasiyam, corporate, birthdays, reunions…); (2) one per faith/rite, drawn from the shipped traditions guide (`lib/wedding-traditions.ts` WEDDING_TRADITIONS_GUIDE + `lib/faith-registry.ts`: Catholic, INC, Muslim/Nikah, Chinese tea ceremony, Born Again, Civil, Aglipayan…); (3) "how to" per feature (e.g. "How to collect every guest photo with Papic"). Tagalog twins; real FAQs; each ends with the matching feature's Try it. **Each feature page shows a "Guides" row of 2–4 related articles** (cards → each article's own page), and each article links back to its feature (owner, verbatim: *"when we open the feature. there can be a couple of articles inside it as well that has their own pages?"* → yes). Fix the blog's wedding-only title ("Filipino wedding planning guides" → all events). Owner reviews faith/rite articles before publishing (accuracy + respect). Queued with P10. | Owner in chat 2026-10-01. |
| 2026-10-01 | 🗂 **ARTICLES LEAVE DISCOVER — THEY LIVE UNDER FEATURES.** Owner, verbatim: *"so on discover, articles will be removed. it will stay inside features?"* → yes. ⇒ Discover (the front page) keeps what is happening: upcoming events, Real Stories, suppliers/shops. Articles move under **Features**: each feature page's "Guides" row + one **"All guides"** page reached from Features (the existing `/blog` list, regrouped by event type · faith · feature, with search). Old article URLs keep working (same `/blog/<slug>` pages, or a permanent redirect if they move) so nothing indexed is lost. Part of P10. | Owner in chat 2026-10-01. |

What to change (title-only; the regroup is a later build) in `apps/web/app/blog/page.tsx`:
- `metadata.title` and `twitter.title`: "Setnayan Articles — Filipino wedding planning guides" →
  event-neutral, e.g. "Setnayan Articles — Filipino event planning guides".
- `metadata.description`, `openGraph.description`, `twitter.description`, and the JSON-LD
  `blogJsonLd.description` ("Filipino wedding planning guides — …", "…couples planning a wedding…")
  → event-neutral.
- Visible eyebrow "Setnayan Articles · the Filipino wedding edit" and H1 "Wedding planning, the
  Filipino way." → event-neutral ("event", never "celebration").
- First `grep -rn "Filipino wedding planning guides" apps/web` for any test/guard pinning the old text.
REPORT (not change) what else on the page is wedding-only: the `real-weddings` category key/label
(`lib/blog.ts` `blogCategoryLabel`), and the article list itself (almost all wedding guides).

## FIX 4 — Admin money switches → ⏳ NOT STARTED (findings below)

Ruling (DECISION_LOG.md, verbatim):

| 2026-09-23 | **THE THREE ADMIN MONEY-SWITCH QUESTIONS ARE ANSWERED — ⚠ BY THE VENDOR-DASHBOARD SESSION UNDER THE OWNER'S DELEGATION, NOT BY THE OWNER.** He said, verbatim and in full: *"answer the three money switch questions"*, having already seen all three with recommendations on the prototype. So these are the session's calls, made with his authority — **record them as reversible, and if any is wrong he overrides without argument.** **(1) A RUNNING FREE-FEE PROMOTION IS NOT ANNOUNCED** — suppliers meet it on the quote, where the line already reads *"Booking fee ₱X — free right now"*. That is the moment a supplier decides whether to take a booking, which is the moment it can change behaviour; a banner is cheap to add later and awkward to withdraw. ⚠ A banner DOES earn its place if a promotion is ever used to RECRUIT suppliers rather than nudge existing ones — a different goal and a later build. **(2) TURNING THE EVENT-HUB LOCK ON WARNS AND NAMES, IT DOES NOT REFUSE.** Refusing blocks a call the owner is entitled to make; naming who would be shut out is what makes warning safe. 🔑 **The console still REFUSES in the one case where refusing is correct — when it could not COUNT who would be affected** (`pointer-events:none` on the switch plus a sentence). So *"I know and it is bad"* and *"I do not know"* stay different answers, which is the whole point of the blast-radius line. **(3) A PROMOTION CARRIES A REASON, AND IT IS REQUIRED TO OPEN A WINDOW** (not to close one). In a year the audit row shows money was waived for three weeks; without it, not why. 🔑 **It is the only one of the three that cannot be added back later** — the other two are one-line reversals, a missing history is not — which is why it is required rather than optional. ⚠ **NONE OF THIS IS BUILT.** The slice is held by the REDESIGN CONTROLLER; the prototype now shows the three as SETTLED rather than amber. | corpus `prototypes/admin_money_switches_FINAL_2026-09-22.html` - repo (unbuilt) `apps/web/app/admin/pricing/_components/booking-fee-form.tsx` - `_surfaces/pricing-surface.tsx` - `price-control-actions.ts` - plan `build-sessions/PLAN-vendor-money-switches.md` - SPEC IMPACT: this row |

Findings on origin/main:
- (3) Reason: the free-fee window is ONE window on `platform_settings` (`booking_fee_free_from`,
  `booking_fee_free_until`; migration `20271240512825_a_free_fee_window_waives_the_charge.sql`).
  Form: `apps/web/app/admin/launch-offer/launch-offer-form.tsx` `FreeFeeWindowForm`; action:
  `actions.ts` `saveLaunchOffer` `intent === 'window'` (writes platform_settings + an
  `admin_audit_log` row 'booking_fee_free_window_edit' with before/after); page reads the two columns
  in `page.tsx`. No reason column exists. Plan: `pnpm migration:new` → add
  `booking_fee_free_reason TEXT` with a length CHECK (NULL allowed; NO "reason required" CHECK in SQL —
  a prod row with an open window and no reason would then make every other platform_settings update
  fail); re-state `REVOKE ALL ON TABLE public.platform_settings FROM anon; GRANT SELECT ON TABLE
  public.platform_settings TO authenticated;` as every platform_settings migration does (note: any
  signed-in user can read the column, like the rest of the row). Action: when the saved window is
  non-empty, require a non-blank reason (refuse with a plain message); when both dates are blank
  (closing), no reason needed and clear it to NULL; include the reason in `update` (so the audit row
  carries it). Form: a required-when-opening "Reason" text field, prefilled with the stored reason;
  page selects the new column. Regenerate `lib/admin-map/admin-jobs.generated.ts` with
  `pnpm --filter @setnayan/web admin:jobs` if it drifts (`admin-jobs-are-generated.test.ts`).
  Run db tests incl. `tests/db/platform-settings-anon-revoke.db.test.ts` and the Ugat tests.
  Add a guard (reason required to open, not to close) + sabotage.
- (2) Event-hub lock: there is NO admin control for `fee_unlocks_event_enforced` anywhere in
  `apps/web/app` (`grep -rn fee_unlocks_event apps/web/app` → nothing; only readers in `lib/`).
  Per the brief: REPORT it, do NOT build a new switch.

## Decisions taken (not covered by the record)
- (2) Hide inside the card, not in `grid.tsx` (conflict with #6791). A failed table read hides the
  card (it arrives as no tables) rather than claiming "No head table set up yet".
