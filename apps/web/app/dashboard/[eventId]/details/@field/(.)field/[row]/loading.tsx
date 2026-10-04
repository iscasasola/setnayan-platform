/** While a row's field is on its way: say so at once, where the sheet will be — the record stays as it is. */
export default function RecordFieldOpening() {
  return (
    <p
      role="status"
      data-record-field-opening=""
      className="pointer-events-none fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-1/2 z-[45] -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-3.5 py-2 text-[12px] font-semibold text-cream shadow-lg"
    >
      Opening…
    </p>
  );
}
