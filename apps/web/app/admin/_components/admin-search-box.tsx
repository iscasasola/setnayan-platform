'use client';

import { Search, Sparkles } from 'lucide-react';

import { ADMIN_SEARCH_OPEN_EVENT } from './admin-search-open-event';

/**
 * AdminSearchBox — the visible way in.
 *
 * 🔴 WHY THIS EXISTS, IN THE OWNER'S WORDS: *"i do not see the AI searchbar."*
 * He was right, and nothing was broken — it had simply never been given a door.
 * The admin's own palette knows 96 pages, 284 jobs and every price row, answers
 * a whole sentence, and asks a model for phrasings nothing has seen. All of it
 * opened with ⌘K only: no button, no label, and no shortcut at all on a phone.
 * The one visible box on the admin bar belonged to the SHARED palette, which
 * looks through the person's own events — so the console had an assistant and
 * the control on screen opened something else entirely.
 *
 * 🔑 IT LOOKS LIKE A FIELD AND IS A BUTTON. Rendering a real <input> here would
 * mean two inputs for one search — this one and the palette's — and the second
 * steals focus the moment the dialog opens, so the first keystroke lands in a
 * box that is about to be replaced. A button carries the same affordance, one
 * focus stop, and no lost characters.
 *
 * ⌘K still works, and still opens the same panel. This is a second door onto
 * one room, never a second room.
 */
export function AdminSearchBox() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(ADMIN_SEARCH_OPEN_EVENT))}
      // Desktop only, on purpose. The owner ruled on 2026-08-26 that the phone
      // admin answers what needs a decision and does not edit — and this box
      // opens doors into editing screens. The phone reaches the same words
      // through "All surfaces", whose filter now runs the SAME rule as the
      // laptop (it did not, for one day — it required every word and blanked on
      // a sentence).
      //
      // ⚠ SO THE PHONE'S TOP BAR HAS NO SEARCH IN THE MIDDLE, AND THAT IS THE
      // RULING, NOT AN OVERSIGHT. Before this slot existed the bar carried the
      // SHARED palette there — a search over the person's own events, which is
      // not what somebody standing in HQ is asking for. Do not "restore" it
      // without re-opening the ruling.
      className="hidden w-full max-w-sm items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition-colors lg:flex"
      style={{ borderColor: 'var(--sn-line)', background: 'var(--sn-paper, #FBFAF7)' }}
      aria-label="Search the admin, or ask where something lives"
    >
      <Search aria-hidden className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--sn-ink-500)' }} strokeWidth={2} />
      <span className="flex-1 truncate text-[12.5px]" style={{ color: 'var(--sn-ink-500)' }}>
        Search or ask — “papic prices”, “add a category”
      </span>
      <Sparkles aria-hidden className="h-3 w-3 shrink-0" style={{ color: 'var(--sn-gold, #A9834B)' }} strokeWidth={2} />
      <kbd
        className="hidden shrink-0 rounded border px-1 py-0.5 font-mono text-[9px] xl:inline"
        style={{ borderColor: 'var(--sn-line)', color: 'var(--sn-ink-500)' }}
      >
        ⌘K
      </kbd>
    </button>
  );
}
