import { z } from "zod";

const providerConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string(),
  streaming: z.boolean().optional(),
  contextWindow: z.number().optional(),
});

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

const channelsConfigSchema = z.object({
  telegram: z
    .object({
      enabled: z.boolean().default(true),
      botToken: z.string().min(1),
      allowedUsers: z.array(z.number()).default([]),
    })
    .optional(),
  discord: z
    .object({
      enabled: z.boolean().default(true),
      botToken: z.string().min(1),
      allowedUsers: z.array(z.string()).default([]),
    })
    .optional(),
  webchat: z
    .object({
      enabled: z.boolean().default(true),
      port: z.number().default(0),
    })
    .optional(),
  slack: z.object({
    enabled: z.boolean().default(true),
    botToken: z.string().min(1),
    appToken: z.string().min(1),
    allowedUsers: z.array(z.string()).default([]),
  }).optional(),
  whatsapp: z.object({
    enabled: z.boolean().default(true),
    authDir: z.string().optional(),
    allowedNumbers: z.array(z.string()).default([]),
  }).optional(),
  signal: z.object({
    enabled: z.boolean().default(true),
    phoneNumber: z.string().min(1),
    signalCliPath: z.string().optional(),
    allowedNumbers: z.array(z.string()).default([]),
  }).optional(),
  email: z.object({
    enabled: z.boolean().default(true),
    imap: z.object({
      host: z.string().min(1),
      port: z.number().default(993),
      user: z.string().min(1),
      password: z.string().min(1),
      tls: z.boolean().default(true),
    }),
    smtp: z.object({
      host: z.string().min(1),
      port: z.number().default(587),
      user: z.string().min(1),
      password: z.string().min(1),
      tls: z.boolean().default(true),
    }),
    pollIntervalSeconds: z.number().min(10).default(60),
    allowedSenders: z.array(z.string()).optional(),
    fromName: z.string().optional(),
  }).optional(),
});

export type ChannelsConfig = z.infer<typeof channelsConfigSchema>;

export const configSchema = z.object({
  // Legacy fields (still work for backward compat)
  anthropicApiKey: z.string().optional(),
  model: z.string().optional(),
  telegramBotToken: z.string().optional(),
  telegramAllowedUsers: z.array(z.number()).default([]),

  // Multi-provider system
  providers: z.record(z.string(), providerConfigSchema).optional(),
  activeProvider: z.string().optional(),
  failover: z.array(z.string()).optional(),

  // Multi-channel system
  channels: channelsConfigSchema.optional(),

  // Voice (STT/TTS)
  voice: z.object({
    stt: z.object({
      provider: z.string().default("whisper"),
      apiKey: z.string().optional(),
      model: z.string().optional(),
      // Local whisper.cpp options
      binaryPath: z.string().optional(),
      modelPath: z.string().optional(),
      language: z.string().optional(),
    }).optional(),
    tts: z.object({
      provider: z.string().default("openai"),
      apiKey: z.string().min(1),
      voice: z.string().optional(),
    }).optional(),
    // Voice conversation mode options
    conversation: z.object({
      silenceThreshold: z.number().min(500).max(5000).default(1500),
      maxRecordingMs: z.number().min(5000).max(120000).default(30000),
    }).optional(),
  }).optional(),

  // Agent
  agentName: z.string().default("Zubo"),
  maxTurns: z.number().default(50),
  heartbeatMinutes: z.number().min(1).max(1440).default(30),
  createdAt: z.string().default(() => new Date().toISOString()),

  // Rate limiting
  rateLimit: z.object({
    chatPerMinute: z.number().default(60),
    uploadPerMinute: z.number().default(10),
  }).optional(),

  // API authentication
  auth: z.object({
    enabled: z.boolean().default(false),
  }).optional(),

  // Skill sandboxing
  sandbox: z.object({
    enabled: z.boolean().default(true),
    timeoutMs: z.number().default(30_000),
  }).optional(),

  // Tool scope controls
  toolScopes: z.object({
    // If set, tools whose scopes are not included here are blocked.
    allowed: z.array(z.string()).optional(),
    // When true, confirm-gated tools default to simulation unless _dryRun is false.
    dryRunByDefault: z.boolean().default(false),
  }).optional(),

  // Tool permission overrides
  toolPermissions: z.record(z.string(), z.enum(["auto", "confirm", "deny"])).optional(),

  // Memory retrieval tuning for router context injection
  memoryRetrieval: z.object({
    contextTopK: z.number().int().min(1).max(10).default(3),
    minConfidence: z.number().min(0).max(1).default(0),
    vectorCandidateLimit: z.number().int().min(100).max(50_000).default(2000),
  }).optional(),

  // Smart model routing
  smartRouting: z.object({
    enabled: z.boolean().default(false),
    fastProvider: z.string().optional(),
    fastModel: z.string().optional(),
  }).optional(),

  // Budget controls
  budget: z.object({
    dailyLimitUsd: z.number().optional(),
    monthlyLimitUsd: z.number().optional(),
    alertThreshold: z.number().min(0).max(1).default(0.8),
  }).optional(),

  // Webhooks
  webhooks: z.object({
    secret: z.string().optional(),
  }).optional(),

  // Image generation
  imageGeneration: z.object({
    provider: z.enum(["openai", "fal", "together"]),
    apiKey: z.string().optional(),
    model: z.string().optional(),
    defaultSize: z.string().optional(),
  }).optional(),

  // Code interpreter
  codeInterpreter: z.object({
    enabled: z.boolean().default(true),
    timeout: z.number().default(30000),
    maxOutputSize: z.number().default(50000),
  }).optional(),

  // MCP servers
  mcp: z.object({
    servers: z.array(z.object({
      name: z.string().min(1),
      command: z.string().min(1),
      args: z.array(z.string()).optional(),
      env: z.record(z.string(), z.string()).optional(),
      enabled: z.boolean().default(true),
    })),
  }).optional(),

  // OAuth integrations
  oauth: z.object({
    providers: z.object({
      google: z.object({
        clientId: z.string().min(1),
        clientSecret: z.string().min(1),
        scopes: z.array(z.string()).optional(),
      }).optional(),
      notion: z.object({
        clientId: z.string().min(1),
        clientSecret: z.string().min(1),
      }).optional(),
      linear: z.object({
        clientId: z.string().min(1),
        clientSecret: z.string().min(1),
      }).optional(),
      github: z.object({
        clientId: z.string().min(1),
        clientSecret: z.string().min(1),
        scopes: z.array(z.string()).optional(),
      }).optional(),
      slack: z.object({
        clientId: z.string().min(1),
        clientSecret: z.string().min(1),
        scopes: z.array(z.string()).optional(),
      }).optional(),
    }).optional(),
  }).optional(),
});

export type ZuboConfig = z.infer<typeof configSchema>;
