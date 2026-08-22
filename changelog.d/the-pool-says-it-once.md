## 2026-08-19 · design(papic): the shared photo pool stops labelling itself twice

**SPEC IMPACT:** None.

The guest-facing pool page carried the eyebrow **"Everyone's photos"** directly
above a title ending **"— the whole gallery"**. One of the two was the other one,
on a page a guest meets once, on a phone, at a party.

The eyebrow goes. The paragraph under the title **stays** — it is the instruction
that makes the page work (*"Spot yourself? Tap **I'm in this** and the photo joins
**your** gallery"*), not a description of what the page is.

### The sweep this closes

Guest-facing surfaces were **never in the masthead lint's scope** — it watches
`app/dashboard`, `app/vendor-dashboard` and `app/admin` only, by design. Scanned
them all (`[slug]` · papic · panood · join · samahan · `/v` · `/u` · host ·
receipts · 3d_plan) for the eyebrow-title-paragraph shape: **6 instances, and 5
of them are correct.**

- **`/[slug]` not-found** and **error** — the "eyebrow" is the Setnayan wordmark,
  and the paragraph is the whole point of the page.
- **`/[slug]/pabuya`** — a guest who has never met the tradition needs *"the
  pabuya · digital money dance"*; "A blessing for Ice" alone does not say money.
- **Live Studio program** — the paragraph is what free gets you versus the unlock.
- **Papic order** — the paragraph is payment status.

🔑 **A guest page is not a dashboard page.** A dashboard is somewhere you return
daily and a label you have read a hundred times is noise; a guest surface is met
once, cold, by somebody who has never seen the product. The same sentence earns
its place in one and not the other.

Also re-read all **58** descriptions kept behind an (i) and checked for one that
opens onto nothing: **zero** empty ledes — no `lede=""`, no `lede={<></>}`, and
none under three words.

Verified: `tsc` clean (version checked first — a fresh worktree's `tsc` prints a
"not the tsc you are looking for" notice and reports no errors because it never
runs) · 833 app tests green.
