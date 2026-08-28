'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUpload } from '@/app/_components/file-upload';
import { SubmitButton } from '@/app/_components/submit-button';
import { submitPaymentProof } from '../actions';

/**
 * The paying half of /pay/[reference] — steps 2 and 3, plus the bar that keeps
 * the next step reachable.
 *
 * ⚠ WHY THIS IS ONE COLUMN, AND WHY THE BAR EXISTS.
 * The first cut of the prototype put the summary and the QR side by side. On a
 * phone that is not a second column, it is a second SCREEN with nothing
 * pointing at it — the owner reported: *"it just went to the you're paying
 * for… never showed the pay this exact amount and no way to get there."*
 * Do not reintroduce a two-column layout here: the QR is the whole point of
 * the page and it must be unmissable at 375px.
 */

type Channel = 'gcash' | 'bdo';

export type ChannelInfo = {
  /** Amount-carrying QR Ph payload, or null when we could not mint one. */
  payload: string | null;
  /** The uploaded static QR image, used when there is no payload to mint. */
  staticUrl: string | null;
  number: string | null;
  name: string | null;
  enabled: boolean;
};

export function PayPanel({
  rechecked,
  proofSent,
  resubmitNotice,
  requiresReference,
  amountPhp,
  reference,
  orderId,
  gcash,
  bdo,
  activatesLine,
}: {
  /**
   * TRUE on the render right after we asked them to check their reference
   * against their own picture. It rides into the form as a hidden field, and
   * the action then accepts whatever the picture says.
   *
   * 🔑 WE ASK ONCE. Somebody who has already sent money must always have a way
   * through — they are the ones a stricter rule would trap, because a person
   * with a genuinely wrong receipt gives up while a person with a real payment
   * and an unlucky read keeps trying.
   */
  rechecked: boolean;
  proofSent: boolean;
  /** What the admin asked for, when they sent the payer back for better proof. */
  resubmitNotice: string | null;
  /** The booking-fee lane, where the reference is required (owner 2026-08-06). */
  requiresReference: boolean;
  amountPhp: number;
  reference: string;
  orderId: string;
  gcash: ChannelInfo;
  bdo: ChannelInfo;
  activatesLine: string;
}) {
  // GCash first: a GCash payer sends for free, a bank transfer into BDO costs
  // them ₱10–15 in InstaPay fees (measured 2026-07-31). Default to the rail
  // that does not charge them — unless it is switched off.
  const [channel, setChannel] = useState<Channel>(gcash.enabled ? 'gcash' : 'bdo');
  const info = channel === 'gcash' ? gcash : bdo;

  return (
    <>
      <section id="payCard" className="sn-tile mt-5 scroll-mt-4 p-6">
        <StepHead n={2} title="Pay this exact amount" />
        <div className="flex gap-2">
          <ChannelTab
            label="GCash"
            note={gcash.enabled ? 'free to send' : 'unavailable right now'}
            on={channel === 'gcash'}
            disabled={!gcash.enabled}
            onClick={() => setChannel('gcash')}
          />
          <ChannelTab
            label="BDO"
            note={bdo.enabled ? 'bank fee may apply' : 'unavailable right now'}
            on={channel === 'bdo'}
            disabled={!bdo.enabled}
            onClick={() => setChannel('bdo')}
          />
        </div>

        <QrTile channel={channel} info={info} amountPhp={amountPhp} />

        {(info.number || info.name) && (
          <p className="mt-4 text-center text-sm text-ink/70">
            or send manually to
            <br />
            {info.number && (
              <span className="font-mono text-[15px] font-semibold text-ink">{info.number}</span>
            )}
            {info.name && <span className="block text-xs text-ink/55">{info.name}</span>}
          </p>
        )}

        <div className="mt-5">
          <button type="button" className="button-primary w-full" onClick={() => jump('proofCard')}>
            I&rsquo;ve paid &mdash; send my proof
          </button>
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-ink/55">
          Paying on the same phone? Save the code to your photos first &mdash; your wallet&rsquo;s
          scanner can open it from your gallery. Sending to BDO from another bank usually costs you
          a ₱10&ndash;₱15 transfer fee; GCash to GCash is free.
        </p>
      </section>

      <section id="proofCard" className="sn-tile mt-5 scroll-mt-4 p-6">
        <StepHead n={3} title="After you pay" />
        {resubmitNotice && (
          <p className="mb-4 rounded-lg border border-mulberry/40 bg-mulberry/[0.06] p-3 text-sm text-ink">
            {resubmitNotice}
          </p>
        )}
        {proofSent ? (
          <div className="rounded-xl border border-mulberry bg-white p-5 text-center">
            <h2 className="text-lg font-semibold text-ink">We&rsquo;re checking your payment</h2>
            <p className="mt-2 text-sm text-ink/65">
              You&rsquo;ll get an email once it&rsquo;s confirmed &mdash; usually within 24 hours.
              Nothing else to do.
            </p>
          </div>
        ) : (
          <ProofForm
            orderId={orderId}
            reference={reference}
            amountPhp={amountPhp}
            channel={channel}
            requiresReference={requiresReference}
            rechecked={rechecked}
          />
        )}
      </section>

      <StickyBar amountPhp={amountPhp} activatesLine={activatesLine} proofSent={proofSent} />
    </>
  );
}

function jump(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function StepHead({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[12px] font-bold text-white">
        {n}
      </span>
      <span className="sn-eye">{title}</span>
    </div>
  );
}

function ChannelTab({
  label,
  note,
  on,
  disabled,
  onClick,
}: {
  label: string;
  note: string;
  on: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold text-ink disabled:opacity-45 ${
        on ? 'border-mulberry ring-1 ring-mulberry' : 'border-ink/15'
      }`}
    >
      {label}
      <span className="block text-[11px] font-normal text-ink/55">{note}</span>
    </button>
  );
}

/**
 * The QR itself.
 *
 * The amount-carrying payload is rendered in the BROWSER (`qrcode` imported
 * dynamically, same as the couple's checkout drawer) so the renderer never
 * enters the server bundle. When there is no payload to mint we fall back to
 * the static uploaded image unchanged — which is what shipped before — and say
 * plainly that the amount has to be typed, rather than implying it is filled in.
 */
function QrTile({
  channel,
  info,
  amountPhp,
}: {
  channel: Channel;
  info: ChannelInfo;
  amountPhp: number;
}) {
  const [minted, setMinted] = useState<string | null>(null);
  const payload = info.payload;

  useEffect(() => {
    let cancelled = false;
    setMinted(null);
    if (!payload) return;
    import('qrcode')
      .then((m) => m.toDataURL(payload, { margin: 1, width: 520, errorCorrectionLevel: 'M' }))
      .then((url) => {
        if (!cancelled) setMinted(url);
      })
      .catch(() => {
        if (!cancelled) setMinted(null);
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  const src = minted ?? info.staticUrl;
  const exact = Boolean(minted);
  const label = channel === 'gcash' ? 'GCash' : 'your bank app';

  if (!src) {
    return (
      <p className="mt-4 rounded-lg border border-ink/15 p-4 text-center text-sm text-ink/60">
        Send to the account below. We&rsquo;ll email you a code if this rail changes.
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-ink/15 bg-white p-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={
          exact
            ? `Payment QR code already set to ${peso(amountPhp)}`
            : 'Setnayan payment QR code'
        }
        width={260}
        height={260}
        decoding="async"
        className="mx-auto h-auto w-full max-w-[260px]"
      />
      <p className="mt-3 text-sm text-ink/65">
        {exact ? (
          <>
            This code is for <b className="text-ink">{peso(amountPhp)}</b> &mdash; {label} fills the
            amount in for you. Nothing to type.
          </>
        ) : (
          <>
            Scan this, then type <b className="text-ink">{peso(amountPhp)}</b> yourself &mdash; this
            code doesn&rsquo;t carry an amount.
          </>
        )}
      </p>
      {exact && (
        <a
          href={src}
          download={`setnayan-${channel}-${amountPhp}.png`}
          className="mt-3 inline-block text-sm font-medium text-link underline"
        >
          Save code to my photos
        </a>
      )}
    </div>
  );
}

/**
 * Proof — screenshot, then the last 6 digits.
 *
 * Owner, 2026-08-21: *"show the preview of the screenshot so they can read the
 * reference number and type it."* So the picture STAYS on screen above the
 * field and enlarges on tap. The preview is a local object URL from the file
 * they just picked — the uploaded copy lives in the PRIVATE bucket and is only
 * ever readable through a short-lived signed link, so it is never fetched back
 * to render here.
 */
function ProofForm({
  orderId,
  reference,
  amountPhp,
  channel,
  requiresReference,
  rechecked,
}: {
  orderId: string;
  reference: string;
  amountPhp: number;
  channel: Channel;
  requiresReference: boolean;
  rechecked: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [big, setBig] = useState(false);
  const urlRef = useRef<string | null>(null);
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  return (
    <form action={submitPaymentProof} className="space-y-4">
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="amount_php" value={amountPhp} />
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="client_idempotency_key" value={idempotencyKey} />
      {/* Their second attempt. See `rechecked` on PayPanel — we ask once. */}
      {rechecked && <input type="hidden" name="rechecked" value="1" />}

      <p className="text-sm text-ink/65">
        Send us the screenshot and the last 6 digits of your reference number. We confirm within 24
        hours.
      </p>

      {preview && (
        <div className="rounded-xl border border-mulberry bg-white p-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="The payment screenshot you just picked"
            className="mx-auto max-h-[340px] w-full max-w-[300px] cursor-zoom-in rounded-lg border border-ink/10 object-contain"
            onClick={() => setBig(true)}
          />
          <p className="mt-2 text-xs text-ink/60">
            Read the reference number off it &mdash; tap to enlarge.
          </p>
        </div>
      )}

      <FileUpload
        // Payment proofs are PRIVATE: bank and wallet screenshots carry account
        // numbers and names. Private bucket, read only through signed GETs.
        bucket="thread-files"
        pathPrefix={`payments/${orderId}`}
        name="screenshot_ref"
        label={preview ? 'Use a different picture' : 'Your payment screenshot'}
        help="PNG, JPEG, WebP or HEIC up to 5 MB."
        maxSizeMB={5}
        acceptedTypes={[
          'image/png',
          'image/jpeg',
          'image/webp',
          'image/gif',
          'image/heic',
          'image/heif',
        ]}
        variant="wide"
        onFilePicked={(file) => {
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          const url = URL.createObjectURL(file);
          urlRef.current = url;
          setPreview(url);
        }}
      />

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">
          Last 6 digits of your reference number
          {requiresReference && <span className="font-normal text-ink/55"> · required</span>}
        </span>
        {/*
          🪤 THIS FIELD USED TO CARRY `maxLength={6}`, WHICH SILENTLY DELETED
          MOST OF WHAT ANYBODY PASTED. The sentence below invites a full paste,
          and the server that receives it says in terms that "six is a minimum,
          not a maximum" and keeps up to 64 characters — but the browser cut the
          value to six before either of them ever saw it, with no error and no
          sign anything had been dropped. Somebody following the instruction
          exactly got the WORST result: their long, unambiguous reference
          arrived as the first six characters of itself.

          The pattern is widened to match, and admits the spaces and dashes
          GCash prints into a grouped reference ("0043 457 367694") — the server
          strips them anyway, and refusing them made a correct paste look wrong.
        */}
        <input
          name="reference_last6"
          inputMode="numeric"
          autoComplete="off"
          maxLength={64}
          pattern="[A-Za-z0-9][A-Za-z0-9 \-]{3,63}"
          placeholder="••••••"
          required={requiresReference}
          className="input-field font-mono tracking-[0.2em]"
        />
        <span className="mt-1.5 block text-xs text-ink/55">
          On your receipt it looks like 0043457367694 &mdash; the last six is enough, and you can
          paste the whole thing if it is easier.
        </span>
      </label>

      <SubmitButton className="button-primary w-full" pendingLabel="Sending…">
        I&rsquo;ve sent the payment
      </SubmitButton>

      {big && preview && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/85 p-5"
          role="button"
          tabIndex={0}
          aria-label="Close the enlarged screenshot"
          onClick={() => setBig(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') setBig(false);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Your payment screenshot, enlarged"
            className="max-h-[86vh] max-w-[min(420px,88vw)] rounded-xl bg-white"
          />
        </div>
      )}
    </form>
  );
}

/**
 * The bar that makes the next step reachable without scrolling blind. It names
 * the amount at all times — the one number the payer keeps checking — and its
 * button follows where they are on the page.
 */
function StickyBar({
  amountPhp,
  activatesLine,
  proofSent,
}: {
  amountPhp: number;
  activatesLine: string;
  proofSent: boolean;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const pay = document.getElementById('payCard');
      if (!pay) return;
      setStep(pay.getBoundingClientRect().top > 120 ? 0 : 1);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const target = step === 0 ? 'payCard' : proofSent ? 'payCard' : 'proofCard';
  const label = step === 0 ? 'Show me the QR code' : proofSent ? 'Back to the code' : "I've paid — send my proof";

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/12 bg-white/95 px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto flex max-w-[560px] items-center gap-3">
        <span className="whitespace-nowrap font-mono text-[17px] font-bold text-ink">
          <span className="block font-sans text-[11px] font-normal text-ink/55">
            {proofSent ? 'Checking' : 'To pay'}
          </span>
          {peso(amountPhp)}
        </span>
        <button type="button" className="button-primary flex-1" onClick={() => jump(target)}>
          {label}
        </button>
      </div>
      <p className="sr-only">{activatesLine}</p>
    </div>
  );
}

function peso(n: number): string {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2 });
}
