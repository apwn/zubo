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
      apiKey: z.string().min(1),
      model: z.string().optional(),
    }).optional(),
    tts: z.object({
      provider: z.string().default("openai"),
      apiKey: z.string().min(1),
      voice: z.string().optional(),
    }).optional(),
  }).optional(),

  // Agent
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
});

export type ZuboConfig = z.infer<typeof configSchema>;
