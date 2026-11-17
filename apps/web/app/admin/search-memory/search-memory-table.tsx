'use client';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { ActionButton } from '@/components/action-button';

import { useState, useTransition } from 'react';
import { BrainCircuit, GraduationCap, Save, Trash2, X } from 'lucide-react';

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
  return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' });
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
                    <PickMenu
                      label="Where this phrase should go"
                      value={pickHref}
                      options={destinations.map((d) => ({ key: d.href, label: d.label }))}
                      onPick={setPickHref}
                      dataAttr="data-teach-destination"
                      className="min-h-11"
                    />
                    <ActionButton tone="ok" icon={Save} label="Save" type="button" onClick={() => handleTeach(row.phrase)} disabled={busy.has(row.phrase)} />
                    <ActionButton tone="neutral" icon={X} label="Cancel" type="button" onClick={() => setTeaching(null)} />
                  </div>
                );
              }
              return (
                <>
                  <div className="font-medium text-ink">{label}</div>
                  <div className="break-all text-[12px] text-ink/50 tabular-nums">{href}</div>
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
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[12px] font-medium ${LEARNED_STYLE[from]}`}
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
                  <ActionButton tone="neutral" icon={GraduationCap} label="Teach it this instead" type="button" onClick={() => openTeach(row.phrase, overrides.get(row.phrase)?.href ?? row.href)} disabled={isBusy || teaching === row.phrase} />
                  <ActionButton tone="neutral" icon={Trash2} label="Delete" type="button" onClick={() => handleDelete(row.phrase)} disabled={isBusy} />
                </span>
              );
            },
          },
        ]}
      />
    </div>
  );
}
