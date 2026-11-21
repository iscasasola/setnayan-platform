## 2026-11-21 · feat(cake-maker): the Cake Maker v6 — set once on Shop › Specialized tools, designed in the chat, quoted from the design

Built 1:1 from the owner-approved drawing `prototypes/cake_maker_2026-11-21/cake_maker_fable.html` (v6) and the
DECISION_LOG rows "THE CAKE MAKER LIVES IN THE CHAT, NOT ON SERVICE CARDS", "CAKE MAKER v5 APPROVED" and "CAKE MAKER v6
= THE BUILD REFERENCE". Cakes only (`wedding_cake`, `cake`).

- **Shop › Specialized tools › Cake Maker** — a new tile in the shipped carousel (after Scanner; suggested for cake
  shops) opening the BodyPanel. Set ONCE per shop: arrangements (stacked · floating · pillars · offset · staircase),
  sizes 1–10 each with its own extra and how many it serves, display tiers and their extra, flavours, shapes (round ·
  square · hexagon · heart) and heights (standard · tall = double barrel), finish, colours ("Couples pick 1 to N", max
  3), accents per tier, flowing accents, the event's monogram, toppers, cupcakes (packs at the shop's price, a tower
  switch), the message's letter cap, and "What couples see". Every extra is ≥ ₱0 and the shop's own — nothing priced
  by us; a fresh Cake Maker starts at ₱0 everywhere. Stored as ONE row per shop (`vendor_cake_makers`, owner-read RLS,
  written server-side through the one action).
- **Pro and up** (`TIER_CAPS.specialTools`, no fee): before the admin's start date (`platform_settings.special_tools_paid_from`,
  Admin › Launch offer) every shop has it; after, a shop below Pro sees "Included in Pro · Upgrade" and keeps what it saved.
- **Design a cake — in the chat** (`app/_components/cake-maker/cake-designer.tsx`): full screen on a phone, the split view
  on a computer. Two starts: Design your own, or Use an inspiration (the shop's cake photos, then the couple's own).
  The 3D cake is the main view (tap a tier); 2D only as a fallback. Steps: Shape · Tiers (count + servings beside the
  couple's guests; per tier real/display, flavour, shape, height; the cut tier) · Colours (their Mood Board first, the
  shop's after, the cap blocks Send) · Accents (per tier, across the tiers from/to) · Monogram + topper · Cupcakes ·
  Message + "Anything else the baker should know?" (500 letters). Total = the cake card's one price + the extras
  (`cakeDesignOf`, the same function the server stores). Send posts ONE card in the chat; a refused send says
  "Not delivered" with Send again. "Book at this total" is gone.
- **The design card** (both sides): the couple sees "Your cake design · Sent" with Change my design (a new version; the
  old card says Replaced); the shop sees "Cake design · New" with **Make a quote**, which opens the shipped quote card
  prefilled — the card's one price, one line per priced pick, the estimate as the total, the making time to confirm —
  and Reply. The picture is ONE 3D still rendered in the browser when the card scrolls into view (nothing stored).
- **The invite**: the shop's "Design your cake for us" card (couple: Design your cake → the designer; shop: "Waiting
  for their design"). `app/_components/cake-maker/index.ts` exports the doors (`cakeChatStatus`, `CakeDesignerSheet`,
  `askForCakeDesign`, the tile words) for the chat's ＋ tray, which the Unichat builder wires.
- **Nothing on service cards.** The Card Maker's cake part is removed; "Need your own form? Tell us what you need"
  stays on every card's customization part.
- **Make a quote** takes extra lines (`makeQuoteLines(picked, offer, extras)`): the card's line is the offer less the
  extras, so the total is still exactly the offer typed; an offer below the extras is refused.
- One server action for all of it (`cakeAction`: options · save · invite · status · open · design · send).
- Migration `20271356877338_cake_maker_shop_and_designs.sql`: `platform_settings.special_tools_paid_from`, the
  `vendor_cake_makers` and `cake_designs` tables (RLS at create). Nothing is added to packages.

SPEC IMPACT: None — builds the approved v6 drawing and the controller's logged rulings; no ruling changed.
