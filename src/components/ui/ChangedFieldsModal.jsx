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

// Simple LCS-based word diff. Returns array of {text, type: "equal"|"removed"|"added"}
function computeWordDiff(before, after) {
  const tokenize = (str) => str.match(/\S+|\s+/g) || [];
  const a = tokenize(before);
  const b = tokenize(after);

  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const result = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j]) {
      result.push({ text: a[i], type: "equal" });
      i++; j++;
    } else if (j < n && (i >= m || dp[i][j + 1] >= dp[i + 1][j])) {
      result.push({ text: b[j], type: "added" });
      j++;
    } else {
      result.push({ text: a[i], type: "removed" });
      i++;
    }
  }
  return result;
}

function DiffText({ text, side, otherText, toneClass }) {
  const hasChange = text !== otherText && otherText !== null && otherText !== undefined;
  if (!hasChange) {
    return <span className={toneClass}>{text}</span>;
  }

  const beforeStr = side === "before" ? text : otherText;
  const afterStr = side === "after" ? text : otherText;
  const diff = computeWordDiff(beforeStr, afterStr);
  const relevant = side === "before" ? "removed" : "added";

  return (
    <>
      {diff.map((part, idx) =>
        part.type === relevant ? (
          <mark key={idx} className="bg-yellow-300 font-bold rounded-sm px-0.5">{part.text}</mark>
        ) : part.type === "equal" ? (
          <span key={idx} className={toneClass}>{part.text}</span>
        ) : null
      )}
    </>
  );
}

const TEXT_ONLY_FIELDS = new Set(["addons", "nutritions", "allergens", "diets", "miscInfo"]);

function cleanText(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractFieldText(path, value) {
  const root = (path ?? "").split(/[.[]/)[0];
  if (!TEXT_ONLY_FIELDS.has(root)) return value;
  if (Array.isArray(value)) {
    const texts = value.map((item) => (item && typeof item === "object" ? item.text ?? item.innerText ?? null : item)).filter((t) => t != null);
    const joined = texts.length === 1 ? texts[0] : texts.length > 1 ? texts.join(" ") : null;
    return cleanText(joined);
  }
  if (value && typeof value === "object") return cleanText(value.text ?? value.innerText ?? null);
  return cleanText(value);
}

function renderDiffValue(value, toneClass, otherValue, side, path) {
  if (value === null || value === undefined) {
    return <p className={`text-[11px] italic ${toneClass} opacity-40`}>empty</p>;
  }
  const simplify = (v) => extractFieldText(path, v);
  const stringify = (v) => JSON.stringify(v, null, 2).replace(/\\n/g, "\n");
  const coerce = (v) => { const s = simplify(v); return isStructuredValue(s) ? stringify(s) : formatValue(s); };
  const str = coerce(value);
  const otherStr = otherValue === null || otherValue === undefined ? null : coerce(otherValue);

  const display = (s) => s.replace(/\n/g, " ");

  if (isStructuredValue(simplify(value))) {
    return (
      <pre className={`whitespace-pre-wrap break-words bg-transparent p-0 text-[11px] ${toneClass}`}>
        <DiffText text={str} side={side} otherText={otherStr} toneClass={toneClass} />
      </pre>
    );
  }
  return (
    <p className={`break-words text-[11px] ${toneClass}`}>
      <DiffText text={display(str)} side={side} otherText={otherStr ? display(otherStr) : otherStr} toneClass={toneClass} />
    </p>
  );
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
                    {renderDiffValue(field.beforeValue, "text-rose-700", field.afterValue, "before", field.path)}
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
                    {renderDiffValue(field.afterValue, "text-emerald-700", field.beforeValue, "after", field.path)}
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
