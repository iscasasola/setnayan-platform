import { checkedOnLine, VERDICT_WORDS, type VenueVerdict } from '@/lib/venue-check';

/** The dot beside a result — the green / yellow / red the spec asks for, in tokens that flip for dark mode. */
export const TONE_DOT: Record<'good' | 'warn' | 'bad', string> = {
  good: 'bg-success-600',
  warn: 'bg-warn-500',
  bad: 'bg-danger-600',
};

export type VenueCheckStatusProps =
  | { state: 'unread' }
  | { state: 'none' }
  | { state: 'found'; finishedAt: string; verdict: VenueVerdict; placeName: string | null };

/** One line: the last result, "Not checked yet", or — never the same thing — "couldn't load". */
export function VenueCheckStatus(props: VenueCheckStatusProps) {
  if (props.state === 'unread') {
    return (
      <p role="status" className="text-sm text-ink/70">
        We couldn&rsquo;t load the last check. Reload in a moment.
      </p>
    );
  }
  if (props.state === 'none') {
    return <p className="text-sm text-ink/70">Not checked yet.</p>;
  }
  const tone = VERDICT_WORDS[props.verdict].tone;
  return (
    <p className="flex items-start gap-2 text-sm font-medium text-ink">
      <span aria-hidden className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[tone]}`} />
      <span>{checkedOnLine(props)}</span>
    </p>
  );
}
