'use client';

import { useState, useTransition } from 'react';
import { Plus, Check, AlertTriangle } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import {
  addVendorDomain,
  verifyVendorDomain,
  removeVendorDomain,
  type DomainRow,
} from './actions';
import { useSaveLoader } from '@/components/sd-loader';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { FormRows, TypedRow } from '@/app/_components/form-row';

type DnsRec = { type: string; name: string; value: string };
type Item = DomainRow & { dns?: DnsRec[]; note?: string };

export function DomainManager({
  initial,
  proAsks = false,
}: {
  initial: DomainRow[];
  /**
   * The page's ◆ Pro question for your own address (owner 2026-10-15; `proAsks` on Your page). While it asks, the card
   * must not ALSO say "It's free" — one box saying Pro and free is a money contradiction (supplier batch walk, W4).
   */
  proAsks?: boolean;
}) {
  const [items, setItems] = useState<Item[]>(initial);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const save = useSaveLoader();

  /** Add a domain — from the button (what the box holds) or from Enter in the box (`onEnter`, which hands its words over). */
  function handleAdd(typed: string = input) {
    if (pending || !typed.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await save.run(() => addVendorDomain(typed), {
        steps: ['Adding your domain'],
        hint: 'Saving',
      });
      if (!res.ok || !res.domainId) {
        setError(res.error ?? 'Something went wrong.');
        return;
      }
      setItems((prev) => [
        ...prev.filter((d) => d.domain !== res.domain),
        { domain_id: res.domainId!, domain: res.domain!, verified: Boolean(res.verified), dns: res.dns },
      ]);
      setInput('');
    });
  }

  function handleVerify(id: string) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const res = await save.run(() => verifyVendorDomain(id), {
        steps: ['Verifying your domain'],
        hint: 'Saving',
      });
      setBusyId(null);
      if (res.ok && res.verified) {
        setItems((prev) => prev.map((d) => (d.domain_id === id ? { ...d, verified: true, note: undefined } : d)));
      } else {
        setItems((prev) => prev.map((d) => (d.domain_id === id ? { ...d, dns: res.dns ?? d.dns, note: res.error } : d)));
      }
    });
  }

  /**
   * 👈 A domain's delete is its SWIPE (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO
   * VISIBLE ✕ ON ROWS"): left on a phone, the hover trash on a computer. The row hides at once and the removal is
   * written after the Undo window (`deleteWithUndo`) — the same `removeVendorDomain`, so Undo never has to re-add the
   * address at Vercel. A refusal brings the row back and says why.
   */
  function handleRemove(d: Item) {
    setError(null);
    let at = -1;
    deleteWithUndo({
      label: `${d.domain} removed`,
      hide: () =>
        setItems((prev) => {
          at = prev.findIndex((x) => x.domain_id === d.domain_id);
          return prev.filter((x) => x.domain_id !== d.domain_id);
        }),
      restore: () =>
        setItems((prev) => {
          if (prev.some((x) => x.domain_id === d.domain_id)) return prev;
          const next = [...prev];
          next.splice(at < 0 ? next.length : Math.min(at, next.length), 0, d);
          return next;
        }),
      commit: () => removeVendorDomain(d.domain_id),
      failed: `Couldn’t remove ${d.domain}. It’s back — try again.`,
    });
  }

  return (
    <section className="mt-6 space-y-3" data-domain-manager="">
      {/* Template rule 2 + 7: a plain section (no card) — the label, and the how-to behind its ⓘ. */}
      <InfoTip
        label="Use your own web address"
        labelAs="h2"
        align="start"
        labelClassName="inline-flex items-center gap-2 text-[15px] font-semibold text-ink"
      >
        Point a domain you own (like sny.yourshop.com) at your Setnayan page.{proAsks ? '' : ' It’s free.'} You’ll add one
        DNS record, then verify.
      </InfoTip>

      {items.length > 0 && (
        <ul className="divide-y divide-[color:var(--m-line)] border-y border-[color:var(--m-line)]">
          {items.map((d) => (
            <SwipeToDelete
              key={d.domain_id}
              as="li"
              label={`Remove ${d.domain}`}
              word="Remove"
              onDelete={() => handleRemove(d)}
              disabled={pending}
              radiusClass="rounded-none"
              surfaceClass="bg-white"
            >
            <div className="py-3" data-domain-row="">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-ink">
                  {d.verified ? (
                    <Check aria-hidden className="h-4 w-4 shrink-0" style={{ color: 'rgb(var(--color-ok))' }} strokeWidth={2} />
                  ) : (
                    <AlertTriangle aria-hidden className="h-4 w-4 shrink-0" style={{ color: 'var(--m-orange-2)' }} strokeWidth={1.75} />
                  )}
                  {d.domain}
                  <span className="text-[13px] font-normal text-[color:var(--m-slate-2)]">
                    {d.verified ? '· Live' : '· Pending DNS'}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  {!d.verified && (
                    <ActionButton
                      tone="info"
                      icon={Check}
                      label={busyId === d.domain_id && pending ? 'Checking…' : 'Verify'}
                      onClick={() => handleVerify(d.domain_id)}
                      disabled={pending}
                    />
                  )}
                </div>
              </div>

              {!d.verified && d.dns && d.dns.length > 0 && (
                <div className="mt-3 space-y-2 rounded-[var(--m-r-lg)] bg-[color:var(--m-paper-2)] p-3">
                  <p className="text-[13px] text-[color:var(--m-slate-2)]">
                    Add {d.dns.length === 1 ? 'this record' : 'these records'} at your domain provider,
                    then click Verify:
                  </p>
                  {d.dns.map((r, i) => (
                    <div key={i} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px] text-ink">
                      <span className="text-[color:var(--m-slate-2)]">Type</span><span className="font-mono">{r.type}</span>
                      <span className="text-[color:var(--m-slate-2)]">Name</span><span className="break-all font-mono">{r.name}</span>
                      <span className="text-[color:var(--m-slate-2)]">Value</span><span className="break-all font-mono">{r.value}</span>
                    </div>
                  ))}
                </div>
              )}
              {d.note && (
                <p className="mt-2 text-[13px] text-[rgb(var(--color-warn))]">{d.note}</p>
              )}
            </div>
            </SwipeToDelete>
          ))}
        </ul>
      )}
      <UndoToastHost />

      <div className="flex flex-col gap-2 sm:flex-row">
        {/* ✍ A row of the ONE Field template (`TypedRow`, owner 1 Nov 2026). It follows what is typed (`onType`), so
            "Add domain" lights up as before. ⏎ ENTER ADDS (owner 1 Nov 2026, "ENTER STILL ADDS IN ONE-LINE ADD BOXES":
            `onEnter`), as the raw box did; a tap away only keeps it. 🔒 enter-still-adds.test.ts */}
        <div className="min-w-0 flex-1">
          <FormRows width="wide">
            <TypedRow
              name="Your custom domain"
              value={input}
              empty="sny.yourshop.com"
              placeholder="sny.yourshop.com"
              inputMode="url"
              autoCapitalize="off"
              maxLength={253}
              onType={setInput}
              onKeep={(t) => setInput(t)}
              onEnter={handleAdd}
              data="custom-domain"
              pillAttrs={{ 'data-custom-domain': '' }}
            />
          </FormRows>
        </div>
        <ActionButton
          tone="brand"
          icon={Plus}
          label={pending && !busyId ? 'Adding…' : 'Add domain'}
          onClick={() => handleAdd()}
          disabled={pending || !input.trim()}
        />
      </div>

      {error && (
        <p className="text-sm text-[rgb(var(--color-danger))]" role="alert">{error}</p>
      )}
    </section>
  );
}
