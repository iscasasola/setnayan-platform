'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { ArrowRight, Clock } from 'lucide-react';

import { FileUpload } from '@/app/_components/file-upload';
import { FirstRunBrand } from '@/app/_components/first-run-brand';
import { PictureFrameControl } from '@/app/_components/picture-frame-control';
import { updateVendorProfileField, type FieldSaveResult } from '@/app/vendor-dashboard/actions';
import { ActionButton } from '@/components/action-button';
import { DEFAULT_LOGO_FRAME, LOGO_FRAME_INPUTS, type LogoFrame } from '@/lib/open-shop-logo';
import { LOGO_LATER } from '@/lib/open-shop-validation';
import { storedPictureFrame } from '@/lib/picture-frame';

/** How long after the last finished change the save goes (prototype v21: ~600 ms after you let go). */
const SAVE_AFTER_MS = 600;

type SaveAction = (prev: FieldSaveResult | null, form: FormData) => Promise<FieldSaveResult>;

/**
 * "Add your logo" — one screen, right after the shop opens (owner, the 2026-11-06 gate walk, A2), framed by dragging
 * and pinching the circle itself (owner 7 Nov, prototype v21, A3 — the shared `PictureFrameControl`). Every change
 * SAVES ON ITS OWN (*"change and save automatically"*): the upload, then each finished drag / pinch / zoom, ~600 ms
 * after the last one, through My Shop's own logo save — so the logo and its frame have one writer. One status, in
 * place: "Saving…" → "✓ Logo saved". Nothing re-renders the screen (a save never resets the screen).
 * Skip lands on Today before a logo is in; once it is saved, Continue does.
 */
export function AddYourLogo({
  vendorProfileId,
  shopName,
  storedLogoRef: logoUrl,
  displayUrl,
  frame: savedFrame,
  saveAction = updateVendorProfileField,
}: {
  vendorProfileId: string;
  shopName: string;
  /** The stored `r2://` ref — a FORM value posted back, never rendered (the picture is `displayUrl`). */
  storedLogoRef: string | null;
  displayUrl: string | null;
  frame: LogoFrame;
  /** The save. Always `updateVendorProfileField` in the app; the dev lab hands in a stand-in that writes nothing. */
  saveAction?: SaveAction;
}) {
  const [ref, setRef] = useState<string>(logoUrl ?? '');
  const [preview, setPreview] = useState<string | null>(displayUrl);
  const [frame, setFrame] = useState<LogoFrame>(savedFrame ?? DEFAULT_LOGO_FRAME);
  const [state, save, saving] = useActionState<FieldSaveResult | null, FormData>(saveAction, null);
  // A save is queued from the moment a change finishes until it is sent — "Saving…" covers that wait too.
  const [queued, setQueued] = useState(false);
  // The logo was in before this visit, or a save has succeeded here — then Continue, not Skip.
  const [hasSaved, setHasSaved] = useState(Boolean(logoUrl));
  const timer = useRef<number | null>(null);
  const latest = useRef({ ref, frame });

  useEffect(() => {
    // Success is the action's answer, never the gesture (the SignInCard rule).
    if (state?.ok) setHasSaved(true);
  }, [state]);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  function saveSoon(next: { ref?: string; frame?: LogoFrame }) {
    latest.current = { ...latest.current, ...next };
    if (!latest.current.ref) return;
    setQueued(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      const f = storedPictureFrame(latest.current.frame);
      const form = new FormData();
      form.set('field', 'logo');
      form.set('logo_url', latest.current.ref);
      form.set(LOGO_FRAME_INPUTS.x, String(f.x));
      form.set(LOGO_FRAME_INPUTS.y, String(f.y));
      form.set(LOGO_FRAME_INPUTS.zoom, String(f.zoom));
      setQueued(false);
      startTransition(() => save(form));
    }, SAVE_AFTER_MS);
  }

  const status = queued || saving ? 'saving' : state?.ok ? 'saved' : null;

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg p-1 sm:p-2" data-open-shop-logo="">
        <FirstRunBrand className="mb-4" color="var(--m-ink)" size={13} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--m-ink)' }}>
          {hasSaved ? 'Your logo' : 'Add your logo'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--m-slate)' }}>
          {shopName} is open. Couples see your logo on every supplier card. Changes save on their own.
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
        <div className="mt-5 space-y-4">
          {/* The circle IS the editor (prototype v21): it comes first. Once a picture is in, the upload shrinks to its
              one-row form under it (a 72 px thumb · Remove) instead of drawing a second big circle. */}
          <PictureFrameControl
            imageUrl={ref ? preview : null}
            frame={frame}
            onChange={setFrame}
            onCommit={(f) => saveSoon({ frame: f })}
            status={status}
            savedLabel="Logo saved"
            alt="Your logo, as couples see it"
            tipTitle="The circle is what couples see"
          />
          <FileUpload
            bucket="media"
            pathPrefix={`vendors/${vendorProfileId}/logo`}
            name="logo_url"
            variant="square"
            roundPreview
            row={ref ? { title: 'Logo file' } : undefined}
            unsavedHint={null}
            currentValue={ref || null}
            initialDisplayUrls={logoUrl && displayUrl ? { [logoUrl]: displayUrl } : {}}
            onChange={(v) => {
              const next = Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
              setRef(next);
              if (!next) setPreview(null);
              // A new picture starts centred and saves the moment its upload is in.
              if (next) saveSoon({ ref: next, frame: latest.current.frame });
              else latest.current = { ...latest.current, ref: '' };
            }}
            onFilePicked={(file) => {
              // The frame is set on the picture in hand — no wait for the upload to answer. A new picture starts centred.
              setFrame(DEFAULT_LOGO_FRAME);
              latest.current = { ...latest.current, frame: DEFAULT_LOGO_FRAME };
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
          <span className="block text-xs" style={{ color: 'var(--m-slate-3)' }}>
            {LOGO_LATER.hint}
          </span>
          {/* The thumb row: one content-width pill on the right (BUTTON_RULE). */}
          <div className="flex items-center justify-end gap-2 pt-1">
            {hasSaved ? (
              <ActionButton tone="brand" main icon={ArrowRight} label="Continue" href="/vendor-dashboard" data-testid="open-shop-logo-continue" />
            ) : (
              <ActionButton tone="neutral" icon={Clock} label="Skip for now" href="/vendor-dashboard" data-testid="open-shop-logo-skip" />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
