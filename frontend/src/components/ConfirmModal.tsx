import { useEffect } from "react";

interface Props {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="confirm-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="confirm-modal-card animate-fade-in">
        <h3 id="confirm-modal-title" className="confirm-modal-title">
          {title}
        </h3>
        <p className="confirm-modal-body">{body}</p>
        <div className="confirm-modal-actions">
          <button
            type="button"
            onClick={onCancel}
            className="astral-auth-secondary chat-edit-action"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              destructive
                ? "confirm-modal-destructive chat-edit-action"
                : "astral-auth-primary chat-edit-action"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
