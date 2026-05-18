import { useCallback, useEffect, useRef, useState } from "react";

export interface UseCopyToClipboardResult {
  copy: (text: string) => Promise<void>;
  status: "idle" | "copied" | "error";
  message: string | null;
}

// Shared clipboard helper for admin invite/reinvite buttons. Returns a
// short-lived "copied" status so call-sites can swap the button label
// without each one duplicating the timer logic. The aria-live message
// stays announceable for screen readers.
export function useCopyToClipboard(
  resetMs = 2000,
): UseCopyToClipboardResult {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const copy = useCallback(
    async (text: string) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      try {
        await navigator.clipboard.writeText(text);
        setStatus("copied");
        setMessage("Link copiado al portapapeles");
      } catch {
        setStatus("error");
        setMessage("No se pudo copiar - seleccionalo manualmente");
      }
      timeoutRef.current = setTimeout(() => {
        setStatus("idle");
        setMessage(null);
      }, resetMs);
    },
    [resetMs],
  );

  return { copy, status, message };
}
