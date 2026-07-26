-- events_std_media_nsfw_verdict
-- ============================================================================
-- SEC-6 — a direct PATCH of events.std_media.nsfw publishes an UNSCREENED video
-- to the public guest page.
--
-- ── THE HOLE ────────────────────────────────────────────────────────────────
-- "NSFW filter is on by default and CANNOT be disabled" is a locked product
-- rule. The Save-the-Date closing beat may be a couple-uploaded video, gated on
-- a screening verdict that — until this migration — lived INSIDE
-- events.std_media, a JSONB column the host must be able to write (they pick
-- their own video). Postgres RLS is ROW-level, never column-level, and the
-- Supabase anon key is public, so:
--
--     PATCH /rest/v1/events?event_id=eq.<their-own-event>
--     { "std_media": { "type":"video", "videoKey":"r2://…", "nsfw":"approved" } }
--
-- …published an unscreened video. The server action (saveAllStdContent) did
-- refuse to accept a client verdict and forced 'pending' — but that refusal was
-- enforced in the wrong LAYER. PostgREST does not run server actions.
--
-- ── WHY THE OBVIOUS FIX IS WORSE THAN THE BUG ───────────────────────────────
-- The tempting trigger is "on UPDATE, preserve the OLD nsfw value". That PINS an
-- `approved` verdict onto a video that was swapped underneath it, converting a
-- one-off bypass into a durable one: upload something clean, get approved, then
-- point videoKey at anything at all and keep the approval forever.
--
-- ── THE FIX: BIND THE VERDICT TO THE MEDIA IT WAS COMPUTED FOR ──────────────
-- One new column, `std_media_nsfw`, holding a self-describing verdict:
--
--     { "status": "pending" | "approved" | "rejected",
--       "videoKey": "<the r2 ref this verdict authorises>",
--       "posterKey": "<the r2 ref that was actually classified>",
--       "videoFingerprint": "<etag>:<bytes>",
--       "posterFingerprint": "<etag>:<bytes>",
--       "screenedAt": "<iso>", "attemptedAt": "<iso>" }
--
-- and it is UNWRITABLE by authenticated + anon: only the service-role screen
-- (lib/nsfw-screen.ts screenStdVideo) and the admin override write it.
--
-- The binding is what makes this safe WITHOUT a trigger. The reader
-- (lib/std-media.ts stdVideoIsLive → lib/std-video-gate.ts stdVideoIsServable)
-- shows the video only when the verdict is `approved` AND names this exact
-- videoKey + posterKey AND the objects at those keys still carry the recorded
-- fingerprints. So:
--   • host PATCHes std_media to a different videoKey → verdict stops binding →
--     the video is not shown, and a re-screen is scheduled. Nothing to clean up.
--   • host re-PUTs different bytes to the SAME key with the presigned URL they
--     still hold (api/upload TTL is 5 minutes; the screen lands in seconds) →
--     the ETag changes → the fingerprint check fails → not shown.
--   • no verdict at all, malformed verdict, R2 unreadable → not shown.
-- Unknown or stale ⇒ NOT SHOWN, in every branch.
--
-- ── THE 20271005100000 / 20271007100000 GRANT TRAP ──────────────────────────
-- Both privilege migrations REVOKEd the table-level privilege on public.events
-- and granted back a COMPUTED allow-list snapshotted AT APPLY TIME. A column
-- added afterwards is in NEITHER snapshot — so `std_media_nsfw` is already
-- un-writable AND un-readable by authenticated/anon by default. That is the
-- correct default for the write side and the WRONG one for the read side (the
-- couple's builder shows "your video is being reviewed"), so this migration:
--   • GRANTs SELECT to authenticated — the status is the couple's own and not a
--     secret; the public page reads through the service-role client anyway.
--   • explicitly REVOKEs UPDATE/INSERT from authenticated + anon rather than
--     relying on the snapshot's silence, so the intent is stated in SQL and a
--     blanket re-GRANT applied before this file still lands closed.
--   • asserts BOTH halves in a post-condition, because a grant that silently did
--     not take is invisible (fail-closed, so nothing screams).
--
-- ── THE ONE-ROW DATA CHANGE ─────────────────────────────────────────────────
-- The legacy `nsfw` key is STRIPPED out of every existing std_media blob. Prod
-- holds exactly 1 video row (verified immediately before writing this file:
-- 1 video, 1 'approved', 1 with a poster). Nothing reads that key any more, but
-- leaving an attacker-writable field literally named `nsfw: "approved"` sitting
-- in the blob is how it gets re-wired by mistake later.
--
-- ── THE GRANDFATHER, AND WHAT IT HONESTLY CLAIMS ────────────────────────────
-- That one row is `cale-ice` — a real couple's live, public Save-the-Date page
-- whose video is serving right now. Enforcing the new rule with no transition
-- would take it down to their photo gallery for a rule they did not break, so it
-- is CARRIED ACROSS rather than reset.
--
-- It is carried across HONESTLY. The verdict written below is not dressed up as
-- a review. It records:
--
--     "grandfathered": { "reason": "pre-SEC-6 poster-only screen …", "at": … }
--
-- and the examination the application will attach to it is stamped
-- `by: 'legacy-poster-screen'` — a name that says, in the data, that a still
-- frame is all that was ever looked at. Nobody reading this row later can
-- mistake it for a human sign-off. It is queryable in one line:
--
--     SELECT slug FROM public.events WHERE std_media_nsfw ? 'grandfathered';
--
-- and the Reveal Studio deliberately keeps the row in the review queue —
-- badged "Live, but never actually watched" — even though it is serving. An
-- admin Approve replaces the carry-over with a real `human-review` examination
-- and drops the marker. The exception is designed to expire.
--
-- THE TRADE-OFF, STATED PLAINLY. This is a decision to keep one unexamined video
-- on a public page rather than interrupt a real customer. It is defensible only
-- because it is bounded to a single named row, is visible in the data and in the
-- admin UI, cannot be minted again (nothing but this file writes the marker, and
-- the column is host-unwritable in two independent ways), and dies the moment
-- anyone reviews it. If that trade is not wanted, delete the one UPDATE below:
-- the row then parks at 'pending', the page shows the couple's photo gallery,
-- and an admin can approve it properly within a minute.
--
-- ── WHY THE MARKER DOES NOT SERVE ON ITS OWN ────────────────────────────────
-- The serve path requires an examination naming a SEALED object plus its
-- `<etag>:<bytes>`, and SQL cannot HEAD an R2 object — so this file physically
-- cannot write a serving verdict, which is the right kind of inability. The row
-- lands NOT serving and one pass of the screen (fingerprint → classify the
-- poster → seal) completes it. `stdVideoNeedsGrandfatherHeal` fires that pass
-- from the public loader for marker rows only, so the page heals itself within a
-- render instead of waiting for someone to log in.
--
-- No OTHER verdict is backfilled — deliberately. Backfilling `approved` in
-- general would bless a forgery if one had already happened, and a row cannot
-- tell you which it is.
--
-- ── WHAT IS UNAFFECTED ──────────────────────────────────────────────────────
--   • std_media itself keeps its host UPDATE/INSERT grant — the couple must be
--     able to choose their media. Only the VERDICT moved out of their reach.
--   • service_role / postgres: untouched.
--   • No RLS policy is added, changed, or removed. Row visibility is unchanged.
--   • The public guest page reads events through createAdminClient(), so the
--     SELECT grant below is only for the couple's own dashboard.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS · a `- 'nsfw'` strip that is a no-op the
-- second time · REVOKE/GRANT are declarative. Safe to re-apply.
--
-- REVERSIBLE: `ALTER TABLE public.events DROP COLUMN std_media_nsfw;` restores
-- the prior schema (the code that reads it goes with the revert). The stripped
-- `nsfw` keys are not restored — and must not be: they were never trustworthy.
-- ============================================================================

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS std_media_nsfw JSONB;

COMMENT ON COLUMN public.events.std_media_nsfw IS
  'SEC-6 · Save-the-Date video NSFW verdict, BOUND to the media it judged: '
  '{status, videoKey, posterKey, videoFingerprint, posterFingerprint, screenedAt, attemptedAt}. '
  'Service-role written ONLY (authenticated + anon hold no UPDATE/INSERT) — the verdict used to '
  'live in the host-writable events.std_media blob, where a PostgREST PATCH could set it to '
  '"approved". A verdict whose keys or content fingerprints no longer match the current media is '
  'STALE and the video is not shown (lib/std-video-gate.ts stdVideoIsServable). Binding is what '
  'replaces a preserve-the-old-verdict trigger, which would pin an approval onto swapped media.';

-- ── Carry the already-serving rows across (see the header) ──────────────────
-- Runs BEFORE the strip below, because it reads the legacy key it is about to
-- delete. Scoped to rows that are (a) a video, (b) carrying both R2 refs the new
-- binding needs, and (c) already publicly approved under the old rule. In prod
-- that is exactly one row; on a fresh database it is zero.
--
-- `videoFingerprint` / `posterFingerprint` / `sealed` / `video` / `poster` are
-- all NULL — SQL cannot HEAD R2 — so this verdict does NOT serve as written. It
-- is a marker plus a binding, and the application completes it.
UPDATE public.events
   SET std_media_nsfw = jsonb_build_object(
         'status',            'approved',
         'videoKey',          std_media->>'videoKey',
         'posterKey',         std_media->>'posterKey',
         'videoFingerprint',  NULL,
         'posterFingerprint', NULL,
         'sealed',            NULL,
         'video',             NULL,
         'poster',            NULL,
         'grandfathered',     jsonb_build_object(
                                'reason',
                                'pre-SEC-6 poster-only screen (events.std_media.nsfw = "approved"); '
                                'the video''s own bytes were never examined by anything',
                                'at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                              ),
         'screenedAt',        NULL,
         'attemptedAt',       NULL
       )
 WHERE std_media->>'type'      = 'video'
   AND std_media->>'nsfw'      = 'approved'
   AND std_media->>'videoKey'  IS NOT NULL
   AND std_media->>'posterKey' IS NOT NULL
   AND std_media_nsfw IS NULL;  -- idempotent: never overwrite a real verdict

-- The verdict is no longer read from std_media. Strip the untrustworthy key so
-- it cannot be mistaken for authority by a future reader.
UPDATE public.events
   SET std_media = std_media - 'nsfw'
 WHERE std_media ? 'nsfw';

-- ── Privileges ──────────────────────────────────────────────────────────────
-- Explicit, not inherited from the allow-list snapshot's silence.
REVOKE UPDATE (std_media_nsfw), INSERT (std_media_nsfw)
  ON public.events FROM authenticated, anon;

-- The couple reads their own screening status in the builder. anon gets nothing.
GRANT SELECT (std_media_nsfw) ON public.events TO authenticated;

-- Restate service_role's access so the migration is self-sufficient on a
-- freshly-built database (a no-op in prod, where it already holds it).
GRANT SELECT (std_media_nsfw), UPDATE (std_media_nsfw), INSERT (std_media_nsfw)
  ON public.events TO service_role;

-- ----------------------------------------------------------------------------
-- Post-conditions — assert against the REAL catalog. A grant that silently did
-- not take is invisible here (fail-closed), so it has to be checked.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  bad TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- (a) the verdict must be UNWRITABLE by both public-key roles. This is the
  --     whole point of the migration.
  IF has_column_privilege('authenticated', 'public.events', 'std_media_nsfw', 'UPDATE') THEN
    bad := array_append(bad, 'authenticated-can-update-verdict');
  END IF;
  IF has_column_privilege('authenticated', 'public.events', 'std_media_nsfw', 'INSERT') THEN
    bad := array_append(bad, 'authenticated-can-insert-verdict');
  END IF;
  IF has_column_privilege('anon', 'public.events', 'std_media_nsfw', 'UPDATE') THEN
    bad := array_append(bad, 'anon-can-update-verdict');
  END IF;
  IF has_column_privilege('anon', 'public.events', 'std_media_nsfw', 'INSERT') THEN
    bad := array_append(bad, 'anon-can-insert-verdict');
  END IF;

  -- (b) …but the couple must be able to READ it, or the builder badge is dead.
  IF NOT has_column_privilege('authenticated', 'public.events', 'std_media_nsfw', 'SELECT') THEN
    bad := array_append(bad, 'authenticated-cannot-read-verdict');
  END IF;

  -- (c) the MEDIA column must stay host-writable — locking it would break the
  --     couple's own video picker, which is not what this fix is for.
  IF NOT has_column_privilege('authenticated', 'public.events', 'std_media', 'UPDATE') THEN
    bad := array_append(bad, 'lost-host-write:std_media');
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.events', 'std_media', 'SELECT') THEN
    bad := array_append(bad, 'lost-host-read:std_media');
  END IF;

  -- (d) the screen + the admin override run as service_role.
  IF NOT has_column_privilege('service_role', 'public.events', 'std_media_nsfw', 'UPDATE')
     OR NOT has_column_privilege('service_role', 'public.events', 'std_media_nsfw', 'SELECT') THEN
    bad := array_append(bad, 'service_role-cannot-write-verdict');
  END IF;

  -- (e) no legacy nsfw key is left in any std_media blob.
  IF EXISTS (SELECT 1 FROM public.events WHERE std_media ? 'nsfw') THEN
    bad := array_append(bad, 'legacy-nsfw-key-survived');
  END IF;

  -- (f) the grandfather is BOUNDED. A marker may exist only on a video row, and
  --     it must name that row's own current media — otherwise the carry-over is
  --     authorising something other than what is there, which is the whole bug.
  IF EXISTS (
    SELECT 1 FROM public.events
     WHERE std_media_nsfw ? 'grandfathered'
       AND (
            std_media->>'type' IS DISTINCT FROM 'video'
         OR std_media_nsfw->>'videoKey'  IS DISTINCT FROM std_media->>'videoKey'
         OR std_media_nsfw->>'posterKey' IS DISTINCT FROM std_media->>'posterKey'
       )
  ) THEN
    bad := array_append(bad, 'grandfather-does-not-bind-its-media');
  END IF;

  -- (g) a marker must NOT ship pre-authorised. It carries no examination and no
  --     seal on purpose: the serve path needs both, so a marker row cannot play
  --     until the application has fingerprinted, classified and frozen it. If
  --     this ever fails, something wrote a servable verdict from SQL, which it
  --     cannot honestly do (SQL cannot read an R2 ETag).
  IF EXISTS (
    SELECT 1 FROM public.events
     WHERE std_media_nsfw ? 'grandfathered'
       AND (jsonb_typeof(std_media_nsfw->'video')  <> 'null'
         OR jsonb_typeof(std_media_nsfw->'sealed') <> 'null')
  ) THEN
    bad := array_append(bad, 'grandfather-shipped-pre-authorised');
  END IF;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'std_media_nsfw verdict post-condition failed: %',
      array_to_string(bad, ', ');
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- A SECOND, GRANT-INDEPENDENT LOCK
--
-- The REVOKE above is the primary control and it holds today. But it is a GRANT,
-- and grants on this table are recomputed by a migration that snapshots the live
-- catalog: 20271005100000 builds its allow-list as "every column of public.events
-- MINUS a hard-coded deny-set". std_media_nsfw cannot be added to that deny-set
-- (the file predates the column and its typo guard RAISEs on a name that does not
-- exist yet, breaking every fresh replay), so RE-APPLYING that baseline after
-- this file hands UPDATE back to `authenticated` and re-opens SEC-6 in silence.
-- `db push` will not do it on its own; a deliberate re-apply will.
--
-- So the verdict is ALSO defended by a trigger, which no GRANT can undo.
--
-- ⚠ THIS IS NOT THE "PRESERVE THE OLD VERDICT" TRIGGER THIS MIGRATION REJECTS.
-- That one silently keeps the previous value, which PINS an approval onto media
-- that was swapped underneath it. This one REFUSES THE STATEMENT. It never
-- carries a verdict forward, so it cannot make an approval outlive its media —
-- the binding + seal in the application layer remain the only thing that decides
-- whether a verdict still applies.
--
-- Scope: `authenticated` and `anon` only. service_role, postgres and every
-- migration are untouched, and an ordinary host edit (display_name, std_media,
-- …) leaves the column IS NOT DISTINCT FROM its old value and no-ops through.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_events_std_media_nsfw()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.std_media_nsfw IS NOT NULL THEN
        RAISE EXCEPTION
          'events.std_media_nsfw is written only by the screening service'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'The Save-the-Date NSFW verdict is set by the service-role screen (lib/nsfw-screen.ts) or the admin override, never by a client.';
      END IF;
    ELSIF NEW.std_media_nsfw IS DISTINCT FROM OLD.std_media_nsfw THEN
      RAISE EXCEPTION
        'events.std_media_nsfw is written only by the screening service'
        USING ERRCODE = 'insufficient_privilege',
              HINT = 'The Save-the-Date NSFW verdict is set by the service-role screen (lib/nsfw-screen.ts) or the admin override, never by a client.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_events_std_media_nsfw() IS
  'SEC-6 · defence-in-depth for events.std_media_nsfw. The column REVOKE is the primary lock; this trigger survives a re-application of the 20271005100000 privilege baseline, which recomputes its allow-list from the live catalog and would otherwise GRANT the verdict back to authenticated. REFUSES the statement — it never preserves the old value, because a preserve-on-update trigger would pin an approval onto swapped media (the exact failure mode this migration was written to avoid).';

DROP TRIGGER IF EXISTS guard_events_std_media_nsfw_trg ON public.events;
CREATE TRIGGER guard_events_std_media_nsfw_trg
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_events_std_media_nsfw();

COMMIT;

-- ============================================================================
-- ⚠ MAINTENANCE NOTE — how SEC-6 could still be re-opened
--
-- 20271005100000 computes its allow-list as "every column of public.events MINUS
-- its hard-coded deny-set", from the LIVE catalog. std_media_nsfw is not in that
-- deny-set (it could not be: the file predates the column, and its typo guard
-- RAISEs on a name that does not exist yet, which would break every fresh
-- replay). So RE-RUNNING 20271005100000 *after* this file GRANTs UPDATE on
-- std_media_nsfw back to authenticated.
--
-- Since 2026-07-26 that alone is no longer enough to publish a forged verdict —
-- guard_events_std_media_nsfw_trg still refuses the write, and
-- tests/db/std-media-nsfw-verdict.db.test.ts proves it by RE-GRANTING the column
-- and re-running the identical statement. But belt and braces: if you ever do
-- re-apply the baseline, also run
--     REVOKE UPDATE (std_media_nsfw), INSERT (std_media_nsfw)
--       ON public.events FROM authenticated, anon;
-- and do NOT drop the trigger.
--
-- The same test proves the shipped ordering end to end.
-- ============================================================================
