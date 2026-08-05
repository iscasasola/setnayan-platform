## 2026-08-05 · docs: close the loose ends an audit found in the 2026-08-04 session

An independent audit of the six PRs merged on 2026-08-04 found several things that session
started, claimed, or implied but did not finish. None is a behaviour change; all are corrections
to statements that were wrong or unfindable.

**1 · 🦠 The false migration belief is spreading FASTER than the correction.** PR #4084 corrected
it and said *"two merged migration headers still assert the false version."* The real number is
**six** — and **two of those were written by other sessions AFTER #4084 merged**:

| migration | author |
|---|---|
| `20271102603681_orders_exclude_vendor_payer_from_event_reads` | the 08-04 session |
| `20271102765509_open_browse_default_new_events_on` | inherited, 08-03 |
| `20271102810371_vendor_lines_library` | the 08-04 session |
| `20271103100614_vendor_reuse_requests` | the 08-04 session |
| `20271104090000_vendor_package_items_team_admin` | **another session, after the fix** |
| `20271106090000_events_date_forced_by_lock_of` | **another session, after the fix** |

🔑 **The lesson is about where a correction has to live.** #4084 put it in a script docblock; the
belief lives in the auto-loaded corpus context, so new sessions kept inheriting it. The
authoritative correction now sits in the corpus `CLAUDE.md` "kill on sight" block plus a
`DECISION_LOG.md` row, because those are what every session actually loads. The docblock list here
is corrected to six and says why it undercounted: **it was assembled from memory by the session
that had authored three of them.**

All six are applied, so **none is edited** — never edit an applied migration.

**2 · The residency correction never reached its own to-do list.** #3946's fragment deferred
`.env.example` and `STATUS.md` pending the Cloudflare dashboard, then recorded that the fact had
arrived (APAC) and fixed only two code comments. Both were still stale:
- `.env.example` said *"Cloudflare R2 — PH region buckets"*
- `STATUS.md` said *"R2: 4 PH-region buckets"* — **wrong twice over**, the exact error that PR
  declared fixed: wrong region AND wrong count (there are five; `-vendor-verification` holds
  vendor government IDs).

**3 · 🔴 The outstanding owner action was undocumented — which is why it is outstanding.**
`NEXT_PUBLIC_WEBSITE_MENU_ENABLED` gates the navigation menu on the open-browse guest site whose
DEFAULT went live on 2026-08-04. **59 other `NEXT_PUBLIC_` vars were in `.env.example` and this one
was not**, so there was no way to discover it exists. Now documented, with the trap stated:
`siteMenuEnabled() = isSample || flag === 'true'`, so **the sample event forces the menu on and
proves nothing about a real event** — and `NEXT_PUBLIC_*` inlines at BUILD time, so it needs a
redeploy.

**4 · Four dangling migration prefixes in changelog fragments**, which
`scripts/changelog-collect.mjs` pastes verbatim into `CHANGELOG.md`. Each dead prefix now names its
successor rather than reading as current. `changelog.d/open-browse-launch.md` also still described
the launch in the future tense (*"Staged, auto-merge OFF"*) a day after the owner merged it.

**5 · Three fragments asserted the false claim** and would have published it as fact in
`CHANGELOG.md`. Each now carries the correction inline.

Verified: migration guard passes on 1,036 migrations; its 5 unit tests pass. No behaviour change.

SPEC IMPACT: **Yes — applied.** Corpus `CLAUDE.md` (kill-on-sight block), `DECISION_LOG.md`
(correction row), and `PR_H_Lock_Request_Handshake_BUILD_SPEC_2026-08-04.md` (3 assertions — that
spec is actively feeding another session's build, which is why it was corrected first).
