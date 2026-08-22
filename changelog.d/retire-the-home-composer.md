## 2026-08-20 · refactor(launcher): retire the "What's your event?" composer

The full-width composer row under **Your events** is removed. Owner, on a
screenshot of that screen: *"if that is create event. then we do not need it
there because create event is already found on the top nav?"*

**Its premise expired.** The row was asked for on **2026-08-07** (owner, from
the Facebook comparison: *"instead of what's on your mind? what's your
event?"*) at a time when creating an event was reachable only through three
SMALL controls — the dashed ghost card, the phone pill's ➕, and ⌘K — and none
of them ASKED. The top bar's full `+ Create event` button landed **2026-08-15**
(when the owner said *"create should allow me to create an event"*), which is a
big, worded invitation in a more prominent place. From that day the composer was
the same single destination, said twice, two rows apart.

**And it read as a search bar.** The owner's first question about it was whether
it searched his events — one row under the real search bar, which does exactly
that (`HomeCommandBar`, ⌘K, filters your own events/spaces/destinations). A
control that has to be explained before it can be used costs more than the
invitation it adds.

**Creation is unchanged and still reachable four ways** from this page: the top
bar's `+ Create event` (≥1024px), the phone pill's ➕ (<1024px — the same CSS
split that already hides the top-bar button there, so no width loses its door),
the dashed **New event** card at the end of the board, and ⌘K. All four point at
`/dashboard/create-event`, the same href the composer used.

Removed with it, because nothing else read them: the launcher's
`users.display_name, profile_photo_url` SELECT (its only two consumers were the
composer's avatar and the greeting, itself retired 2026-08-18), the
`displayUrlForStoredAsset` resolution of that photo, and the now-unused
`profileRes` leg of the page's `Promise.all` — one fewer query per home render.

Guard trimmed, not weakened: `lib/your-face-not-a-letter.test.ts` loses the
three assertions that pinned the composer's photo plumbing (a guard for a
surface that no longer exists can only cry wolf) and keeps all three call-room
assertions, which cover a live surface. Verified 3/3 pass, and the launcher's
own `two-levels-and-the-board.test.ts` 32/32.

⚠ **Not observed in a browser.** The launcher sits behind a login and the
worktree has no local Supabase env, so this is proven by typecheck (clean) and
tests, NOT by a live look. Do not upgrade that to "verified on the live site".

SPEC IMPACT: `DECISION_LOG.md` row 2026-08-20 (supersedes the 2026-08-07
composer decision — the button that replaced it did not exist then).
