export class UserOperationConflictError extends Error {
  constructor(
    public readonly code: "bodygraph_replace_in_progress" | "chat_in_flight",
  ) {
    super(code);
    this.name = "UserOperationConflictError";
  }
}

const activeGuideTurns = new Map<string, number>();
const activeBodygraphReplacements = new Set<string>();

export function beginGuideTurn(userId?: string): () => void {
  if (!userId) return () => {};
  if (activeBodygraphReplacements.has(userId)) {
    throw new UserOperationConflictError("bodygraph_replace_in_progress");
  }

  activeGuideTurns.set(userId, (activeGuideTurns.get(userId) ?? 0) + 1);
  let released = false;

  return () => {
    if (released) return;
    released = true;
    const next = (activeGuideTurns.get(userId) ?? 1) - 1;
    if (next <= 0) {
      activeGuideTurns.delete(userId);
    } else {
      activeGuideTurns.set(userId, next);
    }
  };
}

export function beginBodygraphReplace(userId: string): () => void {
  if (activeBodygraphReplacements.has(userId)) {
    throw new UserOperationConflictError("bodygraph_replace_in_progress");
  }
  if ((activeGuideTurns.get(userId) ?? 0) > 0) {
    throw new UserOperationConflictError("chat_in_flight");
  }

  activeBodygraphReplacements.add(userId);
  let released = false;

  return () => {
    if (released) return;
    released = true;
    activeBodygraphReplacements.delete(userId);
  };
}
