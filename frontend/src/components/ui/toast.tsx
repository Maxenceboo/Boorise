import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ToastContext, type Toast } from "@/components/ui/toast-context";

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-3), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((entry) => entry.id !== id));
    }, toast.kind === "error" ? 6500 : 4200);
  }, []);

  const value = useMemo(() => ({
    show,
    success: (message: string, title = "Action effectuee") => show({ kind: "success", title, message }),
    error: (message: string, title = "Action impossible") => show({ kind: "error", title, message }),
    warning: (message: string, title = "Attention") => show({ kind: "warning", title, message }),
    info: (message: string, title = "Information") => show({ kind: "info", title, message }),
  }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div className={cn("toast", `toast-${toast.kind}`)} key={toast.id}>
            <div>
              {toast.title ? <strong>{toast.title}</strong> : null}
              <p>{toast.message}</p>
            </div>
            <button type="button" aria-label="Fermer la notification" onClick={() => setToasts((current) => current.filter((entry) => entry.id !== toast.id))}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
