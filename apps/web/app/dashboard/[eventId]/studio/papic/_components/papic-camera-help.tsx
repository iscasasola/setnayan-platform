import { InfoTip } from '@/app/_components/info-tip';

/**
 * papic-camera-help.tsx — "SETUP & HELP", MOVED INTO THE PAPIC CARD (the Papic page, removed 2026-10-26, folded it at
 * its foot: the shutter, the capture defaults, DSLR pairing). Nothing in it is a control — it is explanation — so it is
 * ONE line, every word inside its ⓘ (house rule: title + one short line, details in the ⓘ). The words are the page's,
 * unchanged. DSLR pairing is not said in the iPhone app (`appleIap`), exactly as the page did not.
 */
export function PapicCameraHelp({ appleIap = false }: { appleIap?: boolean }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 py-2" data-papic-camera-help="">
      <span className="min-w-0">
        <InfoTip label="How the camera works" labelClassName="text-[15px] text-ink" align="start">
          <span className="block">
            <strong>The shutter — it&rsquo;s just a tap.</strong> In the phone browser, Papic is one shutter button with a
            Photo / Clip toggle — tap for a photo, flip to Clip for a 10-second clip. No app to install; front camera is
            off by design (rear-only, for quality). Every clip runs up to 10 seconds and uploads in the background.
            Drag-to-shoot and a synced flash arrive with the native app (V1.5).
          </span>
          <span className="mt-2 block">
            <strong>Capture defaults.</strong> Battery handoff when it runs low — a handoff QR lets the next person take
            over without losing queued uploads. App-sandbox storage — captures live in the app and purge 24h after upload,
            never in the camera roll (opt-in to save copies). Fixed by design — rear-only, 10-second snippet cap, no
            settings for your crew to fiddle with.
          </span>
          {appleIap ? null : (
            <span className="mt-2 block">
              <strong>Pair a DSLR.</strong> Turn one camera into a phone + DSLR pair. The phone still does everything —
              shutter, QR tagging, upload — and the DSLR provides the glass. Pairing happens in the Papic mobile app over
              Wi-Fi (arrives with the app, V1.5); there&rsquo;s nothing to set up here. DSLR pairing is not on sale yet.
              Canon EOS R-series (Wi-Fi capture) is supported at launch; Nikon, Sony and Fujifilm as their SDKs open.
            </span>
          )}
        </InfoTip>
        <span className="block text-[12.5px] text-ink/55">The shutter, capture defaults{appleIap ? '' : ', DSLR pairing'}</span>
      </span>
    </div>
  );
}
