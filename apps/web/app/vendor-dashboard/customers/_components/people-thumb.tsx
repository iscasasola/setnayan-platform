'use client';

/**
 * people-thumb.tsx — the frosted thumb row of Customers › People: the search
 * (≥ 60 % of the row) and **Add** (supplier redesign S-PR2; prototype frame 03;
 * BUTTON_RULE 3b · 4 · 5 · 7). The tools live in the lower third.
 *
 * 🔎 THE SEARCH RUNS ONCE YOU STOP TYPING, AND NEVER BLINKS (rule 4). The list
 * is server-rendered from `?q=`, so 250 ms after the last key this replaces the
 * URL (same page, no scroll); the box itself is never rebuilt — it lives in the
 * portalled row, keeps its node, its focus and its caret. Enter does the same
 * at once. `page` is dropped so a search starts on its first page.
 *
 * ➕ ADD opens the SHIPPED outside-client form in the app's own sheet — the
 * form is handed in already rendered by the server (`addForm`), so this file
 * holds no field and no action of its own. `?add=outside` (the old round +) and
 * a refused save both open it on arrival.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { SupplierThumbRow } from '../../_components/supplier-thumb-row';

const SEARCH_WAIT_MS = 250;

export function PeopleThumb({
  query,
  addForm,
  addOpen = false,
}: {
  /** The search as the server read it (`?q=`). */
  query: string;
  /** The shipped "add an outside client" form, rendered by the server. */
  addForm: ReactNode;
  /** Open the Add sheet on arrival (`?add=outside`, or a save that was refused). */
  addOpen?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [text, setText] = useState(query);
  const [adding, setAdding] = useState(addOpen);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The params as they are NOW, read at the moment the search runs — a filter
  // picked while the timer was waiting is kept, not overwritten.
  const live = useRef(params);
  live.current = params;

  const go = (value: string) => {
    const q = new URLSearchParams(live.current.toString());
    const next = value.trim();
    if ((q.get('q') ?? '') === next) return;
    if (next) q.set('q', next);
    else q.delete('q');
    q.delete('page');
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <>
      <SupplierThumbRow name="people" label="Customer tools">
        <input
          type="search"
          value={text}
          maxLength={80}
          placeholder="Search a customer"
          aria-label="Search a customer"
          enterKeyHint="search"
          data-people-search=""
          onChange={(e) => {
            const value = e.target.value;
            setText(value);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => go(value), SEARCH_WAIT_MS);
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            if (timer.current) clearTimeout(timer.current);
            go(text);
          }}
        />
        <ActionButton
          tone="brand"
          main
          icon={Plus}
          label="Add"
          name="Add an outside client"
          aria-haspopup="dialog"
          aria-expanded={adding}
          onClick={() => setAdding(true)}
          data-testid="people-add"
        />
      </SupplierThumbRow>
      <Sheet open={adding} onClose={() => setAdding(false)} labelledById="people-add-title" rise>
        <div className="px-5 pb-2 pt-5" data-people-add-sheet="">
          {addForm}
        </div>
      </Sheet>
    </>
  );
}
