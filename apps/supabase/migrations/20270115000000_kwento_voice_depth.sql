-- Kwento voice-depth tier: Flash (≤50 chars, auto-wall) vs Story (≤280 chars, couple-review)
-- Phase 1 of the Kwento Monumental Upgrade (2026-06-18)

ALTER TABLE photo_messages
  ADD COLUMN IF NOT EXISTS voice_depth text NOT NULL DEFAULT 'story'
    CHECK (voice_depth IN ('flash', 'story'));

-- Length constraints enforced at DB level as a safety net; the API enforces first.
ALTER TABLE photo_messages
  ADD CONSTRAINT chk_flash_length
    CHECK (voice_depth != 'flash' OR length(body_text) <= 50);

ALTER TABLE photo_messages
  ADD CONSTRAINT chk_story_length
    CHECK (voice_depth != 'story' OR length(body_text) <= 280);

-- Notification debounce: track when the last kwento_story_batch email was sent per event
-- so we don't spam the couple during an active reception.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS last_kwento_notify_at timestamptz;

-- Flash auto-wall toggle: coordinator can disable the 5-second auto-wall gate per event.
-- Default ON (true = Flash auto-walls after 5s).
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS kwento_flash_auto_wall boolean NOT NULL DEFAULT true;
