'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';

import { DocSlotCard } from '@/app/_components/verification/doc-slot-card';
import { FileUpload } from '@/app/_components/file-upload';
import { useToast } from '@/app/_components/toast/toast-provider';
import {
  APPLICATION_STATUS_LABEL,
  REQUIRED_DOC_SLOT_KEYS,
  VENDOR_DOC_SLOTS,
  isSlotComplete,
  type DocSlot,
  type DocUpload,
} from '@/lib/vendor-verification';
import { updateDocUploadInline, type InlineDocsPayload } from '../inline-docs-actions';

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

  const save = (fields: { r2Ref?: string; url?: string }) => {
    start(async () => {
      const fd = new FormData();
      fd.set('slot_key', slot.key);
      if (fields.r2Ref !== undefined) fd.set('r2_ref', fields.r2Ref);
      if (fields.url !== undefined) fd.set('url', fields.url);
      const res = await updateDocUploadInline(null, fd);
      if (res.ok) {
        toast.success(`${slot.label} saved.`);
        onSaved();
      } else {
        toast.error(res.error);
      }
    });
  };

  if (slot.key === 'social_media') {
    const currentUrl =
      current && typeof current === 'object' && !Array.isArray(current) && 'url' in current
        ? String((current as { url?: string }).url ?? '')
        : '';
    return (
      <SocialUrlInput defaultUrl={currentUrl} pending={pending} onSave={(url) => save({ url })} />
    );
  }

  const multiple = slot.key === 'portfolio_samples' || slot.key === 'client_references';
  const accept =
    slot.key === 'portfolio_samples'
      ? ['image/png', 'image/jpeg', 'image/webp']
      : ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
  const seedValue = currentR2Refs(current);

  return (
    <div className="space-y-1.5">
      <FileUpload
        bucket="vendor-verification"
        pathPrefix={`vendors/${vendorProfileId}/verification/${slot.key}`}
        name="r2_ref"
        currentValue={multiple ? seedValue : (seedValue[0] ?? null)}
        initialDisplayUrls={seedDisplayUrls}
        multiple={multiple}
        maxFiles={multiple ? 10 : undefined}
        maxSizeMB={15}
        acceptedTypes={accept}
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

function SocialUrlInput({
  defaultUrl,
  pending,
  onSave,
}: {
  defaultUrl: string;
  pending: boolean;
  onSave: (url: string) => void;
}) {
  const [url, setUrl] = useState(defaultUrl);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        type="url"
        inputMode="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://instagram.com/your-brand"
        className="input-field h-9 flex-1 text-sm"
      />
      <button
        type="button"
        onClick={() => onSave(url.trim())}
        disabled={pending || url.trim() === defaultUrl.trim()}
        className="button-secondary h-9 shrink-0 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save link'}
      </button>
    </div>
  );
}

/** Extract the stored R2 ref(s) for a file slot from its doc_uploads entry. */
function currentR2Refs(entry: DocUpload | null): string[] {
  if (!entry) return [];
  if (Array.isArray(entry)) {
    return entry.map((e) => e?.r2_key).filter((k): k is string => typeof k === 'string');
  }
  if (typeof entry === 'object' && 'r2_key' in entry && typeof entry.r2_key === 'string') {
    return [entry.r2_key];
  }
  return [];
}

