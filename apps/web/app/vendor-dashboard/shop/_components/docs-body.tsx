'use client';

import { useMemo, useState, useTransition } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';

import { DocSlotCard } from '@/app/_components/verification/doc-slot-card';
import { FileUpload } from '@/app/_components/file-upload';
import { useToast } from '@/app/_components/toast/toast-provider';
import {
  APPLICATION_STATUS_LABEL,
  CLIENT_REFERENCES_MAX,
  PORTFOLIO_MAX,
  REQUIRED_DOC_SLOT_KEYS,
  SOCIAL_PLATFORMS,
  VENDOR_DOC_SLOTS,
  emptyClientReference,
  isFilledReference,
  isSlotComplete,
  parseClientReferences,
  parsePortfolioRefs,
  parseSocialLinks,
  type ClientReference,
  type DocSlot,
  type DocUpload,
} from '@/lib/vendor-verification';
import { updateDocUploadInline, type InlineDocsPayload } from '../inline-docs-actions';
import { useSaveLoader } from '@/components/sd-loader';

/**
 * Step 1 of the Get-verified stepper — the vendor's own document uploads.
 * Extracted 2026-07-03 from the retired `inline-documents-row.tsx` when
 * verification lifted out of the Profile checklist into its own section. The
 * Setnayan-run cards are GONE (owner: "we do not need this"): post-prune the
 * only non-upload slot is the Google Meet, which renders as Step 3 of the
 * stepper, never as a document card. Each upload auto-saves via
 * `updateDocUploadInline`; the 4 REQUIRED docs carry a "Required" chip.
 */
export function DocsBody({
  payload,
  vendorProfileId,
  onSaved,
}: {
  payload: InlineDocsPayload;
  vendorProfileId: string;
  onSaved: () => void;
}) {
  const locked = !payload.editable;
  return (
    <div className="space-y-4">
      {locked ? (
        <p
          className="rounded-lg border border-dashed p-3 text-xs"
          style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
        >
          Your application is{' '}
          <strong>{payload.status ? APPLICATION_STATUS_LABEL[payload.status] : 'submitted'}</strong>
          , so documents are locked while we review.
        </p>
      ) : null}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {VENDOR_DOC_SLOTS.map((slot) => {
          const complete = isSlotComplete(slot.key, payload.docMap[slot.key]);
          return (
            <li key={slot.key}>
              <DocSlotCard slot={slot} complete={complete}>
                <p
                  className="font-mono text-[10px] uppercase tracking-[0.15em]"
                  style={{ color: 'var(--m-slate-3)' }}
                >
                  {REQUIRED_DOC_SLOT_KEYS.has(slot.key) ? 'Required' : 'Optional'}
                </p>
                {locked ? (
                  <p className="text-xs" style={{ color: complete ? 'var(--m-sage-deep)' : 'var(--m-slate-3)' }}>
                    {complete ? 'Submitted' : 'Not submitted'}
                  </p>
                ) : (
                  <VendorSlotInput
                    slot={slot}
                    current={payload.docMap[slot.key] ?? null}
                    seedDisplayUrls={payload.seedDisplayUrls}
                    vendorProfileId={vendorProfileId}
                    onSaved={onSaved}
                  />
                )}
              </DocSlotCard>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The vendor-actionable input for one upload/URL slot — auto-saves on upload. */
function VendorSlotInput({
  slot,
  current,
  seedDisplayUrls,
  vendorProfileId,
  onSaved,
}: {
  slot: DocSlot;
  current: DocUpload | null;
  seedDisplayUrls: Record<string, string>;
  vendorProfileId: string;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const saveLoader = useSaveLoader();

  const save = (fields: {
    r2Ref?: string;
    url?: string;
    referencesJson?: string;
    socialJson?: string;
    portfolioJson?: string;
  }) => {
    start(async () => {
      const fd = new FormData();
      fd.set('slot_key', slot.key);
      if (fields.r2Ref !== undefined) fd.set('r2_ref', fields.r2Ref);
      if (fields.url !== undefined) fd.set('url', fields.url);
      if (fields.referencesJson !== undefined) fd.set('references_json', fields.referencesJson);
      if (fields.socialJson !== undefined) fd.set('social_json', fields.socialJson);
      if (fields.portfolioJson !== undefined) fd.set('portfolio_json', fields.portfolioJson);
      const res = await saveLoader.run(() => updateDocUploadInline(null, fd), {
        steps: ['Saving the document'],
        hint: 'Saving',
      });
      if (res.ok) {
        toast.success(`${slot.label} saved.`);
        onSaved();
      } else {
        toast.error(res.error);
      }
    });
  };

  // ── Social media — 9 labeled platform inputs (owner 2026-07-03). ──────────
  if (slot.key === 'social_media') {
    return (
      <SocialLinksInput
        current={current}
        pending={pending}
        onSave={(map) => save({ socialJson: JSON.stringify(map) })}
      />
    );
  }

  // ── Client references — structured repeater (name·contact·event·date). ────
  if (slot.key === 'client_references') {
    return (
      <ClientReferencesInput
        current={current}
        pending={pending}
        onSave={(refs) => save({ referencesJson: JSON.stringify(refs) })}
      />
    );
  }

  // ── Portfolio — a multi-file photo grid that persists the FULL array. ─────
  if (slot.key === 'portfolio_samples') {
    const seedValue = parsePortfolioRefs(current);
    return (
      <div className="space-y-1.5">
        <FileUpload
          bucket="vendor-verification"
          pathPrefix={`vendors/${vendorProfileId}/verification/${slot.key}`}
          name="r2_ref"
          currentValue={seedValue}
          initialDisplayUrls={seedDisplayUrls}
          multiple
          maxFiles={PORTFOLIO_MAX}
          maxSizeMB={15}
          acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
          variant="wide"
          disabled={pending}
          qrGuard
          onChange={(val) => {
            const refs = Array.isArray(val) ? val : val ? [val] : [];
            // Persist the WHOLE set — the old inline flow saved only refs[0].
            save({ portfolioJson: JSON.stringify(refs) });
          }}
        />
        <p className="text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
          {seedValue.length}/{PORTFOLIO_MAX} photos added
          {pending ? ' · saving…' : ''}
        </p>
      </div>
    );
  }

  // ── Every remaining upload slot — a single file. ──────────────────────────
  const seedValue = parsePortfolioRefs(current);
  return (
    <div className="space-y-1.5">
      <FileUpload
        bucket="vendor-verification"
        pathPrefix={`vendors/${vendorProfileId}/verification/${slot.key}`}
        name="r2_ref"
        currentValue={seedValue[0] ?? null}
        initialDisplayUrls={seedDisplayUrls}
        maxSizeMB={15}
        acceptedTypes={['image/png', 'image/jpeg', 'image/webp', 'application/pdf']}
        variant="wide"
        disabled={pending}
        onChange={(val) => {
          const ref = Array.isArray(val) ? (val[0] ?? '') : (val ?? '');
          save({ r2Ref: ref });
        }}
      />
      {pending ? (
        <p className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--m-slate-3)' }}>
          <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden />
          Saving…
        </p>
      ) : null}
    </div>
  );
}

/**
 * Social media — one labeled input per platform (Website · Facebook · … ·
 * Telegram, `SOCIAL_PLATFORMS`). Reads legacy `{ url }` values via
 * `parseSocialLinks` (mapped onto their detected platform). All optional; the
 * "Save links" button is dirty-gated against the seeded map.
 */
function SocialLinksInput({
  current,
  pending,
  onSave,
}: {
  current: DocUpload | null;
  pending: boolean;
  onSave: (map: Record<string, string>) => void;
}) {
  const seed = useMemo(() => parseSocialLinks(current), [current]);
  const [links, setLinks] = useState<Record<string, string>>(seed);

  const trimmed = (m: Record<string, string>): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const p of SOCIAL_PLATFORMS) {
      const v = (m[p.key] ?? '').trim();
      if (v) out[p.key] = v;
    }
    return out;
  };
  const dirty = JSON.stringify(trimmed(links)) !== JSON.stringify(trimmed(seed));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SOCIAL_PLATFORMS.map((p) => (
          <label key={p.key} className="block space-y-1">
            <span
              className="font-mono text-[10px] uppercase tracking-[0.12em]"
              style={{ color: 'var(--m-slate-3)' }}
            >
              {p.label}
            </span>
            <input
              type={p.kind === 'url' ? 'url' : 'text'}
              inputMode={p.kind === 'url' ? 'url' : p.kind === 'phone' ? 'tel' : 'text'}
              value={links[p.key] ?? ''}
              onChange={(e) => setLinks((prev) => ({ ...prev, [p.key]: e.target.value }))}
              placeholder={p.placeholder}
              className="input-field h-9 w-full text-sm"
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onSave(trimmed(links))}
        disabled={pending || !dirty}
        className="button-secondary h-9 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save links'}
      </button>
    </div>
  );
}

/**
 * Client references — a structured repeater. Each row carries name · contact
 * number · event · date. A fresh blank row auto-appears once the last row is
 * filled (name + contact), up to `CLIENT_REFERENCES_MAX`. The "Save
 * references" button is dirty-gated against the seeded set.
 */
function ClientReferencesInput({
  current,
  pending,
  onSave,
}: {
  current: DocUpload | null;
  pending: boolean;
  onSave: (refs: ClientReference[]) => void;
}) {
  const seed = useMemo(() => {
    const parsed = parseClientReferences(current);
    return parsed.length > 0 ? parsed : [emptyClientReference()];
  }, [current]);
  const [rows, setRows] = useState<ClientReference[]>(seed);

  // Auto-open one blank row when the last row is filled and we're under the cap.
  const withTrailingBlank = (list: ClientReference[]): ClientReference[] => {
    const last = list[list.length - 1];
    if (list.length < CLIENT_REFERENCES_MAX && (list.length === 0 || isFilledReference(last))) {
      return [...list, emptyClientReference()];
    }
    return list;
  };

  const update = (idx: number, patch: Partial<ClientReference>) => {
    setRows((prev) => {
      const next = prev.map((r, i) => (i === idx ? { ...r, ...patch } : r));
      return withTrailingBlank(next);
    });
  };
  const removeRow = (idx: number) => {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length === 0 ? [emptyClientReference()] : next;
    });
  };

  const filled = rows.filter(isFilledReference);
  const seedFilled = seed.filter(isFilledReference);
  const dirty = JSON.stringify(filled) !== JSON.stringify(seedFilled);

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {rows.map((row, idx) => (
          <li
            key={idx}
            className="space-y-2 rounded-lg border p-2.5"
            style={{ borderColor: 'var(--m-line)' }}
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className="font-mono text-[10px] uppercase tracking-[0.12em]"
                style={{ color: 'var(--m-slate-3)' }}
              >
                Reference {idx + 1}
              </span>
              {rows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  aria-label={`Remove reference ${idx + 1}`}
                  className="rounded p-0.5 text-ink/45 hover:text-danger-700"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={row.name}
                onChange={(e) => update(idx, { name: e.target.value })}
                placeholder="Client name"
                className="input-field h-9 w-full text-sm"
              />
              <input
                type="tel"
                inputMode="tel"
                value={row.contact_number}
                onChange={(e) => update(idx, { contact_number: e.target.value })}
                placeholder="Contact number"
                className="input-field h-9 w-full text-sm"
              />
              <input
                type="text"
                value={row.event}
                onChange={(e) => update(idx, { event: e.target.value })}
                placeholder="Event (e.g. Reyes–Cruz wedding)"
                className="input-field h-9 w-full text-sm"
              />
              <input
                type="date"
                value={row.date}
                onChange={(e) => update(idx, { date: e.target.value })}
                className="input-field h-9 w-full text-sm"
              />
            </div>
          </li>
        ))}
      </ul>
      {rows.length < CLIENT_REFERENCES_MAX && rows.every(isFilledReference) ? (
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, emptyClientReference()])}
          className="inline-flex items-center gap-1 text-xs text-ink/65 hover:text-ink"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          Add another reference
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onSave(filled)}
        disabled={pending || !dirty}
        className="button-secondary h-9 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save references'}
      </button>
    </div>
  );
}


