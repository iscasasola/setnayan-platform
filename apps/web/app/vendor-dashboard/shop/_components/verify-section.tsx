'use client';

import { VERIFY_DOCS_ANCHOR } from '../../_components/get-verified-line';
import { useActionState, useEffect, useRef, useState } from 'react';
import { BadgeCheck, Check, ChevronDown, Clock, Loader2 } from 'lucide-react';

import { useToast } from '@/app/_components/toast/toast-provider';
import { SubmitButton } from '@/app/_components/submit-button';
import { Collapsible } from '../../_components/collapsible';
import {
  loadInlineDocs,
  submitInlineForReview,
  type InlineDocsPayload,
  type SubmitResult,
} from '../inline-docs-actions';
import { DocsBody } from './docs-body';
import { formatCount } from '@/lib/format-number';
import { REQUIRED_DOC_COUNT, countCompleteRequiredSlots } from '@/lib/vendor-verification';

/**
 * "Get verified" — the always-visible verification stage (owner-approved
 * redesign 2026-07-03), cut down to the owner's 2026-11-14 ruling (DECISION_LOG
 * "VERIFICATION IS THREE PAPERS AND ONE SUBMIT"): *"verification process is
 * simple. submit the 3 documents and press submit. that's it. no other steps
 * needed. we wait for admin cofirmation first."*
 *
 *   One step — Your documents (DocsBody, lazy): the three papers (DTI/SEC ·
 *   BIR 2303 · Mayor's/Business Permit) plus optional extras. Then Submit, gated
 *   by ONE shared server helper (`verificationSubmitMissing`) so copy never
 *   drifts from enforcement. Then the application waits for the admin, who
 *   approves or sends it back.
 *
 *   REMOVED 2026-11-14, each from where it lived here:
 *     · the "First step: finish your business profile" banner and the profile
 *       auto-open (the profile-100% gate — owner: "Yes, remove it");
 *     · Step 2 · Confirm your contacts (the VALIDATE email + text);
 *     · the "final confirmation, a 15-min Google Meet" copy and its booked time;
 *     · the "n of 2 steps done" bar.
 */
export type VerifySummary = {
  /** Latest application status, or null when the vendor has none yet. */
  status: 'draft' | 'pending_review' | 'in_review' | 'approved' | 'rejected' | 'withdrawn' | null;
  vendorComplete: number;
  vendorTotal: number;
  /** How many of the 3 REQUIRED papers are in — the one count shown (owner 2026-10-22). */
  requiredIn: number;
  /** All 3 required documents in (owner 2026-11-14, DECISION_LOG f69ec167). */
  requiredDocsIn: boolean;
  /**
   * Admin decision reason on a rejected application — ONLY for a send-back made before 2026-11-14, which named no
   * paper. A send-back that names its papers says the reason on those papers alone (`lib/setup-papers.ts`, the pairs).
   */
  decisionReason: string | null;
  /** Server-computed submit blockers (empty = ready). ONE source of truth. */
  submitMissing: string[];
};

export function VerifySection({
  vendorProfileId,
  isVerified,
  verify,
  papersAbove = null,
}: {
  /**
   * 📄 THE PAPERS ARE ASKED ONCE (walk 13 Nov 2026, F-W1-11). On Today the three required papers are already a list of
   * their own ("Send your documents", `SetupPapers`) right above this section; here the documents step then only
   * points to it — the id of that list — instead of loading and asking for the same three again. Absent (Your
   * details), the step is the full upload it always was.
   */
  papersAbove?: string | null;
  vendorProfileId: string;
  isVerified: boolean;
  verify: VerifySummary;
}) {
  const submitted = verify.status === 'pending_review' || verify.status === 'in_review';
  // The papers step starts OPEN while papers are still missing — the supplier lands on exactly what to do next.
  const [open, setOpen] = useState<boolean>(() => !verify.requiredDocsIn && !submitted);

  // 🛡 [Get verified] (`GetVerifiedLine`, owner 2026-10-29 v13 note 4) lands on `#docs`: the fold opens, and HERE the
  // papers step opens with it, so the first missing paper is on screen — not a closed step to find.
  useEffect(() => {
    if (isVerified || submitted) return;
    const onHash = () => {
      if (window.location.hash === `#${VERIFY_DOCS_ANCHOR}`) setOpen(true);
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [isVerified, submitted]);

  return (
    <section id="get-verified" className="space-y-3">
      <h2 className="sn-sec">{isVerified ? 'Verification' : 'Get verified'}</h2>

      {/* ── A VERIFIED SHOP KEEPS ITS BADGE **AND** IS ASKED FOR ITS PAPERS (owner ruling 2026-09-09). ⛔ No
          deadline is set and the badge is never threatened. Submitting is safe for them by construction:
          `PENDING_REVIEW_ADVANCEABLE` deliberately excludes 'verified', so the badge stays through the review. ── */}
      {isVerified ? (
        <div
          className="flex items-start gap-3 rounded-2xl border p-5"
          style={{
            borderColor: 'var(--m-line)',
            background: 'color-mix(in srgb, var(--m-sage-deep) 8%, rgba(255,255,255,.72))',
          }}
        >
          <BadgeCheck
            aria-hidden
            className="h-6 w-6 shrink-0"
            strokeWidth={1.75}
            style={{ color: 'var(--m-sage-deep)' }}
          />
          <div className="space-y-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--m-sage-deep)' }}>
              You&rsquo;re verified
            </p>
            <p className="text-xs" style={{ color: 'var(--m-slate)' }}>
              Couples see your Verified badge and message verified shops first. Your business
              profile is locked — ask Setnayan to correct a verified detail.
            </p>
          </div>
        </div>
      ) : null}

      <div className="sn-tile p-5">
        {/* Reward first — why verify at all. */}
        <div className="mb-4 flex items-start gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }}
          >
            <BadgeCheck className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
              {isVerified ? 'Your papers' : 'Get the Verified badge'}
            </p>
            <p className="text-xs" style={{ color: 'var(--m-slate)' }}>
              {isVerified
                ? 'Setnayan keeps the papers behind every badge. Send yours when they’re handy — your badge stays either way.'
                : 'Couples trust and message verified shops first. Add your three papers and press Submit — Setnayan checks them and confirms.'}
            </p>
          </div>
        </div>

        {submitted ? (
          <div
            className="mb-4 flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs"
            style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
          >
            <Clock aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>Waiting for Setnayan — your papers are being checked, within 5 business days.</span>
          </div>
        ) : null}
        {verify.status === 'rejected' && verify.decisionReason ? (
          <div
            className="mb-4 rounded-lg border p-3 text-xs"
            style={{ borderColor: 'var(--m-orange-3)', color: 'var(--m-ink)', background: 'var(--m-orange-4)' }}
          >
            <strong>Needs attention:</strong> {verify.decisionReason}
          </div>
        ) : null}

        <div className="space-y-2.5">
          <DocsStep
            n={1}
            done={verify.requiredDocsIn}
            open={open}
            onToggle={() => setOpen((cur) => !cur)}
            requiredIn={verify.requiredIn}
            vendorProfileId={vendorProfileId}
            isVerified={isVerified}
            papersAbove={papersAbove}
          />
        </div>

        {!submitted ? <SubmitBlock missing={verify.submitMissing} /> : null}
      </div>
    </section>
  );
}

/* ─── Step shell ────────────────────────────────────────────────────────── */

function StepShell({
  n,
  title,
  sub,
  pill,
  done,
  open,
  onToggle,
  children,
}: {
  n: number;
  title: string;
  sub: string;
  pill: React.ReactNode;
  done: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border bg-[color:var(--m-paper)]"
      style={{ borderColor: open ? 'var(--m-orange-3)' : 'var(--m-line)' }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3.5 text-left"
      >
        <span
          aria-hidden
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
          style={
            done
              ? {
                  background: 'color-mix(in srgb, var(--m-sage-deep) 14%, transparent)',
                  color: 'var(--m-sage-deep)',
                }
              : { background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }
          }
        >
          {done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
            {title}
          </span>
          <span className="block truncate text-xs" style={{ color: 'var(--m-slate-3)' }}>
            {sub}
          </span>
        </span>
        {pill}
        <ChevronDown
          aria-hidden
          className="h-4 w-4 shrink-0 transition-transform"
          strokeWidth={1.75}
          style={{ color: 'var(--m-slate-4)', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>
      <Collapsible open={open}>
        <div className="border-t px-3.5 pb-4 pt-3.5" style={{ borderColor: 'var(--m-line)' }}>
          {children}
        </div>
      </Collapsible>
    </div>
  );
}

function StepPill({
  tone,
  children,
}: {
  tone: 'done' | 'action' | 'checking' | 'wait';
  children: React.ReactNode;
}) {
  const style =
    tone === 'done'
      ? {
          background: 'color-mix(in srgb, var(--m-sage-deep) 12%, transparent)',
          color: 'var(--m-sage-deep)',
        }
      : tone === 'action'
        ? { background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }
        : tone === 'checking'
          ? { background: 'var(--m-line-soft)', color: 'var(--m-slate)' }
          : { background: 'var(--m-paper)', color: 'var(--m-slate-2)' };
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]"
      style={style}
    >
      {children}
    </span>
  );
}

/* ─── Step 1 · Documents (lazy DocsBody) ────────────────────────────────── */

function DocsStep({
  n,
  done,
  open,
  onToggle,
  requiredIn,
  vendorProfileId,
  isVerified,
  papersAbove = null,
}: {
  papersAbove?: string | null;
  n: number;
  done: boolean;
  open: boolean;
  onToggle: () => void;
  /** Required papers in, from the page's read — replaced by the live payload's once it loads. */
  requiredIn: number;
  vendorProfileId: string;
  /** From the page's own authoritative profile read — NOT a second probe. */
  isVerified: boolean;
}) {
  const [payload, setPayload] = useState<InlineDocsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  // Distinct from "not loaded yet": only a REAL fetch rejection flips this. A
  // fresh vendor with zero docs resolves to an empty editable payload (the
  // upload state), never an error — the retry copy is reserved for a genuine
  // failure. (Bug: the never-loaded state used to render the error text.)
  const [failed, setFailed] = useState(false);

  const reload = () => {
    setLoading(true);
    setFailed(false);
    loadInlineDocs()
      .then((p) => {
        setPayload(p);
        setFailed(false);
      })
      .catch(() => {
        setPayload(null);
        setFailed(true);
      })
      .finally(() => setLoading(false));
  };

  // Lazy load whenever the step is OPEN without a payload yet — this covers both
  // the click-to-open path AND the parent's auto-open paths (initial mount when
  // papers still missing, and the #docs hash) that set `open`
  // directly on the parent without routing through handleToggle. The per-ref R2
  // presigns still run only once the step actually opens, preserving laziness.
  useEffect(() => {
    if (open && !papersAbove && !payload && !loading && !failed) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payload, loading, failed]);

  const handleToggle = () => {
    onToggle();
  };

  // 🔢 ONE COUNT: the three required papers (2026-11-14), never "of 7" (owner 2026-10-22, journey_fixes Supplier 2).
  const shown = payload ? countCompleteRequiredSlots(payload.docMap) : requiredIn;
  return (
    <StepShell
      n={n}
      title="Your documents"
      sub="DTI/SEC, BIR 2303, Business Permit — plus optional extras"
      pill={<StepPill tone={done ? 'done' : 'action'}>{formatCount(shown)} of {formatCount(REQUIRED_DOC_COUNT)} required</StepPill>}
      done={done}
      open={open}
      onToggle={handleToggle}
    >
      {papersAbove ? (
        <p className="text-sm" style={{ color: 'var(--m-slate)' }} data-verify-papers-above="">
          Your papers are in Send your documents, above.{' '}
          <a href={`#${papersAbove}`} className="font-medium text-terracotta">
            Go to your papers
          </a>
        </p>
      ) : payload ? (
        <DocsBody
          payload={payload}
          vendorProfileId={vendorProfileId}
          isVerified={isVerified}
          onSaved={reload}
        />
      ) : failed ? (
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          Couldn&rsquo;t load your documents.{' '}
          <button type="button" onClick={reload} className="font-medium text-mulberry hover:underline">
            Try again
          </button>
          .
        </p>
      ) : (
        // No payload + no failure = still loading (or the open-triggered fetch is
        // about to fire). Show the spinner, never the error.
        <p className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--m-slate)' }}>
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
          Loading your documents…
        </p>
      )}
    </StepShell>
  );
}

/* ─── Submit ────────────────────────────────────────────────────────────── */

function SubmitBlock({ missing }: { missing: string[] }) {
  const toast = useToast();
  const [state, formAction] = useActionState<SubmitResult | null, FormData>(
    submitInlineForReview,
    null,
  );
  const handled = useRef<unknown>(null);
  useEffect(() => {
    if (!state || state === handled.current) return;
    handled.current = state;
    if (state.ok) toast.success('Submitted — our team reviews within 5 business days.');
    else toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const ready = missing.length === 0;
  return (
    <form action={formAction} className="mt-4 space-y-2">
      <SubmitButton
        className="button-primary w-full justify-center py-2.5 text-sm"
        pendingLabel="Submitting…"
        disabled={!ready}
      >
        Submit for review
      </SubmitButton>
      <p className="text-center text-xs" style={{ color: 'var(--m-slate-3)' }} aria-live="polite">
        {ready
          ? 'All set — after you submit, Setnayan checks your papers and confirms.'
          : `To submit: ${missing.join(' · ').toLowerCase()}.`}
      </p>
    </form>
  );
}
