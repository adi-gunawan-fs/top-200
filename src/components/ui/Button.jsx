const TONE_VARIANTS = {
  neutral: {
    outline: "border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
    tonal: "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200",
    solid: "border-slate-700 bg-slate-700 text-white hover:bg-slate-800",
    ghost: "border-transparent bg-transparent text-slate-600 hover:bg-slate-100",
  },
  info: {
    outline: "border-blue-300 bg-white text-blue-700 hover:bg-blue-50",
    tonal: "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100",
    solid: "border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
    ghost: "border-transparent bg-transparent text-blue-700 hover:bg-blue-50",
  },
  success: {
    outline: "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50",
    tonal: "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    solid: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
    ghost: "border-transparent bg-transparent text-emerald-700 hover:bg-emerald-50",
  },
  warning: {
    outline: "border-amber-300 bg-white text-amber-700 hover:bg-amber-50",
    tonal: "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
    solid: "border-amber-600 bg-amber-600 text-white hover:bg-amber-700",
    ghost: "border-transparent bg-transparent text-amber-700 hover:bg-amber-50",
  },
  danger: {
    outline: "border-rose-300 bg-white text-rose-700 hover:bg-rose-50",
    tonal: "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100",
    solid: "border-rose-600 bg-rose-600 text-white hover:bg-rose-700",
    ghost: "border-transparent bg-transparent text-rose-700 hover:bg-rose-50",
  },
  ai: {
    outline: "border-violet-300 bg-white text-violet-700 hover:bg-violet-50",
    tonal: "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100",
    solid: "border-violet-600 bg-violet-600 text-white hover:bg-violet-700",
    ghost: "border-transparent bg-transparent text-violet-700 hover:bg-violet-50",
  },
};

const SIZE_CLASSES = {
  xs: "px-1.5 py-0.5 text-[10px]",
  sm: "px-2 py-1 text-xs",
  md: "px-3 py-1.5 text-xs",
  lg: "px-3 py-2 text-xs",
};

const DISABLED_CLASSES = "disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400";

const BASE_CLASSES = "inline-flex items-center justify-center gap-1 rounded-md border font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500";

export function Button({
  variant = "outline",
  tone = "neutral",
  size = "sm",
  type = "button",
  className = "",
  children,
  ...rest
}) {
  const toneClasses = TONE_VARIANTS[tone]?.[variant] ?? TONE_VARIANTS.neutral.outline;
  const sizeClasses = SIZE_CLASSES[size] ?? SIZE_CLASSES.sm;

  return (
    <button
      type={type}
      className={`${BASE_CLASSES} ${sizeClasses} ${toneClasses} ${DISABLED_CLASSES} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({
  tone = "neutral",
  size = "sm",
  type = "button",
  className = "",
  children,
  ...rest
}) {
  const sizeClasses = size === "xs"
    ? "h-5 w-5"
    : size === "md"
      ? "h-7 w-7"
      : "h-6 w-6";
  const toneClasses = TONE_VARIANTS[tone]?.outline ?? TONE_VARIANTS.neutral.outline;

  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center rounded-md border transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${sizeClasses} ${toneClasses} ${DISABLED_CLASSES} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
