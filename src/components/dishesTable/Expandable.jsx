import { useState } from "react";

const TRUNCATE_LIMIT = 200;

export function ExpandableText({ text }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return <span className="text-slate-400">—</span>;
  const isLong = text.length > TRUNCATE_LIMIT;
  if (!isLong) return <span className="break-words text-slate-700">{text}</span>;
  return (
    <span className="break-words text-slate-700">
      {expanded ? text : `${text.slice(0, TRUNCATE_LIMIT).trimEnd()}… `}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="ml-1 text-blue-700 hover:text-blue-900 hover:underline focus:outline-none"
      >
        {expanded ? "See less" : "See more"}
      </button>
    </span>
  );
}

export function ExpandableJson({ data }) {
  const [expanded, setExpanded] = useState(false);
  if (!data) return <span className="text-slate-400">—</span>;
  const jsonStr = JSON.stringify(data, null, 2);
  const isLong = jsonStr.length > TRUNCATE_LIMIT;
  if (!isLong) return <pre className="whitespace-pre-wrap break-words text-xs text-slate-700 bg-transparent p-0">{jsonStr}</pre>;
  return (
    <div className="text-slate-700">
      <pre className={`whitespace-pre-wrap break-words text-xs bg-transparent p-0 ${expanded ? "" : "line-clamp-3"}`}>{jsonStr}</pre>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="ml-1 text-xs text-blue-700 hover:text-blue-900 hover:underline focus:outline-none"
      >
        {expanded ? "See less" : "See more"}
      </button>
    </div>
  );
}
