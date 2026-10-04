import { RecordFieldSlot } from '../../../_components/record-field-slot';

/**
 * `/dashboard/[eventId]/details/field/[row]`, INTERCEPTED from the record — a
 * row's field arriving over the record, which stays as it is (owner 2026-10-04,
 * "YES TO ALL": rows are edited in place). The same `RecordFieldSlot` the
 * address draws when loaded on its own (`details/field/[row]/page.tsx`).
 */
export default async function InterceptedRecordField({ params }: { params: Promise<{ eventId: string; row: string }> }) {
  const { eventId, row } = await params;
  return <RecordFieldSlot eventId={eventId} row={row} />;
}
