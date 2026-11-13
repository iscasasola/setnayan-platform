'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { ArrowRight, Clock } from 'lucide-react';

import { FileUpload } from '@/app/_components/file-upload';
import { FirstRunBrand } from '@/app/_components/first-run-brand';
import { PictureFrameControl } from '@/app/_components/picture-frame-control';
import { updateVendorProfileField, type FieldSaveResult } from '@/app/vendor-dashboard/actions';
import { ActionButton } from '@/components/action-button';
import { DEFAULT_LOGO_FRAME, LOGO_FRAME_INPUTS, SHOP_LOGO_UPLOAD, type LogoFrame } from '@/lib/open-shop-logo';
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
  /** The logo the last sent save carried — '' for a removal — so its answer says whether a logo is now in. */
  const sent = useRef<string>(logoUrl ?? '');

  useEffect(() => {
    // Success is the action's answer, never the gesture (the SignInCard rule).
    if (state?.ok) setHasSaved(Boolean(sent.current));
  }, [state]);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  /** Queue the save. A removal saves too (an empty `logo_url` clears the logo and its frame) — "Changes save on their own". */
  function saveSoon(next: { ref?: string; frame?: LogoFrame }, removing = false) {
    latest.current = { ...latest.current, ...next };
    if (!latest.current.ref && !removing) return;
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
      sent.current = latest.current.ref;
      setQueued(false);
      startTransition(() => save(form));
    }, SAVE_AFTER_MS);
  }

  const status = queued || saving ? 'saving' : state?.ok ? 'saved' : null;

  return (
    /* 🧱 THE WIZARD'S OWN SHELL (walk 13 Nov 2026, F-W1-08). This screen used to be a centred card — no progress, the
       button floating mid-page, and the whole block re-centring (jumping) as the picture and its controls grew in. It
       now wears `/open-shop`'s frame: top-aligned, the wordmark over the five step bars (all filled — the shop is open),
       the step's title + line, and the same sticky bottom bar holding the one button. */
    <main className="flex min-h-[100dvh] flex-col overflow-x-clip md:block md:min-h-[70vh]" data-open-shop-logo="">
      <div className="flex flex-1 flex-col gap-[18px] px-4 pt-6 md:mx-auto md:max-w-[620px] md:px-7 md:pb-9">
        <div className="grid gap-3">
          <FirstRunBrand color="var(--m-ink)" size={13} />
          <div className="flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={5} aria-valuenow={5} aria-label="Your shop is open" data-open-shop-segments="">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="h-1 flex-1 rounded-full" style={{ background: 'var(--m-orange-deep)' }} />
            ))}
          </div>
        </div>
        <div className="grid gap-[3px]">
        <h1 className="text-[22px] font-semibold leading-[1.1] tracking-[-0.01em]" style={{ color: 'var(--m-ink)' }}>
          {hasSaved ? 'Your logo' : 'Add your logo'}
        </h1>
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          {shopName} is open. Couples see your logo on every supplier card. Changes save on their own.
        </p>
        </div>
        {state && !state.ok ? (
          <p
            className="mt-4 rounded-lg p-3 text-xs"
            style={{ background: 'var(--m-orange-4)', color: 'var(--m-ink)' }}
            role="alert"
          >
            {state.error}
          </p>
        ) : null}
        <div className="flex-1 space-y-4">
          {/* The circle IS the editor (prototype v21): it comes first, the bare picture and nothing over it. Once a
              picture is in, the upload below draws no second picture — only `[Replace photo] [Remove]` (`pills`). */}
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
            pills={{ replace: 'Replace photo' }}
            unsavedHint={null}
            currentValue={ref || null}
            initialDisplayUrls={logoUrl && displayUrl ? { [logoUrl]: displayUrl } : {}}
            onChange={(v) => {
              const next = Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
              setRef(next);
              if (!next) setPreview(null);
              // A new picture starts centred and saves the moment its upload is in.
              if (next) saveSoon({ ref: next, frame: latest.current.frame });
              // Remove: the logo goes from the shop too, on its own (one writer, the same save).
              else saveSoon({ ref: '', frame: DEFAULT_LOGO_FRAME }, true);
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
            // 📏 The one logo rule, shared with Today's logo row (F-W1-09).
            maxSizeMB={SHOP_LOGO_UPLOAD.maxSizeMB}
            compressImage
            acceptedTypes={[...SHOP_LOGO_UPLOAD.acceptedTypes]}
            qrGuard
          />
          {/* Shipped copy, one line, until a logo is in (v21 drops the skip hint once it saves). */}
          {hasSaved ? null : (
            <span className="block text-xs" style={{ color: 'var(--m-slate-3)' }}>
              {LOGO_LATER.hint}
            </span>
          )}
        </div>
          {/* The thumb row: one content-width pill on the right (BUTTON_RULE) — in the wizard's sticky bottom bar. */}
          <div
            className="sticky bottom-0 z-10 -mx-4 mt-auto flex items-center justify-end gap-2.5 border-t px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 md:static md:mx-0 md:border-0 md:px-0 md:pb-0 md:pt-1"
            style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
            data-open-shop-bar=""
          >
            {hasSaved ? (
              <ActionButton tone="brand" main icon={ArrowRight} label="Continue" href="/vendor-dashboard" data-testid="open-shop-logo-continue" />
            ) : (
              <ActionButton tone="neutral" icon={Clock} label="Skip for now" href="/vendor-dashboard" data-testid="open-shop-logo-skip" />
            )}
          </div>
      </div>
    </main>
  );
}
