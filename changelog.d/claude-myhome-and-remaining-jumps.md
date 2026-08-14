## 2026-08-15 · fix(shell): the legal + marketing pages join the shared shell, and an unread admin queue stops reading as an empty one

SPEC IMPACT: None. No price, SKU, schema or product rule changes — this is the
same one-top-bar work already recorded in `DECISION_LOG.md` 2026-08-14,
continued onto the nine pages it had not reached.

**Nine more pages stopped jumping out of the shell.** `/terms`, `/cookies`,
`/acceptable-use`, `/refunds`, `/privacy`, `/privacy/google-access`, `/about`,
`/pricing` and `/realstories` each rendered the old floating glass nav; pressing
a link from a signed-in surface swapped the furniture. They now wear
`AppRailShell variant="doorway"` and left `NAV_ROUTES`. Measured on the served
HTML, not inferred: all nine return 200 with exactly one `<main>`, one `<h1>`,
one shell top bar and **zero** `backdrop-blur` (the old bar's marker).

`/pricing` had no `<main>` at all and carried hand-typed nav clearance
(`pt-20 sm:pt-28 lg:pt-32`); both are now the shell's job.

**`force-dynamic` + a `loading.tsx` on each.** The shell reads the session, and
a route that reads the session while `force-static` gets a silently EMPTY cookie
jar — it would build green, cache, and serve a permanently signed-out rail. A
layout cannot set this (`dynamic` resolves nested-most-wins), so it is one edit
per page. Each `loading.tsx` renders `null`: without a boundary a dynamic route
prefetches an empty tree (measured 72,197 bytes static / 162 without / 58,473
with), and a skeleton would flash a second set of furniture inside the first.

**My Home: an unread queue is no longer reported as a clear one.** The Admin HQ
tile said the desk was clear whenever it had failed to read it — in three places
at once: the page seeded and re-seeded the total to `0` in its `catch`; the
per-queue sum did `?? 0`, so one degraded lane vanished from an otherwise-good
total; and the tile printed nothing for the unknown state, which on a board of
numerals reads as calm. `count === null` means NOT MEASURED. It now stays
`null` end to end, sorts WITH the tiles wanting attention, and says
"Couldn't check the queues". This is the same defect `/admin/work` paid for on
2026-08-05.

The four My Home spokes (My Events · Alaala · People · Storyteller) also
unified to one content width; they had been 7xl / 5xl / 2xl / 3xl.

### Guards

- `unmeasured-is-not-zero.test.ts` (7) — runs the real derivation rather than
  grepping for `?? 0`. **Five mutations, each verified to land by occurrence
  count**, all now red: catch → 0 · loop branch → 0 · `?? 0` in the sum ·
  `needs` treating null as calm · the null branch rendering nothing.
- 🪤 **One mutation initially slipped through and the guard was widened, not
  the mutation dropped.** Rewriting the loop's `adminOpenTotal = null` to `= 0`
  is a real defect and BOTH existing assertions stayed green: one only checked
  that the `count === null` branch existed, the other never looked at the
  right-hand side. **Detecting a branch is not detecting what the branch does.**
- 🪤 **And one assertion cried wolf on correct code** — matching
  `adminOpenTotal = 0` over the whole file flagged the accumulator's legitimate
  seed. Scoped to the catch handler. A guard that cries wolf teaches you to skim
  past the one time it is right.

### `metadata` moved out of `app/privacy/google-access/page.tsx`

That page's guard imports its metadata to inspect the REAL resolved values.
The page then began mounting the shared shell, which carries
`import 'server-only'` — aliased by the Next bundler and **not in
node_modules** — so the test died with MODULE_NOT_FOUND. A guard that a UI
change can silence is worse than no guard. Two escapes were rejected: dropping
the shell's `server-only` marker (a real boundary), and re-reading the object
out of source with a regex (matching a string, not the act). The object moved to
a dependency-free `./metadata.ts`; the page still does a literal
`export const metadata = …`, so Next's static analysis is unchanged. Verified by
mutation: deleting `twitter` takes the guard from 7 pass to 3 fail.

### Not done, deliberately

- `/explore` and the 15 folder rows. Its search bar pins above the shell bar,
  the supplier grid would drop 1448 → 1160px against the owner's
  "let it maximize the full width", and a signed-out visitor would get a rail
  with no marketplace in it. That is a design decision, not a port.
- `/help` — 74 links point at footer-only `/help/[slug]` pages.
- `/alaala` still renders its own page rather than `DoorwayPage`.
