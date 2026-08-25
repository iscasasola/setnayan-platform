## 2026-08-25 · fix(guests): "the whole barkada" left real members out, could pick strangers, and dropped everyone past 200 in silence

Three defects an adversarial audit found in the group gesture I merged this morning. (The audit's
finders ran; **every skeptic died on a session limit**, so each was re-verified by hand first.)

🚨 **THE CHIP WAS A WORD SEARCH WEARING A MEMBERSHIP FILTER'S CLOTHES.** Pressing a samahan typed
its name into the search box and let the text matcher do the work — wrong in both directions at
once:

- **Members were left out, silently.** A row's "from" line carries at most ONE samahan (the
  alphabetically first), and cross-source de-duplication keeps the richest row — so a cousin who is
  in your barkada *and* was a guest at your engagement party survived as an event row labelled with
  that party. She was not in the chip's results, nothing said so, and "the whole barkada" is the
  entire promise of the control.
- **Strangers could be picked.** A group called "Ana" matched Diana and Joana.

Now every candidate carries **every samahan the person is in**, a dropped duplicate **donates its
groups to the row that survives**, and the chip is an exact membership test. The chip and the
search box are two filters that compose, so you can still narrow inside a barkada.

🪤 **AND THE CAP DROPPED THE OVERFLOW WITHOUT SAYING SO.** `picks.slice(0, 200)` has always been
there and `failed` was only ever incremented inside the loop, so picks 201..N were neither added
nor counted — the call returned `added: 200, failed: 0`, and the sheet only speaks when `failed` is
non-zero, so it closed as if everything had worked. 140 relatives simply not invited, discovered
when their invitations never arrive. One tap on a list that reads up to 500 candidates is what made
that reachable this morning. **No silent caps** — the overflow is counted and named.

🪤 **TWO OF THE NEW GUARDS WERE DECORATION ON THEIR FIRST RUN, and only the mutation showed it.**
Turning the exact membership test into a substring test stayed GREEN, because no fixture had one
group name inside another (two real barkadas can easily be "Ana" and "Ana Barkada"); and slicing
the server builder down to the first samahan stayed green because nothing tied that line to
anything. Both closed. Seven mutations in total, each measured before → after.

SPEC IMPACT: None.
