'use client';

import { useState, useTransition } from 'react';
import { BrainCircuit, GraduationCap, Trash2 } from 'lucide-react';

import { ConsoleTable } from '@/app/admin/_components/console-table';
import type { SearchMemoryRow } from '@/lib/admin-search-memory';
import { deleteSearchPhraseAction, teachSearchPhraseAction } from './actions';

type Destination = { label: string; href: string };

const LEARNED_STYLE: Record<'ai' | 'admin', string> = {
  ai: 'bg-terracotta/10 text-mulberry border-terracotta/20',
  admin: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function SearchMemoryTable({
  rows,
  readError,
  destinations,
}: {
  rows: SearchMemoryRow[] | null;
  readError: { message?: string } | null;
  destinations: Destination[];
}) {
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [overrides, setOverrides] = useState<ReadonlyMap<string, { href: string; label: string }>>(
    new Map(),
  );
  const [error, setError] = useState<string | null>(null);
  const [teaching, setTeaching] = useState<string | null>(null);
  const [pickHref, setPickHref] = useState('');

  function mark(phrase: string, on: boolean) {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(phrase);
      else next.delete(phrase);
      return next;
    });
  }

  function handleDelete(phrase: string) {
    const ok = window.confirm(
      `Forget "${phrase}"?\n\nThe next admin who types it reaches the assistant again, ` +
        `same as if it had never been asked.`,
    );
    if (!ok) return;
    setError(null);
    mark(phrase, true);
    startTransition(async () => {
      const res = await deleteSearchPhraseAction(phrase);
      mark(phrase, false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setGone((prev) => new Set(prev).add(phrase));
    });
  }

  function openTeach(phrase: string, currentHref: string) {
    setTeaching(phrase);
    setPickHref(currentHref);
    setError(null);
  }

  function handleTeach(phrase: string) {
    const target = destinations.find((d) => d.href === pickHref);
    if (!target) {
      setError('Pick a page first.');
      return;
    }
    setError(null);
    mark(phrase, true);
    startTransition(async () => {
      const res = await teachSearchPhraseAction(phrase, target.href, target.label);
      mark(phrase, false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOverrides((prev) => new Map(prev).set(phrase, target));
      setTeaching(null);
    });
  }

  const visible = (rows ?? []).filter((r) => !gone.has(r.phrase));

  return (
    <div>
      {error ? (
        <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
          {error}
        </p>
      ) : null}

      <ConsoleTable
        rows={readError ? null : visible}
        readPermitted
        readError={readError}
        reads="what the assistant has learned"
        label="Learned search phrases"
        minWidth="46rem"
        rowKey={(row) => row.phrase}
        empty={{
          Icon: BrainCircuit,
          title: 'Nothing learned yet',
          blurb:
            'The assistant only writes here after the free word matching finds nothing AND the AI is asked. Nobody has hit that path yet.',
        }}
        columns={[
          {
            header: 'Phrase',
            cell: (row) => <span className="break-words font-medium text-ink">“{row.phrase}”</span>,
          },
          {
            header: 'Resolves to',
            cell: (row) => {
              const applied = overrides.get(row.phrase);
              const label = applied?.label ?? row.label;
              const href = applied?.href ?? row.href;
              if (teaching === row.phrase) {
                return (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <select
                      value={pickHref}
                      onChange={(e) => setPickHref(e.target.value)}
                      className="rounded-md border border-ink/15 bg-white px-1.5 py-1 text-[12px] text-ink"
                    >
                      {destinations.map((d) => (
                        <option key={d.href} value={d.href}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleTeach(row.phrase)}
                      disabled={busy.has(row.phrase)}
                      className="rounded-md bg-success-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-success-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setTeaching(null)}
                      className="rounded-md border border-ink/15 px-2 py-1 text-[11px] text-ink/70"
                    >
                      Cancel
                    </button>
                  </div>
                );
              }
              return (
                <>
                  <div className="font-medium text-ink">{label}</div>
                  <div className="break-all font-mono text-[10.5px] text-ink/50">{href}</div>
                </>
              );
            },
          },
          {
            header: 'Learned from',
            hideBelow: 'md',
            cell: (row) => {
              const from = overrides.has(row.phrase) ? 'admin' : row.learnedFrom;
              return (
                <span
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${LEARNED_STYLE[from]}`}
                >
                  {from === 'admin' ? 'taught by an admin' : 'the AI'}
                </span>
              );
            },
          },
          {
            header: 'Used',
            align: 'right',
            mono: true,
            hideBelow: 'md',
            cell: (row) => <span className="text-ink/70">{row.timesUsed}×</span>,
          },
          {
            header: 'Last used',
            mono: true,
            hideBelow: 'lg',
            cell: (row) => <span className="whitespace-nowrap text-ink/70">{formatWhen(row.lastUsedAt)}</span>,
          },
          {
            header: 'Actions',
            align: 'right',
            cell: (row) => {
              const isBusy = busy.has(row.phrase);
              return (
                <span className="whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => openTeach(row.phrase, overrides.get(row.phrase)?.href ?? row.href)}
                    disabled={isBusy || teaching === row.phrase}
                    className="inline-flex items-center gap-1 rounded-md border border-ink/15 px-2 py-1 text-[12px] text-ink hover:bg-ink/5 disabled:opacity-50"
                  >
                    <GraduationCap className="h-3.5 w-3.5" aria-hidden />
                    Teach it this instead
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(row.phrase)}
                    disabled={isBusy}
                    className="ml-2 inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-[12px] text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Delete
                  </button>
                </span>
              );
            },
          },
        ]}
      />
    </div>
  );
}
