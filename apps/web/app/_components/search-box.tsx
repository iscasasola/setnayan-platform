'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';

/**
 * SEARCH BOX — kind 30 of the control templates (`CONTROL_TEMPLATES_ROUND2_2026-10-12_fable.md`, gallery
 * `prototypes/control_templates_round2_2026-10-12.html` § 30; owner "APPROVE ALL" 2026-10-12, question 11: *search
 * lives in the thumb row (≥ 60 %)*). The ONE look for "find something in the place you are in".
 *
 *   · a pill, magnifier at the left, the placeholder names WHAT is searched ("Search a customer");
 *   · the box lights the app's accent while the keyboard is up;
 *   · ✕ appears with the first letter and clears the word with one press (a 44-px target round a small grey disc);
 *   · results change AS YOU TYPE — here the list is the server's (it pages a thousand customers, so it cannot be
 *     filtered in the browser): the word goes into the address after a short pause and the page draws the match.
 *     Enter goes at once and puts the keyboard away. Tapping outside only puts the keyboard away; the word stays;
 *   · with no script at all it is a plain GET form — Enter still searches, the result is a link you can come back to.
 *
 * NOT for filtering by a value (that is a Dropdown, `PickMenu`). It knows no screen: what is kept in the address
 * besides the word (`keep`), the word's name (`name`) and where the page lands (`hash`) are the caller's.
 * In a thumb row it is the row's field (`data-fit-field`, rule 3b keeps it at ≥ 60 %).
 */
export function SearchBox({
  placeholder,
  name = 'q',
  defaultValue = '',
  keep = '',
  hash = '',
  wait = 320,
  data,
}: {
  /** What is searched, in words — also its name for a screen reader. */
  placeholder: string;
  /** The address key the word travels in. */
  name?: string;
  /** The word as the page was drawn with it. */
  defaultValue?: string;
  /** The rest of the address, kept as it is (a query string, no "?"). */
  keep?: string;
  /** Where the page lands after a search ("#customers"). */
  hash?: string;
  /** The pause after the last letter before the page is asked (ms). */
  wait?: number;
  /** `data-search-box="<data>"`. */
  data?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(defaultValue);
  const [pending, start] = useTransition();
  const field = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The page came back with another word (Back, a link): show it — unless the person is typing.
  useEffect(() => {
    if (document.activeElement !== field.current) setValue(defaultValue);
  }, [defaultValue]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const go = (word: string) => {
    if (timer.current) clearTimeout(timer.current);
    const params = new URLSearchParams(keep);
    const w = word.trim();
    if (w) params.set(name, w);
    else params.delete(name);
    const qs = params.toString();
    start(() => router.replace(`${pathname}${qs ? `?${qs}` : ''}${hash}`, { scroll: false }));
  };

  return (
    <form
      role="search"
      method="get"
      action={`${pathname}${hash}`}
      data-fit-field=""
      data-search-box={data ?? ''}
      data-pending={pending ? '' : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
        field.current?.blur();
      }}
      className="flex h-11 min-w-0 items-center gap-2 rounded-full bg-cream pl-3.5 shadow-[inset_0_0_0_1px_rgb(var(--color-ink)/0.15)] transition-shadow duration-sn-pill ease-sn focus-within:shadow-[inset_0_0_0_1.5px_rgb(var(--sn-accent)),0_0_0_3px_rgb(var(--sn-accent)/0.14)] motion-reduce:transition-none"
    >
      {[...new URLSearchParams(keep).entries()]
        .filter(([k]) => k !== name)
        .map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      <Search aria-hidden className="h-[18px] w-[18px] flex-none text-ink/50" strokeWidth={2} />
      <input
        ref={field}
        type="search"
        name={name}
        value={value}
        maxLength={80}
        autoComplete="off"
        enterKeyHint="search"
        placeholder={placeholder}
        aria-label={placeholder}
        data-search-input=""
        onChange={(e) => {
          const v = e.currentTarget.value;
          setValue(v);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => go(v), wait);
        }}
        className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] text-ink outline-none placeholder:text-ink/50 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear the search"
          data-search-clear=""
          onClick={() => {
            setValue('');
            go('');
            field.current?.focus();
          }}
          className="sn-press flex h-11 w-11 flex-none items-center justify-center rounded-full"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/[0.08]">
            <X aria-hidden className="h-3 w-3 text-ink/70" strokeWidth={2.6} />
          </span>
        </button>
      ) : (
        <span aria-hidden className="w-3.5 flex-none" />
      )}
    </form>
  );
}
