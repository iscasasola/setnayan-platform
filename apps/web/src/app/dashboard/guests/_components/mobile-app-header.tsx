"use client";

import Link from "next/link";

interface Props {
  totalCount: number;
  searchValue: string;
  onSearchChange: (v: string) => void;
}

export function MobileAppHeader({ totalCount, searchValue, onSearchChange }: Props) {
  // For now, search is always visible inline below the title (toggle pattern can come later).
  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-page-bg/95 backdrop-blur-md lg:hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            href="/dashboard"
            aria-label="Back to dashboard"
            className="-ml-2 grid h-11 w-11 place-items-center rounded-full text-2xl font-light text-ink"
          >
            ‹
          </Link>
          <div className="min-w-0">
            <h2 className="font-serif text-[26px] font-medium leading-none tracking-tight">
              Guests
            </h2>
            <div className="mt-1 text-[13px] text-ink-soft">{totalCount} guests</div>
          </div>
        </div>
        <SearchIconButton value={searchValue} onChange={onSearchChange} />
      </div>
    </header>
  );
}

/**
 * Tap to expand into an inline search input. Hides the button until tapped to
 * keep the header at the spec's minimal density.
 */
function SearchIconButton({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  // Use a controlled <details> for tap-to-expand without state.
  return (
    <details className="group">
      <summary
        className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full border border-rule bg-page-bg-soft text-[18px] text-ink"
        aria-label="Search"
      >
        ⌕
      </summary>
      <div className="absolute left-0 right-0 top-full mt-1 border-b border-rule bg-surface px-4 py-3 shadow-tayo-sm">
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search by name, household, tag…"
          className="w-full rounded-full border border-rule-strong bg-page-bg-soft px-4 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-faint"
          autoFocus
        />
      </div>
    </details>
  );
}
