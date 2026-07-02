-- platform_expenses — the App Performance cockpit's Expenses & Receipts ledger
-- (PR 3 · plan: spec corpus 0023_admin_console/App_Performance_Plan_2026-07-03.md
-- § 3 Zone 2 · owner 2026-07-03: "track all our expenses and collect receipts
-- … from websites, data, credits, claude, suno, and all digital expenses" +
-- "also include our expenses to business permits, and documents").
--
-- INTERNAL ops data (Setnayan's own money OUT — not customer/vendor money):
-- admin-only RLS on every verb. Receipts are the BIR expense-substantiation
-- trail (iteration 0026): each row wants a receipt object on R2; a NULL
-- receipt_r2_key is the "missing receipt — collect before quarter close"
-- signal the cockpit surfaces.
--
-- next_due_on + recurs_monthly power the Upcoming-charges card and give the
-- Action Center's manual watch-list its wiring (renewals with real dates).

BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_expenses (
  expense_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expensed_on         DATE NOT NULL,
  vendor_name         TEXT NOT NULL CHECK (length(vendor_name) BETWEEN 1 AND 200),
  -- The five plan categories: infra (Vercel/Supabase/R2/Resend/Sentry) ·
  -- ai_credits (Claude/Suno/OpenAI/Recraft) · domains_fees (domains, store
  -- developer fees) · tools · permits_docs (IPOPHL trademark, Mayor's permit,
  -- barangay clearance, DTI, BIR stamps, notarization).
  category            TEXT NOT NULL CHECK (
                        category IN ('infra','ai_credits','domains_fees','tools','permits_docs')
                      ),
  -- PESOS (NUMERIC, not centavos) — same money convention as orders /
  -- vendor_subscriptions / vendor_token_purchases.
  amount_php          NUMERIC(12,2) NOT NULL CHECK (amount_php >= 0),
  note                TEXT CHECK (note IS NULL OR length(note) <= 2000),
  -- R2 object key of the receipt (private bucket, viewed via signed GET).
  -- NULL = receipt not yet collected.
  receipt_r2_key      TEXT,
  receipt_uploaded_at TIMESTAMPTZ,
  -- Recurring subscription line (Vercel/Supabase/Suno …): projected onto the
  -- Upcoming-charges card each cycle.
  recurs_monthly      BOOLEAN NOT NULL DEFAULT FALSE,
  -- Next known charge/renewal date (annual domains, January permit cluster).
  next_due_on         DATE,
  created_by          UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS platform_expenses_expensed_on_idx
  ON public.platform_expenses (expensed_on DESC);
CREATE INDEX IF NOT EXISTS platform_expenses_category_idx
  ON public.platform_expenses (category);
CREATE INDEX IF NOT EXISTS platform_expenses_next_due_on_idx
  ON public.platform_expenses (next_due_on)
  WHERE next_due_on IS NOT NULL;

-- RLS at CREATE TABLE time (repo rule). Admin-only on every verb — this is
-- Setnayan-internal financial data; couples/vendors never see it.
ALTER TABLE public.platform_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_expenses_admin_all ON public.platform_expenses;
CREATE POLICY platform_expenses_admin_all
  ON public.platform_expenses FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;
