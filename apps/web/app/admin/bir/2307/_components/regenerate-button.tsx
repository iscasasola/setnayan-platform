'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Loader2 } from 'lucide-react';

type Props = {
  vendor_profile_id: string;
  year: number;
  quarter: number;
};

export function RegenerateButton({ vendor_profile_id, year, quarter }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/bir/2307/regenerate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vendor_profile_id,
            tax_year: year,
            tax_quarter: quarter,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setError(data.error ?? `HTTP ${res.status}`);
          return;
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1 text-xs text-terracotta hover:underline disabled:text-ink/40"
        title={`Regenerate ${year} Q${quarter}`}
      >
        {pending ? (
          <Loader2 aria-hidden className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw aria-hidden className="h-3 w-3" />
        )}
        Regenerate
      </button>
      {error ? (
        <span className="font-mono text-[10px] text-red-700" title={error}>
          {error.length > 40 ? `${error.slice(0, 40)}…` : error}
        </span>
      ) : null}
    </span>
  );
}
