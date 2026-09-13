## 2026-09-08 · fix(explore): one action to reach a supplier

Owner, looking at four buttons on a search-result card: *"this seems confusing.
follow and save — what are the only buttons that we really need?"* Then, after
seeing the gate: *"message can message even if not followed."*

The card carried **Follow · "Follow to message" (greyed) · Save · View vendor**.
Two of them read as "keep this vendor" and did unrelated things, and Message was
a puzzle whose answer was a *different button* — a heart, sitting beside a
bookmark that meant something else entirely.

### Message no longer waits on a heart

"Iteration 0019 § Gate — couple must follow the vendor before opening a new
thread" is a **restrictive INSERT policy on `chat_threads`**. It is enforced by
the database, so deleting the button would not have removed the gate — it would
have produced an unexplained failure one step later.

🔑 **The other door already did this.** `app/v/[slug]/inquiry-actions.ts` lists
its steps as *"…2. follow the vendor (satisfies the iteration 0019 follow-gate
RLS)"* — the inquiry path has always followed on the couple's behalf. The two
doors disagreed and the messages one was the odd one out. Pressing Message now
records the follow and continues; the gate still holds.

⚠ **This does NOT retire the requirement.** That needs a migration against the
RLS policy plus a decision logged against Iteration 0019 — deliberately not done
here, and the guard exists partly so it stays a choice rather than something that
erodes. A failed follow fails LOUD, because a swallowed one would resurface as a
refused insert nobody could explain.

### Follow leaves the search-result card

The relation stays — RLS, `unlock-category` and the inquiry path all read it.
What goes is asking the couple to perform it as a separate step. It produced a
number **no vendor surface displays**: the shop page's "couples saved you" counts
SAVES. The profile variant keeps its button, where "follow this shop" is
unambiguous and where the messages page renders it as the `next_action=follow`
recovery affordance.

### Save says which event it saved into

Owner: *"Save adds to a specific event? this is a search result outside an
event."* It does — `saveVendorToPicks` resolves the couple's PRIMARY host event
and writes there. A reasonable default and a terrible secret: a couple planning a
wedding **and** a debut had no way to learn which one just gained a supplier. The
button now reads **"Saved to {event}"**, falling back to plain "Saved" when the
name cannot be read — the save still happened, and claiming an event we cannot
name would be worse than not naming one.

Mutation-tested four ways. One of them was initially a NO-OP — it re-inserted the
follow still *before* the upsert — and is recorded because a sabotage that does
not break the property proves nothing.

SPEC IMPACT: None yet. Retiring the Iteration 0019 follow requirement outright
would be a spec change; this satisfies it instead.
