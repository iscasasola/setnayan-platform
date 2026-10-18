'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { restoreWithApple } from '@/lib/iap/native-store';
import { iapProductForServiceKey } from '@/lib/iap/products';
import type { IapRestoreResult } from '@/lib/iap/iap-outcome';

/**
 * 🍎 PROFILE › RESTORE PURCHASES (Apple requires it; prototype
 * `in_app_purchase_screens_2026-10-17_fable.html` frame 12). Mounted by the
 * Profile page ONLY where the iPhone app may sell through Apple.
 *
 * Restore asks Apple for this Apple ID's transactions and hands each to our
 * server, which matches it to THIS account's purchases and switches on anything
 * not yet on — never twice. Event Hub Pro and Live Watch are listed by event;
 * Papic credits are not "restored": they live on the event, never on the phone.
 */
export function RestorePurchasesRow({ className }: { className: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IapRestoreResult | null>(null);
  const run = () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    void restoreWithApple().then((r) => {
      setBusy(false);
      setResult(r);
    });
  };
  const listed =
    result && result.ok
      ? result.restored.filter((r) => iapProductForServiceKey(r.serviceKey)?.kind !== 'papic-credits')
      : [];
  return (
    <div data-restore-purchases="">
      <button type="button" onClick={run} disabled={busy} className={`${className} w-full text-left`}>
        <span className="inline-flex min-w-0 flex-col">
          <span className="inline-flex items-center gap-2">
            <RotateCcw aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Restore purchases
          </span>
          <span className="text-xs text-ink/60">Bought on another phone, or signed out</span>
        </span>
        <span className="text-sm font-semibold text-ink/70">{busy ? 'Restoring…' : 'Restore'}</span>
      </button>
      {result ? (
        <div className="space-y-2 px-4 pb-4 text-sm text-ink/75" role="status" data-restore-result="">
          {!result.ok ? (
            <p>The App Store couldn’t be reached. Nothing changed — try again in a moment.</p>
          ) : listed.length === 0 && result.pending === 0 ? (
            <p>Nothing to restore — anything you bought is already on your event.</p>
          ) : (
            <>
              {listed.length > 0 ? <p className="font-semibold text-ink">Restored</p> : null}
              <ul className="space-y-1">
                {listed.map((r) => (
                  <li key={`${r.eventId}:${r.serviceKey}`}>
                    ✓ {iapProductForServiceKey(r.serviceKey)?.appStoreName ?? r.serviceKey}
                    {r.eventName ? ` · ${r.eventName}` : ''}
                  </li>
                ))}
              </ul>
              {result.pending > 0 ? (
                <p>
                  {result.pending === 1 ? 'One purchase is' : `${result.pending} purchases are`} still being switched on.
                  You will not be charged twice.
                </p>
              ) : null}
            </>
          )}
          {result.ok ? (
            <p className="text-xs text-ink/60">
              Papic credits don’t need restoring — they are kept on the event, never on the phone. Anything bought
              outside the app was already here.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
