-- a shop keeps a library of forms
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ═══════════════════════════════════════════════════════════════════════════
-- THE FORM MAKER — a shop keeps MANY forms, links them to service cards, and
-- a linked form reaches the couple by itself when they book.
--
-- Rulings: DECISION_LOG 2026-10-28 "THE FORM MAKER IS APPROVED", "SUPPLIER
-- FORMS + TOOLS … APPROVED", "SUGGESTED FOR YOUR SERVICE — APPROVED", "FORM
-- MEDIA BY PLAN"; build plan v111 item 18 (owner verbatim: Title / Add Media
-- files / Add Video Link / Add a Question Line / Link to Service Card / Save to
-- Library / Send to Chat). Build spec: THE ONE BUILD §5.5 + §9 #13 (Setnayan-
-- specs plans/supplier_one_build_2026-11-08/B2 §3.2).
--
-- ── NO PARALLEL STORAGE (DECISION_LOG 2026-10-28) ─────────────────────────
-- The shipped "Questions for the couple" (20271233982952 + 20271316174617) is
-- ALREADY a form: vendor_questions = its items, event_question_answers = its
-- answers. This migration EXTENDS those two tables and adds only:
--     vendor_forms                 the container (title), one shop's library
--     vendor_form_service_links    form ↔ service card, pick as many
--     event_form_sends             "this form was sent into this event"
--     form_templates               admin "Suggested for your service" forms
--     category_form_suggestions    which templates a leaf category suggests
--
-- 🔑 form_id IS NULL = THE SHIPPED SET, exactly as it is today. Every shipped
-- reader of vendor_questions filters `form_id IS NULL`
-- (lib/the-shipped-question-set-stays-the-set.test.ts), so no library item can
-- ever appear as a "Questions for the couple" row.
--
-- ── QUESTION TYPES = THE v113 FORM MAKER'S TYPE DROPDOWN ──────────────────
-- (§9 #13). v113 lists: Short answer · Long answer · Multiple choice ·
-- Checkboxes · Dropdown · Date · Number · Yes / No · Photo upload ·
-- Measurement. "Photo upload" is NOT in this CHECK: §4 rules photo-upload
-- answers OUT of this build ("text answers only"), and a type the database
-- accepts but no answer path can serve would be a box the couple cannot fill.
-- Adding it later is one CHECK swap.
-- The shipped set's box is the long answer (`TypedRow long`), so that is the
-- column default and every existing row keeps exactly what it drew.
--
-- ── WHO READS WHAT ────────────────────────────────────────────────────────
--   • a shop's forms: its own team (Pattern C) + admin; the couple reads a form
--     only once it was SENT into their event.
--   • a form's items: vendor_questions' shipped signed-in read (USING true) —
--     the same reach `prompt`/`hint` already have; an item holds nothing about
--     any couple.
--   • answers: the shipped couple lane covers any question on their event; a
--     THIRD supplier lane is added — own item of a form sent into THIS event.
--   • templates + suggestions: any signed-in user reads, only admin writes
--     (the taxonomy pattern).
-- Suggestions ship EMPTY (§9 #13): no seed is invented; the page says "No
-- suggested forms for this service yet".
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · vendor_forms — the container ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vendor_forms (
  form_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id         TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('F'),
  vendor_profile_id UUID NOT NULL
                    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  title             TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  -- The suggestion it was COPIED from ("Use this"). Never a live link: an admin
  -- edit to the template never rewrites a shop's copy.
  from_template_key TEXT CHECK (from_template_key IS NULL OR length(from_template_key) <= 63),
  -- Retire, never delete: a delete would orphan answers a couple already typed.
  retired_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_forms_vendor_idx
  ON public.vendor_forms (vendor_profile_id, updated_at DESC);

ALTER TABLE public.vendor_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_forms_owner_all ON public.vendor_forms;
CREATE POLICY vendor_forms_owner_all
  ON public.vendor_forms FOR ALL
  TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR (SELECT public.is_admin())
  )
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR (SELECT public.is_admin())
  );
-- (vendor_forms_sent_couple_select is created after event_form_sends, below.)

COMMENT ON TABLE public.vendor_forms IS
  'A shop''s library of forms (Form Maker, DECISION_LOG 2026-10-28 / v111 item 18). Items live in vendor_questions (form_id = this row); the shipped "Questions for the couple" set is form_id IS NULL. Retire, never delete.';

-- ── 2 · vendor_questions — the shipped items, widened ─────────────────────
-- ALTER before anything reads the new columns (one migration, ALTER first).

ALTER TABLE public.vendor_questions
  ADD COLUMN IF NOT EXISTS form_id     UUID REFERENCES public.vendor_forms(form_id),
  ADD COLUMN IF NOT EXISTS item_kind   TEXT NOT NULL DEFAULT 'question',
  ADD COLUMN IF NOT EXISTS answer_type TEXT NOT NULL DEFAULT 'long_answer',
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS options     TEXT[],
  ADD COLUMN IF NOT EXISTS media_keys  TEXT[],
  ADD COLUMN IF NOT EXISTS video_url   TEXT;

ALTER TABLE public.vendor_questions DROP CONSTRAINT IF EXISTS vendor_questions_item_kind_chk;
ALTER TABLE public.vendor_questions ADD CONSTRAINT vendor_questions_item_kind_chk
  CHECK (item_kind IN ('question', 'media', 'video_link'));

ALTER TABLE public.vendor_questions DROP CONSTRAINT IF EXISTS vendor_questions_answer_type_chk;
ALTER TABLE public.vendor_questions ADD CONSTRAINT vendor_questions_answer_type_chk
  CHECK (answer_type IN (
    'short_answer', 'long_answer', 'multiple_choice', 'checkboxes', 'dropdown',
    'date', 'number', 'yes_no', 'measurement'
  ));

-- Each kind carries exactly its own payload. A choice question needs its
-- choices; a question never carries media or a link.
ALTER TABLE public.vendor_questions DROP CONSTRAINT IF EXISTS vendor_questions_item_shape_chk;
ALTER TABLE public.vendor_questions ADD CONSTRAINT vendor_questions_item_shape_chk CHECK (
  CASE item_kind
    WHEN 'media' THEN
      media_keys IS NOT NULL AND cardinality(media_keys) BETWEEN 1 AND 10
      AND video_url IS NULL AND options IS NULL
    WHEN 'video_link' THEN
      video_url IS NOT NULL AND video_url ~ '^https://' AND length(video_url) <= 500
      AND media_keys IS NULL AND options IS NULL
    ELSE
      media_keys IS NULL AND video_url IS NULL
      AND (
        CASE WHEN answer_type IN ('multiple_choice', 'checkboxes', 'dropdown')
          THEN options IS NOT NULL AND cardinality(options) BETWEEN 1 AND 30
          ELSE options IS NULL
        END
      )
  END
);

-- The shipped set stays text questions — a media file or a link is a form item.
ALTER TABLE public.vendor_questions DROP CONSTRAINT IF EXISTS vendor_questions_set_items_are_questions;
ALTER TABLE public.vendor_questions ADD CONSTRAINT vendor_questions_set_items_are_questions
  CHECK (form_id IS NOT NULL OR item_kind = 'question');

CREATE INDEX IF NOT EXISTS vendor_questions_form_idx
  ON public.vendor_questions (form_id, display_order) WHERE form_id IS NOT NULL;

-- Same shop: an item belongs to a form of ITS OWN shop. A policy cannot say
-- this (it sees one row), so a trigger does.
CREATE OR REPLACE FUNCTION public.guard_vendor_question_form_shop()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.form_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_forms f
     WHERE f.form_id = NEW.form_id
       AND f.vendor_profile_id = NEW.vendor_profile_id
  ) THEN
    RAISE EXCEPTION 'a form''s item belongs to the form''s own shop' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS vendor_questions_form_shop_guard ON public.vendor_questions;
CREATE TRIGGER vendor_questions_form_shop_guard
  BEFORE INSERT OR UPDATE OF form_id, vendor_profile_id ON public.vendor_questions
  FOR EACH ROW EXECUTE FUNCTION public.guard_vendor_question_form_shop();

-- Grants unchanged: the shipped GRANT SELECT, INSERT, UPDATE (no DELETE — an
-- item is retired with is_asked = FALSE, the shipped retire-never-delete rule).

-- ── 3 · vendor_form_service_links — form ↔ service card, pick as many ─────

CREATE TABLE IF NOT EXISTS public.vendor_form_service_links (
  form_id           UUID NOT NULL REFERENCES public.vendor_forms(form_id) ON DELETE CASCADE,
  vendor_service_id UUID NOT NULL REFERENCES public.vendor_services(vendor_service_id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (form_id, vendor_service_id)
);

CREATE INDEX IF NOT EXISTS vendor_form_service_links_service_idx
  ON public.vendor_form_service_links (vendor_service_id);

ALTER TABLE public.vendor_form_service_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_form_service_links_owner_all ON public.vendor_form_service_links;
CREATE POLICY vendor_form_service_links_owner_all
  ON public.vendor_form_service_links FOR ALL
  TO authenticated
  USING (
    form_id IN (
      SELECT f.form_id FROM public.vendor_forms f
       WHERE f.vendor_profile_id IN (SELECT public.current_vendor_ids())
    )
    OR (SELECT public.is_admin())
  )
  WITH CHECK (
    form_id IN (
      SELECT f.form_id FROM public.vendor_forms f
       WHERE f.vendor_profile_id IN (SELECT public.current_vendor_ids())
    )
    OR (SELECT public.is_admin())
  );

-- Same shop: the card is the form's own shop's card.
CREATE OR REPLACE FUNCTION public.guard_vendor_form_service_link_shop()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public.vendor_forms f
      JOIN public.vendor_services s ON s.vendor_profile_id = f.vendor_profile_id
     WHERE f.form_id = NEW.form_id
       AND s.vendor_service_id = NEW.vendor_service_id
  ) THEN
    RAISE EXCEPTION 'a form links only to its own shop''s service cards' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS vendor_form_service_links_shop_guard ON public.vendor_form_service_links;
CREATE TRIGGER vendor_form_service_links_shop_guard
  BEFORE INSERT OR UPDATE ON public.vendor_form_service_links
  FOR EACH ROW EXECUTE FUNCTION public.guard_vendor_form_service_link_shop();

REVOKE ALL ON public.vendor_form_service_links FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.vendor_form_service_links TO authenticated;

COMMENT ON TABLE public.vendor_form_service_links IS
  'Which of the shop''s service cards a form is linked to (pick as many). A linked form is sent to the couple automatically when the deposit on a booking of that card is confirmed (lib/vendor-forms-on-booking.server.ts, called from runDepositAcknowledgedEffects).';

-- ── 4 · event_form_sends — "this form was sent into this event" ───────────
-- Mirrors event_question_requests (20271316174617): who sent which form into
-- which event and when. No question text, no answer.

CREATE TABLE IF NOT EXISTS public.event_form_sends (
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- NO ACTION (not CASCADE): a form that was sent is retired, never deleted.
  form_id           UUID NOT NULL REFERENCES public.vendor_forms(form_id),
  vendor_profile_id UUID NOT NULL
                    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  thread_id         UUID REFERENCES public.chat_threads(thread_id) ON DELETE SET NULL,
  -- 'supplier' = Send to chat; 'on_booking' = sent by itself when the deposit
  -- was confirmed (service role only — see the insert policy).
  sent_by           TEXT NOT NULL CHECK (sent_by IN ('supplier', 'on_booking')),
  first_sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, form_id)
);

CREATE INDEX IF NOT EXISTS event_form_sends_vendor_idx
  ON public.event_form_sends (vendor_profile_id);
CREATE INDEX IF NOT EXISTS event_form_sends_form_idx
  ON public.event_form_sends (form_id);

ALTER TABLE public.event_form_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_form_sends_select ON public.event_form_sends;
CREATE POLICY event_form_sends_select
  ON public.event_form_sends FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR event_id IN (SELECT public.current_couple_event_ids())
    OR (SELECT public.is_admin())
  );

-- The supplier sends — own row, own form, only into an event they talk to.
DROP POLICY IF EXISTS event_form_sends_vendor_insert ON public.event_form_sends;
CREATE POLICY event_form_sends_vendor_insert
  ON public.event_form_sends FOR INSERT
  TO authenticated
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    AND sent_by = 'supplier'
    AND EXISTS (
      SELECT 1 FROM public.chat_threads t
       WHERE t.event_id = event_form_sends.event_id
         AND t.vendor_profile_id = event_form_sends.vendor_profile_id
    )
  );
-- "Own LIVE form" is the trigger below, not a policy clause: a policy here that
-- read vendor_forms would expand vendor_forms_sent_couple_select, which reads
-- event_form_sends — Postgres refuses that cycle ("infinite recursion").

-- "Send again" moves sent_at on their own row.
DROP POLICY IF EXISTS event_form_sends_vendor_update ON public.event_form_sends;
CREATE POLICY event_form_sends_vendor_update
  ON public.event_form_sends FOR UPDATE
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids()))
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    AND EXISTS (
      SELECT 1 FROM public.chat_threads t
       WHERE t.event_id = event_form_sends.event_id
         AND t.vendor_profile_id = event_form_sends.vendor_profile_id
    )
  );

-- Same shop, live form: a send names a form of the sending shop that is not
-- retired — for every writer, the booking moment (service role) included.
CREATE OR REPLACE FUNCTION public.guard_event_form_send_form()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_forms f
     WHERE f.form_id = NEW.form_id
       AND f.vendor_profile_id = NEW.vendor_profile_id
       AND f.retired_at IS NULL
  ) THEN
    RAISE EXCEPTION 'a send names one of the shop''s own live forms' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS event_form_sends_form_guard ON public.event_form_sends;
CREATE TRIGGER event_form_sends_form_guard
  BEFORE INSERT OR UPDATE ON public.event_form_sends
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_form_send_form();

-- Column-level writes: first_sent_at is the database's (its DEFAULT). The key
-- columns sit in the UPDATE list only because a PostgREST upsert re-states
-- every column it was given; the UPDATE policy pins the row. No DELETE: a send
-- is not withdrawn (the couple may already have answered).
REVOKE ALL ON public.event_form_sends FROM anon, authenticated;
GRANT SELECT ON public.event_form_sends TO authenticated;
GRANT INSERT (event_id, form_id, vendor_profile_id, thread_id, sent_by, sent_at)
  ON public.event_form_sends TO authenticated;
GRANT UPDATE (event_id, form_id, vendor_profile_id, thread_id, sent_by, sent_at)
  ON public.event_form_sends TO authenticated;

COMMENT ON TABLE public.event_form_sends IS
  'A shop sent one of its library forms (vendor_forms) into one event — by the supplier from the chat/Forms page, or by itself on booking (deposit confirmed; service role). No question text, no answer. Lets the couple see that form and that supplier read the answers to its items.';

-- The couple reads a form once it was sent into their event.
DROP POLICY IF EXISTS vendor_forms_sent_couple_select ON public.vendor_forms;
CREATE POLICY vendor_forms_sent_couple_select
  ON public.vendor_forms FOR SELECT
  TO authenticated
  USING (
    form_id IN (
      SELECT s.form_id FROM public.event_form_sends s
       WHERE s.event_id IN (SELECT public.current_couple_event_ids())
    )
  );

REVOKE ALL ON public.vendor_forms FROM anon, authenticated;
-- No DELETE: retire (retired_at), never delete.
GRANT SELECT, INSERT, UPDATE ON public.vendor_forms TO authenticated;

-- ── 5 · answers — a third supplier read lane ──────────────────────────────
-- Own item of a form SENT into this event (both halves, like the asked lane).
DROP POLICY IF EXISTS event_question_answers_form_sent_vendor_select ON public.event_question_answers;
CREATE POLICY event_question_answers_form_sent_vendor_select
  ON public.event_question_answers FOR SELECT
  TO authenticated
  USING (
    (event_id, question_id) IN (
      SELECT s.event_id, q.question_id
        FROM public.event_form_sends s
        JOIN public.vendor_questions q ON q.form_id = s.form_id
       WHERE s.vendor_profile_id IN (SELECT public.current_vendor_ids())
         AND q.vendor_profile_id IN (SELECT public.current_vendor_ids())
    )
  );
-- The couple's shipped host_write lane already covers any question on their event.

-- ── 6 · admin "Suggested for your service" — read by signed-in, admin write ─

CREATE TABLE IF NOT EXISTS public.form_templates (
  template_key TEXT PRIMARY KEY CHECK (template_key ~ '^[a-z][a-z0-9_]{1,62}$'),
  title        TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  -- [{ "kind": "question", "prompt": "…", "answer_type": "short_answer", "required": false, "options": [] }, …]
  -- Question lines only: a template carries no shop's media.
  items        JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID REFERENCES public.users(user_id) ON DELETE SET NULL
);

ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS form_templates_read ON public.form_templates;
CREATE POLICY form_templates_read
  ON public.form_templates FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS form_templates_admin_write ON public.form_templates;
CREATE POLICY form_templates_admin_write
  ON public.form_templates FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE TABLE IF NOT EXISTS public.category_form_suggestions (
  category_id  TEXT NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL REFERENCES public.form_templates(template_key) ON DELETE RESTRICT,
  sort_order   INT NOT NULL DEFAULT 0,
  PRIMARY KEY (category_id, template_key)
);

CREATE INDEX IF NOT EXISTS category_form_suggestions_template_idx
  ON public.category_form_suggestions (template_key);

ALTER TABLE public.category_form_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS category_form_suggestions_read ON public.category_form_suggestions;
CREATE POLICY category_form_suggestions_read
  ON public.category_form_suggestions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS category_form_suggestions_admin_write ON public.category_form_suggestions;
CREATE POLICY category_form_suggestions_admin_write
  ON public.category_form_suggestions FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

REVOKE ALL ON public.form_templates FROM anon;
REVOKE ALL ON public.category_form_suggestions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.form_templates FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.category_form_suggestions FROM authenticated;
GRANT SELECT ON public.form_templates TO authenticated;
GRANT SELECT ON public.category_form_suggestions TO authenticated;

COMMENT ON TABLE public.form_templates IS
  'Admin-authored forms offered as "Suggested for your service" (DECISION_LOG 2026-10-28). "Use this" COPIES one into the shop''s vendor_forms; an admin edit never rewrites a copy. Ships EMPTY (THE ONE BUILD §9 #13) — no seed is invented. Written by admin (service role) only.';
COMMENT ON TABLE public.category_form_suggestions IS
  'Which form_templates a leaf service category suggests, in order. Ships EMPTY (no invented seed). Written by admin only.';

COMMIT;
