'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import {
  BadgeCheck,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Loader2,
  Mail,
  Smartphone,
  Video,
} from 'lucide-react';

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

/**
 * "Get verified" — the always-visible verification stage on My Shop (owner-
 * approved redesign 2026-07-03). Verification used to be buried four levels
 * deep inside the Profile tile; it now leads with the reward and renders a
 * FLAT 3-step stepper, each step one Collapsible deep, one open at a time:
 *
 *   1 · Your documents        — required + optional uploads (DocsBody, lazy)
 *   2 · Confirm your contacts — the vendor emails + texts Setnayan the token
 *                               "VALIDATE <shop name>" from their own
 *                               email/number; an admin stamps each received
 *   3 · Meet the team         — the 15-min Google Meet (identity check)
 *
 * SOFT-GATE: steps can start anytime; only "Submit for review" is gated
 * (profile-100% + required docs + both contacts) — the reasons come from the
 * SERVER (`verificationSubmitMissing` via loadShopData) so the copy here can
 * never drift from what `submitInlineForReview` enforces.
 */
export type VerifySummary = {
  /** Latest application status, or null when the vendor has none yet. */
  status: 'draft' | 'pending_review' | 'in_review' | 'approved' | 'rejected' | 'withdrawn' | null;
  vendorComplete: number;
  vendorTotal: number;
  /** All 4 required documents in. */
  requiredDocsIn: boolean;
  emailConfirmedAt: string | null;
  phoneConfirmedAt: string | null;
  /** google_meet slot's scheduled_at, when the Meet is booked. */
  meetScheduledAt: string | null;
  /** Admin decision reason on a rejected application. */
  decisionReason: string | null;
  /** Server-computed submit blockers (empty = ready). ONE source of truth. */
  submitMissing: string[];
  /** Where the vendor sends the VALIDATE messages (admin-managed settings). */
  validateEmail: string;
  validatePhone: string | null;
};

export function VerifySection({
  businessName,
  vendorProfileId,
  isVerified,
  verify,
}: {
  businessName: string;
  vendorProfileId: string;
  isVerified: boolean;
  verify: VerifySummary;
}) {
  const [openStep, setOpenStep] = useState<1 | 2 | 3 | null>(null);
  const toggle = (s: 1 | 2 | 3) => setOpenStep((cur) => (cur === s ? null : s));

  // Verified → the section collapses to its terminal reward state.
  if (isVerified) {
    return (
      <section id="get-verified" className="space-y-3">
        <h2 className="text-sm font-medium" style={{ color: 'var(--m-slate)' }}>
          Verification
        </h2>
        <div
          className="flex items-start gap-3 rounded-2xl border p-5"
          style={{
            borderColor: 'var(--m-line)',
            background: 'color-mix(in srgb, var(--m-sage-deep) 8%, var(--m-paper))',
          }}
        >
          <BadgeCheck aria-hidden className="h-6 w-6 shrink-0" strokeWidth={1.75} style={{ color: 'var(--m-sage-deep)' }} />
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
      </section>
    );
  }

  const submitted = verify.status === 'pending_review' || verify.status === 'in_review';
  const step1Done = verify.requiredDocsIn;
  const step2Done = Boolean(verify.emailConfirmedAt && verify.phoneConfirmedAt);
  const step3Done = Boolean(verify.meetScheduledAt);
  const stepsDone = (step1Done ? 1 : 0) + (step2Done ? 1 : 0) + (step3Done ? 1 : 0);

  return (
    <section id="get-verified" className="space-y-3">
      <h2 className="text-sm font-medium" style={{ color: 'var(--m-slate)' }}>
        Get verified
      </h2>

      <div
        className="rounded-2xl border p-5"
        style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
      >
        {/* Reward first — why verify at all. */}
        <div className="mb-4 flex items-start gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
          >
            <BadgeCheck className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
              Get the Verified badge
            </p>
            <p className="text-xs" style={{ color: 'var(--m-slate)' }}>
              Couples trust and message verified shops first. Three steps — we handle the checks.
            </p>
          </div>
        </div>

        {submitted ? (
          <div
            className="mb-4 flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs"
            style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
          >
            <Clock aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            Submitted — our team reviews within 5 business days. We&rsquo;ll email you either way.
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

        {/* One quiet progress readout for the whole journey. */}
        <p className="text-xs tabular-nums" style={{ color: 'var(--m-slate)' }} aria-live="polite">
          {stepsDone} of 3 steps done
        </p>
        <div
          className="mb-4 mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: 'var(--m-line-soft)' }}
        >
          <span
            className="block h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${Math.round((stepsDone / 3) * 100)}%`, background: 'var(--m-orange)' }}
          />
        </div>

        <div className="space-y-2.5">
          <DocsStep
            n={1}
            done={step1Done}
            open={openStep === 1}
            onToggle={() => toggle(1)}
            vendorComplete={verify.vendorComplete}
            vendorTotal={verify.vendorTotal}
            vendorProfileId={vendorProfileId}
          />
          <ContactsStep
            n={2}
            done={step2Done}
            open={openStep === 2}
            onToggle={() => toggle(2)}
            businessName={businessName}
            emailConfirmedAt={verify.emailConfirmedAt}
            phoneConfirmedAt={verify.phoneConfirmedAt}
            validateEmail={verify.validateEmail}
            validatePhone={verify.validatePhone}
          />
          <MeetStep
            n={3}
            done={step3Done}
            open={openStep === 3}
            onToggle={() => toggle(3)}
            docsIn={step1Done}
            meetScheduledAt={verify.meetScheduledAt}
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
      className="overflow-hidden rounded-xl border bg-white"
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
              : { background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }
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
        ? { background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }
        : tone === 'checking'
          ? { background: 'var(--m-line-soft)', color: 'var(--m-slate)' }
          : { background: 'var(--m-paper)', color: 'var(--m-slate-3)' };
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
  vendorComplete,
  vendorTotal,
  vendorProfileId,
}: {
  n: number;
  done: boolean;
  open: boolean;
  onToggle: () => void;
  vendorComplete: number;
  vendorTotal: number;
  vendorProfileId: string;
}) {
  const [payload, setPayload] = useState<InlineDocsPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = () => {
    setLoading(true);
    loadInlineDocs()
      .then(setPayload)
      .catch(() => setPayload(null))
      .finally(() => setLoading(false));
  };
  // Lazy: the per-ref R2 presigns run only when the step first opens.
  const handleToggle = () => {
    if (!open && !payload && !loading) reload();
    onToggle();
  };

  const shown = payload ? payload.vendorComplete : vendorComplete;
  return (
    <StepShell
      n={n}
      title="Your documents"
      sub="DTI/SEC, BIR 2303, Business Permit, bank proof — plus optional extras"
      pill={<StepPill tone={done ? 'done' : 'action'}>{shown} of {vendorTotal} in</StepPill>}
      done={done}
      open={open}
      onToggle={handleToggle}
    >
      {loading && !payload ? (
        <p className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--m-slate)' }}>
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
          Loading your documents…
        </p>
      ) : payload ? (
        <DocsBody payload={payload} vendorProfileId={vendorProfileId} onSaved={reload} />
      ) : (
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          Couldn&rsquo;t load your documents.{' '}
          <button type="button" onClick={reload} className="font-medium text-terracotta hover:underline">
            Try again
          </button>
          .
        </p>
      )}
    </StepShell>
  );
}

/* ─── Step 2 · Confirm your contacts (VALIDATE email + text) ────────────── */

function ContactsStep({
  n,
  done,
  open,
  onToggle,
  businessName,
  emailConfirmedAt,
  phoneConfirmedAt,
  validateEmail,
  validatePhone,
}: {
  n: number;
  done: boolean;
  open: boolean;
  onToggle: () => void;
  businessName: string;
  emailConfirmedAt: string | null;
  phoneConfirmedAt: string | null;
  validateEmail: string;
  validatePhone: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const token = `VALIDATE ${businessName}`;
  const oneIn = Boolean(emailConfirmedAt) !== Boolean(phoneConfirmedAt);
  const pill = done ? (
    <StepPill tone="done">Confirmed</StepPill>
  ) : oneIn ? (
    <StepPill tone="checking">We&rsquo;re checking</StepPill>
  ) : (
    <StepPill tone="action">Action needed</StepPill>
  );

  const copy = () => {
    if (navigator.clipboard) void navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <StepShell
      n={n}
      title="Confirm your contacts"
      sub="Prove your email and number are really yours"
      pill={pill}
      done={done}
      open={open}
      onToggle={onToggle}
    >
      <div className="space-y-3">
        <p className="text-xs" style={{ color: 'var(--m-slate)' }}>
          From your own email and phone, send us an email and a text with this exact message —
          we confirm each as it lands:
        </p>
        <div
          className="flex items-center justify-between gap-3 rounded-lg border p-2.5 pl-3"
          style={{ borderColor: 'var(--m-orange-3)', background: 'var(--m-orange-4)' }}
        >
          <code className="min-w-0 truncate font-mono text-sm" style={{ color: 'var(--m-orange-2)' }}>
            {token}
          </code>
          <button
            type="button"
            onClick={copy}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-terracotta hover:bg-white/60"
          >
            {copied ? <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`mailto:${validateEmail}?subject=${encodeURIComponent(token)}&body=${encodeURIComponent(token)}`}
            className="button-secondary inline-flex items-center gap-2 px-3 py-1.5 text-xs"
          >
            <Mail className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            Email {validateEmail}
          </a>
          {validatePhone ? (
            <a
              href={`sms:${validatePhone}?&body=${encodeURIComponent(token)}`}
              className="button-secondary inline-flex items-center gap-2 px-3 py-1.5 text-xs"
            >
              <Smartphone className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              Text {validatePhone}
            </a>
          ) : (
            <span className="inline-flex items-center gap-2 px-1 text-xs" style={{ color: 'var(--m-slate-3)' }}>
              <Smartphone className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              Text number coming soon — email works now
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <ReceiptLine label="Email" at={emailConfirmedAt} />
          <ReceiptLine label="Text" at={phoneConfirmedAt} />
        </div>
      </div>
    </StepShell>
  );
}

function ReceiptLine({ label, at }: { label: string; at: string | null }) {
  return at ? (
    <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--m-sage-deep)' }}>
      <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      {label} · received
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--m-slate-3)' }}>
      <Clock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      {label} · waiting
    </span>
  );
}

/* ─── Step 3 · Meet the team ────────────────────────────────────────────── */

function MeetStep({
  n,
  done,
  open,
  onToggle,
  docsIn,
  meetScheduledAt,
}: {
  n: number;
  done: boolean;
  open: boolean;
  onToggle: () => void;
  docsIn: boolean;
  meetScheduledAt: string | null;
}) {
  const pill = done ? (
    <StepPill tone="done">Booked</StepPill>
  ) : docsIn ? (
    <StepPill tone="checking">We&rsquo;ll email you</StepPill>
  ) : (
    <StepPill tone="wait">After docs</StepPill>
  );
  return (
    <StepShell
      n={n}
      title="Meet the team"
      sub="A 15-min Google Meet — where we confirm your identity"
      pill={pill}
      done={done}
      open={open}
      onToggle={onToggle}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'var(--m-paper)', color: 'var(--m-slate)' }}
        >
          <Video className="h-4 w-4" strokeWidth={1.75} />
        </span>
        {meetScheduledAt ? (
          <p className="inline-flex items-center gap-1.5 text-sm" style={{ color: 'var(--m-sage-deep)' }}>
            <Calendar className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Meet booked ·{' '}
            {new Date(meetScheduledAt).toLocaleString('en-PH', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        ) : (
          <p className="text-xs" style={{ color: 'var(--m-slate)' }}>
            {docsIn
              ? 'Your documents are in — we’ll email you a scheduling link to pick a time that fits.'
              : 'Available once your documents are in. We’ll email you a scheduling link.'}
          </p>
        )}
      </div>
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
          ? 'All set — an admin reviews and books your Google Meet.'
          : `To submit: ${missing.join(' · ').toLowerCase()}.`}
      </p>
    </form>
  );
}
