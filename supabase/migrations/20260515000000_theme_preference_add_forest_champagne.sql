-- Adds 'forest_champagne' as 5th theme option per CLAUDE.md decision log 2026-05-15.
-- Idempotent — safe to re-run. Additive only; no DROP, no breaking change.
-- Existing `users.theme_preference` rows are unaffected; CSS key 'setnayan_default'
-- is preserved (rebrand is a display-name + accent-token change only).

ALTER TYPE theme_preference ADD VALUE IF NOT EXISTS 'forest_champagne';
