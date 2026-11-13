-- wedding_venue_setting_may_be_not_set
--
-- 🏛 A WEDDING WITH NO VENUE TYPE IS "NOT SET", NEVER A DEFAULT "BANQUET HALL" (owner 13 Nov 2026, the answer to walk
-- F-W2-02: "not set"). `events_wedding_fields_consistency` (20260521080000) required `venue_setting` on every wedding,
-- so the wedding onboarding wrote 'banquet_hall' for a couple who picked no reception setting — and Details then told
-- them their venue was a banquet hall. `lib/venue-settings.ts` (`AMBIGUOUS_VENUE_SETTING`) had already recorded that on
-- this column 'banquet_hall' and "never said" were the same bytes.
--
-- The rule now: a wedding still needs its ceremony type; its reception venue type may be NULL ("Not set"). A
-- non-wedding still carries neither. Same constraint name, so every reader that cites it still finds it.
--
-- ⚠ Existing rows are NOT rewritten: a stored 'banquet_hall' may be a real pick, and no reader can tell — this
-- migration changes what a NEW wedding can store, never what an old one says.
--
-- Idempotent: DROP … IF EXISTS, then ADD.

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_wedding_fields_consistency;
ALTER TABLE public.events
  ADD CONSTRAINT events_wedding_fields_consistency
  CHECK (
    (event_type = 'wedding' AND ceremony_type IS NOT NULL)
    OR (event_type <> 'wedding' AND ceremony_type IS NULL AND venue_setting IS NULL)
  );

COMMENT ON CONSTRAINT events_wedding_fields_consistency ON public.events IS
  'A wedding carries its ceremony_type; its reception venue_setting may be NULL ("Not set" — owner 13 Nov 2026). A non-wedding carries neither.';
