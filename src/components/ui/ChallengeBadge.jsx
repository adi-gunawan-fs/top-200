export function ChallengeBadge({ challenge }) {
  if (challenge === "Hard") {
    return <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">Hard</span>;
  }
  if (challenge === "Easy") {
    return <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Easy</span>;
  }
  return <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Not Relevant</span>;
}

export function challengeCell(item) {
  if (!item?.requiresCuration) {
    return <span className="text-slate-400">-</span>;
  }
  return <ChallengeBadge challenge={item.challenge ?? "Easy"} />;
}
