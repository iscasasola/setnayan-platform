'use client';

/**
 * clients-search.tsx — THE CLIENTS SEARCH IS THE ADD (owner 18–19 Nov 2026, verbatim: *"so we also do no need an add
 * button because. our text box is search / add feature"* · *"tap the magnifying glass to convert it to add."*).
 *
 * The thumb row's ＋ Add is gone. The ONE add way it opened — the shipped "Add a booking from outside" sheet
 * (`OutsideClientAdd` → `importExternalClient`) — is now reached from the search itself:
 *   · words typed → 🔍 is ＋ by itself when no client matches, or on a tap; ＋ or Enter opens the sheet with the name in it;
 *   · nothing typed → a row right at the EMPTY search while it has the cursor: "Add a booking from outside".
 * Nothing new is written here: both call the sheet's own imported opener.
 * 🔒 lib/a-search-that-adds-shows-add.test.ts
 */
import { Plus } from 'lucide-react';
import { SearchBox } from '@/app/_components/search-box';
import { holdFocus } from '@/components/clear-field';
import { openOutsideClientAdd } from './outside-client-add';
import styles from './clients-search.module.css';

export function ClientsSearch({ defaultValue, keep, matches }: { defaultValue: string; keep: string; /** Does any client match the word the page was drawn with? */ matches: boolean }) {
  return (
    <SearchBox
      placeholder="Search clients"
      defaultValue={defaultValue}
      keep={keep}
      hash="#customers"
      data="customers"
      tour="customers-search"
      add={{ matches, onAdd: openOutsideClientAdd }}
    />
  );
}

/** The add way, at the EMPTY search while it has the cursor (shown by CSS — the press never takes the cursor). */
export function ClientsEmptyAdd() {
  return (
    <div className={styles.emptyAdd} data-clients-empty-add="">
      <button type="button" className={styles.addRow} onPointerDown={holdFocus} onMouseDown={holdFocus} onClick={() => openOutsideClientAdd('')}>
        <Plus aria-hidden className="h-5 w-5" strokeWidth={2} />
        Add a booking from outside
      </button>
    </div>
  );
}
