import { Badge } from "./Badge";
import { KpiTile } from "./KpiTile";

function Counts({ deleted, added, updated }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge tone="danger" uppercase={false}>Deleted: {deleted}</Badge>
      <Badge tone="success" uppercase={false}>New: {added}</Badge>
      <Badge tone="info" uppercase={false}>Updated: {updated}</Badge>
    </div>
  );
}

export function SummaryTriple({ label, deleted, added, updated, bare = false }) {
  if (bare || !label) {
    return <Counts deleted={deleted} added={added} updated={updated} />;
  }
  return (
    <KpiTile label={label}>
      <Counts deleted={deleted} added={added} updated={updated} />
    </KpiTile>
  );
}
