'use client';

import { useEffect, useRef, useState } from 'react';

import { CANT_CHAPTER_FIELD, joinChapterNames } from '@/lib/invitation-chapters';

/**
 * ✉ "You'll be at: …" under "Which part can't you make?" (owner's approved prototype, Step 5) — follows the ticks of
 * the block it sits in. Draws nothing until mounted (the server's markup and the first render agree), and nothing
 * without script; the ticks still post either way.
 */
export function YouWillBeAt() {
  const ref = useRef<HTMLParagraphElement>(null);
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    const block = ref.current?.parentElement;
    if (!block) return;
    const read = () => {
      const left = Array.from(block.querySelectorAll<HTMLInputElement>(`input[name="${CANT_CHAPTER_FIELD}"]`))
        .filter((i) => !i.checked)
        .map((i) => i.dataset.label ?? '');
      setLine(`You’ll be at: ${left.length === 0 ? 'none of these' : joinChapterNames(left)}`);
    };
    read();
    block.addEventListener('change', read);
    return () => block.removeEventListener('change', read);
  }, []);
  return (
    <p ref={ref} data-you-will-be-at="" className="min-h-5 text-sm text-ink/80">
      {line}
    </p>
  );
}
