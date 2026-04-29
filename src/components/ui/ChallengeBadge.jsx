import { Badge } from "./Badge";

export function ChallengeBadge({ challenge }) {
  if (challenge === "Hard") return <Badge tone="danger">Hard</Badge>;
  if (challenge === "Easy") return <Badge tone="success">Easy</Badge>;
  return <Badge tone="neutral">Not Relevant</Badge>;
}

export function challengeCell(item) {
  if (!item?.requiresCuration) {
    return <span className="text-slate-400">-</span>;
  }
  return <ChallengeBadge challenge={item.challenge ?? "Easy"} />;
}
