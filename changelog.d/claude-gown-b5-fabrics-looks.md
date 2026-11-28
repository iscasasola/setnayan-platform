## 2026-11-27 · feat(gown-maker): the shop's fabrics, lace and looks, and the admin's fabric types (port steps B5 + B5b)

Gown maker port, step B5 (corpus `WHATS_NEXT_Gown_Maker_Port_2026-11-27.md` § 5). The approved drawing is `prototypes/gown_maker_2026-11-27/gown_maker_v196.html`, pages "Fabrics and lace" and "Inspirations", with its v187 rule (small swatches) and v188 rule (four sliders).

- **Where it lives:** Shop › Your widgets › Attire Maker now has three views: **Price list · Fabrics · Looks**. Fabrics and Looks load only when opened.
- **Fabrics and lace list:** each row shows the swatch, the name, the kind of cloth and code, and the price per metre. An unpriced fabric reads "Not priced", never zero. A hidden row reads "Hidden from brides". Tap a row or **Add fabric or lace** to open one sheet:
  - fabric or lace, name, your code, kind of cloth (the admin's list), your price per metre (brides never see it);
  - Patterned, and Show to brides;
  - the photo: its centre square becomes a 64 px WebP swatch in the designer's browser. A patterned cloth also keeps a 512 px repeat tile; a plain one has no tile, so picking it makes no tile request. The colour is read from the photo and can be named;
  - **Shine · See-through · Body · Texture:** each starts at the cloth's own value and is saved as an offset from it, so a later type edit still carries.
- **Looks:** name, photo, and shape, neckline, sleeves, train, veil and fabric. Each is checked on the server the same way a bride's design is.
- **Server:** three ops on the existing `supplierScan` dispatcher (`stock`, `fabric_save`, `look_save`), so there are zero new server actions.
  - They are for the Shop Manager only. A locked shop still reads its stock, but saves nothing.
  - Every photo must sit in the shop's own `vendors/<shop>/gown/` folder of the public media bucket.
  - The stock read (prices, hidden rows) is never part of a bride's read.
- **B5b, the fabric-type registry (owner Q4: Setnayan admin only):** a **Fabric types** tab inside Admin › Studio (no new page or route).
  - It lists every type with its family, weight, "Values to check" until verified, and "Hidden".
  - One sheet holds every column the table holds, bounded by the table's own CHECKs: id (new only), name, other names, family, weight, stiffness, shine, see-through, stretch, uses, "Looks like", order, "Values checked against a source", and "Shops can pick it".
  - Hide, never delete. Ops `types` and `type_save` prove the admin (`requireAdminAction`) before the service role opens.
- **This clears every staged row from B1:** both no-writer tables (`vendor_gown_fabrics`, `vendor_gown_looks`) and all four switches (`vendor_gown_fabrics.active`, `vendor_gown_looks.active`, `gown_fabric_types.active`, `gown_fabric_types.verified`).
- **Lab:** `/dev/gown-shop-lab?view=fabrics · looks · stock-empty · types` (sample data).
- **Guards:** `lib/gown-maker-stock.test.ts` (8). Every rule of a fabric type is checked as the table would. The registry ops prove the admin first (sabotage-checked). Nothing can delete a type. Photos outside the shop's own folder are refused (sabotage-checked). An empty price stays unpriced. The sliders stay within ±1. The ops belong to the Shop Manager. The stock read stays out of the bride's read. The screens reach the ops with no dead button.

SPEC IMPACT: None. This builds steps B5 and B5b as planned (Q4 answered: admin only).
