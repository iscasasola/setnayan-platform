## 2026-08-25 · fix(guests): choosing a whole barkada could leave Add dead with nothing on screen saying why

Found by the completeness pass of the samahan audit — the one that asks what nobody looked at. It
is a defect **the bulk control I shipped this morning made reachable in one tap**.

Add is held shut while any chosen one-word name still has no last name. That rule is computed over
**every loaded row**, but the only control that can satisfy it — the "Last name" box — renders
inside the **visible** list. So: press the barkada chip → *Choose all 12 shown* → clear the chip →
the three one-word names are still picked, now off screen, still holding Add shut. Nothing named
them, nothing counted them, and the only escape was closing the sheet, which discards the entire
selection you just built.

Samahan rows are exactly the population it bites: they are built from a single display-name string,
and a group-chat handle is one word far more often than a guest-list entry is. Before one tap could
pick twelve people you reached that state one tick at a time, with the input right under your
finger.

Now the footer **says it** — "3 of your 12 need a last name — show them" — and that is the control:
it shows those rows, **reaching past both the chip and the search**, because past them is exactly
where they went. There is a way back to the whole list, and the blocking view lets itself out once
the last surname is filled rather than leaving you staring at an empty list.

Four mutations, each measured before → after, all red.

SPEC IMPACT: None.
