import { PaletteField } from './palette-field';
import { ListField } from './list-field';
import type { DressCodeConfig } from '../actions';

/**
 * The dress-code form BODY, shared by its own editor page and the unified
 * editor's inline panel (Unified Website Editor · PR-8).
 *
 * ⚠ Why shared rather than re-typed: `updateDressCode` reads **every** field on
 * each save (title, description, palette, dos, donts) — a partial form would
 * silently WIPE the lists and palette it didn't post. Extracting the fields once
 * and rendering them in both places makes that class of bug impossible, and
 * keeps the two surfaces from drifting apart.
 *
 * Caller supplies the surrounding `<form action=…>` and its submit button, so
 * each surface keeps its own chrome (full page vs. compact rail panel).
 */
export function DressCodeFields({
  config,
  eventNoun,
  compact = false,
}: {
  config: DressCodeConfig;
  /** e.g. "wedding" — used in the palette hint copy. */
  eventNoun: string;
  /** Rail-panel density: tighter spacing + smaller labels. */
  compact?: boolean;
}) {
  const gap = compact ? 'space-y-4' : 'space-y-6';
  const label = compact
    ? 'block text-[0.7rem] font-semibold text-ink/60'
    : 'sn-eye block';
  const input = compact
    ? 'block w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus-visible:border-ink/40 focus-visible:outline-none'
    : 'block w-full min-h-[44pt] rounded-md border border-ink/15 bg-white px-3 py-2 text-base text-ink placeholder:text-ink/35 focus-visible:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta';
  const hint = compact ? 'text-[0.7rem] text-ink/45' : 'text-xs text-ink/55';

  return (
    <div className={gap}>
      <div className="space-y-1.5">
        <label htmlFor="dress-code-title" className={label}>
          Headline
        </label>
        <input
          id="dress-code-title"
          type="text"
          name="title"
          defaultValue={config.title}
          maxLength={80}
          placeholder="e.g. Look magical · Dress in Filipiniana · Garden formal"
          className={input}
        />
        <p className={hint}>One short headline. Up to 80 characters.</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="dress-code-description" className={label}>
          Guidance
        </label>
        <textarea
          id="dress-code-description"
          name="description"
          defaultValue={config.description}
          maxLength={600}
          rows={compact ? 3 : 4}
          placeholder="A sentence or two on what you're picturing. Formal? Garden party? Filipiniana? Tell guests in your own voice."
          className={input}
        />
        <p className={hint}>Up to 600 characters.</p>
      </div>

      <div className="space-y-1.5">
        <p className={label}>Palette</p>
        <p className={hint}>
          Up to six swatches. Guests use these to dress in colors that match your {eventNoun}
          &rsquo;s mood.
        </p>
        <PaletteField initial={config.palette} />
      </div>

      <div className="space-y-1.5">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-success-700">Do</p>
        <p className={hint}>What you&rsquo;d love guests to wear.</p>
        <ListField name="dos" tone="do" initial={config.dos} />
      </div>

      <div className="space-y-1.5">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-danger-700">
          Don&rsquo;t
        </p>
        <p className={hint}>
          What you&rsquo;d rather they skip. Be kind — they&rsquo;ll read this.
        </p>
        <ListField name="donts" tone="dont" initial={config.donts} />
      </div>
    </div>
  );
}

/**
 * The one parser for the `events.dress_code_config` JSONB shape — shared by the
 * page and the editor panel so they can never disagree about a malformed row.
 * Moved here from the page in PR-8 (was private there).
 */
export function normalizeDressCodeConfig(raw: unknown): DressCodeConfig {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    title: typeof obj.title === 'string' ? obj.title : '',
    description: typeof obj.description === 'string' ? obj.description : '',
    dos: Array.isArray(obj.dos)
      ? obj.dos.filter((v): v is string => typeof v === 'string')
      : [],
    donts: Array.isArray(obj.donts)
      ? obj.donts.filter((v): v is string => typeof v === 'string')
      : [],
    palette: Array.isArray(obj.palette)
      ? obj.palette
          .map((row) => {
            if (!row || typeof row !== 'object') return null;
            const r = row as Record<string, unknown>;
            const name = typeof r.name === 'string' ? r.name : '';
            const hex = typeof r.hex === 'string' ? r.hex : '';
            if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
            return { name, hex };
          })
          .filter((row): row is { name: string; hex: string } => row !== null)
      : [],
  };
}
