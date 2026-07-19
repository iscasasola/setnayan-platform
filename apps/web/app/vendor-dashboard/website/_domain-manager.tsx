'use client';

import { useState, useTransition } from 'react';
import { Globe, Plus, Check, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import {
  addVendorDomain,
  verifyVendorDomain,
  removeVendorDomain,
  type DomainRow,
} from './actions';
import { useSaveLoader } from '@/components/sd-loader';

type DnsRec = { type: string; name: string; value: string };
type Item = DomainRow & { dns?: DnsRec[]; note?: string };

export function DomainManager({ initial }: { initial: DomainRow[] }) {
  const [items, setItems] = useState<Item[]>(initial);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const save = useSaveLoader();

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const res = await save.run(() => addVendorDomain(input), {
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

  function handleRemove(id: string) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const res = await save.run(() => removeVendorDomain(id), {
        steps: ['Removing the domain'],
        hint: 'Saving',
      });
      setBusyId(null);
      if (res.ok) setItems((prev) => prev.filter((d) => d.domain_id !== id));
      else setError(res.error ?? 'Could not remove that domain.');
    });
  }

  return (
    <section
      className="mt-8 space-y-4 rounded-2xl p-6"
      style={{ background: 'var(--m-paper)', border: '1px solid var(--m-line)', boxShadow: 'var(--m-shadow-sm)' }}
    >
      <div className="space-y-1">
        <p className="sn-eye inline-flex items-center gap-2" style={{ color: 'var(--m-orange-2)' }}>
          <Globe aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Your own domain
        </p>
        <h2 className="text-lg font-semibold tracking-tight text-ink">Use your own web address</h2>
        <p className="max-w-2xl text-sm" style={{ color: 'var(--m-slate)' }}>
          Point a domain you own (like <span className="font-mono">sny.yourshop.com</span>) at your
          Setnayan page. It’s free. You’ll add one DNS record, then verify.
        </p>
      </div>

      {items.length > 0 && (
        <ul className="space-y-3">
          {items.map((d) => (
            <li
              key={d.domain_id}
              className="rounded-xl p-4"
              style={{ background: 'var(--m-ivory, #fff)', border: '1px solid var(--m-line)' }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 font-mono text-sm text-ink">
                  {d.verified ? (
                    <Check aria-hidden className="h-4 w-4 shrink-0" style={{ color: 'var(--m-sage-deep, #3f7d54)' }} strokeWidth={2} />
                  ) : (
                    <AlertTriangle aria-hidden className="h-4 w-4 shrink-0" style={{ color: 'var(--m-orange-2)' }} strokeWidth={1.75} />
                  )}
                  {d.domain}
                  <span className="text-xs" style={{ color: 'var(--m-slate)' }}>
                    {d.verified ? '· Live' : '· Pending DNS'}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  {!d.verified && (
                    <button
                      type="button"
                      onClick={() => handleVerify(d.domain_id)}
                      disabled={pending}
                      className="button-secondary inline-flex items-center gap-2"
                    >
                      {busyId === d.domain_id && pending ? (
                        <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                      ) : (
                        <Check aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                      )}
                      Verify
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(d.domain_id)}
                    disabled={pending}
                    aria-label={`Remove ${d.domain}`}
                    className="button-secondary inline-flex items-center gap-1.5"
                  >
                    <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>

              {!d.verified && d.dns && d.dns.length > 0 && (
                <div className="mt-3 space-y-2 rounded-lg p-3" style={{ background: 'var(--m-paper)' }}>
                  <p className="text-xs" style={{ color: 'var(--m-slate)' }}>
                    Add {d.dns.length === 1 ? 'this record' : 'these records'} at your domain provider,
                    then click Verify:
                  </p>
                  {d.dns.map((r, i) => (
                    <div key={i} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-xs text-ink">
                      <span style={{ color: 'var(--m-slate)' }}>Type</span><span>{r.type}</span>
                      <span style={{ color: 'var(--m-slate)' }}>Name</span><span className="break-all">{r.name}</span>
                      <span style={{ color: 'var(--m-slate)' }}>Value</span><span className="break-all">{r.value}</span>
                    </div>
                  ))}
                </div>
              )}
              {d.note && (
                <p className="mt-2 text-xs" style={{ color: 'var(--m-orange-2)' }}>{d.note}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          inputMode="url"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="sny.yourshop.com"
          aria-label="Your custom domain"
          className="min-w-0 flex-1 rounded-lg px-3 py-2 font-mono text-sm text-ink"
          style={{ background: 'var(--m-ivory, #fff)', border: '1px solid var(--m-line)' }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={pending || !input.trim()}
          className="button-primary inline-flex items-center justify-center gap-2"
        >
          {pending && !busyId ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.75} />
          ) : (
            <Plus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          )}
          Add domain
        </button>
      </div>

      {error && (
        <p className="text-sm" style={{ color: 'var(--m-orange-2)' }} role="alert">{error}</p>
      )}
    </section>
  );
}
