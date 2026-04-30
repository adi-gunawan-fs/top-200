import { Badge } from "./Badge";

export function ChangeTypeBadge({ type }) {
  if (type === "Relevant") return <Badge tone="danger" uppercase={false}>Relevant</Badge>;
  return <Badge tone="neutral" uppercase={false}>Not Relevant</Badge>;
}

export function ChangeTypeCounts({ counts }) {
  const safeCounts = counts ?? { Relevant: 0, "Not Relevant": 0 };

  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge tone="danger" uppercase={false}>Relevant: {safeCounts.Relevant ?? 0}</Badge>
      <Badge tone="neutral" uppercase={false}>Not Relevant: {safeCounts["Not Relevant"] ?? 0}</Badge>
    </div>
  );
}
