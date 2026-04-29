import { Badge } from "./Badge";

const STATUS_TONE = {
  new: "success",
  updated: "warning",
  deleted: "danger",
  unchanged: "neutral",
};

export function rowStyles(status) {
  if (status === "new") return "bg-emerald-50/40";
  if (status === "updated") return "bg-amber-50/50";
  if (status === "deleted") return "bg-rose-50/40";
  return "bg-white";
}

export function StatusPill({ status }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}
