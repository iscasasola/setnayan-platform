'use client';

import { useId, useState, useTransition } from 'react';
import { Check, Copy, Download, Send } from 'lucide-react';
import {
  createAdminVendorInvite,
  type AdminInviteResult,
} from '../actions';
import { useSaveLoader } from '@/components/sd-loader';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SWITCH_TRACK } from '@/app/_components/switch-track';
import { svgDataUri, qrFileName } from '@/lib/qr-download';
import {
  PERSONAL_INVITE_PHOTO_ALLOWANCE,
  PERSONAL_INVITE_TIERS,
  planMenuNote,
  type PlanPrices,
} from '@/lib/personal-invite-offer';
import { PORTFOLIO_FREE_BASE } from '@/lib/vendor-tier-caps';
import { planWord } from '@/lib/vendor-plan-change-words';

type Ok = Extract<AdminInviteResult, { status: 'ok' }>;

/** The small mono section label the supplier screens use ("The offer", "Invite card", "Message to send"). */
function Sec({ children }: { children: string }) {
  return (
    <p className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/55" data-invite-sec="">
      {children}
    </p>
  );
}

/**
 * Admin-side vendor-invite form (2026-05-21). Posts to `createAdminVendorInvite`; on success, displays the claim URL
 * with a copy-to-clipboard button so the admin can paste it into Messenger / SMS. No automated send in V1 — admin
 * shares the link manually.
 *
 * 🎁 THE PERSONAL INVITE (owner 2026-10-23, prototype `supplier_personal_invite_2026-10-23.html` frames A2 · A3) —
 * the same form, the same one button, with **The offer** appended: the plan they get free (one dropdown), until when
 * (a date), and a switch, off, for 100 portfolio photos that stay theirs after the offer ends. The result keeps the
 * link and Copy exactly as shipped and adds the card to download and the message to copy. Prices in the dropdown are
 * the catalogue's (`readPersonalInvitePlanPrices`), handed in — none is typed here.
 */
export function InviteVendorForm({
  prices = {},
  categories = [],
}: {
  /** 28-day catalogue price per plan; a plan with none is listed without a price. */
  prices?: PlanPrices;
  /** Every supplier category, `{ key, label }`, in the taxonomy's order. */
  categories?: ReadonlyArray<{ key: string; label: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const save = useSaveLoader();
  const [state, setState] = useState<{ kind: 'idle' } | ({ kind: 'success' } & Ok) | { kind: 'error'; message: string }>({
    kind: 'idle',
  });
  const [category, setCategory] = useState<string>('');
  const [plan, setPlan] = useState<string>('free');
  const [photos, setPhotos] = useState(false);
  const switchId = useId();
  const untilId = useId();

  const planOptions = (['free', ...PERSONAL_INVITE_TIERS] as const).map((k) => {
    const note = planMenuNote(k, prices);
    return { key: k, label: planWord(k), ...(note ? { trail: { text: note, tone: 'muted' as const } } : {}) };
  });
  const categoryOptions = [{ key: '', label: 'Not set' }, ...categories];

  return (
    <section className="mb-6 rounded-xl border border-ink/10 bg-cream p-4 sm:p-5" data-invite-vendor="">
      <h2 className="text-base font-semibold tracking-tight text-ink">
        Invite a supplier
      </h2>
      <p className="mt-1 text-sm text-ink/65">
        Pre-create a supplier account. The supplier uses your link to sign up and
        continues filling in their profile — no setup work needed on your end.
      </p>

      <form
        className="mt-4 grid gap-3 sm:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const fd = new FormData(form);
          startTransition(async () => {
            const result: AdminInviteResult = await save.run(
              () => createAdminVendorInvite(fd),
              { steps: ['Sending the invite'], hint: 'Saving' },
            );
            if (result.status === 'ok') {
              setState({ kind: 'success', ...result });
              form.reset();
              setCategory('');
              setPlan('free');
              setPhotos(false);
              return;
            }
            if (result.status === 'invalid_email') {
              setState({ kind: 'error', message: 'Please enter a valid email address.' });
              return;
            }
            if (result.status === 'duplicate_pending') {
              setState({
                kind: 'error',
                message: 'There is already a pending invite for this email. Revoke it first if you need to re-send.',
              });
              return;
            }
            setState({ kind: 'error', message: result.message ?? 'Could not create invite.' });
          });
        }}
      >
        <label className="space-y-1">
          <span className="block text-xs font-medium text-ink/70">Supplier email</span>
          <input
            name="email"
            type="email"
            required
            placeholder="hello@vendorbusiness.ph"
            className="input-field"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-ink/70">Business name</span>
          <input
            name="business_name"
            type="text"
            required
            maxLength={128}
            placeholder="ABC Catering"
            className="input-field"
          />
        </label>
        <div className="space-y-1">
          <span className="block text-xs font-medium text-ink/70">Service category</span>
          <input type="hidden" name="service_category" value={category} />
          <PickMenu
            label="Service category"
            value={category}
            options={categoryOptions}
            onPick={setCategory}
            dataAttr="data-invite-category"
            className="w-full !min-h-11"
          />
        </div>

        {/* ── THE OFFER (owner 2026-10-23) ── */}
        <div className="sm:col-span-3" data-invite-offer="">
          <Sec>The offer</Sec>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <span className="block text-xs font-medium text-ink/70">Plan they get for free</span>
              <input type="hidden" name="offer_tier" value={plan === 'free' ? '' : plan} />
              <PickMenu
                label="Plan they get for free"
                value={plan}
                options={planOptions}
                onPick={setPlan}
                dataAttr="data-invite-plan"
                className="w-full !min-h-11"
              />
            </div>
            {plan !== 'free' ? (
              <label className="space-y-1" htmlFor={untilId}>
                <span className="block text-xs font-medium text-ink/70">Free until</span>
                <input id={untilId} name="offer_until" type="date" required className="input-field" data-invite-until="" />
              </label>
            ) : null}
          </div>
          <label htmlFor={switchId} className="mt-2 flex min-h-11 cursor-pointer items-center justify-between gap-3 py-2" data-invite-photos="">
            <span>
              <span className="block text-[15px] text-ink">Give {PERSONAL_INVITE_PHOTO_ALLOWANCE} portfolio photos</span>
              <span className="mt-0.5 block text-[12.5px] text-ink/60">
                Off: {PORTFOLIO_FREE_BASE}, as on every plan. On: {PERSONAL_INVITE_PHOTO_ALLOWANCE}, and it stays after the offer ends.
              </span>
            </span>
            <span className="relative flex-none">
              <input
                id={switchId}
                type="checkbox"
                role="switch"
                name="offer_photos"
                checked={photos}
                onChange={(e) => setPhotos(e.target.checked)}
                className="peer sr-only"
              />
              <span aria-hidden className={SWITCH_TRACK} />
            </span>
          </label>
        </div>

        <div className="sm:col-span-3">
          <button
            type="submit"
            disabled={pending}
            className="button-primary inline-flex items-center gap-2 disabled:opacity-60"
          >
            <Send aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {pending ? 'Creating invite…' : 'Create invite link'}
          </button>
        </div>
      </form>

      {state.kind === 'success' ? <InviteResult result={state} /> : null}

      {state.kind === 'error' ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {state.message}
        </p>
      ) : null}
    </section>
  );
}

/**
 * THE RESULT (frame A3) — the link and Copy as shipped, then the card to download and the message to copy. One main
 * button at a time: "Download the card". Exported for `/dev/personal-invite-lab`, which draws it on fixtures.
 */
export function InviteResult({ result }: { result: Ok }) {
  const [copied, setCopied] = useState<'link' | 'message' | null>(null);

  function copyToClipboard(text: string, what: 'link' | 'message') {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(what);
        setTimeout(() => setCopied(null), 2000);
      },
      () => {
        // Clipboard write can fail on insecure-context (http) or when the
        // browser denies permission. Surface nothing — admin can manually
        // select + copy the visible text.
      },
    );
  }

  /** "Download the card" — a plain download of the same SVG that is on screen; never a new tab (`lib/qr-download.ts`). */
  function downloadCard(svg: string, name: string) {
    const a = document.createElement('a');
    a.href = svgDataUri(svg);
    a.download = qrFileName(`invite ${name}`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
        <div className="mt-5 border-t border-ink/10 pt-4" data-invite-result="">
          <p className="text-sm font-semibold text-success-900">
            Invite ready for {result.businessName}.
          </p>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-ink/10 py-1.5 pl-3 pr-1.5">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-ink/75">{result.claimUrl}</code>
            <ActionButton
              tone="neutral"
              icon={copied === 'link' ? Check : Copy}
              label={copied === 'link' ? 'Copied' : 'Copy link'}
              onClick={() => copyToClipboard(result.claimUrl, 'link')}
            />
          </div>
          <p className="mt-2 text-xs text-ink/60">
            Expires in 90 days.
            {result.offerLine ? ` ${result.offerLine}` : ' The supplier signs up via this link, and their shop is created automatically with the business name you entered.'}
          </p>

          <Sec>Invite card</Sec>
          <div
            className="mx-auto mt-2 w-full max-w-[360px] [&>svg]:h-auto [&>svg]:w-full"
            data-invite-card-wrap=""
            // The card is built on the server from escaped text and the shipped QR drawing (`personalInviteCardSvg`).
            dangerouslySetInnerHTML={{ __html: result.cardSvg }}
          />
          <div className="mt-3">
            <ActionButton
              tone="brand"
              main
              icon={Download}
              label="Download the card"
              className="w-full"
              onClick={() => downloadCard(result.cardSvg, result.businessName)}
            />
          </div>

          <Sec>Message to send</Sec>
          <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-ink/[0.04] px-3.5 py-3 text-sm leading-relaxed text-ink" data-invite-message="">
            {result.message}
          </p>
          <div className="mt-3">
            <ActionButton
              tone="neutral"
              icon={copied === 'message' ? Check : Copy}
              label={copied === 'message' ? 'Copied' : 'Copy message'}
              className="w-full"
              onClick={() => copyToClipboard(result.message, 'message')}
            />
          </div>
        </div>
        );
}
