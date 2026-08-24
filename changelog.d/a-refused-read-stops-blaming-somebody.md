## 2026-08-24 · fix(guest): a refused read stops blaming somebody

W2-A's "three hub files where a refused read renders as blank". The framing
turned out to understate it: these pages did not render **blank** on a failed
read — they rendered a **confident accusation**.

Every absence state on the seat pass and the table finder blames someone:

| the guest read | *"Open this from your invitation"* — to somebody who just did |
|---|---|
| the token lookup | *"your QR was replaced, get a new one"* — about a perfectly good QR |
| the tables read | *"the floor plan is on its way"* — a claim about the **couple's** progress |
| the event read | `notFound()` — *"your celebration is not a real page"* |

`supabase-js` resolves with `data: null` on failure, which is the **same value**
as "nothing here". Only the error tells them apart, and every one of these
discarded it. **None of those four accusations is recoverable by the person
reading it.** "Try again" is the only honest answer, and now the one they get.

📏 **Measured before and after** — `app/[slug]/seat/page.tsx`: 9 reads, **0**
error bindings → the four user-visible ones bound. `find-my-table/page.tsx`: 4
reads, 1 binding → 3.

⚖ **One read is deliberately left alone and named here rather than silently
skipped:** the tablemate-names lookup. A failure there shows a table with no
companion names — mildly worse, blames nobody, and needs no new surface.

### ⚖ The photos plate is a DECISION, not a defect — and is not reworded

`empty-states.tsx`'s `photos` copy is unreachable, and its own comment says so
and says why: *rewording a string no guest can reach is a fix nobody can see.*
That is a decision, and § 0b's rule applies — it is not mine to reverse. What IS
a defect is wiring it up as-is, because a birthday's guests would read *"The
couple's photos will appear here."* **That comment's warning is now a test**: it
fails the moment anything passes `kind="photos"` while the copy still hardcodes
"the couple". A reason written as a rationale gets summarised away; written as a
failure condition it gets run.

🛡 **6 mutations, all measured, all red.**

🪤 **AND MY OWN TEST FOUND A FOURTH READ BY FAILING.** The first cut anchored on
the *first* `.from('guests')` in the file. There are **three**, and the first is
the token lookup — so a correct fix reported red, and chasing why surfaced the
"your QR was replaced" lie, the most alarming of the four. Re-anchored on the
binding.

🪤 **AND ONE ASSERTION WAS DECORATION OVER A 57-CHARACTER SLICE.** The
"blames nobody" check sliced the failure component with `indexOf('\n}')` — which
lands on the closing brace of the **destructured parameters**, not the function.
Every `!includes` then passed over almost nothing: putting *"is being arranged"*
straight into that component's title stayed **GREEN**. Bounded to the next
top-level declaration, with a length assertion so a collapsed slice is visible
rather than silently vacuous. This is the *negative assertion over an empty
slice* shape already recorded in this project's own notes.

✅ typecheck clean · lint exit 0 · **test:unit 9733/9733**.

SPEC IMPACT: closes W2-A's three-hub-files item.
