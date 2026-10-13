'use client';

import { Count, Fill } from '@/components/count';
import { formatPhp } from '@/lib/php';

/**
 * Money's two figures and its meter (kind 32: "a meter … fills with the number beside it"; button rule 2: every
 * number a person reads counts to its value).
 *
 * 🔑 THE PESO IS `formatPhp`, NOT THE COUNTER'S ROUNDED ONE. `Count`'s built-in "peso" format is `formatPhpRounded`,
 * which `lib/php.ts` forbids for money that is owed or paid — it hides centavos. The count's frames are whole numbers,
 * and its LAST frame is `Math.round(value)`; that frame prints the exact figure, so "₱837.50" ends as "₱837.50",
 * never "₱838".
 */
export function PesoCount({ value, id, className, tone }: { value: number; id: string; className?: string; tone?: 'ok' }) {
  return (
    <Count
      value={value}
      id={id}
      className={className}
      style={tone === 'ok' ? { color: 'rgb(var(--color-ok))' } : undefined}
      format={(n) => formatPhp(n === Math.round(value) ? value : n)}
    />
  );
}

/** The received-of-booked meter: the ok colour (it is money in), grown from 0 on load. */
export function MoneyFill({ value, id }: { value: number; id: string }) {
  return <Fill value={value} id={id} className="h-full rounded-full" style={{ background: 'rgb(var(--color-ok))' }} />;
}
