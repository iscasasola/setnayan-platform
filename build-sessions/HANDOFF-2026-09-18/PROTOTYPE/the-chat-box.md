# The chat box — what was wrong, what was built, what comes next
### Setnayan · 2026-09-18

---

## 1. What you saw

*"something is overlapping the your team"* · *"i cannot scroll"* · *"the chatbox shrunk"*
*"see. even on desktop view. there is an issue with the conversation box"*

Measured on production, on the couple's thread with a quote present:

```
<ol class="flex-1 … overflow-y-auto">   clientHeight   32px
                                        scrollHeight  498px
```

**The entire conversation in a 32-pixel sliver.** On desktop it clipped a card
mid-sentence instead.

## 2. Why — three separate faults, stacked

**a · Seven cards, one column.** The thread page stacked seven bordered blocks —
safety banner, pinned quote, interest chip, conversation, call row, deal row,
composer — down a fixed-height column. The conversation was the only `flex-1`
child, so it absorbed whatever the other six left. With a quote present, that
was 32px.

**b · An identity transform unpinned every overlay.**
`.sn-page-enter { animation: … both }` kept a `transform: matrix(1,0,0,1,0,0)`
applied after the animation finished. It moves nothing and is invisible in a
screenshot, a diff and a review — and per CSS spec *any* transform on an
ancestor makes it the containing block **and** a stacking context for every
`position: fixed` descendant. The 3-step tour's backdrop measured **636×2444**
against a 1107px viewport, putting Skip and Next 341px below the fold, behind
the bottom nav.

**c · The modal locked body scroll.** So the card was unreachable *and* you
could not scroll to it. Escape was the only way out, and nothing said so.

🔑 **Each is mild alone. Together they trap someone on a page with no visible
way out.** And all three were unreachable until today — (a) needs a quote to
exist, and no quote had ever been sent on this platform.

## 3. What shipped

| PR | | |
|---|---|---|
| **#5582** | `.sn-page-enter` ends on `backwards`, not `both`; 28 other rules baselined, list may only shrink | ✅ merged |
| **#5584** | quote moves **into** the conversation with its line items, a **Counter-offer** action, and two jump pills positioned over the scroller | ✅ merged |
| **#5586** | **one `ChatBox` frame** on both threads — header · one-line notice · tabs · conversation · composer · tool tray | in CI |

### The measurement that matters

| width | before | after · couple | after · supplier |
|---|---|---|---|
| 320 | **32** | 224 | 224 |
| 360 | **32** | 224 | 224 |
| 390 | **32** | 391 | 357 |
| 1440 | **32** | 453 | 443 |

## 4. Three corrections to my own work

Recorded because each cost something, and because a plan that hides its
mistakes teaches the next person nothing.

**#5584 did not fix the couple side — it changed the failure.** I swapped the
column's fixed `h-[calc(100dvh-12rem)]` for `min-h`. **A minimum with no ceiling
is not a floor**: the list grew unbounded, scroll-to-bottom scrolled nothing,
and a thread opened at its *oldest* message with the composer ~1100px below the
fold at 390px.

**#5584's Counter-offer was dead on the supplier side.** `?compose=deal` seeded
the amendment builder inside a closed `<details>`, so the button landed on a
page that looked unchanged.

**The six-tab row I specified does not exist.** I drew it from a screenshot of
the *client-brief* page. The thread ships All · Decisions · Files — and
**Decisions already is Quote + Payments + Schedule**, each card carrying its own
status line. The spec was drawn from the wrong page.

## 5. The prototype

**https://claude.ai/artifact/8hTv3DD7gSSw7ujjK88TcW** — two artboards at 390×844:
today's seven stacked cards beside the consolidated frame, in Setnayan's palette
with the real Rosa & Ben / Saysay thread in it.

⚠ It is a drawing, not a spec: its icons are 30px where real tap targets are
44px, and its tab row is the wrong one (see above). The **arrangement** is what
was approved.

## 6. What comes next — steps 2, 3, 4

Order set by the owner: *"you need to fix the chatbox first."* Each step's
surface is the previous step's output.

### Step 2 · a supplier updates a quote; the couple re-accepts

Owner ruling **(a)** — surface the amendment loop that already ships
(`proposal_amendments`, the builder, a propose → accept/decline RPC, db tests)
as **"Update this quote"** on the new quote card. Reachable today only through
the composer's 🧾, named after neither updating nor quoting.

**Depends on:** step 1 serving. **Not in scope:** a v1 → v2 → v3 history on the
proposal — that is option (b), and it means re-thinking the send-time freeze
that stops RSVP changes altering a sent quote.

### Step 3 · make the booking fee chargeable

```
NEXT_PUBLIC_BOOKING_FEE_ENABLED     "true"    ← set
NEXT_PUBLIC_BOOKING_FEE_RAIL_LIVE   ABSENT    ← never set
```

Two-key gate; `booking_fee_charges` holds **0 rows and always has**. The second
key flips *"once the rail is KYC-approved AND the checkout is wired."* KYC is
yours; the checkout is a build.

⚠ **Until this is done, step 4 cannot fire at all.**

### Step 4 · the booking fee becomes the commit point

> *"it becomes final once we approve that we received their payment. that is
> when everything triggers."*

The trigger is admin approval of the supplier's fee — `approvePayment`, which
already owns a per-SKU activation dispatcher whose docblock says new hooks are
**added to that map, never by re-editing `approvePayment`**. So it is a
registration, not new machinery.

| # | effect | today |
|---|---|---|
| 1 | free Papic credits, if any | sized from the fee — genuinely cannot fire earlier |
| 2 | lock the supplier's schedule | fires at **lock** |
| 3 | finalise location + date | candidates in `events.date_candidates` |
| 4 | fill the budget planner | fires at **lock** and works |
| 5 | record 1 locked customer | fires at lock; a guard already calls it *"counts a finalized booking that has not happened"* |
| 6 | announce vacancies to that supplier's other shortlists | **new** · your own question mark: *"(if setnayan AI is activated?)"* |

**Four more that belong at the same moment and were not on the list:**

- **`archived_by_lock_of`** — archives every rival the couple was considering. If
  the commit point moves and this does not, a couple loses their shortlist for a
  booking that may never be paid for.
- **`event_vendor_payment_plan`** — freezes the instalment schedule at lock.
- **The contract** — `finalizeVendor` touches it 18 times; `vendor_contracts` has
  **0 rows** and has never run.
- **The couple's deposit** — asked for today *before* the supplier has paid
  Setnayan anything.

**Open, not decided:** what a "vacancy" counts against
(`vendor_services.daily_capacity` exists); whether 6 needs Setnayan AI; whether
1–3 and 5 fire at lock meanwhile and are re-pointed later, or wait.
