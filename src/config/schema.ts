import { z } from "zod";

const providerConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string(),
  streaming: z.boolean().optional(),
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

  // Agent
  maxTurns: z.number().default(50),
  createdAt: z.string().default(() => new Date().toISOString()),
});

export type OrbaConfig = z.infer<typeof configSchema>;
