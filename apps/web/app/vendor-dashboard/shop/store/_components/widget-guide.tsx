import Image from 'next/image';
import { ImageIcon } from 'lucide-react';
import { stepsLine } from '@/lib/help/guides';
import type { WidgetGuide } from '@/lib/supplier-store-guides';

/**
 * 📘 HOW TO USE IT — one widget's guide, in the Guide & Help guide page's shape (corpus `prototypes/guide_help_2026-11-20`
 * screen 4; `HelpGuideView`, `app/(shell)/(help-pages)/help/guides/[key]/guide-view.tsx`): "N steps", then numbered steps — a title, one or two plain lines, and the real
 * screen's picture. Owner 23 Nov 2026 via the controller: *"Yes, guides only"* — no trial, no "Try it first"; every
 * widget gets this guide, opened from its Store page (`#guide`) and from its panel in Your tools ("How to use it").
 *
 * 🖼 A step with no captured screen yet draws an EMPTY picture frame (an icon, no words, no stand-in drawing) — never a
 * fake shot. The pictures land as real 375 px captures in `public/` and are named in `lib/supplier-store-guides.ts`.
 */
export function WidgetGuideSteps({ guide }: { guide: WidgetGuide }) {
  if (guide.steps.length === 0) {
    return (
      <p className="text-sn-base text-[color:var(--m-slate-2)]" data-widget-guide={guide.key} data-guide-none="">
        {guide.title} has no screen of its own yet, so there are no steps to show.
      </p>
    );
  }
  return (
    <div data-widget-guide={guide.key}>
      <p className="text-sn-base text-[color:var(--m-slate-2)]">{stepsLine(guide.steps.length)}</p>
      <ol className="mt-4 space-y-6" data-guide-steps="">
        {guide.steps.map((s, i) => (
          <li key={`${i}-${s.title}`} className="flex gap-3" data-guide-step={i + 1}>
            <span aria-hidden className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[color-mix(in_srgb,rgb(var(--sn-accent))_12%,transparent)] text-sn-base font-semibold text-ink">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sn-lg font-semibold text-ink">
                <span className="sr-only">Step {i + 1}: </span>
                {s.title}
              </h3>
              <p className="mt-1 text-sn-base leading-snug text-[color:var(--m-slate-2)]">{s.body}</p>
              {s.shot ? (
                <Image
                  src={s.shot.src}
                  alt={s.shot.alt}
                  width={460}
                  height={972}
                  sizes="(min-width: 640px) 320px, 70vw"
                  className="sn-frame mt-3 h-48 w-full object-cover object-top"
                  data-guide-shot=""
                />
              ) : (
                <span role="img" aria-label="No picture of this step yet" className="sn-frame mt-3 grid h-32 w-full place-items-center text-[color:var(--m-slate-2)]" data-guide-shot-missing="">
                  <ImageIcon aria-hidden className="h-6 w-6" strokeWidth={1.5} />
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
