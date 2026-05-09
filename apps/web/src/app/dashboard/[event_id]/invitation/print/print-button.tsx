"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined") window.print();
      }}
      className="btn-accent text-[12px]"
    >
      🖨 Print
    </button>
  );
}
