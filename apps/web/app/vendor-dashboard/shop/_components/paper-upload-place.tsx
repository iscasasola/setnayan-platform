'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Check, Clock, Loader2, Minus, UserRound } from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import { TypedRow } from '@/app/_components/form-row';
import { useToast } from '@/app/_components/toast/toast-provider';
import { CityPin } from '@/app/open-shop/_components/city-pin';
import { VERIFY_DOCS_ANCHOR } from '../../_components/get-verified-line';
import { formatLongDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-number';
import {
  saveVerificationIdentityField,
  updateDocUploadInline,
  type InlineDocsPayload,
} from '../inline-docs-actions';
import { MAX_TRIES } from '@/lib/paper-intake-shared';
import type { IntakeReport, IntakeSlot } from '@/lib/paper-intake';
import type { ModelPaperRead, ReadableSlotKey } from '@/lib/verification-paper-read';

/**
 * THE ONE UPLOAD PLACE — the supplier's half of "Getting verified: three papers,
 * one Submit" (approved design v10, Setnayan-specs `prototypes/
 * supplier_verification_docs_2026-11-14_fable.html`, §2).
 *
 * Owner rulings 2026-11-14 it draws:
 *   · "Please upload your 3 documents here." — ONE button, 1–3 files, any order;
 *     the app tells which paper each is (`lib/paper-intake.ts`).
 *   · What was read is filled in READ-ONLY. "If any of it is wrong, the fix is a
 *     clearer copy, never typing over it."
 *   · Only clean files are kept; up to three tries per paper; on the third the
 *     supplier types the details and that paper reads "A person will check this".
 *   · The permit's address becomes the pin, through the SHIPPED pin card
 *     (`CityPin`, "Is this your address?"); nothing is written until "Yes".
 *
 * ⛔ Nothing here decides anything. It shows what the server filed; the checks
 * run on the server, on sealed reads, when Submit is pressed.
 */

const ROWS: ReadonlyArray<{ slot: ReadableSlotKey; title: string; hint: string }> = [
  { slot: 'dti_certificate', title: 'DTI or SEC', hint: 'Your DTI certificate or SEC registration — either one' },
  { slot: 'bir_2303', title: 'BIR 2303', hint: 'BIR Certificate of Registration, Form 2303' },
  { slot: 'mayors_permit', title: 'Business Permit', hint: 'This year’s Mayor’s / Business Permit' },
];

/** The typed form after three tries — one date for a BIR 2303, which has no end date. */
const TYPED_FIELDS: Record<ReadableSlotKey, ReadonlyArray<{ key: string; label: string }>> = {
  dti_certificate: [
    { key: 'registered_business_name', label: 'Registered name' },
    { key: 'registration_number_raw', label: 'Registration number' },
    { key: 'valid_until', label: 'Valid until' },
  ],
  bir_2303: [
    { key: 'registered_business_name', label: 'Registered name' },
    { key: 'tin_number', label: 'TIN' },
    { key: 'registered_address', label: 'Registered address' },
    { key: 'date_registered', label: 'Date registered' },
  ],
  mayors_permit: [
    { key: 'registered_business_name', label: 'Business name' },
    { key: 'permit_number', label: 'Permit no.' },
    { key: 'permit_address', label: 'Address' },
    { key: 'valid_until', label: 'Valid until' },
  ],
};

const MUTE = '#6E6A62';

function asSlot(v: unknown): IntakeSlot | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as IntakeSlot;
  return { ...o, attempts: typeof o.attempts === 'number' ? o.attempts : 0 };
}

function fileName(ref: string): string {
  const last = ref.split('/').pop() ?? ref;
  // Upload keys carry a uuid prefix — show the name the person chose when we can.
  return last.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[-_]?/i, '') || last;
}

function addressOf(m: ModelPaperRead): string | null {
  return [m.address, m.barangay && !(m.address ?? '').toLowerCase().includes(m.barangay.toLowerCase()) ? `Brgy. ${m.barangay}` : null, m.city && !(m.address ?? '').toLowerCase().includes(m.city.toLowerCase()) ? m.city : null]
    .filter(Boolean)
    .join(', ') || null;
}

/** "Read ✓ · DTI 3456789" — the one-line summary of a read paper. */
function readSummary(slot: ReadableSlotKey, m: ModelPaperRead): string {
  if (slot === 'dti_certificate') return `Read ✓ · ${m.registry === 'sec' ? 'SEC' : 'DTI'} ${m.registrationNumber ?? ''}`.trim();
  if (slot === 'bir_2303') return `Read ✓ · TIN ${m.registrationNumber ?? ''}`.trim();
  return `Read ✓ · Permit ${m.registrationNumber ?? ''}`.trim();
}

/** The read values, read-only, in the design's order. */
function readLines(slot: ReadableSlotKey, m: ModelPaperRead): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const name = m.accountName ?? m.ownerName;
  if (name) out.push(['Name', name]);
  if (m.registrationNumber) {
    out.push([
      slot === 'dti_certificate' ? (m.registry === 'sec' ? 'SEC no.' : 'DTI no.') : slot === 'bir_2303' ? 'TIN' : 'Permit no.',
      m.registrationNumber,
    ]);
  }
  const addr = addressOf(m);
  if (addr) out.push(['Address', addr]);
  if (m.expirationDate) out.push(['Valid', `until ${formatLongDate(m.expirationDate)}`]);
  else if (slot === 'bir_2303') out.push(['Valid', 'No expiry date']);
  return out;
}

/** What a report line adds under the file name. */
function reportTail(r: IntakeReport): string {
  switch (r.outcome) {
    case 'unreadable':
    case 'file_refused':
      return 'not kept';
    case 'tries_used_kept':
      return 'try 3 · kept';
    case 'read_ok':
      return 'read';
    default:
      return 'Not counted as a try.';
  }
}

export function PaperUploadPlace({
  payload,
  vendorProfileId,
  isVerified,
  onSaved,
}: {
  payload: InlineDocsPayload;
  vendorProfileId: string;
  /** From the page's one authoritative read, threaded down — never a probe here. */
  isVerified: boolean;
  onSaved: () => void;
}) {
  const toast = useToast();
  const locked = !payload.editable;
  const [pending, start] = useTransition();
  const [checking, setChecking] = useState(0);
  const [reports, setReports] = useState<IntakeReport[]>([]);
  const [pickerKey, setPickerKey] = useState(0);
  const [open, setOpen] = useState<ReadableSlotKey | null>(null);

  const slots = useMemo(
    () => Object.fromEntries(ROWS.map((r) => [r.slot, asSlot(payload.docMap[r.slot])])) as Record<ReadableSlotKey, IntakeSlot | null>,
    [payload.docMap],
  );
  const inCount = ROWS.filter((r) => slots[r.slot]?.r2_key).length;
  // 🛡 THE PAPER THAT HOLDS THEM BACK (owner 2026-10-29, v13 note 4 — carried over from the retired pairs): an
  // unverified shop's FIRST missing paper is marked, and [Get verified] (`#docs`) brings it into view.
  const firstMissing = isVerified || locked ? null : (ROWS.find((r) => !slots[r.slot]?.r2_key)?.slot ?? null);
  const firstMissingRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!firstMissing) return;
    const bring = () => {
      if (window.location.hash !== `#${VERIFY_DOCS_ANCHOR}`) return;
      window.setTimeout(() => firstMissingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
    };
    bring();
    window.addEventListener('hashchange', bring);
    return () => window.removeEventListener('hashchange', bring);
  }, [firstMissing]);
  const permit = slots.mayors_permit;
  const proposal = permit?.pin_proposal ?? null;
  const pinConfirmed =
    Boolean(proposal) && (payload.identityValues.registered_address ?? '').trim() === (permit?.evidence?.model?.address ?? proposal?.address ?? '').trim();

  const send = (refs: string[]) => {
    if (refs.length === 0) return;
    setChecking(refs.length);
    start(async () => {
      const fd = new FormData();
      fd.set('intent', 'intake');
      fd.set('r2_refs', JSON.stringify(refs));
      const res = await updateDocUploadInline(null, fd);
      setChecking(0);
      setPickerKey((k) => k + 1);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setReports(res.reports ?? []);
      onSaved();
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
        Please upload your 3 documents here.
      </p>

      {locked ? null : (
        <div className="space-y-1.5">
          <FileUpload
            key={pickerKey}
            bucket="vendor-verification"
            pathPrefix={`vendors/${vendorProfileId}/verification/papers`}
            name="r2_refs"
            multiple
            maxFiles={3}
            limitMessage="Pick up to three papers at a time."
            unsavedHint={null}
            currentValue={[]}
            maxSizeMB={15}
            acceptedTypes={['image/png', 'image/jpeg', 'application/pdf']}
            variant="wide"
            label="Upload documents"
            help="Pick 1, 2 or all 3 at once — any order. PDF / JPG / PNG up to 15 MB each."
            disabled={pending}
            onChange={(val) => send(Array.isArray(val) ? val : val ? [val] : [])}
          />
          {pending && checking > 0 ? (
            <p className="inline-flex items-center gap-1.5 text-sm" role="status" style={{ color: 'var(--m-ink)' }}>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
              Checking {checking} {checking === 1 ? 'paper' : 'papers'}…
              <span className="text-xs" style={{ color: MUTE }}>
                Each one ticks as soon as we know what it is.
              </span>
            </p>
          ) : null}
        </div>
      )}

      {reports.length > 0 ? (
        <ul className="space-y-1.5" aria-live="polite">
          {reports.map((r, i) => (
            <li
              key={`${r.r2Key}-${r.page ?? 'x'}-${i}`}
              className="rounded-lg px-3 py-2 text-xs"
              style={{
                background: r.outcome === 'read_ok' || r.outcome === 'replaced' ? 'var(--m-paper-2, #FAF8F4)' : 'var(--m-orange-4)',
                color: 'var(--m-ink)',
              }}
            >
              <span className="font-medium">{r.message}</span>
              <span className="block" style={{ color: MUTE }}>
                {fileName(r.r2Key)}
                {r.page !== null ? ` · page ${r.page + 1}` : ''} · {reportTail(r)}
                {r.outcome === 'unreadable' && (r.attempts ?? 0) === 1 ? ' Lay the paper flat, in good light, all four corners in.' : ''}
                {r.outcome === 'unreadable' && (r.attempts ?? 0) === 2 ? ' A scan or the PDF from your email works best.' : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
          Your three papers
        </h4>
        <span className="text-xs tabular-nums" style={{ color: MUTE }}>
          {formatCount(inCount)} of 3
        </span>
      </div>

      <ol className="divide-y" style={{ borderColor: 'var(--m-line)' }}>
        {ROWS.map((row) => {
          const s = slots[row.slot];
          const model = s?.evidence?.model ?? null;
          const isOpen = open === row.slot;
          let status: { icon: 'ok' | 'wait' | 'person' | 'none'; text: string };
          if (s?.r2_key && s.manual) status = { icon: 'person', text: 'A person will check this' };
          else if (s?.r2_key && model) status = { icon: 'ok', text: readSummary(row.slot, model) };
          else if (s && s.attempts > 0)
            status = {
              icon: 'wait',
              text: `Not read yet · Try ${formatCount(Math.min(s.attempts + 1, MAX_TRIES))} of ${formatCount(MAX_TRIES)}${s.attempts + 1 >= MAX_TRIES ? ' · last one' : ''}`,
            };
          else if (pending && checking > 0) status = { icon: 'wait', text: 'Checking…' };
          else status = { icon: 'none', text: 'Not uploaded yet' };

          return (
            <li
              key={row.slot}
              ref={row.slot === firstMissing ? firstMissingRef : undefined}
              data-first-missing={row.slot === firstMissing ? '' : undefined}
              className={`bg-[color:var(--m-paper)] p-3${row.slot === firstMissing ? ' scroll-mt-24 ring-2 ring-[color:var(--m-orange)]' : ''}`}
              style={{ borderColor: 'var(--m-line)' }}
            >
              {row.slot === firstMissing ? (
                <p className="mb-1.5 text-xs font-medium" style={{ color: 'var(--m-orange-deep)' }}>
                  Start here
                </p>
              ) : null}
              <button
                type="button"
                className="flex w-full min-h-[44px] items-start gap-3 text-left"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : row.slot)}
                disabled={!s?.r2_key}
              >
                <StatusIcon kind={status.icon} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                    {row.title}
                  </span>
                  <span className="block text-xs" style={{ color: status.icon === 'ok' ? 'var(--m-sage-deep)' : MUTE }}>
                    {status.text}
                  </span>
                  {status.icon === 'none' ? (
                    <span className="block text-xs" style={{ color: MUTE }}>
                      {row.hint}
                    </span>
                  ) : null}
                </span>
              </button>

              {s?.r2_key && model && !s.manual && (isOpen || inCount < 3) ? (
                <div className="mt-2 space-y-1 pl-9">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                    {readLines(row.slot, model).map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt style={{ color: MUTE }}>{k}</dt>
                        <dd className="break-words" style={{ color: 'var(--m-ink)' }}>
                          {v}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {locked ? null : (
                    <p className="text-xs" style={{ color: MUTE }}>
                      Something wrong? Upload a clearer copy
                    </p>
                  )}
                </div>
              ) : null}

              {s?.r2_key && s.manual ? (
                <TypedForm slot={row.slot} typed={s.typed ?? null} locked={locked} fileRef={s.r2_key} onSaved={onSaved} />
              ) : null}
            </li>
          );
        })}
      </ol>

      {proposal && !pinConfirmed && !locked ? (
        <PermitPin
          address={permit?.evidence?.model?.address ?? proposal.address}
          city={proposal.city ?? permit?.evidence?.model?.city ?? ''}
          onSaved={onSaved}
        />
      ) : null}

      <p className="text-xs" style={{ color: MUTE }}>
        Kept private — only Setnayan sees your papers.
      </p>
    </div>
  );
}

function StatusIcon({ kind }: { kind: 'ok' | 'wait' | 'person' | 'none' }) {
  const style =
    kind === 'ok'
      ? { background: 'var(--m-sage-4, #E6F0E9)', color: 'var(--m-sage-deep)' }
      : kind === 'wait'
        ? { background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }
        : kind === 'person'
          ? { background: '#EEF1F5', color: '#3B4E67' }
          : { background: '#F1F0EE', color: MUTE };
  const Icon = kind === 'ok' ? Check : kind === 'wait' ? Clock : kind === 'person' ? UserRound : Minus;
  return (
    <span aria-hidden className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={style}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
    </span>
  );
}

/** After the third unclear try: type what the paper says; a person compares it by hand. */
function TypedForm({
  slot,
  typed,
  locked,
  fileRef,
  onSaved,
}: {
  slot: ReadableSlotKey;
  typed: Record<string, string> | null;
  locked: boolean;
  fileRef: string;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(typed ?? {});
  const saved = typed && Object.keys(typed).length > 0;

  return (
    <div className="mt-2 space-y-2 pl-9">
      <p className="text-xs" style={{ color: MUTE }}>
        {fileName(fileRef)} · try 3 · kept
      </p>
      <p className="text-xs" style={{ color: 'var(--m-ink)' }}>
        We couldn’t read it after three tries. Type what the paper says and we’ll compare it by hand.
      </p>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const fd = new FormData();
            fd.set('intent', 'typed');
            fd.set('slot_key', slot);
            fd.set('typed_json', JSON.stringify(values));
            const res = await updateDocUploadInline(null, fd);
            if (res.ok) {
              toast.success('Saved — a person will check this.');
              onSaved();
            } else {
              toast.error(res.error);
            }
          });
        }}
      >
        {TYPED_FIELDS[slot].map((f) =>
          locked ? (
            <p key={f.key} className="text-xs" style={{ color: 'var(--m-ink)' }}>
              <span style={{ color: MUTE }}>{f.label}</span> {values[f.key] ?? '—'}
            </p>
          ) : (
            <TypedRow
              key={f.key}
              name={f.label}
              value={values[f.key] ?? ''}
              boxed
              onKeep={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
            />
          ),
        )}
        {slot === 'bir_2303' ? (
          <p className="text-xs" style={{ color: MUTE }}>
            A BIR 2303 has no end date, so there is one date here.
          </p>
        ) : null}
        {locked ? null : (
          <button type="submit" className="button-primary h-11 px-4 text-sm" disabled={pending}>
            {pending ? 'Saving…' : saved ? 'Save changes' : 'Save these details'}
          </button>
        )}
      </form>
    </div>
  );
}

/**
 * The permit locates the shop — the SHIPPED pin card ("Is this your address?"),
 * opened at the address read from the permit. "Yes, that's right" is the only
 * thing that writes the pin; the address saved is the permit's own words.
 */
function PermitPin({ address, city, onSaved }: { address: string; city: string; onSaved: () => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirmedCity, setConfirmedCity] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // One tap confirms (design v10 §2): "Yes, that's right" in the pin card saves the place.
  useEffect(() => {
    if (confirmedCity) formRef.current?.requestSubmit();
  }, [confirmedCity]);
  return (
    <form
      ref={formRef}
      className="space-y-2 pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        // Enter in the address box is not a "Yes" — only the pin card's answer saves.
        if (!confirmedCity) return;
        const fd = new FormData(e.currentTarget);
        fd.set('intent', 'confirm_permit_pin');
        start(async () => {
          const res = await saveVerificationIdentityField(null, fd);
          if (res.ok) {
            toast.success('Your place is set from your permit.');
            onSaved();
          } else {
            toast.error(res.error);
          }
        });
      }}
    >
      <p className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
        Your place
      </p>
      <p className="text-xs" style={{ color: MUTE }}>
        From your permit
      </p>
      <CityPin defaultAddress={address} defaultCity={city} onConfirmedChange={setConfirmedCity} />
      <p className="text-xs" style={{ color: MUTE }}>
        {pending ? 'Saving your place…' : 'Not quite? Drag the pin.'}
      </p>
    </form>
  );
}
