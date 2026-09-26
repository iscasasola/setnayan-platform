'use client';

/**
 * app/_components/payment/payment-rails.tsx — THE ONE MANUAL-PAYMENT SURFACE.
 *
 * Owner, 2026-09-20, looking at the Papic payment screen beside the couple's
 * checkout drawer: *"they have a different payment process… cant we have 1 type
 * of payment process? and just have this one that pops up on the right corner?"*
 *
 * He was right, and the duplication was not cosmetic. Two surfaces rendered the
 * same three facts — which rails are open, the QR with the amount minted into
 * it, and the account to send to — in two layouts, with two sets of words:
 *
 *   • the couple's checkout drawer  (this file's original home)
 *   • /pay/<reference>              (tabs + its own QrTile + its own copy)
 *
 * 🔑 TWO MECHANISMS FOR ONE FACT EACH PASS THEIR OWN TESTS. The drawer said
 * "Save image · scan from gallery"; /pay said "Save code to my photos" — the
 * same button, and nothing could tell you they had drifted, because each was
 * only ever compared against itself.
 *
 * ── WHAT LIVES HERE, AND WHAT DELIBERATELY DOES NOT ─────────────────────────
 * Here: presentation of the rails. Props in, pixels out, no server action, no
 * mint of an order, no knowledge of WHEN the order exists.
 *
 * Not here: the two timings, which are genuinely different and stay that way.
 * The drawer is PAY-THEN-MINT — the order row is created when the proof is
 * submitted, so an abandoned checkout leaves nothing in the admin queue.
 * /pay is APPLY-THEN-PAY — the order already exists, which is what makes it an
 * address you can come back to (a booking fee an admin reconciles days later, a
 * payment that was rejected and needs sending again, a link from an email).
 * Unifying the LOOK does not require unifying the LIFECYCLE, and apply-then-pay
 * is a locked decision (CLAUDE.md).
 */

import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';

import { CopyButton } from '@/app/_components/copy-button';
import { saveImageToDevice } from '@/lib/save-to-device';
import { OpenWalletButton } from '@/app/_components/open-wallet-button';
import { mintOrderQr } from '@/lib/emv-qr';
import { qrWords } from '@/lib/qr-amount-truth';
import { payAmount } from '@/lib/pay-amount';

/**
 * The slice of `platform_settings` these rails render.
 *
 * ⚠ A STANDALONE TYPE, NOT `SomeProps['settings']`. It used to be keyed off the
 * drawer's own props, which is exactly why /pay could not reuse any of this
 * without importing a checkout component. The optional fields match the
 * server's `?? true` / static-QR fallbacks — a caller that has not been updated
 * still typechecks and simply serves the uploaded image.
 */
export type RailInfo = {
  /** Display name on the receiving account. */
  name: string | null;
  /** The number a payer can type instead of scanning. */
  number: string | null;
  /** The admin-uploaded static code. Carries NO amount. */
  staticUrl: string | null;
  /**
   * The amount-carrying code ALREADY RENDERED, as an inline image.
   *
   * 🔑 PREFERRED OVER `payload`, AND THE REASON IS A DEFECT THE OWNER HIT.
   * While /pay handed down a payload for the browser to draw, `minted` was
   * null on the first paint and the static merchant code — scannable, worth
   * ₱0 — held the screen until the `qrcode` chunk arrived. Owner, 2026-09-20:
   * *"the amount is not filled up. it only shows 0."* A rendered image has no
   * such window, so a caller that CAN mint on the server must.
   */
  mintedUrl?: string | null;
  /**
   * The QR Ph payload, drawn in the browser when no `mintedUrl` is given.
   * This is the older path and it carries the ₱0-first-paint window above —
   * it stays only so a caller that has not moved its mint to the server keeps
   * working rather than losing its code entirely.
   */
  payload?: string | null;
};

export type PayRailSettings = {
  bdo_account_name: string | null;
  bdo_account_number: string | null;
  bdo_qr_url: string | null;
  gcash_account_name: string | null;
  gcash_number: string | null;
  gcash_qr_url: string | null;
  bdo_qr_payload?: string | null;
  gcash_qr_payload?: string | null;
  gcash_enabled?: boolean | null;
  bdo_enabled?: boolean | null;
};

export function ChannelToggle({
  channel,
  onChange,
  open,
}: {
  channel: 'gcash' | 'bdo';
  onChange: (c: 'gcash' | 'bdo') => void;
  /** Rails the owner has left open — a closed one is not rendered at all. */
  open: readonly ('gcash' | 'bdo')[];
}) {
  // A rail is closed when its receiving account is at its monthly cap, where
  // transfers FAIL rather than queue. Showing it greyed-out would invite
  // "why can't I use GCash?"; omitting it just presents what works. The
  // server re-checks on submit either way.
  return (
    <div className="space-y-2.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
        Pay manually · available now
      </p>
      <div role="radiogroup" aria-label="Payment method" className="space-y-2.5">
        {open.includes('gcash') ? (
        <MethodCard
          selected={channel === 'gcash'}
          onSelect={() => onChange('gcash')}
          badge="G"
          badgeClass="bg-[#0A6CF1] text-white"
          title="GCash"
          desc="Scan our GCash QR, or send to our number"
        />
        ) : null}
        {open.includes('bdo') ? (
        <MethodCard
          selected={channel === 'bdo'}
          onSelect={() => onChange('bdo')}
          badge="BDO"
          badgeClass="bg-[#0A2C6B] text-white"
          title="Bank Transfer — BDO"
          desc="Scan our BDO QR, or transfer to the account"
        />
        ) : null}
      </div>
    </div>
  );
}

function MethodCard({
  selected,
  onSelect,
  badge,
  badgeClass,
  title,
  desc,
}: {
  selected: boolean;
  onSelect: () => void;
  badge: string;
  badgeClass: string;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
        selected
          ? 'border-mulberry bg-mulberry/5 ring-1 ring-mulberry'
          : 'border-ink/10 bg-cream hover:border-mulberry/40'
      }`}
    >
      <span
        aria-hidden
        className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl text-[11px] font-extrabold tracking-wide ${badgeClass}`}
      >
        {badge}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          {title}
          <span className="rounded-full border border-success-200 bg-success-50 px-1.5 py-0.5 text-[10px] font-semibold text-success-800">
            Ready
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-ink/55">{desc}</span>
      </span>
      <span
        aria-hidden
        className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border transition-colors ${
          selected ? 'border-mulberry bg-mulberry text-cream' : 'border-ink/25'
        }`}
      >
        {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

export function PaymentDetailsBlock({
  channel,
  info,
  referenceCode,
  amountPhp,
  proofHint,
}: {
  channel: 'gcash' | 'bdo';
  /** This rail's account and code — see `railFromSettings` for the adapter. */
  info: RailInfo;
  referenceCode: string;
  /** VAT-inclusive gross the payer sends — minted into the QR as tag 54. */
  amountPhp: number;
  /**
   * Where the proof goes, in the words of THIS surface. Defaults to the
   * checkout drawer's "then upload your screenshot below", which is true there
   * and false on a page where the upload is a separate stage.
   */
  proofHint?: string;
}) {
  const { name, number, staticUrl: qrUrl, payload: qrPayload } = info;
  const hasInfo = Boolean(number?.trim());

  /**
   * Mint a per-order QR carrying this exact amount, replacing the static
   * uploaded image. Wallet-verified on real money 2026-07-31: GCash and BDO
   * both pre-fill the figure, centavos included, so the couple never types it.
   *
   * Two deliberate choices:
   *  • `mintOrderQr` returns null for anything it does not fully understand,
   *    and we then fall through to the static image — the exact behaviour that
   *    shipped before. A checkout must never show a broken code.
   *  • `qrcode` is imported dynamically so its renderer stays out of the
   *    initial bundle; this drawer opens long after first paint.
   */
  const mintedPayload = useMemo(
    // Nothing to draw when the caller already handed us the picture.
    () => (info.mintedUrl ? null : mintOrderQr(qrPayload, amountPhp)),
    [info.mintedUrl, qrPayload, amountPhp],
  );
  const [drawn, setDrawn] = useState<string | null>(null);
  // The server's image if there is one, else whatever the browser managed to
  // draw. Never the static code here — that is the `qrUrl` fallback below, and
  // conflating them is how a ₱0 code passes for an amount-carrying one.
  const mintedQr = info.mintedUrl ?? drawn;

  useEffect(() => {
    if (!mintedPayload) {
      setDrawn(null);
      return;
    }
    let cancelled = false;
    import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(mintedPayload, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 512,
        }),
      )
      .then((url) => {
        if (!cancelled) setDrawn(url);
      })
      .catch(() => {
        // Render nothing minted → the static QR below still works.
        if (!cancelled) setDrawn(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mintedPayload]);

  // 🔑 `payAmount`, NOT A LOCAL `toLocaleString`. This block used to format the
  // figure itself, which was survivable while it lived only in the checkout
  // drawer; now that /pay renders it too, a private copy would be a SECOND
  // money rule on the one screen whose promise is "the amount is already in
  // it". `payAmount` starts from `toFixed(2)` — the exact expression
  // `mintOrderQr` writes into EMV tag 54 — so the figure a payer READS and the
  // digits the wallet FILLS IN agree structurally instead of by coincidence.
  // (Intl and toFixed part company on a half-centavo: 2.675 is "2.68" to one
  // and "2.67" to the other.)
  const amountDisplay = payAmount(amountPhp);
  // ⚠ THE `qrWords` CALLS BELOW SPELL `payAmount(amountPhp)` OUT rather than
  // passing this local, and that is deliberate: `the-figure-and-the-qr-agree`
  // asserts on the ARGUMENT, because a local can be reassigned between its
  // definition and its use and a file-level match would never see it. Same
  // value, checkable at the call site.

  if (!hasInfo) {
    return (
      <div className="rounded-lg border border-warn-200 bg-warn-50 px-4 py-3 text-xs text-warn-900">
        Bank account details will follow via separate email · our team will
        reach out within the day.
      </div>
    );
  }

  const label = channel === 'gcash' ? 'GCash' : 'BDO';

  return (
    <div className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-4">
      <p className="text-xs text-ink/60">
        Send your <span className="font-semibold text-ink">{label}</span> payment,
        {/* ⚠ "BELOW" IS A CLAIM ABOUT THE PAGE AROUND THIS BLOCK, and it stopped
            being true the moment /pay started rendering it: there the upload is
            the NEXT STAGE, not the next thing down the screen. A sentence that
            was accurate in the drawer became a wrong direction somewhere else —
            which is the cost of sharing copy, and the reason it is a prop with
            the drawer's own words as the default rather than a constant. */}
        {' '}
        {proofHint ?? 'then upload your screenshot below.'}
      </p>

      {referenceCode ? (
        <div className="rounded-xl border border-terracotta/40 bg-terracotta/[0.06] px-3.5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta-700">
                Reference code
              </p>
              <p className="truncate font-mono text-[15px] font-semibold text-ink">
                {referenceCode}
              </p>
            </div>
            <CopyButton value={referenceCode} />
          </div>
          {/* Wallet-tested 2026-07-31: a scanned QR payment goes out through
              GCash's Express Send, which does not reliably carry a note the
              recipient sees — and the reference cannot ride inside the QR
              either (GCash rejects the EMVCo tag 62 template outright). The
              note still works when someone transfers manually, so we keep the
              guidance but stop promising it matches "instantly". */}
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink/55">
            Add this to your {label} transfer note if your app offers one — it
            helps us match your payment faster.
          </p>
        </div>
      ) : null}

      {qrUrl || mintedQr ? (
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-2xl border border-ink/10 bg-white p-3 shadow-sm">
            {/* Native <img> instead of next/image: the fallback is an
                admin-uploaded public asset on the platform_settings R2 host
                (no remotePatterns entry), and the minted code is a data URL
                next/image cannot optimise anyway. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mintedQr ?? qrUrl ?? ''}
              alt={
                mintedQr
                  ? `${label} QR code for ${amountDisplay}`
                  : `${label} QR code`
              }
              className="h-40 w-40 rounded-lg object-contain"
            />
          </div>

          {mintedQr ? (
            <>
              <p className="text-center text-[11px] leading-relaxed text-ink/60">
                {qrWords(true, payAmount(amountPhp), { appLabel: label, reference: referenceCode })
                  .caption}
              </p>
              {/* Same-device path: a couple browsing on their phone cannot
                  point that phone's camera at its own screen. Both GCash and
                  the BDO app can scan an image from the gallery, so saving is
                  the only route that works without a second device. */}
              <SaveQrToGallery
                dataUrl={mintedQr}
                filename={`setnayan-${channel}-${amountPhp.toFixed(2)}.png`}
                appLabel={label}
              />
            </>
          ) : (
            /* 🚨 THIS BRANCH IS THE STATIC UPLOADED CODE, WHICH CARRIES NO
               AMOUNT. It used to say only "Scan in GCash" — true, and silent
               about the one thing that decides whether the money arrives.
               A wallet opens at ₱0 on this code (owner, 2026-09-20). */
            <p className="text-center text-[11px] leading-relaxed text-ink/60">
              {qrWords(false, payAmount(amountPhp), { appLabel: label, reference: referenceCode })
                .caption}
            </p>
          )}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-ink/10" />
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/40">
          or {channel === 'gcash' ? 'send to our number' : 'transfer manually'}
        </span>
        <span className="h-px flex-1 bg-ink/10" />
      </div>

      <div className="divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/10">
        {name ? (
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="min-w-0">
              <span className="block text-[11px] text-ink/50">
                {channel === 'gcash' ? 'GCash name' : 'Account name'}
              </span>
              <span className="block truncate font-mono text-[13px] text-ink">
                {name}
              </span>
            </span>
            <CopyButton value={name} />
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <span className="min-w-0">
            <span className="block text-[11px] text-ink/50">
              {channel === 'gcash' ? 'GCash number' : 'Account number'}
            </span>
            <span className="block truncate font-mono text-[13px] text-ink">
              {number}
            </span>
          </span>
          <CopyButton value={number ?? ''} />
        </div>
        {/* The exact figure, copyable. Load-bearing on the manual path — where
            nothing pre-fills — and the fallback whenever the minted QR is
            unavailable. */}
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <span className="min-w-0">
            <span className="block text-[11px] text-ink/50">Exact amount</span>
            <span className="block truncate font-mono text-[13px] font-semibold text-ink">
              {amountDisplay}
            </span>
          </span>
          <CopyButton value={amountPhp.toFixed(2)} />
        </div>
      </div>

      {/* Tap-to-open, measured on a real phone — see lib/wallet-handoff.ts.
          It renders BELOW the rows on purpose: the number and its copy control
          are the payment path, and this only ever saves the walk to the home
          screen. Renders nothing on BDO (no measured scheme) and nothing on a
          desktop pointer, so a dead button never ships. */}
      <OpenWalletButton
        provider={label}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-[13px] font-semibold text-ink/80 transition hover:border-mulberry/50 hover:text-mulberry"
      />
    </div>
  );
}

/**
 * "Save this code" — get the amount-carrying QR into the payer's gallery.
 *
 * 🛑 THIS REPLACED A BARE `<a download>` ON A data: URL, WHICH SAVED NOTHING
 * ON AN IPHONE. Measured 2026-09-23 on the owner's iPhone, Safari, from a
 * plain http page whose control probe confirmed the page COULD hand off to
 * other apps (a "Call 0917…?" sheet appeared): four taps, four times the file
 * landed in neither Photos nor Files. Nowhere.
 *
 * 🔑 AND THE LABEL PROMISED THE PLACE IT NEVER REACHED. It read
 * "Save image · scan from gallery" — so a couple on their own phone, which is
 * the ONLY situation this control exists for (you cannot point a phone's
 * camera at its own screen), was told to scan from a gallery that never
 * received the picture. The amount-carrying QR is the one path that spares
 * them typing the figure, and on iOS it was a dead end.
 *
 * The mechanism was already in this repo, built for Papic and documented:
 * `lib/save-to-device.ts` hands the file to `navigator.share`, where the OS
 * offers "Save to Photos" (iOS) / "Save image" (Android). A browser cannot
 * write to the camera roll silently — that is a security boundary, not a
 * missing API — so the share sheet is as close to a one-tap save as the web
 * allows. Desktop falls through to a download, which is right there.
 *
 * ⚠ 'shared' DOES NOT MEAN SAVED. `saveImageToDevice` deliberately returns
 * 'shared' when the payer DISMISSES the sheet, because seeing the option is
 * not a failure worth re-prompting over. So nothing here may say "Saved!" —
 * it would be a claim about an action we cannot observe. Every message below
 * is an instruction that stays true whether they tapped Save or cancelled.
 */
function SaveQrToGallery({
  dataUrl,
  filename,
  appLabel,
}: {
  dataUrl: string;
  filename: string;
  /** "GCash" / "BDO" — the app the payer is about to scan this in. */
  appLabel: string;
}) {
  const [phase, setPhase] = useState<'idle' | 'working' | 'shared' | 'downloaded' | 'failed'>(
    'idle',
  );

  async function onSave() {
    setPhase('working');
    const result = await saveImageToDevice(dataUrl, filename);
    setPhase(result === 'shared' ? 'shared' : result === 'downloaded' ? 'downloaded' : 'failed');
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onSave}
        disabled={phase === 'working'}
        className="rounded-full border border-ink/15 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/55 transition hover:border-ink/30 hover:text-ink disabled:opacity-60"
      >
        {phase === 'working' ? 'Opening…' : 'Save this code'}
      </button>

      {phase === 'shared' ? (
        <p className="max-w-[34ch] text-center text-[11px] leading-relaxed text-ink/60">
          Choose <b className="text-ink">Save Image</b>, then in {appLabel} tap{' '}
          <b className="text-ink">Scan</b> and pick it from your photos.
        </p>
      ) : null}

      {phase === 'downloaded' ? (
        <p className="max-w-[34ch] text-center text-[11px] leading-relaxed text-ink/60">
          It went to your downloads. In {appLabel}, tap <b className="text-ink">Scan</b> and
          choose it from your files.
        </p>
      ) : null}

      {phase === 'failed' ? (
        <p className="max-w-[34ch] text-center text-[11px] leading-relaxed text-ink/60">
          That didn&rsquo;t work on this phone — <b className="text-ink">press and hold the code
          above</b> and choose Add to Photos.
        </p>
      ) : null}
    </div>
  );
}

/** platform_settings → the one rail shape these components read. */
export function railFromSettings(
  channel: 'gcash' | 'bdo',
  settings: PayRailSettings,
  mintedUrl?: string | null,
): RailInfo {
  return channel === 'gcash'
    ? {
        name: settings.gcash_account_name,
        number: settings.gcash_number,
        staticUrl: settings.gcash_qr_url,
        payload: settings.gcash_qr_payload ?? null,
        mintedUrl: mintedUrl ?? null,
      }
    : {
        name: settings.bdo_account_name,
        number: settings.bdo_account_number,
        staticUrl: settings.bdo_qr_url,
        payload: settings.bdo_qr_payload ?? null,
        mintedUrl: mintedUrl ?? null,
      };
}
