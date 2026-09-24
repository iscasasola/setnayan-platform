# Owner decisions

## ✅ ALREADY SETTLED — do NOT re-ask these

| decision | ruling |
|---|---|
| **Auto-merge** | Standing default since 2026-05-15. `gh pr merge <N> --auto --merge` immediately after `gh pr create`. **Never ask.** Use `--merge`, not squash or rebase. |
| **Spec corpus edits** | Claude Code is **permanently authorized** (2026-06-04) to edit `~/Documents/Claude/Projects/Setnayan/` directly. Does **not** extend to repo code, which keeps the worktree + PR workflow. |
| **When the booking becomes final** | On admin acknowledgement of the booking fee. Not at accept. See `03_END_TO_END.md`. |
| **Quote updates** | Option (a): a new proposal **supersedes** the old one, the old stays visible as history, acceptance resets to pending. |
| **Charm pricing** | **No longer a rule.** Three SKUs were rounded off their −1 endings in one day. Never derive a price from a file or comment — read `platform_retail_catalog_v2`. |
| **Worktree pruning** | Prune as you go, never batch to the end. |
| **Build long-term, not audits** | Owner steer: prefer **executable guards** over documents. |
| **`setnayan.ph`** | **We do not own it.** Whether to buy it is open; that we have it is false. |
| **Inspiration gallery** | 20 per category · never delete seeded photos · two watermarks · admin queue. |
| **Vendor-portfolio Papic** | 5% of fee, cap 1,000, on payment approval. ₱500 pack = 100 credits; video stays 800. |

## ⚖ OPEN — engineering is blocked or waiting

1. **Captcha back on?** It is **OFF** right now. The mobile lockout that forced it
   off is fixed and served (#5581), so this is now a choice.
   **Order matters: #5581 served → captcha on → the `/verify` gating question
   becomes answerable → then decision 2.**

2. **The seat-claim trade.** Is a scarce, single-claim, event-scoped token plus a
   venue-sized throttle sufficient, **given `seatClaimability()` already checks
   the token with the admin client and captcha is a second lock on the same
   door?** The join door already made exactly this trade. **Build behind an OFF
   flag** until he rules.

3. **Legacy Papic seat tokens** — 24 rows across 6 events, 6 claimed. Keeping
   already-printed QR posters working is reasonable; **should NEW ones still be
   mintable?**

4. **Browsewrap or clickwrap on `/signup`.** ~90 consent columns exist and **none**
   records Terms/Privacy acceptance, because there is no checkbox to record.
   🔑 **Stamping an acceptance that never happened is worse than none.**

5. **DPO wording** for guest collection surfaces (mobile number, allergies, a face).

6. **The site-wide token repaint.** `--hr-grey` / `--hr-grey-2` carry ~54 text
   roles and fail the readability bar.
   ⚠ **Solving BOTH to the bar collapses them:** 0.1256 luminance apart becomes
   **−0.0022** — inverted. A contrast fix can make everything equally loud.

7. **R2 bucket versioning.** ✅ The in-code half is solid — every delete goes
   through one pinned choke point with a derived caller list. ❌ Whether the four
   buckets have object versioning **is not visible from a session**. Cloudflare →
   R2 → bucket → Settings. **This is where the irreplaceable data lives.**

8. **Supabase Pro.** Free plan: low-activity projects can be **paused**, and
   backups are **not downloadable**. **Trigger: before the first real couple
   uploads a photo, or before any week the build goes untouched.**

9. **Pool-channel reuse (Live Studio).** One couple's strike can delete another
   couple's wedding film. Disclosed; **retire-vs-reuse is unanswered.**

10. **`BOOKING_FEE_RAIL_LIVE`** is absent from Vercel Production, so the booking
    fee cannot charge. Setting it is an **owner action**. Step 6 of the end-to-end
    run cannot complete without it.

## 🔑 How to bring him a decision

- **Never ask a question the corpus answers.** Grep first; cite what you checked.
- **A row can be true and not lookable** — check the state is *reachable* before
  putting a "just look" item on his desk.
- **"I flagged it" does not make a guessed number safe.** Owner, verbatim:
  **"don't guess."** A number that governs money must cite where it came from, or
  you stop. Annotating an invention and shipping it is still shipping it.
- **Retract advice in the same breath as reporting the number that kills it.** A
  measurement that does not change the advice was wasted.
- **Lead every handoff prompt with the model and effort tier** — the owner runs
  these himself, and a prompt without its tier is incomplete.
