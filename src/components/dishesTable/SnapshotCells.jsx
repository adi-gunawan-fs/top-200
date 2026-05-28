import { INLINE_SNAPSHOT_COLUMNS, formatSnapshotValue } from "./constants";

function SnapshotValue({ col, value }) {
  const formatted = formatSnapshotValue(value, col.pct);
  if (formatted === null) return <span className="text-slate-400">—</span>;
  return formatted;
}

// Renders the inline snapshot <td> cells for a single snapshot row (or a placeholder/error/empty state).
// `snapshot` is the snapshot row object, or null when rendering a placeholder.
// `placeholder` is one of: "noAfter", "error", "loading", "empty", or null (real snapshot).
export function SnapshotCells({ snapshot, placeholder, errorMessage, stickyBg }) {
  const stickyStyle = { left: "420px" };

  const renderTypeSeparator = () => (
    <span aria-hidden="true" className="type-sticky-shadow pointer-events-none absolute right-[-18px] w-[18px]" style={{ top: "-1px", bottom: "-1px" }} />
  );

  const placeholderContent = (() => {
    if (placeholder === "noAfter") return { text: "-", cls: "text-slate-400" };
    if (placeholder === "error") return { text: errorMessage, cls: "text-rose-500 text-xs" };
    if (placeholder === "loading") return { text: "", cls: "" };
    if (placeholder === "empty") return { text: "No snapshots", cls: "text-slate-400 text-xs" };
    return null;
  })();

  if (placeholderContent) {
    return INLINE_SNAPSHOT_COLUMNS.map((col) => {
      if (col.key === "type") {
        return (
          <td
            key={col.key}
            className={`type-sticky-cell sticky z-[5] px-3 py-2 align-top relative ${stickyBg ?? "bg-white"} ${placeholderContent.cls}`}
            style={stickyStyle}
          >
            {placeholderContent.text}
            {renderTypeSeparator()}
          </td>
        );
      }
      return <td key={col.key} className={`px-3 py-2 align-top ${placeholderContent.cls}`} />;
    });
  }

  return INLINE_SNAPSHOT_COLUMNS.map((col) => {
    if (col.key === "type") {
      const createdAt = snapshot?.createdAt;
      return (
        <td
          key={col.key}
          className={`type-sticky-cell sticky z-[5] px-3 py-2 align-top whitespace-nowrap relative ${stickyBg ?? "bg-white"}`}
          style={stickyStyle}
        >
          <div className="flex flex-col">
            <span className="text-xs text-slate-700">
              <SnapshotValue col={col} value={snapshot[col.key]} />
            </span>
            {createdAt ? (
              <span className="text-[10px] text-slate-500">{new Date(createdAt).toLocaleString()}</span>
            ) : null}
          </div>
          {renderTypeSeparator()}
        </td>
      );
    }
    return (
      <td key={col.key} className={`px-3 py-2 text-xs text-slate-700 align-top${col.nowrap ? " whitespace-nowrap" : col.narrow ? " w-40" : ""}`}>
        <SnapshotValue col={col} value={snapshot[col.key]} />
      </td>
    );
  });
}
