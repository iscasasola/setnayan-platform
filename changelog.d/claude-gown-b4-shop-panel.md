## 2026-11-27 · feat(gown-maker): the Attire Maker's server side, the shop's price-list panel and its Toolkit tile (port steps B3 + B4)

Gown maker port, steps B3 and B4 in one PR (corpus `WHATS_NEXT_Gown_Maker_Port_2026-11-27.md` § 5). They are one PR so that neither a gate nobody checks nor a tile that opens nothing ever ships; agreed with the coordinator, 27 Nov.

- **The server side (B3):** `runGownAction` rides the existing `supplierScan` dispatcher as op `gown_tool`, so there are zero new server actions. Its ops:
  - `options` and `save`: the shop's price list (Shop Manager only; bought AND on a plan to save);
  - `status`: the chat's ＋ tray question;
  - `open`: what a bride may see of the shop: fabrics and lace **without their prices**, its looks, its add-ons as words or her amount, and the offer. Never the price list;
  - `invite`: the designer's invite card (the verified-shop gate is asked at the server);
  - `send`: the design is re-checked against the shop's offer, priced on the server, stored **before** it is named in the chat, and dropped if the message did not post. Only quantities and the one estimate are stored; **no cost line**;
  - `design`: the card read. The bride gets her design and the estimate. The shop also gets the cost lines, priced at read time from its own list, plus its tape;
  - `fit`: the designer's tape (`gown_fittings`, the shop only).
  - Reads and writes are in `lib/gown-maker.server.ts`; every read is ok / none / unread.
- **The shop's panel (B4):** Shop › Your widgets › **Attire Maker**. It holds how you price, markup, every price item by group (an empty one says "Not priced"), what a starting price includes (base-plus-extras mode), time standards, and each add-on as Not offered / Priced / Included / On request. One Save, with a toast. Locked when not bought or not on a plan: it shows the lock words and one door to the Toolkit, and saves nothing.
- **The tile:** `attire_tool` is registered in the Toolkit (paid list, store tags, guide, icon), suggested to custom gown makers. It opens the panel.
- **v195 price items:** "Flutter cape sleeves: cutting, sewing and finishing" (per pair, Sleeves) and "Overlay: cutting, sewing and finishing" (per piece, Skirt), unpriced until priced.
- **Lab:** `/dev/gown-shop-lab` (`?view=supplier · extras · fresh · locked`), sample amounts only.
- **Guards:**
  - `lib/gown-maker.server.test.ts` (7): one action through `supplierScan`; send stores before naming and drops on failure; `open` hands a bride no price; the stored row holds no cost; Shop Manager only and the verified gate; the message words; the tile opens the panel and the panel saves through the action. Sabotage-checked: `open` returning the price list, and fabric prices leaking, each turn it red.
  - `lib/gown-maker.test.ts` gains the v195 items.
  - `specialized-tools.test.ts` and `supplier-store.test.ts` now list the Attire Maker.

SPEC IMPACT: None. B3 and B4 ship together (a sequencing change agreed with the coordinator). The design card, the ＋ tray tile and Make a quote come in B8.
