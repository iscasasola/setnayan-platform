'use client';

/**
 * Client-side actions for the /admin/demo-vendors page.
 *
 * Two modes:
 *   • Standalone (compact=false): renders "Cleanup ALL" + "Regenerate" buttons
 *     side-by-side, with the total count for context. Used in the "Actions"
 *     section header of the page.
 *   • Per-row (compact=true, batchId set): single "Cleanup this batch" button
 *     scoped to one batch. Used in the batches table.
 *
 * Both modes call the corresponding /api/admin/demo/* endpoint and refresh
 * the page on success via router.refresh().
 *
 * Confirmation: cleanup is reversible (re-run seed script), but the user
 * still types "DELETE" or clicks twice for the global cleanup — friction
 * matched to the blast radius.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, RotateCcw, Loader2, Check, X, Sparkles } from 'lucide-react';

type Props = {
  totalCount: number;
  batchId?: string;
  compact?: boolean;
  /** True when the admin's session has demo mode on (computed server-side by
   *  the page). Sent to the seed API so prod Create works without depending on
   *  the httpOnly cookie surviving the fetch. */
  demoMode?: boolean;
};

type ResultState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done'; deleted: number; nextStep?: { command: string; message: string } }
  | { kind: 'error'; message: string };

// One-click chunked create — drives /api/admin/demo/seed category-by-category.
type CreateState =
  | { kind: 'idle' }
  | { kind: 'running'; offset: number; total: number; vendors: number }
  | { kind: 'done'; vendors: number }
  | { kind: 'error'; message: string };

export function DemoVendorActions({ totalCount, batchId, compact, demoMode }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ResultState>({ kind: 'idle' });
  const [confirming, setConfirming] = useState<
    'all' | 'batch' | 'regen' | 'create' | null
  >(null);
  const [perCategory, setPerCategory] = useState(25);
  const [create, setCreate] = useState<CreateState>({ kind: 'idle' });

  async function runCleanup() {
    setResult({ kind: 'busy' });
    try {
      const res = await fetch('/api/admin/demo/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const body = await res.json();
      if (!res.ok) {
        setResult({ kind: 'error', message: body?.error ?? `HTTP ${res.status}` });
        return;
      }
      setResult({ kind: 'done', deleted: body.deleted ?? 0 });
      startTransition(() => router.refresh());
    } catch (err) {
      setResult({ kind: 'error', message: String(err) });
    }
  }

  async function runCleanupBatch(id: string) {
    setResult({ kind: 'busy' });
    try {
      const res = await fetch('/api/admin/demo/cleanup-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: id }),
      });
      const body = await res.json();
      if (!res.ok) {
        setResult({ kind: 'error', message: body?.error ?? `HTTP ${res.status}` });
        return;
      }
      setResult({ kind: 'done', deleted: body.deleted ?? 0 });
      startTransition(() => router.refresh());
    } catch (err) {
      setResult({ kind: 'error', message: String(err) });
    }
  }

  async function runRegenerate() {
    setResult({ kind: 'busy' });
    try {
      const res = await fetch('/api/admin/demo/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const body = await res.json();
      if (!res.ok) {
        setResult({ kind: 'error', message: body?.error ?? `HTTP ${res.status}` });
        return;
      }
      setResult({
        kind: 'done',
        deleted: body.deleted ?? 0,
        nextStep: body.nextStep,
      });
      startTransition(() => router.refresh());
    } catch (err) {
      setResult({ kind: 'error', message: String(err) });
    }
  }

  async function postSeed(payload: Record<string, unknown>) {
    const res = await fetch('/api/admin/demo/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, demoMode: demoMode === true }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
    return body;
  }

  // One click → cleanup + seed the whole marketplace category-by-category so
  // no single request runs long enough to hit the serverless timeout.
  async function runCreate() {
    setConfirming(null);
    setResult({ kind: 'idle' });
    setCreate({ kind: 'running', offset: 0, total: 0, vendors: 0 });
    try {
      const start = await postSeed({ phase: 'start' });
      const batchId = String(start.batchId ?? '');
      const total = Number(start.total ?? 0);
      let offset = 0;
      let vendors = 0;
      setCreate({ kind: 'running', offset: 0, total, vendors: 0 });
      while (offset < total) {
        const chunk = await postSeed({
          phase: 'chunk',
          batchId,
          offset,
          limit: 3,
          vendorsMin: perCategory,
          vendorsMax: perCategory,
        });
        offset = Number(chunk.nextOffset ?? total);
        vendors += Number(chunk.seeded?.vendors ?? 0);
        setCreate({ kind: 'running', offset, total, vendors });
        if (chunk.done) break;
      }
      setCreate({ kind: 'done', vendors });
      startTransition(() => router.refresh());
    } catch (err) {
      setCreate({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ───────────── Compact (per-batch row) ─────────────
  if (compact && batchId) {
    if (confirming === 'batch') {
      return (
        <span className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={() => runCleanupBatch(batchId)}
            disabled={result.kind === 'busy'}
            className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
          >
            {result.kind === 'busy' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Confirm delete
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirming(null);
              setResult({ kind: 'idle' });
            }}
            disabled={result.kind === 'busy'}
            className="rounded-md bg-ink/5 px-2.5 py-1 text-xs text-ink/65 hover:bg-ink/10"
          >
            Cancel
          </button>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={() => setConfirming('batch')}
          className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2.5 py-1 text-xs text-ink/75 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="h-3 w-3" />
          Cleanup batch
        </button>
        {result.kind === 'done' && (
          <span className="text-[11px] text-emerald-700">
            Deleted {result.deleted}
          </span>
        )}
        {result.kind === 'error' && (
          <span className="text-[11px] text-red-700">{result.message}</span>
        )}
      </span>
    );
  }

  // ───────────── Standalone (global actions) ─────────────
  const isCreating = create.kind === 'running';
  return (
    <div className="space-y-3">
      {isCreating ? (
        <div className="space-y-2 rounded-md border border-mulberry/30 bg-mulberry/5 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <Loader2 className="h-4 w-4 animate-spin text-mulberry" />
            Creating demo vendors… {create.offset}/{create.total || '…'} categories ·{' '}
            {create.vendors.toLocaleString()} vendors
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-mulberry transition-[width] duration-300"
              style={{
                width: `${create.total > 0 ? Math.round((create.offset / create.total) * 100) : 5}%`,
              }}
            />
          </div>
          <p className="text-[11px] text-ink/55">
            Keep this tab open — it seeds category-by-category so no single request times out.
          </p>
        </div>
      ) : (
      <div className="flex flex-wrap items-center gap-3">
        {confirming === 'create' ? (
          <>
            <button
              type="button"
              onClick={runCreate}
              className="inline-flex items-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-semibold text-cream hover:bg-mulberry-600"
            >
              <Check className="h-4 w-4" />
              Confirm: delete existing + create (~{perCategory}/category)
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="rounded-md bg-ink/5 px-4 py-2 text-sm text-ink/65 hover:bg-ink/10"
            >
              Cancel
            </button>
          </>
        ) : confirming === 'all' ? (
          <>
            <button
              type="button"
              onClick={runCleanup}
              disabled={result.kind === 'busy'}
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {result.kind === 'busy' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Confirm: delete all {totalCount.toLocaleString()} demo vendors
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(null);
                setResult({ kind: 'idle' });
              }}
              disabled={result.kind === 'busy'}
              className="rounded-md bg-ink/5 px-4 py-2 text-sm text-ink/65 hover:bg-ink/10"
            >
              Cancel
            </button>
          </>
        ) : confirming === 'regen' ? (
          <>
            <button
              type="button"
              onClick={runRegenerate}
              disabled={result.kind === 'busy'}
              className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {result.kind === 'busy' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Confirm: cleanup all + show seed command
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(null);
                setResult({ kind: 'idle' });
              }}
              disabled={result.kind === 'busy'}
              className="rounded-md bg-ink/5 px-4 py-2 text-sm text-ink/65 hover:bg-ink/10"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <label className="inline-flex items-center gap-1.5 text-sm text-ink/70">
              <span className="text-ink/55">Vendors/category</span>
              <input
                type="number"
                min={5}
                max={80}
                value={perCategory}
                onChange={(e) =>
                  setPerCategory(Math.max(5, Math.min(80, Number(e.target.value) || 5)))
                }
                className="w-16 rounded-md border border-ink/15 bg-cream px-2 py-1.5 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => setConfirming('create')}
              className="inline-flex items-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-semibold text-cream hover:bg-mulberry-600"
            >
              <Sparkles className="h-4 w-4" />
              Create demo vendors
            </button>
            <button
              type="button"
              onClick={() => setConfirming('all')}
              disabled={totalCount === 0}
              className="inline-flex items-center gap-2 rounded-md bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Cleanup ALL Demo Vendors
            </button>
            <button
              type="button"
              onClick={() => setConfirming('regen')}
              disabled={totalCount === 0}
              className="inline-flex items-center gap-2 rounded-md bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Regenerate (cleanup + show seed command)
            </button>
          </>
        )}
      </div>
      )}

      {/* Create result */}
      {create.kind === 'done' && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="font-medium">
            Created {create.vendors.toLocaleString()} demo vendors across the marketplace.
            Preview at <code className="rounded bg-emerald-100 px-1">/vendors?demo=1</code>.
          </p>
        </div>
      )}
      {create.kind === 'error' && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="flex items-start gap-2 font-medium">
            <X className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {create.message}
          </p>
        </div>
      )}

      {/* Result banner */}
      {result.kind === 'done' && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="font-medium">Deleted {result.deleted.toLocaleString()} demo vendors.</p>
          {result.nextStep && (
            <div className="mt-2 space-y-1">
              <p className="text-emerald-800">{result.nextStep.message}</p>
              <code className="block rounded bg-emerald-100 px-2 py-1 font-mono text-[12px] text-emerald-900">
                {result.nextStep.command}
              </code>
            </div>
          )}
        </div>
      )}
      {result.kind === 'error' && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="flex items-start gap-2 font-medium">
            <X className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {result.message}
          </p>
        </div>
      )}
    </div>
  );
}
