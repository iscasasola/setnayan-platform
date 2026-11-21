'use client';

/**
 * Attributes › Your services — the rows (owner-approved redraw v3, 21 Nov 2026 · `supplier_tools_redraw_v3_fable.html`
 * § 01). Look only — every field, mark and save is the shipped page's:
 *
 *   · each service is ONE row that opens in place (the shared `Fold`, one open at a time): its name, the Tagalog name ·
 *     "62% complete", and its state as a chip (Listing-ready · Visibility gate not met · New). Open, its fields and its
 *     Save — the same `saveVendorServiceAttribute`, through the same `StayForm` door.
 *   · REMOVE IS A SWIPE LEFT WITH UNDO (controller 21 Nov): the "Remove this service's payload" link under every form
 *     is gone; the row hides at once and the SAME `removeVendorServiceAttribute` is written after the Undo window
 *     (`deleteWithUndo`, through its `StayForm` door — so its answer is read, never a navigation).
 *   · the service just saved opens itself, with "Still missing: <labels>" while the visibility gate is not met.
 */
import { useState, type ReactNode } from 'react';
import { Tag } from 'lucide-react';
import { Fold } from '@/app/_components/fold';
import { StayForm } from '@/app/_components/stay-form';
import { SubmitButton } from '@/app/_components/submit-button';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { saveInPlace } from '@/app/_actions/save-in-place';
import { visibleLeafAttributesForPayload } from '@/lib/leaf-attribute-schema';
import type { ResolvedSchema, VendorAttributePayload } from '@/lib/vendor-service-attributes';
import { ToolChip, ToolLead } from '../../_components/tool-page';
import { saveVendorServiceAttribute } from '../actions';
import { AttributeFieldRenderer } from './attribute-field-renderer';

export type ServiceRow = { schema: ResolvedSchema; payload: VendorAttributePayload | null };

export function ServiceRows({
  rows,
  fresh,
  justSaved,
  missing,
}: {
  /** Saved services, in the shipped order. */
  rows: readonly ServiceRow[];
  /** A service picked from ＋ — not saved yet; drawn first, open, marked New. */
  fresh: ResolvedSchema | null;
  /** The service the last save named — it opens itself. */
  justSaved: string | null;
  /** That save's still-missing fields, as LABELS (`missingLabels`). */
  missing: readonly string[];
}) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const shown = rows.filter((r) => !hidden.has(r.schema.canonical_service));

  const remove = (schema: ResolvedSchema) => {
    const key = schema.canonical_service;
    deleteWithUndo({
      label: `${schema.display_name_en} removed`,
      hide: () => setHidden((h) => new Set(h).add(key)),
      restore: () =>
        setHidden((h) => {
          const next = new Set(h);
          next.delete(key);
          return next;
        }),
      commit: () => {
        const fd = new FormData();
        fd.set('canonical_service', key);
        return saveInPlace('supAttributes.removeVendorServiceAttribute', fd);
      },
      failed: `Couldn’t remove ${schema.display_name_en}. It’s back — try again.`,
    });
  };

  return (
    <>
      <ul className="sn-frame px-4 py-1" data-attribute-services="">
        {fresh ? (
          <li>
            <ServiceFold schema={fresh} payload={null} isNew open note={null} />
          </li>
        ) : null}
        {shown.map(({ schema, payload }) => {
          const key = schema.canonical_service;
          const saved = justSaved === key;
          return (
            <SwipeToDelete
              key={key}
              as="li"
              label={`Remove ${schema.display_name_en}`}
              word="Remove"
              onDelete={() => remove(schema)}
              radiusClass=""
              surfaceClass="bg-[rgb(var(--sn-frame-bg))]"
            >
              <ServiceFold
                schema={schema}
                payload={payload}
                isNew={false}
                open={saved}
                note={
                  saved && missing.length > 0 ? (
                    <p role="status" className="my-1 text-[14px] font-semibold" style={{ color: 'rgb(var(--color-warn))' }} data-attributes-missing="">
                      Saved — not in the marketplace yet. Still missing: {missing.join(', ')}.
                    </p>
                  ) : null
                }
              />
            </SwipeToDelete>
          );
        })}
      </ul>
      <UndoToastHost />
    </>
  );
}

function ServiceFold({
  schema,
  payload,
  isNew,
  open,
  note,
}: {
  schema: ResolvedSchema;
  payload: VendorAttributePayload | null;
  isNew: boolean;
  open: boolean;
  note: ReactNode;
}) {
  const initialPayload = (payload?.attribute_payload ?? {}) as Record<string, unknown>;
  const completeness = payload?.completeness_score ?? 0;
  const meetsVisibility = payload?.meets_visibility_minimum ?? false;
  const facetSet = new Set(schema.filter_facets);
  // Hide refinements (or options) an admin RETIRED in the Taxonomy Studio — but keep any the vendor already answered
  // so their saved value is never dropped on the next save (0044 never-orphan contract).
  const visibleFields = visibleLeafAttributesForPayload(schema.fields, initialPayload);
  const line = [schema.display_name_tl, isNew ? null : `${completeness}% complete`].filter(Boolean).join(' · ');

  return (
    <Fold
      title={schema.display_name_en}
      line={line || undefined}
      lead={
        <ToolLead>
          <Tag className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </ToolLead>
      }
      aside={
        isNew ? (
          <ToolChip tone="info">New</ToolChip>
        ) : meetsVisibility ? (
          <ToolChip tone="ok">Listing-ready</ToolChip>
        ) : (
          <ToolChip tone="wait">Visibility gate not met</ToolChip>
        )
      }
      defaultOpen={open}
      anchor={schema.canonical_service}
      data="attribute-service"
    >
      <div className="flex flex-col gap-3 pb-4 pt-1">
        {note}
        <StayForm door="supAttributes.saveVendorServiceAttribute" action={saveVendorServiceAttribute} className="flex flex-col gap-3">
          <input type="hidden" name="canonical_service" value={schema.canonical_service} />
          {Object.entries(visibleFields).map(([fieldKey, def]) => (
            <AttributeFieldRenderer key={fieldKey} fieldKey={fieldKey} def={def} initial={initialPayload[fieldKey]} isFacet={facetSet.has(fieldKey)} />
          ))}
          <div className="pt-1">
            <SubmitButton pendingLabel="Saving…" className="button-primary h-10 px-4 text-sm">
              {isNew ? 'Add service + save' : 'Save'}
            </SubmitButton>
          </div>
        </StayForm>
      </div>
    </Fold>
  );
}
