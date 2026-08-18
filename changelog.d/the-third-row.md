## 2026-08-18 · fix(dashboard): the third row from the retired menu — and a guard that finds the next one itself

**A ten-page audit of routes with no inbound link returned exactly one real
defect, and it was mine.** This morning's fix restored two rows from a retired
menu component; that component held **five** links, and one of the three left
behind still stranded a live page.

### ⏳ "Refer a couple" was never clickable for a single day of its life

- **2026-06-17** — the account switcher replaced `profile-menu.tsx`; both imports
  of it were deleted.
- **2026-07-10** — a link to `/dashboard/[eventId]/refer` was **added to that
  already-dead component**, three weeks after it stopped rendering. The same
  day, the `refer` row was deleted from both nav sources of truth, and a
  changelog note recorded the page as *"reachable via direct link / account"*.
- **2026-08-18** — the audit found it. It has never had a door.

🔑 **The note is what stopped anyone checking.** Both halves of it were false:
the "account" menu it meant had already been unmounted, so the only way in was
typing the address. That sentence is now corrected at the source.

**What it costs:** the admin Studio's own screen promises this page *"appears for
couples"* when the referral programme is switched on. It cannot. The signup
capture, the reward vouchers and the qualify-on-first-paid-order hook are all
wired to a funnel with no entrance. Latent only because the page redirects while
the programme is off — the loss lands in full the moment that box is ticked.

### 🪤 A gate whose target is gone looks exactly like a gate that is working

The event layout computed `navHideKeys` containing `'refer'` whenever the
programme was off — filtering by item **key**, while no item was keyed `'refer'`.
So for a month it hid nothing and still ran a database read on **every event page
load**.

🔑 **This is the mirror of the gate-with-no-handle: a HANDLE WITH NO GATE.**
Nothing errors; the list simply never contains the thing it excludes. The row is
back and keyed `'refer'`, so the existing gate works as designed — deliberately
reusing it rather than adding a parallel one, because two gates are how the
halves drift apart. Measured both ways: programme on → the row is there;
programme off → it is gone.

### 🛡 The guard is now DERIVED, not hand-written

My first cut listed two segments, because I had two examples in front of me. The
audit found a third hours later.

🔑 **A GUARD IS ONLY AS WIDE AS ITS LIST.** The new assertion reads
`profile-menu.tsx` itself and requires **every** event-scoped link it holds to
exist in the live rail. It also asserts it found at least three links, so a
pattern that stops matching cannot pass while proving nothing.

**The decisive mutation** is not "remove a row" — it is **adding a new link to
the dead component**, which is precisely what happened on 2026-07-10. That now
fails. A hand-written list could never have caught it.

| mutation | |
|---|---|
| remove the Refer row | **red** |
| add a NEW link to the retired menu | **red** ← the 2026-07-10 event |
| tree after the run | clean — committed before mutating |

### The audit's other nine

All correct as they are: eight are redirects catching old bookmarks (each with a
real, labelled link to its destination), one is developer-only and 404s in
production, one is an internal test page. **The admin console is NOT
systematically doorless** — worth stating, since four admin routes were on the
list and none was a defect.

SPEC IMPACT: None.
