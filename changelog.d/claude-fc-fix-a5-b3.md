## 2026-11-25 · fix(supplier): words and doors that say what is true (final check area 5, batch 3)

- Invite shops you trust says the owner's line once. "That request is gone." now shows on the list (a fixed key,
  never URL text). "Name your shop first" lands on Your details › Name and logo (`SHOP_NAME_SETUP_HREF`).
  Segments and Lines send a shop-less person to the one "no shop" landing.
- Attributes: plain words ("fields", not "attribute payload"), no unbacked ranking claim, and no "No services yet" to
  a shop with services. Their work says "every event your cards were booked for".
- The auto-reply voice preview keeps the real answer's shape with no typed peso figure and no one trade's words.
- The bundle maker shows "—" (not ₱0) until two cards are picked, and drops the impossible "above ₱0 and below ₱0".
- A held, off-sale Papic gift is named "Papic credits", never its code.
- One `shownAddress` (`lib/shop-address.ts`): the Shop hero, its share sheet, View shop and My QRs show the address
  without its tracking tags.
- "Where your price sits" asks for a starting price only when the shop has none. Not enough market data is said as
  itself.
- Guard: `lib/supplier-words-are-true.test.ts`. Two older tests now pin the corrected values (My QRs' setup door,
  RW-167's line).
- Findings: A5-G1-06 A5-G3-07 A5-G4-06 A5-G2-12 A5-G2-10 B5-25 A5-X-05 B5-10 B5-09 A5-G3-12 B5-07 B5-20.

SPEC IMPACT: None.
