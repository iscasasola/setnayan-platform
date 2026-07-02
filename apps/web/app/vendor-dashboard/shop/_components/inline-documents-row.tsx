'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ChevronDown, Loader2 } from 'lucide-react';

import { DocSlotCard } from '@/app/_components/verification/doc-slot-card';
import { FileUpload } from '@/app/_components/file-upload';
import { useToast } from '@/app/_components/toast/toast-provider';
import {
  ADMIN_DOC_SLOTS,
  APPLICATION_STATUS_LABEL,
  VENDOR_DOC_SLOTS,
  isSlotComplete,
  type DocSlot,
  type DocUpload,
  type DocUploadMap,
} from '@/lib/vendor-verification';
import type { BusinessProfileItem } from '@/lib/vendor-profile';
import { Collapsible } from '../../_components/collapsible';
import {
  loadInlineDocs,
  updateDocUploadInline,
  type InlineDocsPayload,
} from '../inline-docs-actions';

/**
 * The Documents item of the My Shop → Profile checklist, expanded inline (owner
 * 2026-07-02: "all 12 verification docs inline"). Collapsed it shows a status +
 * a readable progress sub-line. Expanded it LAZY-loads the vendor's application
 * (so My Shop never presigns doc thumbnails unless opened) and renders the 12
 * slots in two groups — the 8 the vendor uploads (auto-attached on upload) and
 * the 4 Setnayan runs (status only). Submitting for review links out to the
 * verification page (owner-decided). "Complete" = fully verified (all 12).
 */
export function InlineDocumentsRow({
  item,
  vendorProfileId,
  isOpen,
  onOpen,
  onClose,
}: {
  item: BusinessProfileItem;
  vendorProfileId: string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
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

  // Lazy-load on first open (the per-ref R2 presign only runs here).
  const openAndLoad = () => {
    if (!payload && !loading) reload();
    onOpen();
  };

  const subline = item.ok
    ? 'Verified'
    : payload
      ? `${payload.vendorComplete} of ${payload.vendorTotal} of your documents in · Setnayan runs ${ADMIN_DOC_SLOTS.length}`
      : 'Review your verification documents';

  return (
    <li
      className="overflow-hidden rounded-lg border bg-white"
      style={{ borderColor: isOpen ? 'var(--m-orange-3)' : 'var(--m-line)' }}
    >
      <div className="flex items-center gap-3 p-3">
        <span
          aria-hidden
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={
            item.ok
              ? {
                  background: 'color-mix(in srgb, var(--m-sage-deep) 14%, transparent)',
                  color: 'var(--m-sage-deep)',
                }
              : { background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }
          }
        >
          {item.ok ? (
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className="block truncate text-sm"
            style={{ color: item.ok ? 'var(--m-slate)' : 'var(--m-ink)' }}
          >
            {item.label}
          </span>
          <span className="block truncate text-xs" style={{ color: 'var(--m-slate-3)' }}>
            {subline}
          </span>
        </span>
        <button
          type="button"
          onClick={() => (isOpen ? onClose() : openAndLoad())}
          aria-expanded={isOpen}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-terracotta transition-colors hover:bg-[color:var(--m-orange-4)]"
        >
          {isOpen ? 'Close' : 'Review'}
          <ChevronDown
            className={`h-3.5 w-3.5 ${isOpen ? 'rotate-180' : ''}`}
            strokeWidth={2}
            aria-hidden
          />
        </button>
      </div>

      <Collapsible open={isOpen}>
        <div className="border-t px-3 pb-4 pt-4" style={{ borderColor: 'var(--m-line)' }}>
          {loading && !payload ? (
            <p
              className="inline-flex items-center gap-2 text-sm"
              style={{ color: 'var(--m-slate)' }}
            >
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
        </div>
      </Collapsible>
    </li>
  );
}

function DocsBody({
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
    <div className="space-y-5">
      {locked ? (
        <p
          className="rounded-lg border border-dashed p-3 text-xs"
          style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
        >
          Your application is{' '}
          <strong>{payload.status ? APPLICATION_STATUS_LABEL[payload.status] : 'submitted'}</strong>
          , so documents are locked.{' '}
          <Link href="/vendor-dashboard/verify" className="font-medium text-terracotta hover:underline">
            View on the verification page
          </Link>
          .
        </p>
      ) : null}

      <section className="space-y-2">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--m-slate-3)' }}>
          Your documents ({VENDOR_DOC_SLOTS.length})
        </h3>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {VENDOR_DOC_SLOTS.map((slot) => (
            <li key={slot.key}>
              <DocSlotCard slot={slot} complete={isSlotComplete(slot.key, payload.docMap[slot.key])}>
                {locked ? (
                  <LockedNote complete={isSlotComplete(slot.key, payload.docMap[slot.key])} />
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
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--m-slate-3)' }}>
          Setnayan handles ({ADMIN_DOC_SLOTS.length})
        </h3>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ADMIN_DOC_SLOTS.map((slot) => (
            <li key={slot.key}>
              <DocSlotCard slot={slot} complete={isSlotComplete(slot.key, payload.docMap[slot.key])}>
                <p
                  className="rounded-md border border-dashed px-3 py-2 text-xs"
                  style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
                >
                  {slot.hint}
                </p>
              </DocSlotCard>
            </li>
          ))}
        </ul>
      </section>

      <Link
        href="/vendor-dashboard/verify"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:underline"
      >
        {payload.vendorComplete >= payload.vendorTotal
          ? 'Submit for verification on the verification page'
          : 'Open the full verification page'}
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </Link>
    </div>
  );
}

function LockedNote({ complete }: { complete: boolean }) {
  return (
    <p className="text-xs" style={{ color: complete ? 'var(--m-sage-deep)' : 'var(--m-slate-3)' }}>
      {complete ? 'Submitted' : 'Not submitted'}
    </p>
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
