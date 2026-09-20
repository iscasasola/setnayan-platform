'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FileUpload } from '@/app/_components/file-upload';
import { SubmitButton } from '@/app/_components/submit-button';
import { submitPaymentProof } from '../actions';
import { payAmount } from '@/lib/pay-amount';
import { PAYMENTS_PAUSED_MESSAGE } from '@/lib/payment-channels';
import {
  ChannelToggle,
  PaymentDetailsBlock,
} from '@/app/_components/payment/payment-rails';
import {
  PAY_STAGES,
  PROOF_STAGE,
  advanceLabel,
  nextStage,
  prevStage,
  shouldMountProof,
  stageHref,
  type PayStage,
} from '@/lib/pay-stages';

/**
 * /pay/[reference] — THREE STAGES, ONE AT A TIME.
 *
 * ⚖ OWNER RULING, 2026-09-20. All three tiles used to render together: numbered
 * like steps, shown as a ~2,039px scroll, with the proof-upload form open for a
 * payment nobody had made yet.
 *
 *   1 · What you're paying   the item, the figure, the reference, who it is for
 *   2 · Pay                  the code, the account details, the honest line
 *   3 · Send your proof      the screenshot and the reference digits
 *
 * ── HOW IT MOVES, AND WHY IT IS BUILT THIS WAY ─────────────────────────────
 *
 * 🔑 THE STAGE IS IN THE URL (`?step=`), following `app/open-shop` rather than
 * inventing a second spelling. Three things fall out of that and none of them
 * needed code: **browser Back works**, each stage is **linkable**, and with
 * JavaScript off or still loading the SERVER renders the right stage — because
 * every advance control is a real `<a href>` that this component only
 * intercepts once it is interactive.
 *
 * ⚠ AND NOTHING IS UNMOUNTED ON THE WAY BACK. `shouldMountProof` keeps the
 * proof form in the document from the moment its stage is first reached, so
 * going back to look at the code again and returning does not empty the picked
 * file and the typed digits — a file input and React state both die on unmount
 * and neither says so. Before that stage is reached it is genuinely ABSENT,
 * which is the other half of the owner's ruling.
 *
 * ⚠ WHY THIS IS ONE COLUMN. The first cut of the prototype put the summary and
 * the QR side by side. On a phone that is not a second column, it is a second
 * SCREEN with nothing pointing at it — the owner reported: *"it just went to
 * the you're paying for… never showed the pay this exact amount and no way to
 * get there."* Do not reintroduce a two-column layout here.
 */

type Channel = 'gcash' | 'bdo';

export type ChannelInfo = {
  /**
   * The amount-carrying code, ALREADY RENDERED, as an inline PNG — or null
   * when we could not mint or could not draw one.
   *
   * 🔑 IT IS AN IMAGE, NOT A PAYLOAD, AND THAT IS THE FIX. While this was a
   * payload the browser had to render, `minted` was null on the first paint
   * and the static merchant code — scannable, worth ₱0 — held the screen until
   * the `qrcode` chunk arrived. Owner, 2026-09-20: *"the amount is not filled
   * up. it only shows 0."* A rendered image has no such window.
   */
  mintedUrl: string | null;
  /** The uploaded static QR image, used when there is no minted one. */
  staticUrl: string | null;
  number: string | null;
  name: string | null;
  enabled: boolean;
};

export function PayPanel({
  rechecked,
  setup,
  proofSent,
  resubmitNotice,
  requiresReference,
  amountPhp,
  reference,
  orderId,
  gcash,
  bdo,
  activatesLine,
  summary,
  initialStage,
  carryQuery,
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
  /** TRUE when this bill is part of the onboarding set-up flow (`?setup=1`). */
  setup: boolean;
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
  /**
   * Stage 1's contents — the order summary — rendered on the SERVER and handed
   * in. It reads the payable, the catalogue and the event; none of that belongs
   * in a client bundle just because the stage machinery is interactive.
   */
  summary: ReactNode;
  /** From `?step=`, so the server paints the stage the address asks for. */
  initialStage: PayStage;
  /** Every other query parameter this page was opened with — see `stageHref`. */
  carryQuery: Record<string, string | undefined>;
}) {
  // GCash first: a GCash payer sends for free, a bank transfer into BDO costs
  // them ₱10–15 in InstaPay fees (measured 2026-07-31). Default to the rail
  // that does not charge them — unless it is switched off.
  const [channel, setChannel] = useState<Channel>(gcash.enabled ? 'gcash' : 'bdo');
  const info = channel === 'gcash' ? gcash : bdo;

  const [stage, setStage] = useState<PayStage>(initialStage);
  /**
   * Has the proof stage ever been on screen in this visit?
   *
   * ⛔ NOT `stage === PROOF_STAGE`. That is the question about NOW, and using
   * it would unmount the form the instant somebody went back to re-read the
   * code — losing the file they had picked and the digits they had typed, with
   * nothing on screen to say it had happened.
   */
  const [reachedProof, setReachedProof] = useState(initialStage === PROOF_STAGE);
  const proofMounted = shouldMountProof(stage, reachedProof);

  /**
   * 🔑 THE HISTORY ENTRY IS WHAT MAKES BACK WORK, and `popstate` is what makes
   * it work in BOTH directions. `pushState` rather than a router navigation on
   * purpose: a navigation re-renders the tree and would unmount the proof form,
   * which is the one thing this component must not do.
   */
  useEffect(() => {
    const onPop = () => {
      const url = new URL(window.location.href);
      const raw = url.searchParams.get('step');
      const to: PayStage = raw === '3' ? 3 : raw === '2' ? 2 : 1;
      setStage(to);
      if (to === PROOF_STAGE) setReachedProof(true);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = (to: PayStage) => {
    setStage(to);
    if (to === PROOF_STAGE) setReachedProof(true);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', stageHref(reference, to, carryQuery));
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  const railsClosed = !gcash.enabled && !bdo.enabled;

  return (
    <>
      <StageRail stage={stage} reference={reference} carryQuery={carryQuery} onGo={go} />

      {/* ── STAGE 1 ─────────────────────────────────────────────────────────
          The summary is the server's; the way onward is this component's.
          `hidden` rather than unmounted, because the summary is cheap and a
          person who goes back to check the figure should not wait for it. */}
      <div hidden={stage !== 1}>
        {summary}
        <div className="mt-5">
          <StageLink
            stage={2}
            reference={reference}
            carryQuery={carryQuery}
            onGo={go}
            className="button-primary w-full justify-center"
          >
            {advanceLabel(1)}
          </StageLink>
        </div>
        {/* ⚖ NOBODY IS FORCED THROUGH THREE TAPS FOR A NUMBER. Somebody who
            only wants the account details — because they already know how they
            are paying, or they are on a desktop copying into a banking app —
            gets them here without leaving stage 1. */}
        <details className="mt-4 rounded-lg border border-ink/12 bg-ink/[0.02] px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-ink">
            Show all the payment details
          </summary>
          <div className="mt-3 space-y-3">
            {railsClosed ? (
              <p role="status" className="text-sm text-ink/75">
                {PAYMENTS_PAUSED_MESSAGE}
              </p>
            ) : (
              <>
                {[gcash, bdo]
                  .filter((c) => c.enabled && (c.number || c.name))
                  .map((c) => (
                    <p key={c.number ?? c.name ?? ''} className="text-sm text-ink/70">
                      {c.number && (
                        <span className="font-mono text-[15px] font-semibold text-ink">
                          {c.number}
                        </span>
                      )}
                      {c.name && <span className="block text-xs text-ink/55">{c.name}</span>}
                    </p>
                  ))}
                <p className="text-sm text-ink/70">
                  Amount to send:{' '}
                  <span className="font-mono font-semibold text-ink">{payAmount(amountPhp)}</span>
                </p>
              </>
            )}
          </div>
        </details>
      </div>

      {/* ── STAGE 2 ──────────────────────────────────────────────────────── */}
      <div hidden={stage !== 2}>
        <section id="payCard" className="sn-tile mt-5 scroll-mt-4 p-6">
          <StepHead n={2} title="Pay this exact amount" />
          {/*
            🔑 EVERY RAIL CLOSED. Both personal accounts are at their monthly
            receiving cap and the owner switched them off — a transfer now
            fails at the bank. Show no QR and no number (the fallback tab
            below would otherwise hand out BDO's with BDO switched off).
            The proof stage still exists: somebody who paid before the
            switch still needs to send their picture.
          */}
          {railsClosed ? (
            <p role="status" className="rounded-lg border border-ink/15 bg-ink/[0.03] p-4 text-sm text-ink/75">
              {PAYMENTS_PAUSED_MESSAGE}
            </p>
          ) : (
            <>
              {/* 🔁 THE SAME RAILS THE COUPLE'S CHECKOUT DRAWER SHOWS.
                  Owner, 2026-09-20: *"cant we have 1 type of payment process?
                  and just have this one that pops up on the right corner?"* —
                  so the cards, the code and the account rows are now ONE
                  component (app/_components/payment/payment-rails.tsx) rather
                  than a tab row and a QrTile that only ever agreed by hand.
                  What did NOT move is this page's lifecycle: the order already
                  exists here, which is what makes /pay an address you can come
                  back to. */}
              <ChannelToggle
                channel={channel}
                onChange={setChannel}
                open={[
                  ...(gcash.enabled ? (['gcash'] as const) : []),
                  ...(bdo.enabled ? (['bdo'] as const) : []),
                ]}
              />

              {/* ⛔ THE MANUAL FALLBACK IS INSIDE THIS BLOCK — the account name,
                  the number and the exact amount, each copyable. It is the
                  route for anyone whose wallet refuses the code, which is the
                  one thing a code-first screen must never take away. */}
              <PaymentDetailsBlock
                channel={channel}
                /* 🔑 `mintedUrl` IS THE SERVER'S IMAGE AND IT STAYS. Handing a
                   payload down for the browser to draw is what put a ₱0 static
                   code on screen until the `qrcode` chunk arrived — owner:
                   "the amount is not filled up. it only shows 0." No payload
                   is passed, so there is nothing for the browser to draw and
                   no window in which the wrong code can show. */
                info={{
                  name: info.name,
                  number: info.number,
                  staticUrl: info.staticUrl,
                  mintedUrl: info.mintedUrl,
                }}
                referenceCode={reference}
                amountPhp={amountPhp}
                /* Not "below": on this page the picture is the NEXT STAGE. */
                proofHint="then send us the screenshot on the next step."
              />
            </>
          )}

          <p className="mt-4 text-[11px] leading-relaxed text-ink/55">
            Paying on the same phone? Save the code to your photos first &mdash; your wallet&rsquo;s
            scanner can open it from your gallery. Sending to BDO from another bank usually costs you
            a ₱10&ndash;₱15 transfer fee; GCash to GCash is free.
          </p>

          <div className="mt-5 flex flex-col gap-2">
            <StageLink
              stage={3}
              reference={reference}
              carryQuery={carryQuery}
              onGo={go}
              className="button-primary w-full justify-center"
            >
              {advanceLabel(2)}
            </StageLink>
            <StageLink
              stage={1}
              reference={reference}
              carryQuery={carryQuery}
              onGo={go}
              className="text-center text-sm text-ink/60 underline underline-offset-4"
            >
              Back
            </StageLink>
          </div>
        </section>
      </div>

      {/* ── STAGE 3 ──────────────────────────────────────────────────────────
          ⛔ ABSENT, NOT HIDDEN, UNTIL ITS STAGE IS REACHED — and never
          unmounted afterwards. See `shouldMountProof`. */}
      {proofMounted && (
        <div hidden={stage !== PROOF_STAGE}>
          <section id="proofCard" className="sn-tile mt-5 scroll-mt-4 p-6">
            <StepHead n={3} title="Send your proof" />
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
                setup={setup}
              />
            )}
            <div className="mt-4">
              <StageLink
                stage={2}
                reference={reference}
                carryQuery={carryQuery}
                onGo={go}
                className="text-sm text-ink/60 underline underline-offset-4"
              >
                Back to the code
              </StageLink>
            </div>
          </section>
        </div>
      )}

      <StickyBar
        amountPhp={amountPhp}
        activatesLine={activatesLine}
        proofSent={proofSent}
        stage={stage}
        reference={reference}
        carryQuery={carryQuery}
        onGo={go}
      />
    </>
  );
}

/**
 * The control that leaves a stage.
 *
 * 🔑 IT IS AN ANCHOR FIRST AND A BUTTON SECOND. With JavaScript off, still
 * loading, or broken, this navigates to `?step=N` and the server paints that
 * stage — the flow keeps working. Once React is listening, `onClick` takes
 * over so nothing is re-rendered and the proof form is not unmounted.
 */
function StageLink({
  stage,
  reference,
  carryQuery,
  onGo,
  className,
  children,
}: {
  stage: PayStage;
  reference: string;
  carryQuery: Record<string, string | undefined>;
  onGo: (s: PayStage) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={stageHref(reference, stage, carryQuery)}
      className={`inline-flex items-center ${className ?? ''}`}
      onClick={(e) => {
        // Let a modified click open a new tab, exactly as any link would.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onGo(stage);
      }}
    >
      {children}
    </a>
  );
}

/** Where they are, and a way back to anywhere they have already been. */
function StageRail({
  stage,
  reference,
  carryQuery,
  onGo,
}: {
  stage: PayStage;
  reference: string;
  carryQuery: Record<string, string | undefined>;
  onGo: (s: PayStage) => void;
}) {
  return (
    <nav aria-label="Paying, step by step" className="mb-4 flex items-center gap-2">
      {PAY_STAGES.map(({ n, title }) => {
        const done = n < stage;
        const here = n === stage;
        const dot = (
          <span
            className={`grid h-6 w-6 flex-none place-items-center rounded-full text-[12px] font-bold ${
              here ? 'bg-ink text-white' : done ? 'bg-ink/15 text-ink' : 'bg-ink/[0.06] text-ink/40'
            }`}
          >
            {n}
          </span>
        );
        return (
          <span key={n} className="flex items-center gap-2">
            {/* ⚠ ONLY A STAGE ALREADY PASSED IS A LINK. A forward jump would
                skip paying and land somebody on the upload for a payment they
                have not made — the thing the owner struck. */}
            {done ? (
              <StageLink stage={n} reference={reference} carryQuery={carryQuery} onGo={onGo}>
                {dot}
              </StageLink>
            ) : (
              dot
            )}
            {here && <span className="sn-eye">{title}</span>}
          </span>
        );
      })}
    </nav>
  );
}

/*
 * ⛔ `jump(id)` LIVED HERE AND IS GONE. It scrolled between the three tiles
 * because all three were on one page; with one stage on screen at a time there
 * is nothing to scroll TO, and leaving it would have been a second way to move
 * that the URL knew nothing about.
 */

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


/* 🔁 ChannelTab AND QrTile ARE GONE — the cards and the code now come from
   app/_components/payment/payment-rails.tsx, which the couple's checkout
   drawer renders too (owner, 2026-09-20: "cant we have 1 type of payment
   process?").

   ⛔ THE ONE THING THAT MUST NOT COME BACK WITH THEM: the renderer in the
   BROWSER. QrTile used to hold `useEffect` + `import('qrcode')`, so `minted`
   was null on every first render and the image fell through to the STATIC
   merchant code — real, scannable, and worth ₱0. It swapped itself for the
   right one some hundreds of milliseconds later; on a phone on mobile data
   that window is not theoretical, and the owner paid through it on
   2026-09-20. This page therefore hands the shared block a `mintedUrl` the
   SERVER drew and NO payload, so there is nothing for a browser to draw and
   no window in which the ₱0 code can show. */

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
  setup,
}: {
  orderId: string;
  reference: string;
  amountPhp: number;
  channel: Channel;
  requiresReference: boolean;
  rechecked: boolean;
  setup: boolean;
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
      {/* So a recheck can send them back to the SAME screen they were on. */}
      {setup && <input type="hidden" name="setup" value="1" />}

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
  stage,
  reference,
  carryQuery,
  onGo,
}: {
  amountPhp: number;
  activatesLine: string;
  proofSent: boolean;
  stage: PayStage;
  reference: string;
  carryQuery: Record<string, string | undefined>;
  onGo: (s: PayStage) => void;
}) {
  /**
   * ⛔ THE SCROLL LISTENER IS GONE, AND IT IS NOT A SIMPLIFICATION — it is the
   * same fact stated once instead of twice. The bar used to guess which step a
   * person was on from how far they had scrolled, because every step was on
   * one page. The stage IS the answer now, and a second derivation of it could
   * only ever disagree with the first.
   */
  const last = stage === PROOF_STAGE;
  const label = proofSent ? 'Back to the code' : (advanceLabel(stage) ?? 'Continue');
  const target = proofSent ? prevStage(stage) : nextStage(stage);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/12 bg-white/95 px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto flex max-w-[560px] items-center gap-3">
        <span className="whitespace-nowrap font-mono text-[17px] font-bold text-ink">
          <span className="block font-sans text-[11px] font-normal text-ink/55">
            {proofSent ? 'Checking' : 'To pay'}
          </span>
          {payAmount(amountPhp)}
        </span>
        {/* On the last stage the bar carries no action: the only thing left to
            do is the form's own submit, and a second button beside it is a
            second thing to press that does not send the proof. */}
        {last && !proofSent ? (
          <span className="flex-1 text-right text-xs leading-snug text-ink/55">
            Send your screenshot and reference above.
          </span>
        ) : (
          <StageLink
            stage={target}
            reference={reference}
            carryQuery={carryQuery}
            onGo={onGo}
            className="button-primary flex-1 justify-center"
          >
            {label}
          </StageLink>
        )}
      </div>
      <p className="sr-only">{activatesLine}</p>
    </div>
  );
}
