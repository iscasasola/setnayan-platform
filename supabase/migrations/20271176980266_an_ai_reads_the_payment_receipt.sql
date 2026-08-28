-- An AI reads the payment receipt (owner 2026-08-28).
--
-- WHY THIS TABLE EXISTS
-- The buyer sends two things: a screenshot of their transfer, and the last six
-- digits of the reference number printed on it. Until now a person opened the
-- picture and compared the two by eye, on every payment. This holds the answer
-- so it is already there when an admin opens the queue.
--
-- 🔑 THE MODEL TRANSCRIBES; THE SHIPPED CODE DECIDES. This is the whole design.
-- The model is asked one thing — "type out the words and numbers on this
-- receipt" — and never asked whether anything matches. The comparison is done
-- afterwards by `scanPaymentProof` and `compareReferences`, which already exist,
-- are pure, and are covered by tests carrying real GCash and BDO receipts.
-- A model asked "does 884213 appear?" can answer yes when it does not; a model
-- asked to read aloud gives us text we then search deterministically.
--
-- ⛔ WHAT IT MAY NEVER DO — the load-bearing line.
-- It NEVER approves, rejects or promotes anything. The one-person admin plan
-- (2026-07-11) binds it: the machine may prepare and may hold back, it may never
-- be the thing that lets money, a price, an approval or a publish through.
-- `payments.status` is moved by an admin pressing a button and by nothing else,
-- and `isDecisivePaymentMatch` — the predicate gating one-click approval —
-- deliberately does not know this table exists.
--
-- 🔑 AND IT PROVES LESS THAN IT LOOKS LIKE IT PROVES.
-- Agreement means the buyer TRANSCRIBED THEIR OWN RECEIPT CORRECTLY. It does not
-- mean money arrived — only the bank's own message says that, and an admin still
-- checks it. The wording on screen says so and must keep saying so: a row that
-- reads as confirmation of payment is worse than no row at all.
--
-- ⚠ A SCREENSHOT IS A PICTURE, AND PICTURES ARE MADE IN SECONDS.
-- This cannot tell a real receipt from a forged one. It catches typos, wrong
-- amounts and pictures of something else entirely — the honest mistakes, which
-- are nearly all of them. It is NOT a fraud control and no copy may call it one.

CREATE TABLE IF NOT EXISTS public.payment_receipt_reads (
  id                bigserial PRIMARY KEY,
  payment_id        uuid NOT NULL REFERENCES public.payments(payment_id) ON DELETE CASCADE,

  -- 'ok'         — we read the picture and compared.
  -- 'unreadable' — we read it, and no reference number was on it at all.
  -- 'failed'     — we never got an answer (no key, no image, network, timeout).
  -- ⚠ 'failed' is a verdict about US, never about the payment.
  status            text NOT NULL,

  -- Did the digits the buyer typed appear in a reference on the picture?
  -- Did a peso figure on the picture equal what the order owes?
  --
  -- 🔑 NULL WHENEVER WE COULD NOT ANSWER, never FALSE-by-default. On screen a
  -- FALSE reads as "that number is not on their receipt", which is an accusation
  -- about a person; defaulting to it would make us wrong about somebody whose
  -- picture merely came out blurry. `scanPaymentProof` already draws this exact
  -- distinction for the same reason.
  reference_matches boolean,
  amount_matches    boolean,

  -- What the parser actually found, so an admin can see WHY rather than trust a
  -- bare yes/no. Small and derived — the receipt transcript itself is NOT kept:
  -- it is the buyer's bank data, the admin can already open the picture, and a
  -- second copy of it here would be a second thing to protect.
  seen_references   text[] NOT NULL DEFAULT '{}',
  seen_amounts      numeric(12,2)[] NOT NULL DEFAULT '{}',

  -- One plain sentence for the admin, in the English the rest of the console
  -- speaks. Never a JSON blob on screen.
  summary           text,
  -- Why we could not read it, when status <> 'ok'.
  error             text,

  model             text,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT payment_receipt_reads_status_chk
    CHECK (status IN ('ok', 'unreadable', 'failed')),
  -- A read that claims it worked has to have said something.
  CONSTRAINT payment_receipt_reads_ok_has_summary_chk
    CHECK (status <> 'ok' OR summary IS NOT NULL),
  -- And one that says it failed has to say why, or the admin sees a blank card
  -- and cannot tell a broken key from a bad picture.
  CONSTRAINT payment_receipt_reads_failed_has_error_chk
    CHECK (status <> 'failed' OR error IS NOT NULL)
);

COMMENT ON TABLE public.payment_receipt_reads IS
  'What was read off a payment screenshot: the reference numbers and peso figures '
  'on it, and whether they agree with what the buyer typed and what the order owes. '
  'ADVISORY ONLY — nothing reads this to approve, reject or promote a payment, and '
  'agreement proves the buyer transcribed their own receipt correctly, never that '
  'money arrived.';

COMMENT ON COLUMN public.payment_receipt_reads.reference_matches IS
  'TRUE/FALSE only when we genuinely compared. NULL means we could not answer — '
  'never defaulted to FALSE, which on screen reads as an accusation.';

-- Newest read per payment is the only access pattern.
CREATE INDEX IF NOT EXISTS payment_receipt_reads_payment_idx
  ON public.payment_receipt_reads (payment_id, created_at DESC);

-- RLS at CREATE TABLE time, per the house pattern.
ALTER TABLE public.payment_receipt_reads ENABLE ROW LEVEL SECURITY;

-- 🔑 NO POLICY AND NO GRANT — SERVICE ROLE ONLY, the same shape as
-- `admin_search_phrases`, for the same reason: NOTHING IN A BROWSER READS THIS
-- TABLE. The admin payments queue already holds the service role and the one
-- writer is a server action. A read policy would hand every signed-in account
-- facts off other people's bank receipts for no feature at all, and a PERMISSIVE
-- `FOR ALL` would hand them INSERT with it — the shape behind eight forgeries on
-- 2026-08-12.
--
-- ⚠ DO NOT "FIX" THE SILENCE BY ADDING A POLICY. This joins the documented
-- "RLS on, no policy" set: reachable by the service role, silently empty to
-- everybody else.
REVOKE ALL ON public.payment_receipt_reads FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.payment_receipt_reads_id_seq FROM anon, authenticated;
