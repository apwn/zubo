import { logger } from "../util/logger";
import { registerTool, unregisterTool } from "./registry";
import type { LlmToolDef } from "../llm/provider";

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

export class McpClient {
  private process: ReturnType<typeof Bun.spawn> | null = null;
  private requestId = 0;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private buffer = "";
  private connected = false;
  private registeredTools: string[] = [];

  constructor(private config: McpServerConfig) {}

  async connect(): Promise<void> {
    const args = this.config.args ?? [];
    const env = {
      ...process.env,
      ...(this.config.env ?? {}),
    };

    this.process = Bun.spawn([this.config.command, ...args], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env,
    });

    // Read stdout for JSON-RPC responses
    this.readStream();

    // Read stderr for logging
    this.readStderr();

    // Initialize
    try {
      const initResult = await this.sendRequest("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "zubo", version: "1.0.0" },
      });

      logger.info(`MCP server "${this.config.name}" initialized`, {
        serverInfo: initResult?.serverInfo,
      });

      // Send initialized notification (no id = notification)
      this.sendNotification("notifications/initialized", {});
    } catch (err: any) {
      logger.error(`Failed to initialize MCP server "${this.config.name}"`, { error: err.message });
      this.disconnect();
      throw err;
    }

    this.connected = true;
  }

  async listTools(): Promise<McpTool[]> {
    const result = await this.sendRequest("tools/list", {});
    return (result?.tools ?? []) as McpTool[];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = await this.sendRequest("tools/call", { name, arguments: args });

    if (result?.isError) {
      const text = result.content?.map((c: any) => c.text ?? "").join("\n") || "Tool execution failed";
      throw new Error(text);
    }

    // Concatenate text content
    const content = result?.content ?? [];
    return content
      .map((c: any) => {
        if (c.type === "text") return c.text ?? "";
        if (c.type === "image") return `[Image: ${c.mimeType ?? "image/png"}]`;
        return JSON.stringify(c);
      })
      .join("\n");
  }

  /**
   * Discover tools from the MCP server and register them in Zubo's tool registry.
   */
  async registerTools(): Promise<string[]> {
    const tools = await this.listTools();
    const registered: string[] = [];

    for (const tool of tools) {
      const zuboName = `${this.config.name}__${tool.name}`;

      const definition: LlmToolDef = {
        name: zuboName,
        description: `[MCP: ${this.config.name}] ${tool.description ?? tool.name}`,
        input_schema: tool.inputSchema ?? { type: "object", properties: {}, required: [] },
      };

      const mcpToolName = tool.name;
      const client = this;

      registerTool({
        definition,
        execute: async (input) => {
          try {
            return await client.callTool(mcpToolName, input);
          } catch (err: any) {
            return JSON.stringify({ error: err.message, is_error: true });
          }
        },
      });

      this.registeredTools.push(zuboName);
      registered.push(zuboName);
    }

    logger.info(`MCP "${this.config.name}": registered ${registered.length} tools`, {
      tools: registered,
    });

    return registered;
  }

  async disconnect(): Promise<void> {
    // Unregister tools
    for (const name of this.registeredTools) {
      unregisterTool(name);
    }
    this.registeredTools = [];

    // Reject pending requests
    for (const [, pending] of this.pending) {
      pending.reject(new Error("MCP client disconnecting"));
    }
    this.pending.clear();

    // Kill process
    if (this.process) {
      try {
        if (this.process.stdin && typeof this.process.stdin !== "number") {
          this.process.stdin.end();
        }
        this.process.kill();
      } catch {}
      this.process = null;
    }

    this.connected = false;
    logger.info(`MCP server "${this.config.name}" disconnected`);
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async sendRequest(method: string, params: Record<string, unknown>): Promise<any> {
    const id = ++this.requestId;
    const message: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request "${method}" timed out after 30s`));
      }, 30000);

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });

      this.writeMessage(message);
    });
  }

  private sendNotification(method: string, params: Record<string, unknown>): void {
    const message: JsonRpcRequest = {
      jsonrpc: "2.0",
      method,
      params,
    };
    this.writeMessage(message);
  }

  private writeMessage(message: JsonRpcRequest): void {
    if (!this.process?.stdin || typeof this.process.stdin === "number") {
      throw new Error("MCP process not running");
    }
    const json = JSON.stringify(message);
    const data = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;
    this.process.stdin.write(data);
  }

  private async readStream(): Promise<void> {
    if (!this.process?.stdout || typeof this.process.stdout === "number") return;

    const reader = this.process.stdout.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        this.buffer += new TextDecoder().decode(value);
        this.processBuffer();
      }
    } catch {
      // Stream closed
    }

    // Process exited — mark as disconnected
    if (this.connected) {
      this.connected = false;
      logger.warn(`MCP server "${this.config.name}" process exited`);

      // Unregister tools
      for (const name of this.registeredTools) {
        unregisterTool(name);
      }
      this.registeredTools = [];
    }
  }

  private async readStderr(): Promise<void> {
    if (!this.process?.stderr || typeof this.process.stderr === "number") return;

    try {
      const text = await new Response(this.process.stderr as ReadableStream).text();
      if (text.trim()) {
        logger.debug(`MCP "${this.config.name}" stderr: ${text.slice(0, 500)}`);
      }
    } catch {
      // ignore
    }
  }

  private processBuffer(): void {
    while (true) {
      // Try to parse Content-Length header
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        // Try without headers (some servers just send raw JSON lines)
        const newlineIdx = this.buffer.indexOf("\n");
        if (newlineIdx === -1) break;

        const line = this.buffer.slice(0, newlineIdx).trim();
        this.buffer = this.buffer.slice(newlineIdx + 1);

        if (line.startsWith("{")) {
          try {
            const msg = JSON.parse(line) as JsonRpcResponse;
            this.handleResponse(msg);
          } catch {
            // Not valid JSON, skip
          }
        }
        continue;
      }

      const header = this.buffer.slice(0, headerEnd);
      const contentLengthMatch = header.match(/Content-Length:\s*(\d+)/i);

      if (!contentLengthMatch) {
        // Skip malformed header
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(contentLengthMatch[1], 10);
      const bodyStart = headerEnd + 4;

      if (this.buffer.length < bodyStart + contentLength) {
        break; // Need more data
      }

      const body = this.buffer.slice(bodyStart, bodyStart + contentLength);
      this.buffer = this.buffer.slice(bodyStart + contentLength);

      try {
        const msg = JSON.parse(body) as JsonRpcResponse;
        this.handleResponse(msg);
      } catch {
        logger.warn(`MCP "${this.config.name}": failed to parse response`);
      }
    }
  }

  private handleResponse(msg: JsonRpcResponse): void {
    if (msg.id === undefined || msg.id === null) {
      // Notification from server — log and ignore
      return;
    }

    const pending = this.pending.get(msg.id);
    if (!pending) return;

    this.pending.delete(msg.id);

    if (msg.error) {
      pending.reject(new Error(`MCP error: ${msg.error.message} (code: ${msg.error.code})`));
    } else {
      pending.resolve(msg.result);
    }
  }
}

// --- Global MCP management ---

const mcpClients = new Map<string, McpClient>();

/**
 * Initialize all configured MCP servers and register their tools.
 */
export async function initMcpServers(
  configs: McpServerConfig[]
): Promise<void> {
  for (const config of configs) {
    if (config.enabled === false) continue;

    const client = new McpClient(config);

    try {
      await client.connect();
      await client.registerTools();
      mcpClients.set(config.name, client);
    } catch (err: any) {
      logger.error(`Failed to start MCP server "${config.name}"`, { error: err.message });
    }
  }
}

/**
 * Disconnect all MCP servers.
 */
export async function disconnectAllMcp(): Promise<void> {
  for (const [name, client] of mcpClients) {
    try {
      await client.disconnect();
    } catch (err: any) {
      logger.warn(`Failed to disconnect MCP server "${name}"`, { error: err.message });
    }
  }
  mcpClients.clear();
}

/**
 * Get the list of active MCP connections.
 */
export function getMcpStatus(): { name: string; connected: boolean; tools: number }[] {
  return Array.from(mcpClients.entries()).map(([name, client]) => ({
    name,
    connected: client.isConnected(),
    tools: 0, // Could track this if needed
  }));
}
