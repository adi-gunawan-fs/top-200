import { ChangeTypeBadge } from "./ChangeTypeBadge";
import { Modal } from "./Modal";

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
  const label = item.type === "dish" ? (item.name || "-") : (item.title || "-");
  const subtitle = `ID ${item.id} · ${fields.length} field${fields.length !== 1 ? "s" : ""} changed`;

  return (
    <Modal title={label} subtitle={subtitle} onClose={onClose} size="md">
      <div className="flex flex-col gap-3 p-4">
        {fields.map((field) => {
          const beforeCount = getCharacterCount(field.beforeValue);
          const afterCount = getCharacterCount(field.afterValue);
          return (
            <div key={field.path} className="rounded-md border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
                <span className="text-xs font-semibold text-slate-800 break-all">{field.path}</span>
                <ChangeTypeBadge type={field.changeType} />
              </div>
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
    </Modal>
  );
}
