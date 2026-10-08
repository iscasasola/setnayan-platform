import type { ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecordEditorKey } from '@/lib/event-details-record';
import { loadEventSettings } from '../../launch/_components/details-settings-load';
import { EventSettingsEditor } from './event-settings-editor';

/**
 * ✍ THE FIELD A ROW OPENS — since 2026-10-08 (DECISION_LOG "EVENT DETAILS IS
 * THREE SEGMENTS"), ONE editor: Event settings, which saves LIVE through its
 * own actions (`event-settings-editor.tsx` says why none of it can ride the
 * Event Hub draft). The seventeen rows that opened a Maker editor and wrote the
 * Event Hub draft LEFT the page — the Maker, Suppliers and Guests own them —
 * so Event Details carries no Undo · Apply (owner, 2026-10-08: *"why is there
 * still undo and apply?"*). `every-fact-has-one-editor.test.ts` holds the count.
 *
 * 🔒 READING NEVER WRITES. Every read here is a SELECT; no editor saves on mount.
 */
export type RecordEditorContext = {
  eventId: string;
  userId: string;
  supabase: SupabaseClient;
};

export async function RecordEditor({ editor, ctx }: { editor: RecordEditorKey; ctx: RecordEditorContext }): Promise<ReactNode> {
  const { eventId, supabase } = ctx;
  switch (editor) {
    case 'settings': {
      const settings = await loadEventSettings({ supabase, eventId, userId: ctx.userId });
      if (!settings) return <CouldNotOpen />;
      return <EventSettingsEditor eventId={eventId} form={settings.form} governed={settings.governed} pax={settings.pax} />;
    }
  }
}

/** A field that could not be read is SAID, never drawn empty — an empty form would save that emptiness. */
function CouldNotOpen() {
  return (
    <p role="alert" className="text-sm text-terracotta-700" data-record-field-failed="">
      This could not be opened just now. Nothing was changed — close it and try again in a moment.
    </p>
  );
}
