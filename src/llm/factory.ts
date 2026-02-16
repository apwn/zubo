import type { ZuboConfig, ProviderConfig } from "../config/schema";
import type { LlmProvider } from "./provider";
import { ClaudeProvider } from "./claude";
import { ClaudeCodeProvider } from "./claude-code";
import { CodexProvider } from "./codex";
import { OpenAICompatProvider } from "./openai-compat";
import { FailoverProvider } from "./failover";
import { SmartRouterProvider } from "./smart-router";
import { logger } from "../util/logger";

/**
 * Query Ollama's /api/show endpoint to get the actual context window for a model.
 * Returns the detected context length, or null if unavailable.
 */
export async function detectOllamaContextWindow(
  model: string,
  baseUrl: string = "http://localhost:11434"
): Promise<number | null> {
  try {
    const res = await fetch(`${baseUrl}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: model }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;

    // Ollama returns model parameters with num_ctx or context_length
    const params = data.model_info ?? data.details ?? {};
    for (const [key, val] of Object.entries(params)) {
      if (
        (key.includes("context_length") || key === "num_ctx") &&
        typeof val === "number" &&
        val > 0
      ) {
        return val;
      }
    }

    // Also check modelfile parameters
    const modelfile = data.parameters ?? "";
    const match = typeof modelfile === "string" && modelfile.match(/num_ctx\s+(\d+)/);
    if (match) return parseInt(match[1], 10);

    return null;
  } catch {
    return null;
  }
}

const KNOWN_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  together: "https://api.together.xyz/v1",
  openrouter: "https://openrouter.ai/api/v1",
  deepseek: "https://api.deepseek.com/v1",
  fireworks: "https://api.fireworks.ai/inference/v1",
  cerebras: "https://api.cerebras.ai/v1",
  perplexity: "https://api.perplexity.ai",
  xai: "https://api.x.ai/v1",
  minimax: "https://api.minimax.io/v1",
  ollama: "http://localhost:11434/v1",
  lmstudio: "http://localhost:1234/v1",
};

function buildSingleProvider(
  name: string,
  providerCfg: ProviderConfig
): LlmProvider {
  const baseUrl = providerCfg.baseUrl ?? KNOWN_BASE_URLS[name];

  if (name === "anthropic") {
    if (!providerCfg.apiKey) {
      throw new Error("Anthropic provider requires an apiKey");
    }
    const provider = new ClaudeProvider(providerCfg.apiKey, providerCfg.model);
    if (providerCfg.contextWindow) provider.contextWindow = providerCfg.contextWindow;
    return provider;
  }

  if (name === "claude-code") {
    const provider = new ClaudeCodeProvider(providerCfg.model);
    if (providerCfg.contextWindow) provider.contextWindow = providerCfg.contextWindow;
    return provider;
  }

  if (name === "codex") {
    const provider = new CodexProvider(providerCfg.model);
    if (providerCfg.contextWindow) provider.contextWindow = providerCfg.contextWindow;
    return provider;
  }

  // Everything else goes through OpenAI-compatible
  if (!baseUrl) {
    throw new Error(
      `Provider "${name}" requires a baseUrl. Known providers: ${Object.keys(KNOWN_BASE_URLS).join(", ")}`
    );
  }

  return new OpenAICompatProvider({
    name,
    baseUrl,
    apiKey: providerCfg.apiKey ?? "no-key",
    model: providerCfg.model,
    streaming: providerCfg.streaming,
    contextWindow: providerCfg.contextWindow,
  });
}

export async function createProvider(config: ZuboConfig): Promise<LlmProvider> {
  // New multi-provider config
  if (config.providers && config.activeProvider) {
    const activeCfg = config.providers[config.activeProvider];
    if (!activeCfg) {
      throw new Error(
        `Active provider "${config.activeProvider}" not found in providers config`
      );
    }

    const primary = buildSingleProvider(config.activeProvider, activeCfg);

    // Auto-detect context window for local providers if not explicitly set
    if (!activeCfg.contextWindow && (config.activeProvider === "ollama" || config.activeProvider === "lmstudio")) {
      const ollamaBase = activeCfg.baseUrl?.replace(/\/v1\/?$/, "") ?? "http://localhost:11434";
      const detected = await detectOllamaContextWindow(activeCfg.model, ollamaBase);
      if (detected) {
        primary.contextWindow = detected;
        logger.info(`Auto-detected context window for ${activeCfg.model}: ${detected} tokens`);
      }
    }

    logger.info(`LLM provider: ${primary.providerName}/${primary.model} (context: ${primary.contextWindow})`);

    // Build failover chain
    let provider: LlmProvider = primary;
    if (config.failover?.length) {
      const fallbacks: LlmProvider[] = [];
      for (const fbName of config.failover) {
        const fbCfg = config.providers[fbName];
        if (fbCfg) {
          fallbacks.push(buildSingleProvider(fbName, fbCfg));
          logger.info(`  failover: ${fbName}/${fbCfg.model}`);
        } else {
          logger.warn(`Failover provider "${fbName}" not configured, skipping`);
        }
      }
      if (fallbacks.length) {
        provider = new FailoverProvider(primary, fallbacks);
      }
    }

    // Wrap in smart router if enabled
    if (config.smartRouting?.enabled) {
      const fastProviderName = config.smartRouting.fastProvider;
      if (fastProviderName && config.providers[fastProviderName]) {
        const fastCfg = { ...config.providers[fastProviderName] };
        if (config.smartRouting.fastModel) {
          fastCfg.model = config.smartRouting.fastModel;
        }
        const fast = buildSingleProvider(fastProviderName, fastCfg);
        logger.info(`Smart routing enabled: fast=${fast.providerName}/${fast.model}`);
        provider = new SmartRouterProvider(provider, fast, true);
      } else {
        logger.warn("Smart routing enabled but fastProvider not configured, skipping");
      }
    }

    return provider;
  }

  // Legacy config: anthropicApiKey + model at top level
  if (config.anthropicApiKey) {
    const model = config.model ?? "claude-sonnet-4-5-20250929";
    logger.info(`LLM provider: anthropic/${model} (legacy config)`);
    return new ClaudeProvider(config.anthropicApiKey, model);
  }

  throw new Error(
    "No LLM provider configured. Run 'zubo setup' or add a providers section to config.json"
  );
}

/**
 * Quick connectivity check — sends a minimal request to verify the API key works.
 * Returns null on success, or a friendly error message on failure.
 */
export async function validateProvider(provider: LlmProvider): Promise<string | null> {
  try {
    await provider.chat({
      system: "Respond with OK.",
      messages: [{ role: "user", content: "Say OK" }],
      maxTokens: 8,
    });
    return null;
  } catch (err: any) {
    const msg = err.message ?? String(err);
    if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("invalid")) {
      return `API key is invalid. Double-check your key for ${provider.providerName}.`;
    }
    if (msg.includes("404") || msg.includes("not found")) {
      return `Model "${provider.model}" not found on ${provider.providerName}. Check the model name.`;
    }
    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed") || msg.includes("Connection refused")) {
      return `Cannot reach ${provider.providerName}. Make sure the server is running.`;
    }
    return `${provider.providerName} test failed: ${msg}`;
  }
}
