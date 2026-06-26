import type { FocusEvent } from "react";
import { useCallback, useEffect, useRef } from "react";

type AutosaveOptions = {
  enabled?: boolean;
  delayMs?: number;
};

export function useBlurAutosave<T extends HTMLElement>(
  save: (container: T) => void | Promise<void>,
  { enabled = true, delayMs = 350 }: AutosaveOptions = {},
) {
  const timeoutRef = useRef<number | undefined>(undefined);
  const saveRef = useRef(save);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  return useCallback((event: FocusEvent<T>) => {
    if (!enabled || !isEditableField(event.target)) {
      return;
    }

    const container = event.currentTarget;
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      void saveRef.current(container);
    }, delayMs);
  }, [delayMs, enabled]);
}

function isEditableField(target: EventTarget) {
  return target instanceof HTMLInputElement
    || target instanceof HTMLSelectElement
    || target instanceof HTMLTextAreaElement;
}
