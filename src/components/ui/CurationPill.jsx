import { Badge } from "./Badge";

export function CurationPill({ required }) {
  if (required) return <Badge tone="info">Require Curation</Badge>;
  return <Badge tone="neutral">No Curation</Badge>;
}
