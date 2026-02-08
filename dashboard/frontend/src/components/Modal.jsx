import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/useFocusTrap";

const SIZES = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-6xl",
};

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = "md",
  className,
}) {
  const overlayRef = useRef(null);
  const contentRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Focus trap to keep keyboard navigation within modal
  const focusTrapRef = useFocusTrap(isOpen);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement;

    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  // Merge refs - both contentRef and focusTrapRef need to reference the same element
  const mergedRef = (node) => {
    contentRef.current = node;
    focusTrapRef.current = node;
  };

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 md:p-8 animate-in fade-in duration-150"
    >
      <div
        ref={mergedRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        aria-describedby={subtitle ? "modal-subtitle" : undefined}
        className={cn(
          "bg-card rounded-lg border border-border w-full max-h-[90vh] overflow-hidden flex flex-col",
          "animate-in zoom-in-95 duration-150",
          SIZES[size],
          className
        )}
      >
        {(title || subtitle) && (
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <div>
              {title && (
                <h3 id="modal-title" className="text-base font-semibold">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p id="modal-subtitle" className="text-sm text-muted-foreground mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-xl px-2 transition-colors rounded-md hover:bg-muted"
              aria-label="Close modal"
            >
              &#x2715;
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
