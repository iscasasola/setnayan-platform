## 2026-08-19 · design(app): seven section labels lose the paragraph under them

**SPEC IMPACT:** None — copy removal.

Found by opening the pages on the live site rather than reading about them. The
**People** header was clean, and two inches lower the identical shape was still
there: **ALAGA** over a five-line paragraph, **SAMAHAN** over two more.

Fixing the label at the top of a page and leaving the one below it is a
distinction without a difference to somebody standing on the page.

**The rule, taken from the owner's own reference.** In the Battery screen he
pointed at, Apple has a small grey **"Daily Usage"** label with **nothing** under
it — and it does keep grey explaining text, *inside the card, beside the control
it is about* ("Auto-Lock is currently turned off. You can save battery by turning
it on."). So: **a label never gets a paragraph.** Explanation either goes, or it
already lives at the control.

**Cut (7):**
- **Alaga** — the form directly below already says all of it *at the field*: the
  "What is this?" picker lists person/pet/business/own/else, and the date help
  spells out which of them keeps a birthday.
- **Samahan** — "first degree"/"second degree" is our internal vocabulary; nobody
  naming their barkada needs the graph explained.
- **Alaala · the memory you keep** (Studio) — marketing prose over a grid whose
  every card already says what it is.
- **The basics** (Personalization) — it listed the fields sitting underneath it.
- **Current hosts** · **Delegate activity** — both restated their own label; the
  activity list is visibly newest-first.
- **Your invitation site** — the address is printed on the very next line.

⚠ **I INFLATED THIS NUMBER TWICE AND BOTH COUNTS WERE MEASUREMENT ERRORS.** I
reported **377**, then **84**; the real count of the shape the owner objected to
is **7**.
- **377** counted every label followed by a `<p>` — but most of those `<p>`s hold
  a **count, a price or a date**. That is the page's DATA, not an explanation, and
  deleting it would have deleted content.
- **84** filtered to real prose, but the overwhelming majority of those are
  **legitimate and stay**: warnings ("this is the only time we'll show the full
  value"), danger notices ("not reversible"), error states, field help, and
  status. Those are precisely the Apple pattern — text beside the control.
🔑 **A REGEX FOUND THE SHAPE; ONLY READING FOUND THE DEFECT.** The pattern
"label then paragraph" is not the problem — a paragraph that only *describes* is.
Nothing but reading all 84 separates those.

⚠ Also: the first `tsc` run in a fresh worktree printed *"This is not the tsc
command you are looking for"* — no `node_modules`. It produced **no errors
because it never ran**, one line above a script that would have called that
clean. Verified `tsc --version` before trusting the second run.

Verified: `tsc` clean · full unit suite green · `lint-port-no-lost-controls` ✅ 402
routes / 1429 controls.
