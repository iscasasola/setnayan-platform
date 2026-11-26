/**
 * A7-22: did the posted value change from the one the form READ (`<key>_was`)? A form that posts no `_was` field is
 * treated as changed (today's behaviour). Both sides compare trimmed, blank = null.
 */
export function fieldChanged(formData: FormData, wasKey: string, next: string | null): boolean {
  if (!formData.has(wasKey)) return true;
  const raw = formData.get(wasKey);
  const was = typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
  return (next ?? null) !== was;
}
