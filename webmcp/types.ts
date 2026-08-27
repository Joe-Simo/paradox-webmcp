export type WebMCPTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: unknown, options?: { signal?: AbortSignal }) => Promise<string>;
};

export type RegisteredWebMCPTool = { name: string; description: string };

export type ModelContext = EventTarget & {
  registerTool(tool: WebMCPTool, options?: { signal?: AbortSignal }): Promise<void>;
  getTools(): Promise<RegisteredWebMCPTool[]>;
  executeTool(tool: RegisteredWebMCPTool, input?: object, options?: { signal?: AbortSignal }): Promise<string>;
};

declare global {
  interface Document {
    readonly modelContext?: ModelContext;
  }
}
