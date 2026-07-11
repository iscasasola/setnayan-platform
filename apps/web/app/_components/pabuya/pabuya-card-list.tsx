import { Gift, Globe, Landmark, ShieldCheck, Smartphone } from 'lucide-react';
import { egiftKindMeta, type EgiftMethodKind } from '@/lib/egift-kinds';

/**
 * Shared, PRESENTATIONAL Pabuya guest-facing card list.
 *
 * Pure (no 'use client', no server-only, no data fetching) so it renders in
 * BOTH places the same way:
 *   • the couple dashboard's LIVE PREVIEW (inside a client component), and
 *   • the public /[slug]/pabuya guest route (server-rendered).
 * That parity is the point — what the couple arranges is exactly what guests
 * get. Interactivity (copy-to-clipboard, "open GCash") is intentionally NOT
 * here; a route that wants it wraps the handle in its own small client control.
 *
 * CORE INVARIANT copy lives in <PabuyaTrustNote>: Setnayan never holds money —
 * every card points at the couple's OWN account.
 */

export type PabuyaMethodCard = {
  kind: EgiftMethodKind | string;
  label: string;
  accountName: string | null;
  handle: string | null;
  note: string | null;
  /** Presigned URL for the QR image, or null when none uploaded. */
  qrUrl: string | null;
};

function KindIcon({ kind }: { kind: string }) {
  const cls = 'h-5 w-5 text-mulberry';
  switch (kind) {
    case 'gcash':
    case 'maya':
      return <Smartphone aria-hidden className={cls} strokeWidth={1.75} />;
    case 'bank':
      return <Landmark aria-hidden className={cls} strokeWidth={1.75} />;
    case 'paypal':
      return <Globe aria-hidden className={cls} strokeWidth={1.75} />;
    default:
      return <Gift aria-hidden className={cls} strokeWidth={1.75} />;
  }
}

export function PabuyaCardList({
  methods,
  emptyHint,
}: {
  methods: PabuyaMethodCard[];
  /** Shown when there are no methods — omit to render nothing. */
  emptyHint?: string;
}) {
  if (methods.length === 0) {
    return emptyHint ? (
      <p className="rounded-2xl border border-dashed border-ink/20 bg-cream/60 px-4 py-6 text-center text-sm text-ink/60">
        {emptyHint}
      </p>
    ) : null;
  }

  return (
    <ul className="space-y-3">
      {methods.map((m, i) => {
        const meta = egiftKindMeta(m.kind);
        return (
          <li
            key={`${m.kind}-${i}`}
            className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm"
          >
            <div className="flex items-start gap-3 p-4">
              <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mulberry/10">
                <KindIcon kind={m.kind} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg italic text-ink">
                  {m.label || meta.defaultLabel}
                </p>
                {m.accountName ? (
                  <p className="mt-0.5 text-sm text-ink/70">{m.accountName}</p>
                ) : null}
                {m.handle ? (
                  <p className="mt-1 break-all font-mono text-[13px] text-mulberry">
                    {m.handle}
                  </p>
                ) : null}
                {m.note ? (
                  <p className="mt-2 text-xs leading-relaxed text-ink/55">
                    {m.note}
                  </p>
                ) : null}
              </div>
              {m.qrUrl ? (
                <span className="inline-flex h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-ink/10 bg-cream">
                  {/* presigned URL → raw img (next/image would cache an expired URL) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.qrUrl}
                    alt={`${m.label || meta.defaultLabel} QR code`}
                    className="h-full w-full object-contain"
                  />
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The hand-off guarantee. Rendered on both surfaces (with audience-appropriate
 * copy) so the "Setnayan never holds your money" promise is impossible to miss.
 */
export function PabuyaTrustNote({
  audience = 'guest',
}: {
  audience?: 'guest' | 'couple';
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-success-200 bg-success-50 px-4 py-3">
      <ShieldCheck
        aria-hidden
        className="mt-0.5 h-4 w-4 shrink-0 text-success-700"
        strokeWidth={2}
      />
      <p className="text-xs leading-relaxed text-ink/70">
        {audience === 'couple' ? (
          <>
            <b className="text-ink">
              Guests send directly to your account — Setnayan never holds your
              money.
            </b>{' '}
            We only display the handles and QR codes you add here. There is no
            commission, no middleman, and no fees.
          </>
        ) : (
          <>
            <b className="text-ink">Setnayan never touches your money.</b> We
            only show you where to send it — it goes directly to the couple&rsquo;s
            own account. No commission, no middleman, no fees.
          </>
        )}
      </p>
    </div>
  );
}
