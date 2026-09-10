'use client';

import { useMemo, useState, useTransition } from 'react';
import { AlertTriangle, Check, Clock, Loader2, Minus } from 'lucide-react';

import { FileUpload } from '@/app/_components/file-upload';
import { useToast } from '@/app/_components/toast/toast-provider';
import {
  CHECK_STATE_SENTENCE,
  TALLY_LABEL,
  VERIFICATION_PAIRS,
  VERIFIED_WITHOUT_PAPERS_BANNER,
  deriveCheck,
  pairFieldLockedKey,
  parsePaperRead,
  tallyChecks,
  type CheckState,
  type PairField,
  type PaperRead,
  type TallyBucket,
  type VerificationPair,
} from '@/lib/verification-pairs';
import { isSlotComplete, type DocUpload } from '@/lib/vendor-verification';
import { LOCKED_FIELD_LABEL, type LockedIdentityFieldKey } from '@/lib/vendor-corrections';
import { REGISTRATION_NUMBER_TAKEN_MESSAGE } from '@/lib/vendor-registration-number';
import {
  saveRegistrationNumberInline,
  saveVerificationIdentityField,
  updateDocUploadInline,
  type InlineDocsPayload,
} from '../inline-docs-actions';

/**
 * THE PAPER BESIDE THE FIELDS IT PROVES — the screen.
 *
 * A PORT of the binding drawing `prototypes/shop_verification_2026-09-09.html`,
 * not a redraw. It replaces nothing on My Shop except the shape of the FOUR
 * REQUIRED document cards inside the shipped Get-verified section: each paper
 * now sits beside the details it proves, and every line reports on its own. The
 * three optional slots (portfolio, references, social links) are untouched and
 * still render as today's cards, one row below.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ───────────────────────────────────────────
 * Reading the document, resolving its QR and calling the registry are the
 * AUTOMATION, and they are a separate build. This screen renders whatever the
 * reader has written into the seam and is completely correct while that seam is
 * empty — which is production today: every filled line reads "with a person at
 * Setnayan", because until the reader ships that is exactly who compares a
 * paper with a field.
 *
 * ── PORT NOTES (divergences, each with its reason) ──────────────────────────
 * · The drawing's faint labels are ported to `--m-slate-2` (#6E6A62 → 5.38:1 on
 *   this page's white), NOT the page's own `--m-slate-3` (#8A857B → 3.67:1).
 *   The drawing's closing note makes exactly this correction for exactly this
 *   reason; using the page's existing faint token would have re-introduced the
 *   failure it caught.
 * · "Use the value on my paper" writes the profile column directly for the
 *   FOUR unlocked fields, as drawn. For the TWO that lock on a verified shop it
 *   files a correction request instead and the copy says so — the drawing
 *   anticipated this exact fork and guessed it would fall on the address;
 *   measured, it falls on the owner's name and the city.
 * · The pair for a locked field draws no input at all. A box whose save the
 *   server refuses is worse than no box.
 */

/* ── Status vocabulary ──────────────────────────────────────────────────── */

type Tone = 'ok' | 'warn' | 'wait' | 'none';

const STATE_TONE: Record<CheckState, Tone> = {
  matched: 'ok',
  mismatch: 'warn',
  with_a_person: 'wait',
  waiting_registry: 'wait',
  typed: 'none',
  not_sent: 'none',
};

const TONE_STYLE: Record<Tone, { fg: string; bg: string }> = {
  // sage on its own tint — the page's own "done" colour.
  ok: { fg: 'var(--m-sage-deep)', bg: 'color-mix(in srgb, var(--m-sage-deep) 12%, transparent)' },
  // warn-700 #7A5E32 on warn-50 #F9F5EC.
  warn: { fg: '#7A5E32', bg: '#F9F5EC' },
  // the repo's link slate-blue #3B4E67 (8.22:1 on white) on its own tint.
  wait: { fg: '#3B4E67', bg: '#EEF1F5' },
  none: { fg: '#6E6A62', bg: 'var(--m-line-soft)' },
};

function ToneIcon({ tone }: { tone: Tone }) {
  const cls = 'h-3.5 w-3.5 shrink-0';
  if (tone === 'ok') return <Check aria-hidden className={cls} strokeWidth={2.5} />;
  if (tone === 'warn') return <AlertTriangle aria-hidden className={cls} strokeWidth={2} />;
  if (tone === 'wait') return <Clock aria-hidden className={cls} strokeWidth={2} />;
  return <Minus aria-hidden className={cls} strokeWidth={2} />;
}

function StatusLine({ state, children }: { state: CheckState; children?: React.ReactNode }) {
  const tone = STATE_TONE[state];
  return (
    <p
      className="mt-1 flex items-start gap-1.5 text-xs"
      style={{ color: TONE_STYLE[tone].fg }}
    >
      <span className="mt-0.5">
        <ToneIcon tone={tone} />
      </span>
      <span>{children ?? CHECK_STATE_SENTENCE[state]}</span>
    </p>
  );
}

/** The pair's own headline state: the worst thing in it, said once. */
function pairHeadline(states: readonly CheckState[]): { label: string; tone: Tone } {
  const mismatches = states.filter((s) => s === 'mismatch').length;
  if (mismatches > 0) {
    return { label: `${mismatches} to fix`, tone: 'warn' };
  }
  if (states.some((s) => s === 'waiting_registry')) {
    return { label: 'Registry not answering', tone: 'wait' };
  }
  if (states.some((s) => s === 'with_a_person')) return { label: 'With a person', tone: 'wait' };
  if (states.every((s) => s === 'matched')) return { label: 'Matched', tone: 'ok' };
  if (states.some((s) => s === 'typed')) return { label: 'Paper not sent', tone: 'none' };
  return { label: 'Not sent', tone: 'none' };
}

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const s = TONE_STYLE[tone];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]"
      style={{ background: s.bg, color: s.fg }}
    >
      <ToneIcon tone={tone} />
      {children}
    </span>
  );
}

/* ── The whole block ────────────────────────────────────────────────────── */

export function VerifyPairs({
  payload,
  vendorProfileId,
  onSaved,
}: {
  payload: InlineDocsPayload;
  vendorProfileId: string;
  onSaved: () => void;
}) {
  const locked = !payload.editable;

  const perPair = useMemo(
    () =>
      VERIFICATION_PAIRS.map((pair) => {
        const entry = (payload.docMap[pair.slotKey] ?? null) as DocUpload | null;
        const paperPresent = isSlotComplete(pair.slotKey, entry);
        const read = parsePaperRead(entry);
        const states = pair.fields.map((f) =>
          deriveCheck({
            field: f,
            typedValue: f.column ? (payload.identityValues[f.column] ?? null) : null,
            paperPresent,
            read,
          }),
        );
        return { pair, entry, paperPresent, read, states };
      }),
    [payload.docMap, payload.identityValues],
  );

  const allStates = perPair.flatMap((p) => p.states);
  const tally = tallyChecks(allStates);
  const total = allStates.length;
  const nothingSent = perPair.every((p) => !p.paperPresent);

  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: '#6E6A62' }}>
        Four papers. Beside each one, the details it proves — type them, or send the paper and we
        fill them in for you to check. Each line is checked on its own, so you can see exactly what
        is left.
      </p>

      {payload.isVerified && nothingSent ? (
        <p
          className="rounded-lg border-l-[3px] p-3 text-xs"
          style={{
            borderColor: 'var(--m-orange)',
            background: 'var(--m-orange-4)',
            color: 'var(--m-ink)',
          }}
        >
          {VERIFIED_WITHOUT_PAPERS_BANNER}
        </p>
      ) : null}

      <Tally tally={tally} total={total} nothingSent={nothingSent} />

      <ol className="space-y-3">
        {perPair.map(({ pair, entry, paperPresent, read, states }) => (
          <li key={pair.slotKey}>
            <PairCard
              pair={pair}
              entry={entry}
              paperPresent={paperPresent}
              read={read}
              states={states}
              identityValues={payload.identityValues}
              isVerified={payload.isVerified}
              seedDisplayUrls={payload.seedDisplayUrls}
              vendorProfileId={vendorProfileId}
              registrationNumberRaw={payload.registrationNumberRaw}
              registrationNumberNeedsReview={payload.registrationNumberNeedsReview}
              locked={locked}
              onSaved={onSaved}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Tally({
  tally,
  total,
  nothingSent,
}: {
  tally: Record<TallyBucket, number>;
  total: number;
  nothingSent: boolean;
}) {
  const order: TallyBucket[] = ['matched', 'to_fix', 'with_person', 'not_yet'];
  const toneOf: Record<TallyBucket, Tone> = {
    matched: 'ok',
    to_fix: 'warn',
    with_person: 'wait',
    not_yet: 'none',
  };
  return (
    <div className="space-y-1.5">
      <p className="text-xs tabular-nums" style={{ color: '#6E6A62' }} aria-live="polite">
        {nothingSent && tally.matched === 0 ? (
          <>
            {tally.matched} of {total} checks · nothing sent yet
          </>
        ) : (
          order
            .filter((b) => tally[b] > 0)
            .map((b) => `${tally[b]} ${TALLY_LABEL[b]}`)
            .join(' · ')
        )}
      </p>
      <div
        className="flex h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--m-line-soft)' }}
        aria-hidden
      >
        {order.map((b) =>
          tally[b] > 0 && b !== 'not_yet' ? (
            <span
              key={b}
              className="block h-full transition-[flex-grow] duration-500 ease-out motion-reduce:transition-none"
              style={{ flexGrow: tally[b], background: TONE_STYLE[toneOf[b]].fg }}
            />
          ) : null,
        )}
        <span style={{ flexGrow: tally.not_yet }} />
      </div>
    </div>
  );
}

/* ── One pair ───────────────────────────────────────────────────────────── */

function PairCard({
  pair,
  entry,
  paperPresent,
  read,
  states,
  identityValues,
  isVerified,
  seedDisplayUrls,
  vendorProfileId,
  registrationNumberRaw,
  registrationNumberNeedsReview,
  locked,
  onSaved,
}: {
  pair: VerificationPair;
  entry: DocUpload | null;
  paperPresent: boolean;
  read: PaperRead | null;
  states: readonly CheckState[];
  identityValues: Record<string, string | null>;
  isVerified: boolean;
  seedDisplayUrls: Record<string, string>;
  vendorProfileId: string;
  registrationNumberRaw: string | null;
  registrationNumberNeedsReview: boolean;
  locked: boolean;
  onSaved: () => void;
}) {
  const headline = pairHeadline(states);
  return (
    <article
      className="overflow-hidden rounded-xl border bg-white"
      style={{ borderColor: 'var(--m-line)' }}
    >
      <div
        className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b p-3.5"
        style={{ borderColor: 'var(--m-line)' }}
      >
        <span
          aria-hidden
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
          style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }}
        >
          {pair.number}
        </span>
        <h4 className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
          {pair.title}
        </h4>
        <Pill tone={headline.tone}>{headline.label}</Pill>
        <p className="w-full text-xs" style={{ color: '#6E6A62' }}>
          {pair.hint}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-3 p-3.5 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.15fr)]">
        {/* ── The paper ── */}
        <div className="space-y-1.5">
          <PaperSide
            pair={pair}
            entry={entry}
            seedDisplayUrls={seedDisplayUrls}
            vendorProfileId={vendorProfileId}
            locked={locked}
            paperPresent={paperPresent}
            onSaved={onSaved}
          />
          {read?.readAs ? (
            <p className="text-xs font-medium" style={{ color: 'var(--m-ink)' }}>
              {read.readAs}
            </p>
          ) : null}
          {read?.notes.map((n) => (
            <p key={n} className="text-xs" style={{ color: '#6E6A62' }}>
              {n}
            </p>
          ))}
          {pair.why ? (
            <p className="text-xs" style={{ color: '#6E6A62' }}>
              {pair.why}
            </p>
          ) : null}
        </div>

        {/* ── The seam that keeps the two halves one unit ── */}
        <p
          aria-hidden
          className="self-center font-mono text-[10px] uppercase tracking-[0.14em]"
          style={{ color: '#6E6A62' }}
        >
          <span className="hidden md:inline">proves →</span>
          <span className="md:hidden">proves ↓</span>
        </p>

        {/* ── The details it proves ── */}
        <div className="space-y-3">
          {pair.fields.map((f, i) => (
            <FieldLine
              key={f.key}
              field={f}
              state={states[i]!}
              typedValue={f.column ? (identityValues[f.column] ?? null) : null}
              onPaper={read?.values[f.key] ?? null}
              isVerified={isVerified}
              registrationNumberRaw={registrationNumberRaw}
              registrationNumberNeedsReview={registrationNumberNeedsReview}
              onSaved={onSaved}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

function PaperSide({
  pair,
  entry,
  seedDisplayUrls,
  vendorProfileId,
  locked,
  paperPresent,
  onSaved,
}: {
  pair: VerificationPair;
  entry: DocUpload | null;
  seedDisplayUrls: Record<string, string>;
  vendorProfileId: string;
  locked: boolean;
  paperPresent: boolean;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();

  if (locked) {
    return (
      <p className="text-xs" style={{ color: paperPresent ? 'var(--m-sage-deep)' : '#6E6A62' }}>
        {paperPresent ? 'Sent — locked while we review.' : 'Not sent.'}
      </p>
    );
  }

  const current =
    entry && typeof entry === 'object' && !Array.isArray(entry) && 'r2_key' in entry
      ? ((entry as { r2_key?: string }).r2_key ?? null)
      : null;

  const save = (ref: string) => {
    start(async () => {
      const fd = new FormData();
      fd.set('slot_key', pair.slotKey);
      fd.set('r2_ref', ref);
      const res = await updateDocUploadInline(null, fd);
      if (res.ok) {
        toast.success(`${pair.title} saved.`);
        onSaved();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-1.5">
      <FileUpload
        bucket="vendor-verification"
        pathPrefix={`vendors/${vendorProfileId}/verification/${pair.slotKey}`}
        name="r2_ref"
        currentValue={current}
        initialDisplayUrls={seedDisplayUrls}
        maxSizeMB={15}
        acceptedTypes={['image/png', 'image/jpeg', 'image/webp', 'application/pdf']}
        variant="wide"
        disabled={pending}
        onChange={(val) => {
          const ref = Array.isArray(val) ? (val[0] ?? '') : (val ?? '');
          save(ref);
        }}
      />
      {pending ? (
        <p className="inline-flex items-center gap-1.5 text-xs" style={{ color: '#6E6A62' }}>
          <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden />
          Saving…
        </p>
      ) : null}
    </div>
  );
}

/* ── One line ───────────────────────────────────────────────────────────── */

function FieldLine({
  field,
  state,
  typedValue,
  onPaper,
  isVerified,
  registrationNumberRaw,
  registrationNumberNeedsReview,
  onSaved,
}: {
  field: PairField;
  state: CheckState;
  typedValue: string | null;
  onPaper: string | null;
  isVerified: boolean;
  registrationNumberRaw: string | null;
  registrationNumberNeedsReview: boolean;
  onSaved: () => void;
}) {
  const lockedKey = pairFieldLockedKey(field, isVerified);

  return (
    <div>
      <span
        className="block font-mono text-[10px] uppercase tracking-[0.12em]"
        style={{ color: '#6E6A62' }}
      >
        {field.label}
      </span>

      {field.column === null ? (
        <>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--m-ink)' }}>
            {field.purpose}
          </p>
          <StatusLine state={state} />
        </>
      ) : lockedKey ? (
        <LockedLine
          lockedKey={lockedKey}
          value={typedValue}
          onPaper={onPaper}
          state={state}
        />
      ) : field.column === 'registration_number_raw' ? (
        <RegistrationNumberLine
          currentRaw={registrationNumberRaw}
          needsReview={registrationNumberNeedsReview}
          state={state}
          onPaper={onPaper}
          onSaved={onSaved}
        />
      ) : (
        <EditableLine
          field={field}
          value={typedValue}
          onPaper={onPaper}
          state={state}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

/**
 * A line the supplier can type. On a mismatch it offers the two exits the
 * drawing specifies and NO third: a free-text box here would let somebody enter
 * a value that matches neither source, which is exactly what the check exists
 * to catch.
 */
function EditableLine({
  field,
  value,
  onPaper,
  state,
  onSaved,
}: {
  field: PairField;
  value: string | null;
  onPaper: string | null;
  state: CheckState;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState(value ?? '');
  const [pending, start] = useTransition();

  const write = (next: string) => {
    start(async () => {
      const fd = new FormData();
      fd.set('column', field.column ?? '');
      fd.set('value', next);
      const res = await saveVerificationIdentityField(null, fd);
      if (res.ok) {
        toast.success(`${field.label} saved.`);
        onSaved();
      } else {
        toast.error(res.error);
      }
    });
  };

  const dirty = draft.trim() !== (value ?? '').trim();

  if (state === 'mismatch' && onPaper) {
    return (
      <>
        <StatusLine state={state} />
        <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <div className="rounded-md border p-2" style={{ borderColor: 'var(--m-line)' }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: '#6E6A62' }}>
              Your profile says
            </p>
            <p className="text-xs" style={{ color: 'var(--m-ink)' }}>
              {value}
            </p>
          </div>
          <div className="rounded-md border-2 p-2" style={{ borderColor: '#7A5E32' }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: '#6E6A62' }}>
              Your paper says
            </p>
            <p className="text-xs" style={{ color: 'var(--m-ink)' }}>
              {onPaper}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setDraft(onPaper);
            write(onPaper);
          }}
          disabled={pending}
          className="button-primary mt-2 h-8 px-3 text-xs disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Use the value on my paper'}
        </button>
      </>
    );
  }

  return (
    <>
      <div className="mt-0.5 flex flex-col gap-1.5 sm:flex-row">
        {field.long ? (
          <textarea
            rows={2}
            value={draft}
            disabled={pending}
            onChange={(e) => setDraft(e.target.value)}
            className="input-field min-w-0 flex-1 text-sm"
            aria-label={field.label}
          />
        ) : (
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            value={draft}
            disabled={pending}
            onChange={(e) => setDraft(e.target.value)}
            className={`input-field h-9 min-w-0 flex-1 text-sm${field.mono ? ' font-mono' : ''}`}
            aria-label={field.label}
          />
        )}
        <button
          type="button"
          onClick={() => write(draft)}
          disabled={pending || !dirty}
          className="button-secondary h-9 shrink-0 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
      <StatusLine state={state} />
    </>
  );
}

/**
 * The registration number, folded into the certificate that carries it (the
 * drawing: two boxes for one number would be the drift the pairs exist to
 * remove). It keeps its OWN writer — the anti-farm uniqueness claim lives in
 * `saveRegistrationNumberInline` and must not get a second copy.
 */
function RegistrationNumberLine({
  currentRaw,
  needsReview,
  state,
  onPaper,
  onSaved,
}: {
  currentRaw: string | null;
  needsReview: boolean;
  state: CheckState;
  onPaper: string | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState(currentRaw ?? '');
  const [flagged, setFlagged] = useState(needsReview);
  const [pending, start] = useTransition();

  const write = (next: string) => {
    start(async () => {
      const fd = new FormData();
      fd.set('registration_number', next);
      const res = await saveRegistrationNumberInline(null, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setFlagged(res.needsReview);
      if (res.needsReview) toast.error(REGISTRATION_NUMBER_TAKEN_MESSAGE);
      else toast.success('Registration number saved.');
      onSaved();
    });
  };

  const dirty = draft.trim() !== (currentRaw ?? '').trim();

  return (
    <>
      <div className="mt-0.5 flex flex-col gap-1.5 sm:flex-row">
        <input
          id="registration_number"
          name="registration_number"
          type="text"
          autoComplete="off"
          value={draft}
          disabled={pending}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. 123-456-789-000"
          className="input-field h-9 min-w-0 flex-1 font-mono text-sm"
          aria-label="Registration number"
        />
        <button
          type="button"
          onClick={() => write(draft)}
          disabled={pending || !dirty || draft.trim().length === 0}
          className="button-secondary h-9 shrink-0 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
      {onPaper && state === 'mismatch' ? (
        <p className="mt-1 text-xs" style={{ color: 'var(--m-ink)' }}>
          Your paper says <span className="font-mono">{onPaper}</span>.
        </p>
      ) : null}
      <StatusLine state={state}>
        {state === 'not_sent' || state === 'typed'
          ? 'This ties your shop to one registered business, so perks can’t be farmed with duplicate accounts.'
          : undefined}
      </StatusLine>
      {flagged ? (
        <p className="mt-1 text-xs" style={{ color: '#7A5E32' }}>
          {REGISTRATION_NUMBER_TAKEN_MESSAGE}
        </p>
      ) : null}
    </>
  );
}

/**
 * A line whose column LOCKS once the shop is verified. It draws no input —
 * `updateVendorProfileField` and `saveVerificationIdentityField` both refuse it
 * through the same `fetchVerifiedLock`, so a box here would be a save that
 * always fails. The shipped correction door is the way through, and the copy
 * says who acts.
 */
function LockedLine({
  lockedKey,
  value,
  onPaper,
  state,
}: {
  lockedKey: LockedIdentityFieldKey;
  value: string | null;
  onPaper: string | null;
  state: CheckState;
}) {
  return (
    <>
      <p className="mt-0.5 text-sm" style={{ color: value ? 'var(--m-ink)' : '#6E6A62' }}>
        {value ?? 'Not filled in yet'}
      </p>
      {onPaper && state === 'mismatch' ? (
        <p className="mt-0.5 text-xs" style={{ color: 'var(--m-ink)' }}>
          Your paper says <strong>{onPaper}</strong>.
        </p>
      ) : null}
      <StatusLine state={state}>
        {state === 'mismatch'
          ? `Your shop is verified, so ${LOCKED_FIELD_LABEL[lockedKey].toLowerCase()} is locked — ask Setnayan to update it below.`
          : undefined}
      </StatusLine>
      <p className="mt-1 text-xs" style={{ color: '#6E6A62' }}>
        Locked while your shop is verified. Ask Setnayan to change it from{' '}
        <strong>Ask Setnayan to correct a detail</strong> further down this page.
      </p>
    </>
  );
}
