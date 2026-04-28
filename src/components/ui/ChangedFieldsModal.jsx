import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ChangeTypeBadge } from "./ChangeTypeBadge";

function formatValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getCharacterCount(value) {
  return formatValue(value).length;
}

function isStructuredValue(value) {
  return value !== null && typeof value === "object";
}

function renderDiffValue(value, toneClass) {
  if (value === null || value === undefined) {
    return <p className={`text-[11px] italic ${toneClass} opacity-40`}>empty</p>;
  }
  if (isStructuredValue(value)) {
    return (
      <pre className={`whitespace-pre-wrap break-words bg-transparent p-0 text-[11px] ${toneClass}`}>
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <p className={`break-words text-[11px] ${toneClass}`}>{formatValue(value)}</p>;
}

export function ChangedFieldsModal({ item, fields, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const focusable = panelRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    const handleKey = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && focusable?.length) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const label = item.type === "dish" ? (item.name || "-") : (item.title || "-");

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-xs font-semibold text-slate-900">{label}</p>
            <p className="text-[10px] text-slate-500">
              ID {item.id} · {fields.length} field{fields.length !== 1 ? "s" : ""} changed
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Field cards */}
        <div className="flex flex-col gap-3 overflow-y-auto p-4">
          {fields.map((field) => {
            const beforeCount = getCharacterCount(field.beforeValue);
            const afterCount = getCharacterCount(field.afterValue);
            return (
              <div key={field.path} className="rounded-md border border-slate-200 bg-white">
                {/* Field meta row */}
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
                  <span className="text-xs font-semibold text-slate-800 break-all">{field.path}</span>
                  <ChangeTypeBadge type={field.changeType} />
                </div>

                {/* Before / After */}
                <div className="grid grid-cols-2 gap-0">
                  <div className="p-3">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-rose-600">
                      Before
                      <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400">
                        {beforeCount} chars
                      </span>
                    </p>
                    <div className="rounded border border-rose-200 bg-rose-50 p-2">
                      {renderDiffValue(field.beforeValue, "text-rose-700")}
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                      After
                      <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400">
                        {afterCount} chars
                      </span>
                    </p>
                    <div className="rounded border border-emerald-200 bg-emerald-50 p-2">
                      {renderDiffValue(field.afterValue, "text-emerald-700")}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
