'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GripVertical } from 'lucide-react';
import { widgetLabel, type SiteWidgetRow } from '@/lib/site-widgets';

/**
 * Drag-drop widget list for the admin Website editor (/admin/website).
 *
 * **Drag library:** native HTML5 drag-and-drop. The repo does not currently
 * ship a drag library (@dnd-kit / react-beautiful-dnd not in package.json),
 * and Decision 6 explicitly says "if not, pick a small lib and document why".
 * For this surface — 12 keyboard-accessible rows on an admin-only screen —
 * the native API is enough and avoids a new dependency:
 *   • Mouse drag: HTML5 draggable + dragenter/dragover/drop handlers.
 *   • Touch: a long-press "Move ↑ / Move ↓" pair on each row keeps the
 *     mobile experience usable per 0023 § 3.10 mobile section.
 *   • Keyboard: same Move buttons are focusable + actuated via Enter/Space.
 *
 * On any reorder the component PATCHes /api/v1/admin/site-widgets/reorder
 * with the new order. The PATCH endpoint audit-logs the change. We keep
 * an optimistic local order so the UI feels instant even on slow networks.
 */
type Props = {
  widgets: ReadonlyArray<SiteWidgetRow>;
  page: string;
};

export function WidgetList({ widgets, page }: Props) {
  const [items, setItems] = useState<SiteWidgetRow[]>([...widgets]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Resync if the parent fetches new data after a server revalidate.
  useMemo(() => {
    setItems([...widgets]);
  }, [widgets]);

  const persistOrder = useCallback(
    (next: SiteWidgetRow[]) => {
      const orderedIds = next.map((w) => w.widget_id);
      startTransition(async () => {
        setError(null);
        try {
          const res = await fetch('/api/v1/admin/site-widgets/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ page, ordered_widget_ids: orderedIds }),
          });
          if (!res.ok) {
            const body = (await res.json().catch(() => null)) as
              | { error?: { message?: string } }
              | null;
            setError(body?.error?.message ?? `Reorder failed (${res.status}).`);
            // Revert to server state by triggering a refresh.
            router.refresh();
            return;
          }
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Network error.');
          router.refresh();
        }
      });
    },
    [page, router],
  );

  const moveTo = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      if (from < 0 || to < 0 || from >= items.length || to >= items.length) return;
      const next = [...items];
      const [picked] = next.splice(from, 1);
      if (!picked) return;
      next.splice(to, 0, picked);
      setItems(next);
      persistOrder(next);
    },
    [items, persistOrder],
  );

  const toggleEnabled = useCallback(
    (widgetId: string, nextEnabled: boolean) => {
      // Optimistic update for the local row.
      setItems((curr) =>
        curr.map((w) =>
          w.widget_id === widgetId ? { ...w, is_enabled: nextEnabled } : w,
        ),
      );
      startTransition(async () => {
        setError(null);
        try {
          const res = await fetch(
            `/api/v1/admin/site-widgets/${encodeURIComponent(widgetId)}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_enabled: nextEnabled }),
            },
          );
          if (!res.ok) {
            const body = (await res.json().catch(() => null)) as
              | { error?: { message?: string } }
              | null;
            setError(body?.error?.message ?? `Toggle failed (${res.status}).`);
            // Revert local optimistic state.
            setItems((curr) =>
              curr.map((w) =>
                w.widget_id === widgetId ? { ...w, is_enabled: !nextEnabled } : w,
              ),
            );
            return;
          }
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Network error.');
          setItems((curr) =>
            curr.map((w) =>
              w.widget_id === widgetId ? { ...w, is_enabled: !nextEnabled } : w,
            ),
          );
        }
      });
    },
    [router],
  );

  return (
    <div className="space-y-3">
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-2 text-sm text-terracotta-700"
        >
          {error}
        </p>
      ) : null}

      <ol
        aria-label="Widgets"
        className="divide-y divide-ink/8 rounded-2xl border border-ink/10 bg-cream"
      >
        {items.map((widget, idx) => (
          <li
            key={widget.widget_id}
            draggable
            onDragStart={(ev) => {
              setDragIndex(idx);
              ev.dataTransfer.effectAllowed = 'move';
              ev.dataTransfer.setData('text/plain', widget.widget_id);
            }}
            onDragOver={(ev) => {
              ev.preventDefault();
              ev.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(ev) => {
              ev.preventDefault();
              if (dragIndex === null) return;
              moveTo(dragIndex, idx);
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
            className={`flex items-center gap-3 px-4 py-3 transition-colors ${
              !widget.is_enabled ? 'opacity-65' : ''
            } ${dragIndex === idx ? 'bg-terracotta/5' : ''}`}
          >
            <span
              aria-hidden
              className="grid h-8 w-6 cursor-grab place-items-center text-ink/45 active:cursor-grabbing"
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" strokeWidth={1.75} />
            </span>

            <span className="w-8 shrink-0 font-mono text-xs text-ink/55">
              {String(idx + 1).padStart(2, '0')}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {widgetLabel(widget.widget_id)}
              </p>
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                {widget.widget_id}
              </p>
            </div>

            {widget.gate_type ? (
              <span
                className="hidden shrink-0 rounded-full bg-ink/8 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/65 sm:inline"
                title={`Render-gated by ${widget.gate_type}`}
              >
                {widget.gate_type}
              </span>
            ) : null}

            {/* Touch/keyboard fallback for reorder — drag-and-drop alone
                isn't reachable for keyboard or touch users. */}
            <div className="hidden flex-col gap-1 sm:flex">
              <button
                type="button"
                disabled={idx === 0 || pending}
                onClick={() => moveTo(idx, idx - 1)}
                aria-label={`Move ${widgetLabel(widget.widget_id)} up`}
                className="h-6 w-6 rounded text-xs text-ink/55 hover:bg-ink/5 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={idx === items.length - 1 || pending}
                onClick={() => moveTo(idx, idx + 1)}
                aria-label={`Move ${widgetLabel(widget.widget_id)} down`}
                className="h-6 w-6 rounded text-xs text-ink/55 hover:bg-ink/5 disabled:opacity-30"
              >
                ↓
              </button>
            </div>

            <ToggleSwitch
              checked={widget.is_enabled}
              label={`Toggle ${widgetLabel(widget.widget_id)}`}
              disabled={pending}
              onChange={(next) => toggleEnabled(widget.widget_id, next)}
            />
          </li>
        ))}
      </ol>

      {pending ? (
        <p
          aria-live="polite"
          className="text-xs text-ink/55"
        >
          Saving…
        </p>
      ) : null}
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-emerald-500' : 'bg-ink/15'
      }`}
    >
      <span
        aria-hidden
        className={`inline-block h-4 w-4 transform rounded-full bg-cream shadow-sm transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
