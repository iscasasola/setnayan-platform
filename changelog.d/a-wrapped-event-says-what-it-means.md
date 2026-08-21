## 2026-08-21 · fix(dashboard): the event names its own browser tab, and the frozen head count says what it is for

Two things spotted while verifying [#4661](https://github.com/iscasasola/setnayan-platform/pull/4661) **on the live site in the owner's own signed-in session** — the first time this stream has been checked by looking rather than by testing.

### The browser tab said "Filipino wedding planning + verified vendors"

Every sibling surface names itself — *Guests · Setnayan*, *Suite · Setnayan*, *Editorial · Setnayan* — because each exports a `metadata.title` that the root layout's `'%s · Setnayan'` template wraps. **The event Overview, the page a person actually lands on, exported none**, so it fell through to the marketing default. With two or three events open in tabs there was no way to tell which was which.

🔒 **The read goes through the CALLER's own session, never the admin client.** `generateMetadata` runs **before** the page body's membership check, so an admin read would put an event's name in the tab title of anyone who guessed an id. Under RLS a stranger gets no row and the site default — which is exactly right. Fail-soft in every direction: no name, no row, or a refused read all fall back rather than rendering an id or an empty title.

### "2 guests locked in", on a list with nobody on it

The owner's Guests page read **"0 guests"** and **"Guest list finalized · 2 guests locked in"** and **"0 of 2 pax"** at the same time.

The frozen figure is `max(estimated_pax, headcount)` — on an event nobody was ever added to, it is simply the number typed at sign-up. Calling that *"guests locked in"* put a figure contradicting the list in bold at the top of the list.

🔑 **Say what the number is FOR.** It now reads *"your suppliers price for 2 heads"*, and the sentence below it names what actually freezes — *"no longer change what your suppliers charge"*, not the vaguer "vendor costs". One wording, true whether the list holds nobody or three hundred, so there is no conditional that has to work out which case it is in.

### Verification

- 3 sabotages, each measured by occurrence count, each RED: the Overview stops naming itself (1 → 0) · the title read switches to the admin client (0 → 1 inside the function) · *"N guests locked in"* returns (`your suppliers price for` 1 → 0, stripped `guests locked in` 0 → 1).
- 🪤 **The second assertion failed on its own first run** — the fix carries a comment *quoting* the string it removed, so a raw source match reported the defect it had just repaired. Comments are stripped before matching: **raw 2, stripped 0, and 0 is the true number.** Same trap `doors-are-designed.test.ts` was corrected for.
- Unit suite **9175 pass / 0 fail**. Typecheck, `next lint` and the lint guards clean.

SPEC IMPACT: None — copy and page metadata only.
