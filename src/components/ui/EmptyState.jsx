import { Card } from "./Card";

export function EmptyState({ message, tone = "neutral", className = "" }) {
  const toneClasses = tone === "danger"
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : "border-slate-200 bg-white text-slate-500";

  return (
    <Card className={`${toneClasses} ${className}`.trim()}>
      <p className="p-4 text-xs">{message}</p>
    </Card>
  );
}
