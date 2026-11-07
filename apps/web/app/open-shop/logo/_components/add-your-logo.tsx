'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { FileUpload } from '@/app/_components/file-upload';
import { FirstRunBrand } from '@/app/_components/first-run-brand';
import { LogoFrameControl } from '@/app/_components/logo-frame-control';
import { SubmitButton } from '@/app/_components/submit-button';
import { updateVendorProfileField, type FieldSaveResult } from '@/app/vendor-dashboard/actions';
import { DEFAULT_LOGO_FRAME, type LogoFrame } from '@/lib/open-shop-logo';
import { LOGO_LATER } from '@/lib/open-shop-validation';

/**
 * "Add your logo" — one screen, right after the shop opens (owner, the 2026-11-06 gate walk, A2): the round preview,
 * the Event Hub Maker photo control (align + zoom), and Skip. Saves with My Shop's own logo save, so the logo and its
 * frame have one writer. Done or skipped, the next stop is Today.
 */
export function AddYourLogo({
  vendorProfileId,
  shopName,
  storedLogoRef: logoUrl,
  displayUrl,
  frame: savedFrame,
}: {
  vendorProfileId: string;
  shopName: string;
  /** The stored `r2://` ref — a FORM value posted back, never rendered (the picture is `displayUrl`). */
  storedLogoRef: string | null;
  displayUrl: string | null;
  frame: LogoFrame;
}) {
  const router = useRouter();
  const [ref, setRef] = useState<string>(logoUrl ?? '');
  const [preview, setPreview] = useState<string | null>(displayUrl);
  const [frame, setFrame] = useState<LogoFrame>(savedFrame ?? DEFAULT_LOGO_FRAME);
  const [state, save] = useActionState<FieldSaveResult | null, FormData>(updateVendorProfileField, null);
  useEffect(() => {
    // Success is the action's answer, never the click (the SignInCard rule).
    if (state?.ok) router.push('/vendor-dashboard');
  }, [state, router]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div
        className="w-full max-w-lg p-1 sm:p-2"
        data-open-shop-logo=""
      >
        <FirstRunBrand className="mb-4" color="var(--m-ink)" size={13} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--m-ink)' }}>
          Add your logo
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--m-slate)' }}>
          {shopName} is open. Couples see your logo on every supplier card.
        </p>
        {state && !state.ok ? (
          <p
            className="mt-4 rounded-lg p-3 text-xs"
            style={{ background: 'var(--m-orange-4)', color: 'var(--m-ink)' }}
            role="alert"
          >
            {state.error}
          </p>
        ) : null}
        <form action={save} className="mt-5 space-y-4">
          <input type="hidden" name="field" value="logo" />
          <FileUpload
            bucket="media"
            pathPrefix={`vendors/${vendorProfileId}/logo`}
            name="logo_url"
            variant="square"
            roundPreview
            unsavedHint="it saves when you press Save"
            currentValue={ref || null}
            initialDisplayUrls={logoUrl && displayUrl ? { [logoUrl]: displayUrl } : {}}
            onChange={(v) => {
              const next = Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
              setRef(next);
              if (!next) setPreview(null);
            }}
            onFilePicked={(file) => {
              // The frame is set on the picture in hand — no wait for the upload to answer.
              try {
                setPreview(URL.createObjectURL(file));
              } catch {
                setPreview(null);
              }
            }}
            maxSizeMB={10}
            compressImage
            acceptedTypes={['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']}
            qrGuard
          />
          <LogoFrameControl imageUrl={ref ? preview : null} frame={frame} onChange={setFrame} />
          <span className="block text-xs" style={{ color: 'var(--m-slate-3)' }}>
            {LOGO_LATER.hint}
          </span>
          <div className="flex items-center gap-2 pt-1">
            <Link
              href="/vendor-dashboard"
              className="inline-flex h-12 shrink-0 items-center justify-center rounded-full border px-5 text-sm"
              style={{ borderColor: 'var(--m-line)', color: 'var(--m-ink)' }}
              data-open-shop-logo-skip=""
            >
              Skip for now
            </Link>
            <SubmitButton
              className="button-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm"
              pendingLabel="Saving…"
              disabled={!ref}
            >
              Save logo
            </SubmitButton>
          </div>
        </form>
      </div>
    </main>
  );
}
