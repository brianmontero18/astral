export interface McpToolCallResult {
  content: Array<
    | {
        type: "text";
        text: string;
      }
    | {
        type: "resource";
        resource: {
          uri: string;
          mimeType: string;
          text?: string;
          blob?: string;
        };
      }
  >;
  structuredContent?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}

export class McpToolCallError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
  }
}
