-- Reconcile the internal sub-processor record with what actually runs.
-- Owner ruling 2026-08-06, as data protection officer.
--
-- There were TWO lists and NOTHING compared them. The public /privacy page named
-- companies this record did not, and this record named companies that are not
-- used at all. Neither was wrong on purpose — adding a processor to one is a
-- different commit from adding it to the other, and no test ever read both. This
-- record had not been touched since 2026-07-06.
--
-- WHAT CHANGES, each verified against what is actually wired:
--   + Sentry   — genuinely running (`@sentry/nextjs`), receiving crash reports.
--   + Google   — scoped: ONLY when the user connects their own account.
--   + TikTok   — scoped the same way.
--   ~ Cloudflare — role corrected: media storage AND the relay that carries live
--                  call video in transit, which the public page already said.
--   − Persona / Veriff / Onfido — NOT USED. Webhook stubs only; /privacy already
--                  says they are "not currently active"; an admin reads vendor
--                  documents by hand. Listing a company that handles your data
--                  when it does not is its own inaccuracy.
--   − SendGrid — not wired. It appeared once, in prose on an internal page.
--
-- 🔑 THE SOURCE IS `apps/web/lib/subprocessors.ts`, NOT THIS FILE. This JSON is
-- generated from it, and `subprocessor-drift.test.ts` fails if the two disagree
-- or if the public page stops naming an entry. The record is ALSO admin-editable
-- through /admin/compliance — so this is a one-time correction of the stored row,
-- not a claim of ownership over it.
--
-- ⚠ `dpa_on_file` stays FALSE on every entry, because that is the live truth:
-- there is no signed data-processing agreement with any of them. Chasing those
-- is a separate job; recording the state honestly is this one.
--
-- GUARDED: the UPDATE only fires when the row still holds the 9-entry array we
-- read. If an admin has edited it since, this is a no-op rather than a silent
-- clobber of someone else's work.

UPDATE public.platform_compliance_facts
   SET sub_processors = '[
  {
    "name": "Vercel",
    "role": "App hosting",
    "jurisdiction": "United States",
    "personal_data": true,
    "dpa_on_file": false
  },
  {
    "name": "Supabase",
    "role": "Database + auth",
    "jurisdiction": "Singapore (ap-southeast-1)",
    "personal_data": true,
    "dpa_on_file": false
  },
  {
    "name": "Cloudflare",
    "role": "Media storage (R2, APAC) + CDN + TURN relay carrying live call and camera video in transit (never stored)",
    "jurisdiction": "APAC",
    "personal_data": true,
    "dpa_on_file": false
  },
  {
    "name": "Resend",
    "role": "Transactional email",
    "jurisdiction": "United States",
    "personal_data": true,
    "dpa_on_file": false
  },
  {
    "name": "Sentry",
    "role": "Server-side error monitoring \u2014 stack traces only",
    "jurisdiction": "United States",
    "personal_data": true,
    "dpa_on_file": false
  },
  {
    "name": "PostHog",
    "role": "Product analytics \u2014 opt-out available",
    "jurisdiction": "US/EU cloud \u2014 confirm instance",
    "personal_data": true,
    "dpa_on_file": false
  },
  {
    "name": "Anthropic",
    "role": "AI features, including vendor Deep Search \u2014 never trained on your data",
    "jurisdiction": "United States",
    "personal_data": true,
    "dpa_on_file": false
  },
  {
    "name": "Suno",
    "role": "AI music generation \u2014 no guest or personal data is sent",
    "jurisdiction": "United States",
    "personal_data": false,
    "dpa_on_file": false
  },
  {
    "name": "Google",
    "role": "ONLY when the user connects their own account \u2014 YouTube Data API for a broadcast, Drive API for photo delivery, plus the public STUN server contacted when starting a call",
    "jurisdiction": "United States",
    "personal_data": true,
    "dpa_on_file": false
  },
  {
    "name": "TikTok",
    "role": "ONLY when the user connects their own account \u2014 Personal-tier Patiktok posting",
    "jurisdiction": "Singapore / United States",
    "personal_data": true,
    "dpa_on_file": false
  },
  {
    "name": "Face matching (in-house)",
    "role": "On-device in the browser; vectors stored in Supabase Singapore. No third party.",
    "jurisdiction": "In-house",
    "personal_data": true,
    "dpa_on_file": false
  }
]'::jsonb,
       updated_at = NOW()
 WHERE jsonb_array_length(sub_processors) = 9;

DO $$
DECLARE
  n INT;
BEGIN
  SELECT jsonb_array_length(sub_processors) INTO n
    FROM public.platform_compliance_facts LIMIT 1;
  IF n IS NULL THEN
    RAISE EXCEPTION 'no compliance row to reconcile';
  END IF;
  IF n <> 11 THEN
    RAISE WARNING 'sub_processors holds % entries, not 11 — an admin edited the record since this was written; reconcile through /admin/compliance instead', n;
  END IF;
END $$;
