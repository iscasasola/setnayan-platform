## 2026-09-22 · feat(quote): the Setnayan gift switch is ON THE QUOTE, and it governs the bill

Owner, 2026-09-22, on the switch drawn DISABLED in the approved quote-maker prototype:
**"We want this working."** (Extends his "per-quote switch" ruling the same day, and closes open
question 1 of the 2026-09-20 quote-builder row.)

**The source of truth moved — it was not duplicated.**

- Migration `20271240324859`: `vendor_proposals.includes_setnayan_gift BOOLEAN`, **nullable, no
  default** (NULL = this quote says nothing; the booking falls back to the service card — a
  `NOT NULL DEFAULT` would record a decision nobody made on every existing row).
- `public.setnayan_gift_offered_on` — the ONE function both doors call
  (`setnayan_gift_quote_applies` and the bill trigger `booking_fee_charges_size_the_gift`) — now
  reads the booking's newest **ACCEPTED** quote first and the card only when no accepted quote
  says anything. Precedence, not a parallel path; both callers unchanged.
- 🔒 **The same-supplier guard is carried onto the new arm.** The card arm joins
  `vs.vendor_profile_id = ev.marketplace_vendor_id` because `service_id` is couple-writable; a
  proposal is reachable the same way, so the quote arm joins
  `vp.vendor_profile_id = ev.marketplace_vendor_id`. A stranger's accepted quote cannot bill this
  shop for a gift it never gave.
- **The combined-quote ambiguity is gone.** One quote, one switch; the Papic line no longer
  follows "the first card".
- Composer: a real switch (`quote-setnayan-gift-switch`), opening at what the booking says
  (`defaultQuoteSwitch`; Answer 1 — ON if any card it was built from is on), rendered only where a
  gift could exist at all. The gift block, the Papic line and the payload all read ONE switched
  standing (`standingForQuoteSwitch`), so the composer cannot promise photos the switch turned off.
  The switch rides the payload → the action → `sendCustomProposalCore` → the column.
- The Papic "switch it on" door now points at that control instead of the service-card page, and
  the **"does not yet govern your bill" copy is removed in the same commit** — copy that outlives
  its condition teaches the next person something false.
- Unchanged: 40% of the fee, the 50,000 cap, the proportional ladder, the freeze at lock, the
  grants. A switch, never a dial.

**Proof.** `tests/db/the-gift-switch-is-on-the-quote.db.test.ts` (8 subtests on the PGlite replay):
the accepted quote wins both ways · NULL falls back to the card · a merely *sent* quote decides
nothing · **a stranger's accepted quote is refused** · the newest acceptance wins · the bill sized
by `booking_fee_charges_size_the_gift` matches the same answer · the quote's own RPC agrees.
Sabotages watched RED: the same-supplier guard deleted (cross-shop case) · the card read first ·
a sent quote counted · a `NOT NULL DEFAULT`. Plus `app/_components/the-gift-switch-reaches-the-bill.test.ts`
(the chain: composer → payload → action → core → column; 3 sabotages red) and 4 new subtests in
`the-exclusive-papic-on-a-quote.test.ts` (3 sabotages red).

⚠ **Two existing guards fired and neither was weakened.**
`the-gift-is-on-the-quote-being-written.test.ts` forbids `proposal-maker.tsx` from knowing
`GIFT_SHARE_OF_FEE_PCT` — it caught the switch's caption, and the fix was mine: the words moved to
`quoteGiftSwitchCopy()` in the lib, where the share is rendered from its constant.
`the-preview-reads-the-billed-total.test.ts` pinned the exact spelling
`previewGiftForTotal(netPayable, giftBasis)`; its **second** argument now follows the switch, so it
was re-pointed at the property it exists for — the FIRST argument must be `netPayable` — and
re-proved by sabotage (previewing against `subtotal` → red).

`supabase/security/exposure-surface.baseline.txt` regenerated (not hand-edited): exactly one added
line, `public.vendor_proposals.includes_setnayan_gift anon=SIU authenticated=SIU`, matching every
other column on that table. RLS is unchanged: the couple may read a non-draft quote of their own
event and cannot write it; only the owning supplier may UPDATE, and only while `status='draft'` —
so the switch is frozen at send.

SPEC IMPACT: DECISION_LOG 2026-09-22 — the per-quote switch row records "later wave / migration";
it is now BUILT, and the open question "which card the bill reads for a combined quote" is closed
by this migration. Corpus edit to follow with the wave.
