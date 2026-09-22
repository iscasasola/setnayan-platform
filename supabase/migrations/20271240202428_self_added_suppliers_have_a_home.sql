-- ============================================================================
-- 20271240202428_self_added_suppliers_have_a_home.sql
--
-- A tier-2 taxonomy tile for the suppliers a couple adds themselves whose trade
-- we could not name: `logistics_safety › everything_else` ("Everything else").
--
-- ─── WHY ────────────────────────────────────────────────────────────────────
-- `misc` is the FALLBACK `VendorCategory`. `eventVendorCategoryForCardKind`
-- returns it for an unknown trade and `vendorCategoryForLeaf` returns it for an
-- unknown leaf, so it is what a self-added supplier is stamped with whenever the
-- app cannot classify them. It had no tile of its own, so
-- `lib/shortlist-taxonomy.ts` pinned it to **`escort`** — a tier-2 tile whose
-- parent is **`transport` ("Cars & transport")**.
--
-- Measured on production 2026-09-22, event 044f7e64 (a live wedding):
-- `Seda Hotel` and `Saysay Live Band & Hosting` both carry
-- `event_vendors.category = 'misc'`, which filed a HOTEL and a BAND under
-- "Cars & transport › Escort". Visible, and in the last place a couple looks.
--
-- ─── WHY `logistics_safety` AND NOT `transport` ─────────────────────────────
-- The plan group that owns `misc` is `logistics`, labelled **"Logistics & Misc"**
-- (`wedding-plan-groups.ts`), whose hint reads "Transportation, security,
-- giveaways, and the rest". Its name matches this folder, not the car one. The
-- group's `catalogFolder` is still `'transport'` and is deliberately left alone:
-- retargeting a whole group's doorway is a bigger move than giving the fallback
-- a home, and the group genuinely spans three folders. Flagged, not bundled.
--
-- ─── WHY `marketplace_hidden = TRUE` IS SAFE, AND CORRECT ───────────────────
-- `buildShortlistFolders` qualifies ALL THREE of its scope filters with
-- `vendors.length === 0`, under an invariant it states in its own comment:
-- "A COUPLE'S EXISTING PICK MUST NEVER VANISH FROM THEIR OWN SHORTLIST." So a
-- hidden tile is skipped only while it is EMPTY. That is precisely the behaviour
-- wanted here: this tile holds no canonical service, so offering it for browsing
-- would be a fake door — and the moment a couple files a supplier under it, the
-- tile appears on their bench.
--
-- ⚠ THIS IS THE FIRST HIDDEN TILE. That branch's comment read "No tile is
-- hidden today (no-op)"; the same commit corrects it. If anyone later drops the
-- `vendors.length === 0` qualifier as dead code, self-added suppliers disappear
-- — the unit test `a-self-added-supplier-has-a-home.test.ts` fails on exactly
-- that, and the db test fails if this row stops being hidden.
--
-- ─── EVENT-TYPE SCOPE: NULL, MEANING EVERY TYPE ────────────────────────────
-- `applicable_event_types` is left NULL. `passesEventTypeFilter` treats NULL as
-- universal (the same convention every tier-1 row uses), which is right: a
-- wedding, a wake and a tournament can each acquire a supplier whose trade we
-- cannot name. Scoping this tile to a list would silently drop the fallback for
-- every type missing from it.
--
-- No canonical services are seeded under it, on purpose — this tile is a home
-- for what the couple types in, not a catalogue of things to buy.
--
-- Idempotent.
-- ============================================================================

BEGIN;

INSERT INTO public.service_categories
  (id, parent_id, tier, kind, label_en, label_short, slug, sort_order, scope, marketplace_hidden, status)
VALUES
  ('everything_else', 'logistics_safety', 2, 'leaf', 'Everything else', NULL,
   'everything-else', 99, 'global', TRUE, 'active')
    ON CONFLICT (id) DO NOTHING;

-- Belt and braces for a re-run against a row someone edited by hand: the two
-- properties this tile's behaviour actually depends on are its parent (which
-- folder it renders in) and its hidden flag (empty ⇒ invisible).
UPDATE public.service_categories
   SET parent_id = 'logistics_safety',
       marketplace_hidden = TRUE,
       status = 'active'
 WHERE id = 'everything_else'
   AND (parent_id IS DISTINCT FROM 'logistics_safety'
        OR marketplace_hidden IS DISTINCT FROM TRUE
        OR status IS DISTINCT FROM 'active');

COMMIT;
