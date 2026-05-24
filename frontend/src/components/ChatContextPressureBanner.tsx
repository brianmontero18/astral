import type { ChatContextPressureWarning } from "../chat-context-pressure";

interface ChatContextPressureBannerProps {
  warning: ChatContextPressureWarning;
  onDismiss: () => void;
}

export function ChatContextPressureBanner({
  warning,
  onDismiss,
}: ChatContextPressureBannerProps) {
  return (
    <div
      className={`chat-context-pressure chat-context-pressure--${warning.level} animate-fade-in`}
      role="status"
      aria-live="polite"
    >
      <div className="chat-context-pressure-copy">
        <div className="chat-context-pressure-title">{warning.title}</div>
        <div className="chat-context-pressure-body">{warning.body}</div>
      </div>
      <button
        type="button"
        className="chat-context-pressure-dismiss"
        onClick={onDismiss}
      >
        {warning.dismissLabel}
      </button>
    </div>
  );
}
