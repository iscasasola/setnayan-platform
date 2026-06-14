/**
 * Shared labelled form field — label + control + optional help text + optional
 * required marker.
 *
 * Extracted 2026-06-13 (dashboard-consolidation Track A) from ~15 byte-identical
 * local `Field` helpers that had been copy-pasted across settings/profile and
 * form surfaces on the couple, vendor, and admin doorways. The vendor variant's
 * optional `required` asterisk is folded in here as the superset, so every prior
 * call site reproduces exactly — callers that omit `required` render no asterisk,
 * matching the couple/admin originals byte-for-byte.
 */
export function Field({
  label,
  htmlFor,
  help,
  required = false,
  children,
}: {
  label: string;
  htmlFor: string;
  help?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block space-y-1">
      <span className="block text-sm font-medium text-ink">
        {label}
        {required ? <span className="ml-1 text-terracotta">*</span> : null}
      </span>
      {children}
      {help ? <span className="block text-xs text-ink/55">{help}</span> : null}
    </label>
  );
}
