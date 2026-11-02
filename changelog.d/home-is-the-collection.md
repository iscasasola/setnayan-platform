## 2026-08-11 · fix(home): the home board is reachable — it is the collection, ongoing and completed

**Owner ruling:** *"home board is for the user's collection of events. On going and completed."*

### The trap this removes

The launcher's landing rule was:

```ts
if (active.length === 1 && !hasConsole) redirect(`/dashboard/${id}`);
```

`active` means **"not archived"** — so a wedding that had *already happened* still matched.
Every single-event, non-console user was bounced out of the home board into their event, and
the account switcher's Home button pointed at plain `/dashboard`, **which re-fired the same
redirect**. The loop had no exit.

That is not cosmetic. **Alaala · People · Samahan · the Creator's Lab did not exist** for the
core persona — an engaged couple with one wedding — nor for *any* couple after their wedding
day, permanently. It is the reason the owner's *"how do i find my samahan"* had no good
answer: he could not reach the room it lives in.

The 2026-07-04 ruling was *"keep the auto-jump, **hub reachable**."* Only the first half was
ever built.

### What changed

- **The jump fires only while the sole event is still UPCOMING.** Once the day has passed the
  person is keeping, not planning, so they land on the collection — which is precisely what
  the owner's ruling requires the board to hold. It reuses the file's **own existing**
  `isPast` definition (moved above the rule; the display split still uses it below).
- **`?hub=1` always wins**, and the account switcher's Home carries it. Home now means the
  board from anywhere — the "reachable" half, finally.

### Deliberately NOT changed

- **The auto-jump itself.** A couple mid-planning with one wedding still wants to land in it;
  reversing that would undo a ruling the owner has never withdrawn.
- **The 0-event console redirect.** That branch was correct — only the single-event one
  over-fired. A test pins it so the fix cannot over-correct into stranding a vendor with no
  events on a blank board.

### Guard

`home-is-reachable.test.ts` — 4 tests, **every mutation verified applied before the red was
trusted**:

| Mutation | Result |
|---|---|
| revert to the original over-firing rule | **2 fail** |
| drop the hub bypass from the redirect | **1 fails** |
| "tidy" `?hub=1` off the switcher's Home link | **1 fails** |
| remove the untouched console branch | **1 fails** |

A **source scan** on purpose: the hazard is a `redirect()` that fires too often. There is no
return value to assert — `redirect()` throws — and the launcher does a dozen live reads
first, so standing it up in a unit test would assert the mocks rather than the rule. The
third case is the one most easily lost: someone tidies the query string off the href and the
launcher's guard still reads correctly in review.

SPEC IMPACT: `DECISION_LOG.md` — the owner's 2026-08-11 ruling on what Home means.
