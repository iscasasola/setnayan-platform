# WAVE PLAN — rewritten on the re-measured backlog

> Owner: *"re-measure the redesign backlog before planning the next bundles."* Done. This replaces
> the 2026-09-22 03:00 version, which was planned from the register and was wrong in both directions.
>
> Measured against `origin/main` **727b9ccb4**. ⚠ Re-run `build-sessions/merge-control.sh` before
> acting on any row — and note the first plan's own paths were missing the `apps/web/` prefix, which
> manufactures false "not built" verdicts.

---

## What the re-measure changed

| | first plan | measured |
|---|---|---|
| slices to build | ~24 | **~15** |
| "the biggest slice" (a supplier is their card) | to build | ✅ **already shipped** |
| a purchase control for Setnayan AI | to build | ✅ **already shipped** — wire the card to it |
| three more | to build | ⚠ **completions**, not builds |
| Papic | 4 phases | **P4 + 2 sub-items** — the rest is in #5875 |

🔑 **Roughly a third of the plan was not work.** The platform bundle measured the same thing at
8 of 14. **Every remaining bundle budgets the RULE 0 re-measure as the main work, not a preamble.**

---

## IN FLIGHT

| PR | what | state |
|---|---|---|
| **#5875** | Papic redesign P1 · P2a · P2b · P3 · P3b | armed, CI finishing |
| **#5876** | wave 1 — 4 builds | red on the sign-up captcha; **fix committed at `02ba306a9`, re-fold pending #5875** |
| **#5877** | platform W1 | armed |
| **#5874** | Overview "status stays in view" | draft, unarmed — **owner must look** |
| **#5873** | free-fee window | armed |

**Banked, unpushed:** the closing-copy fix (`90acb5a50`, chat session — owner approved the wording).

---

## WAVE 2 — after #5875 and #5876 land

Three disjoint neighbourhoods. The frame rides **alone** because the couple's chat panels are derived
from the supplier's registry by import, so editing one silently changes the other.

| slot | build | why it is safe here |
|---|---|---|
| A | **the chat frame** — the ported v2 layout, both registries | alone in its wave by rule |
| B | **the two Overview counts get distinct names** — "23 of 25 categories not booked" vs "27 need a decision" | `event-dashboard.tsx`; nothing else in flight touches it |
| C | **the admin money switches** | 4 files in `admin/pricing/**`, ⚖ blocked on 3 owner answers |

⚠ **B must land before Your Team's slice 4** (removing the two task surfaces), or a couple is left with
one number and nothing saying which set it counts.

## WAVE 3

- **Your Team slice 1** — badge counters from `unreadThreadIds`, rolled up with `includedWith == null`
  so one supplier occupying several cards counts once.
- **Your Team slice 3** — the money split. ⚠ Not merely absent: `teamMoney`'s buffer does `(c ?? 0)`,
  so **a null price is silently ₱0 — it lies rather than refusing.**
- **Your Team slice 4** — remove the two task surfaces (after B above).
- **Wire the upsell card to the checkout that already ships** (`SetnayanAiComebackOffer` /
  `InlineCheckoutDrawer`, SKU `SETNAYAN_AI`). ⚠ **Four assertions across two tests pin the stale
  ₱499/₱799 to the literal** — they must be re-pointed at the property, not deleted.
- **Quote maker E and F** — after the frame lands.

## WAVE 4 — the two migrations, deliberately apart

`pnpm migration:new` allocates forward; two migrations must not share a wave.

- **ONE DOOR build 2** — consent per event. Measured: consent is `users.public_summary_consent_at`
  with **no `events.` sibling**, and it has **eight readers** — a repoint, not a new column.
- **Papic P4** — per-face blur. ⚖ Worth asking whether it ships at all: 146 guests, 0 have used it.

## LATER / COMPLETIONS — narrower than they look

- **ONE DOOR build 1** — the small `/signup` card. Blocked until the contested sign-up file settles.
- **The "You" card** — exists; the @handle on it is read-only with a submit-time check elsewhere, and
  the formal name is not folded.
- **The card picker** — exists as a single `<select>` that **replaces** the lines. Needs multi-select
  and accumulation, not a new picker.
- **The brief in the composer** — exists in `ChatInfoRail` beside it; needs moving in, not building.
- **Papic's two sub-items** — Drive signing in on the tap, and the 631-challenge picker.

---

## Gaps named, deliberately not fixed

- **The two bench strips cannot tell a refused read from an empty one** — `vendors/page.tsx` hands
  both an empty array. Needs an upstream error signal.
- **A withdrawn-but-`pending` thread still renders "Waiting for {vendor} to accept"** from a branch
  the closing-copy fix correctly did not touch. Behaviour, not copy.
- **`main`'s port baseline has been stale** since before this wave, and **no guard checks freshness** —
  the baseline guards verify canonical-ness and no-loss only. #5875 fixes the file; the gap remains.
- **Three thread states print the declined sentence** — fixed by the banked closing-copy build.

## 🔑 On the owner's desk

1. **Look at two prototypes** — Overview (#5874 is unarmed waiting on it) and the quote maker.
2. **The admin money switches, three answers** — announce a promotion or let suppliers find it ·
   refuse or warn when enforcement would lock someone out (rec: warn **and name them**) · does a
   window need a reason field (rec: yes).
3. **Throw the captcha switch once and sign up at `/open-shop`** — the sign-up fallback is wired and
   has never been exercised under the condition it exists for. Only he can test it.
4. **Every vendor photo is served from a development storage hostname**, documented as rate-limited.
   A DNS change, his call.
5. **Facts, not questions:** before the event the Papic credit balance now leads instead of the facts
   strip, by his instruction — a rule was reversed, not broken.
