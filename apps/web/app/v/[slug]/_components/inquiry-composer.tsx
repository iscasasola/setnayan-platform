'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, AlertCircle, MessageCircle } from 'lucide-react';
import { startServiceInquiry, type StartServiceInquiryResult } from '../inquiry-actions';

export type InquiryComposerService = {
  vendorServiceId: string;
  label: string;
  priceLabel: string;
};

type Props = {
  vendorProfileId: string;
  vendorLabel: string;
  /** The service the couple clicked Inquire on — recorded source='initial'. */
  initial: InquiryComposerService & { categoryKey: string | null };
  /**
   * Price-included linked services for the initial pick — shown as read-only
   * "✓ included" context and recorded source='linked' server-side. The couple
   * can't uncheck a price-included service into non-existence.
   */
  linked: { label: string }[];
  /**
   * The vendor's OTHER standalone services — unchecked opt-in "Also ask about"
   * checkboxes, recorded source='couple_added' when ticked.
   */
  alsoOptions: InquiryComposerService[];
};

type LocalState =
  | { kind: 'idle' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string };

export function InquiryComposer({
  vendorProfileId,
  vendorLabel,
  initial,
  linked,
  alsoOptions,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<LocalState>({ kind: 'idle' });
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const alsoById = useMemo(
    () => new Map(alsoOptions.map((s) => [s.vendorServiceId, s])),
    [alsoOptions],
  );

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isSent = state.kind === 'sent';

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (isSent || pending) return;
        const alsoServiceIds = Array.from(checked).filter((id) => alsoById.has(id));
        startTransition(async () => {
          const result: StartServiceInquiryResult = await startServiceInquiry({
            vendorProfileId,
            initialServiceId: initial.vendorServiceId,
            initialCategoryKey: initial.categoryKey,
            alsoServiceIds,
          });
          if (result.status === 'ok') {
            setState({ kind: 'sent' });
            router.push(`/dashboard/${result.eventId}/messages/${result.threadId}`);
            return;
          }
          if (result.status === 'not_signed_in') {
            const next = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/login?next=${next}`;
            return;
          }
          if (result.status === 'no_event') {
            setState({
              kind: 'error',
              message: 'Create your event first, then send an inquiry.',
            });
            return;
          }
          setState({ kind: 'error', message: result.message ?? 'Could not send inquiry.' });
        });
      }}
      className="space-y-4 rounded-xl border border-ink/10 bg-cream p-5"
    >
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Inquire about
        </p>
        <p className="text-sm text-ink">
          <span className="font-semibold text-ink">{initial.label}</span>
          <span className="ml-2 font-mono text-xs text-ink/60">{initial.priceLabel}</span>
        </p>
      </div>

      {linked.length > 0 ? (
        <div className="space-y-1.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">
            Comes with
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {linked.map((l, i) => (
              <li
                key={`${l.label}-${i}`}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-300/60 bg-emerald-50 px-2.5 py-0.5 text-[12px] text-emerald-900"
              >
                <Check aria-hidden className="h-3 w-3" strokeWidth={2.25} />
                {l.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {alsoOptions.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">
            Also ask about
          </legend>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {alsoOptions.map((s) => {
              const on = checked.has(s.vendorServiceId);
              return (
                <li key={s.vendorServiceId}>
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      on
                        ? 'border-terracotta/50 bg-terracotta/5 text-ink'
                        : 'border-ink/10 bg-cream/80 text-ink/80 hover:border-terracotta/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(s.vendorServiceId)}
                      disabled={isSent || pending}
                      className="h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
                    />
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    <span className="font-mono text-[11px] text-ink/55">{s.priceLabel}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : null}

      {state.kind === 'error' ? (
        <p className="flex items-center gap-1.5 text-xs text-rose-700">
          <AlertCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSent || pending}
        className="inline-flex h-11 items-center gap-2 rounded-md bg-mulberry px-5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600 disabled:cursor-default disabled:opacity-90"
      >
        {isSent ? (
          <>
            <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
            Inquiry sent
          </>
        ) : (
          <>
            <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {pending ? 'Sending…' : `Inquire with ${vendorLabel}`}
          </>
        )}
      </button>
    </form>
  );
}
