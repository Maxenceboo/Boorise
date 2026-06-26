import { createContext, useContext } from "react";

export type ToastKind = "info" | "success" | "error" | "warning";
export type Toast = {
  id: number;
  kind: ToastKind;
  title?: string;
  message: string;
};

export type ToastApi = {
  show: (toast: Omit<Toast, "id">) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
};

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
