## 2026-09-20 · feat(invitation): one action under the mark, and its label is the status

Second slice of the arrival design (owner-approved canvas, 2026-09-20), on top of the mark-first
reorder in #5781.

Directly under the hero, an identified guest now meets ONE accented control whose words say where
they stand: **RSVP** before a reply · **You're going** with a quiet *Change* after one · **Show
your pass** on the day · **See the photos** after. An anonymous reader gets nothing — the public
page keeps its own call to action rather than meeting a second, weaker one.

🕐 **The day boundary is Manila's.** `manilaToday()` formats the current instant in Asia/Manila
and both sides compare as `YYYY-MM-DD` strings. `new Date('YYYY-MM-DD')` is midnight UTC — the
previous day here — and would turn the day-of branch on EIGHT HOURS EARLY, during the night before
the wedding. A test states that trap with a real instant (00:30 Manila on the 18th reads as the
17th in UTC) and pins the call site to the helper.

⚠ **Not a second fixed bar.** `GuestHubBar` was retired for covering the menu whole
(`fixed bottom-0 z-40` over a `z-30` menu); this renders in the flow. A test asserts the component
carries no `fixed bottom-0`, and that the row sits below the hero and above the status card.

Two more branches worth naming: a guest with no QR is not sent to a pass that does not exist, and
someone who declined is not handed a door pass on the day.

Guarded by `lib/one-action-says-where-you-stand.test.ts` (9 tests). Two sabotages each turn one
red: making the label a verb again, and letting UTC decide the day.

🔴 **CAUGHT BEFORE MERGE, IN THIS BRANCH: every href was invented.** The first version pointed at
`#your-qr`, `#schedule`, `#photos` and `#rsvp` — **none of those ids exist on the invitation**, so
each label scrolled nowhere and reported nothing. A fragment link to a missing id is the quietest
failure this page has. The hrefs now come from `SITE_MENU_ANCHORS`, the map the site menu already
resolves, plus one new `PASS_ANCHOR` rendered on the QR card. A test walks EVERY branch and asserts
each target is a real anchor; restoring `#your-qr` turns it red.

Not yet seen by a real guest — that check comes after deploy, on a guest link.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-20 row — the arrival's one action.
