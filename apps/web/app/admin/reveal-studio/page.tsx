import { fetchRevealConfig } from '@/lib/reveal-config';
import { RevealStudio } from './studio';

export const metadata = { title: 'Reveal Studio · Setnayan HQ' };

export default async function AdminRevealStudioPage() {
  const config = await fetchRevealConfig();
  return (
    <div className="max-w-6xl px-5 py-8 sm:px-8">
      <div className="mb-6">
        <div className="mb-1 text-[11px] uppercase tracking-wider text-[var(--m-slate,#6a6e76)]">Content</div>
        <h1 className="text-2xl font-semibold text-[var(--m-ink,#1e2229)]">Reveal Studio</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--m-slate,#4f535b)]">
          The opening reveal on every Save-the-Date couple site — the bridal veil, envelopes and
          doors guests lift to uncover the invitation. Turn it on or off, choose which templates
          couples may use, toggle features, and tune the veil look with the live sliders. Changes
          save as the house default and go live on couple sites.
        </p>
      </div>
      <RevealStudio initial={config} />
    </div>
  );
}
