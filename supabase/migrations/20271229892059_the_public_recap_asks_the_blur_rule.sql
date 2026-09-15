-- THE PUBLIC RECAP ASKS THE BLUR RULE — the FaceBlock arm, for the one surface
-- that never had one.
--
-- ── THE GAP THIS CLOSES, NAMED IN THE TREE SINCE 2026-09-09 ────────────────
-- `lib/every-guest-read-asks-the-blur-gate.test.ts` carries it verbatim: the
-- public recap's own gate (`app/[slug]/_components/editorial/consent-veto.ts`
-- → `publicKeyForCapture`) implements only the WITHDRAWN-CONSENT half of owner
-- ruling 1 in TypeScript and has **NO FaceBlock arm at all**, while
-- `papic_capture_needs_blur` treats FaceBlock as EVENT-WIDE. So on an event
-- with a FaceBlock guest the venue wall and the shared pool blur every frame
-- and **the couple's PUBLIC EVENT PAGE does not.**
--
-- Owner ruling 1 of 2026-08-17: *"Public = everyone except the couple — blur on
-- the venue wall, the public event page, and the shared pool other guests
-- browse. The couple's own album stays unblurred."* Two of those three were
-- built. This is the third.
--
-- ── WHY A MIGRATION AND NOT SIX LINES OF TYPESCRIPT ────────────────────────
-- 🔑 THE FIX MUST NOT BE A SECOND COPY OF THE RULE. Writing
-- `faceblock_enabled` into `consent-veto.ts` is exactly what
-- `papic-guest-blur-gate.ts` refuses to do and exactly what its test forbids —
-- and re-implementing the withdrawal half in TypeScript is *how this hole was
-- dug in the first place*. So the event-wide arm is lifted out of
-- `papic_capture_needs_blur` into a function of its own, and
-- `papic_capture_needs_blur` is REDEFINED IN TERMS OF IT.
--
-- After this migration the FaceBlock clause exists in exactly ONE place in the
-- whole system. The venue wall, the shared pool and the public recap all reach
-- it — the first two through `papic_capture_needs_blur`, the recap by asking
-- `papic_event_blurs_every_capture` directly, because FaceBlock is event-wide
-- and the recap holds an event, not yet a list of captures. **They cannot
-- disagree, because there is nothing to disagree with.**
--
-- ⚖ NO BEHAVIOUR CHANGES IN SQL. `papic_capture_needs_blur` computes the same
-- boolean it computed before, character for character, only reached through one
-- more call. The nine assertions in `withdrawal-blurs-and-keeps.db.test.ts` and
-- the pool's own tests pin that and must still pass untouched.
--
-- ⚠ WHAT DOES CHANGE — AND IT IS A CHANGE TO A PUBLISHED PAGE. Once the
-- TypeScript half lands, ONE guest turning FaceBlock on means every Papic frame
-- on that couple's public recap must carry a baked blur or be WITHHELD. On an
-- event whose recap is already published and already being read, frames people
-- have seen will stop being served. That is the posture the wall and the pool
-- have had since 2026-08-24, and ruling 1 asks for it — but it is a change to
-- something already public and is not smuggled: it is the point of this PR.
-- Inert in production at the time of writing: 0 FaceBlock guests, 0
-- `face_recognition_excluded`, 118 live guests (measured 2026-09-16).

-- ---------------------------------------------------------------------------
-- 1. The event-wide arm, alone, so it has ONE definition.
--
-- FaceBlock is EVENT-WIDE by owner ruling: one guest with it on means every
-- capture on that event must carry a blur. It does not depend on the capture at
-- all, which is why a page holding only an event id can and must be able to ask
-- it. Withdrawn consent stays PER-PHOTO via tags and is NOT part of this.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.papic_event_blurs_every_capture(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.guests g
    WHERE g.event_id = p_event_id AND g.faceblock_enabled AND g.deleted_at IS NULL
  );
$function$;

COMMENT ON FUNCTION public.papic_event_blurs_every_capture(UUID) IS
  'THE single definition of the FaceBlock arm of owner ruling 1 (2026-08-17): TRUE when this event has any live guest with faceblock_enabled, in which case EVERY capture on the event must be blurred before anyone outside the couple sees it. papic_capture_needs_blur is defined in terms of this, so the venue wall, the shared pool and the public recap cannot hold different ideas of what FaceBlock means. Event-wide on purpose — withdrawn photo consent is the per-photo arm and lives in papic_capture_needs_blur.';

REVOKE ALL ON FUNCTION public.papic_event_blurs_every_capture(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_event_blurs_every_capture(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. The same predicate, now reaching the arm above instead of holding a copy.
--
-- The withdrawn-consent clause is reproduced CHARACTER FOR CHARACTER from
-- 20271160110233. In particular it still carries NO `deleted_at` filter: the
-- 2026-08-24 changelog refused to add one because it would WIDEN what projects
-- while looking like a tidy-up, and that remains untouched here.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.papic_capture_needs_blur(
  p_event_id     UUID,
  p_source_table TEXT,
  p_source_id    UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    -- FaceBlock: event-wide. ONE definition, shared with the public recap.
    public.papic_event_blurs_every_capture(p_event_id)
    OR
    -- Withdrawn photo consent: per-photo, via tags.
    EXISTS (
      SELECT 1 FROM public.photo_tags pt
      JOIN public.guests g2 ON g2.guest_id = pt.guest_id
      WHERE pt.source_table = p_source_table AND pt.source_id = p_source_id
        AND g2.photo_consent = FALSE
    );
$function$;

COMMENT ON FUNCTION public.papic_capture_needs_blur(UUID, TEXT, UUID) IS
  'THE single answer to "must this capture be blurred before anyone outside the couple sees it?" TRUE when papic_event_blurs_every_capture() says the event has a FaceBlock guest (event-wide) OR this capture is tagged with a guest who withdrew photo consent (per-photo). Both wall functions, the shared pool and every public reader ask THIS — a second copy of the rule is how one surface blurs and another does not. The FaceBlock arm is deliberately a separate function so a page holding only an event id (the public recap) can ask the SAME rule rather than re-implement it.';

REVOKE ALL ON FUNCTION public.papic_capture_needs_blur(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_capture_needs_blur(UUID, TEXT, UUID) TO service_role;
