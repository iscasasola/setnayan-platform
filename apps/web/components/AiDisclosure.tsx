import { Sparkles } from 'lucide-react';

/**
 * AiDisclosure — the single shared "this content is AI-generated" disclosure for
 * generative-AI outputs (Pakanta songs, Animated Monogram, AI highlight cuts, and
 * future generative SKUs).
 *
 * WHY: the 2026-06-25 a11y/honesty audit found generative outputs presented to
 * couples with no AI-origin disclosure (and one surface that named the underlying
 * model in customer copy). Centralizing the wording here means:
 *   • the copy is consistent across every generative surface,
 *   • the brand is ALWAYS "Setnayan AI" — the underlying model/vendor (DALL-E,
 *     Suno, Claude, OpenAI) can NEVER leak into customer-facing copy, because the
 *     caller picks a `generator` noun, not a free-text label (locked: CLAUDE.md
 *     "Customer-facing brand Setnayan AI; DALL-E/OpenAI never named").
 *   • new generative surfaces have one component to render + one grep target to
 *     audit against.
 *
 * This is a disclosure, never legal advice — for legal-bearing AI output
 * (e.g. contract analysis) pair it with a separate not-legal-advice note.
 */

type Generator = 'song' | 'image' | 'video' | 'text';
type Variant = 'caption' | 'badge';

// Copy resolved internally — callers cannot pass a raw provider/model name.
const NOUN: Record<Generator, string> = {
  song: 'AI-generated music',
  image: 'AI-generated artwork',
  video: 'AI-generated video',
  text: 'AI-generated text',
};

export function AiDisclosure({
  generator,
  variant = 'caption',
  className = '',
}: {
  generator: Generator;
  variant?: Variant;
  className?: string;
}) {
  const label = `${NOUN[generator]} — created with Setnayan AI`;

  if (variant === 'badge') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-medium text-ink/60 ${className}`}
      >
        <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
        {label}
      </span>
    );
  }

  return (
    <p className={`inline-flex items-center gap-1 text-xs text-ink/55 ${className}`}>
      <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
      {label}
    </p>
  );
}
