import type { ZuboConfig, ProviderConfig } from "../config/schema";
import type { LlmProvider } from "./provider";
import { ClaudeProvider } from "./claude";
import { ClaudeCodeProvider } from "./claude-code";
import { CodexProvider } from "./codex";
import { OpenAICompatProvider } from "./openai-compat";
import { FailoverProvider } from "./failover";
import { SmartRouterProvider } from "./smart-router";
import { logger } from "../util/logger";

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

export function createProvider(config: ZuboConfig): LlmProvider {
  // New multi-provider config
  if (config.providers && config.activeProvider) {
    const activeCfg = config.providers[config.activeProvider];
    if (!activeCfg) {
      throw new Error(
        `Active provider "${config.activeProvider}" not found in providers config`
      );
    }

    const primary = buildSingleProvider(config.activeProvider, activeCfg);
    logger.info(`LLM provider: ${primary.providerName}/${primary.model}`);

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
