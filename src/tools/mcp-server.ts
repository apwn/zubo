import { getAllTools } from "./registry";
import { logger } from "../util/logger";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/**
 * Run Zubo as an MCP server over stdio.
 * Claude Code / Codex can spawn `zubo mcp-serve` and communicate via JSON-RPC 2.0.
 */
export async function startMcpServer(): Promise<void> {
  const serverInfo = {
    name: "zubo",
    version: "0.1.7",
  };

  let buffer = "";

  function send(response: JsonRpcResponse): void {
    const json = JSON.stringify(response);
    const data = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;
    process.stdout.write(data);
  }

  function sendResult(id: number | string | undefined, result: unknown): void {
    if (id === undefined) return; // notification, no response needed
    send({ jsonrpc: "2.0", id, result });
  }

  function sendError(id: number | string | undefined, code: number, message: string): void {
    if (id === undefined) return;
    send({ jsonrpc: "2.0", id, error: { code, message } });
  }

  async function handleRequest(req: JsonRpcRequest): Promise<void> {
    const { id, method, params } = req;

    switch (method) {
      case "initialize": {
        sendResult(id, {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: { listChanged: false },
          },
          serverInfo,
        });
        break;
      }

      case "notifications/initialized": {
        // Notification -- no response
        break;
      }

      case "tools/list": {
        const toolMap = getAllTools();
        const toolDefs = Array.from(toolMap.values()).map(t => ({
          name: t.definition.name,
          description: t.definition.description,
          inputSchema: t.definition.input_schema,
        }));
        sendResult(id, { tools: toolDefs });
        break;
      }

      case "tools/call": {
        const toolName = params?.name as string;
        const toolArgs = (params?.arguments ?? {}) as Record<string, unknown>;

        const toolMap = getAllTools();
        const tool = toolMap.get(toolName);

        if (!tool) {
          sendResult(id, {
            content: [{ type: "text", text: `Tool "${toolName}" not found` }],
            isError: true,
          });
          break;
        }

        try {
          const result = await tool.execute(toolArgs);
          sendResult(id, {
            content: [{ type: "text", text: result }],
          });
        } catch (err: any) {
          sendResult(id, {
            content: [{ type: "text", text: `Tool error: ${err.message}` }],
            isError: true,
          });
        }
        break;
      }

      default: {
        sendError(id, -32601, `Method not found: ${method}`);
      }
    }
  }

  async function processBuffer(): Promise<void> {
    while (true) {
      // Try Content-Length header framing
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        // Try newline-delimited JSON fallback
        const nlIdx = buffer.indexOf("\n");
        if (nlIdx === -1) break;
        const line = buffer.slice(0, nlIdx).trim();
        buffer = buffer.slice(nlIdx + 1);
        if (line.startsWith("{")) {
          try {
            const req = JSON.parse(line) as JsonRpcRequest;
            await handleRequest(req);
          } catch (err) {
            logger.debug("Failed to parse JSON-RPC line", { error: String(err) });
          }
        }
        continue;
      }

      const header = buffer.slice(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + contentLength) break;

      const body = buffer.slice(bodyStart, bodyStart + contentLength);
      buffer = buffer.slice(bodyStart + contentLength);

      try {
        const req = JSON.parse(body) as JsonRpcRequest;
        await handleRequest(req);
      } catch (err) {
        logger.debug("Failed to parse JSON-RPC message", { error: String(err) });
      }
    }
  }

  logger.info("Zubo MCP server starting on stdio");

  // Read from stdin
  const reader = Bun.stdin.stream().getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value);
      await processBuffer();
    }
  } catch {
    // stdin closed
  } finally {
    try { reader.releaseLock(); } catch {}
  }

  logger.info("Zubo MCP server stopped");
}
