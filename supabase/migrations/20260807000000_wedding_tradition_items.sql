-- 20260807000000_wedding_tradition_items.sql
-- Admin-editable per-religion wedding traditions (owner-directed 2026-06-03:
-- make the per-religion "what to expect" content validatable/editable without
-- a deploy — the validation path for the starter content shipped in #890).
--
-- The /paperwork "What to expect — your {religion} wedding" guide reads its
-- items from this table when populated, and falls back to the code defaults
-- (lib/wedding-traditions.ts WEDDING_TRADITIONS_GUIDE) when the table is empty
-- or unreachable — so the deploy is safe before this migration is pushed and
-- before an admin loads the starter content. Admins manage rows at
-- /admin/wedding-traditions ("Load starter content" copies the code defaults
-- in, then edit / add / remove / reorder).
--
-- Items only — the per-religion overview + "confirm with" framing stays in the
-- code module (short, low-risk). The item list (the per-religion specifics that
-- most need owner/clergy validation) is what's editable here.

CREATE TABLE IF NOT EXISTS public.wedding_tradition_items (
  item_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ceremony_type TEXT NOT NULL
                CHECK (ceremony_type IN (
                  'catholic','civil','inc','christian','muslim','cultural','chinese','mixed'
                )),
  dimension     TEXT NOT NULL
                CHECK (dimension IN ('officiant','ceremonial','food','custom','paperwork')),
  label         TEXT NOT NULL,
  note          TEXT NOT NULL DEFAULT '',
  sort_order    INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wedding_tradition_items_lookup_idx
  ON public.wedding_tradition_items (ceremony_type, is_active, sort_order);

ALTER TABLE public.wedding_tradition_items ENABLE ROW LEVEL SECURITY;

-- Public read (the couple-facing /paperwork guide renders these to anyone
-- planning a wedding); the app filters is_active for couples. Admin-only write.
DROP POLICY IF EXISTS wedding_tradition_items_read_all ON public.wedding_tradition_items;
CREATE POLICY wedding_tradition_items_read_all
  ON public.wedding_tradition_items FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS wedding_tradition_items_admin_write ON public.wedding_tradition_items;
CREATE POLICY wedding_tradition_items_admin_write
  ON public.wedding_tradition_items FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
