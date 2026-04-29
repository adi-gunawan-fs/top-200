const TONE_CLASSES = {
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  ai: "border-violet-200 bg-violet-50 text-violet-700",
};

const SIZE_CLASSES = {
  xs: "px-1.5 py-0.5 text-[10px]",
  sm: "px-1.5 py-0.5 text-[11px]",
};

export function Badge({
  tone = "neutral",
  size = "xs",
  uppercase = true,
  className = "",
  children,
}) {
  const toneClasses = TONE_CLASSES[tone] ?? TONE_CLASSES.neutral;
  const sizeClasses = SIZE_CLASSES[size] ?? SIZE_CLASSES.xs;
  const caseClasses = uppercase ? "uppercase tracking-wide" : "";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border font-semibold ${sizeClasses} ${toneClasses} ${caseClasses} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
