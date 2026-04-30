import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "./Button";

const SIZE_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-xl",
  xl: "max-w-2xl",
};

export function Drawer({
  open = true,
  onClose,
  size = "md",
  title,
  subtitle,
  children,
  footer,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}) {
  const panelRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!open) {
      setMounted(false);
      return undefined;
    }

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const raf = window.requestAnimationFrame(() => setMounted(true));

    const focusable = panelRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    const handleKey = (e) => {
      if (e.key === "Escape" && closeOnEscape) {
        onClose?.();
        return;
      }

      if (e.key === "Tab" && focusable?.length) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      window.cancelAnimationFrame(raf);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose, closeOnEscape]);

  if (!open) return null;

  const sizeClasses = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 transition-colors duration-200 ${mounted ? "bg-slate-900/40" : "bg-slate-900/0"}`}
      onClick={() => closeOnOverlayClick && onClose?.()}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={panelRef}
        className={`fixed inset-y-0 right-0 flex h-full w-full ${sizeClasses} flex-col overflow-hidden border-l border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-out ${mounted ? "translate-x-0" : "translate-x-full"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || subtitle || onClose) && (
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              {title ? <p className="truncate text-xs font-semibold text-slate-900">{title}</p> : null}
              {subtitle ? <p className="text-[10px] text-slate-500">{subtitle}</p> : null}
            </div>
            {onClose ? (
              <IconButton onClick={onClose} aria-label="Close" className="ml-4">
                <X className="h-3.5 w-3.5" />
              </IconButton>
            ) : null}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">{children}</div>

        {footer ? (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
