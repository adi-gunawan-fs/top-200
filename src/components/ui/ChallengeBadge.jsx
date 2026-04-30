import { Badge } from "./Badge";

export function ChallengeBadge({ challenge }) {
  if (challenge === "Hard") return <Badge tone="danger" uppercase={false}>Hard</Badge>;
  if (challenge === "Easy") return <Badge tone="success" uppercase={false}>Easy</Badge>;
  return <Badge tone="neutral" uppercase={false}>Not Relevant</Badge>;
}

export function challengeCell(item) {
  if (!item?.requiresCuration) {
    return <span className="text-slate-400">-</span>;
  }
  return <ChallengeBadge challenge={item.challenge ?? "Easy"} />;
}
