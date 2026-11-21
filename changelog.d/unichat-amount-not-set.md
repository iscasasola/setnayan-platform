## 2026-11-21 · fix(chat): an unpriced quote line says "Amount not set", never ₱0

**What changed:**
- A quote line nobody priced now reads **"Amount not set"** in the chat's quote receipt (Make a quote · Change quote), not ₱0. That covers a service card with no "from" price and a line the supplier added but didn't price.
- The receipt won't send such a line until it has a price or is switched to Free. It says: "Price every line, or switch it to Free." Before, it went out at ₱0, and the couple's quote card showed ₱0 for it.

**What did not change:** A stored ₱0 line reopened as it was, such as a free-transport line, is the supplier's earlier choice. It still sends untouched.

**Where:**
- `receiptLineUnpriced` in `lib/quote-receipt.ts`
- `QUOTE_LINE_AMOUNT_NOT_SET` in `lib/quote-line-price-words.ts`
- the receipt price column in `app/_components/chat/cards/quote-receipt.tsx`
- guard: `lib/quote-receipt.test.ts` § 6, checked with sabotage

SPEC IMPACT: None. This implements the controller's 21 Nov F-backlog item (a).

**Ship review fixes (21 Nov):** a free catalogue extra is added FREE (`extras[].free` carried from the catalogue line),
not as a ₱0 line that blocked sending · a stored line counts as priced only while its amount still equals what was
stored (edited to ₱0, or Free turned off → "Amount not set") · the catalogue picker says "Free" / "Amount not set",
never "₱0" (`quoteExtraPriceWords`). Test 7 in `lib/quote-receipt.test.ts`.
